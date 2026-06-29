import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import api from '../api/client';
import { BackButton, PageHeader, LoadingSpinner } from '../components/common';

const COLORS = ['#2563eb','#059669','#d97706','#7c3aed','#dc2626','#0891b2','#4f46e5','#c026d3','#65a30d','#f59e0b','#06b6d4','#8b5cf6'];

const REPORT_TYPES = [
  { id: 'span', label: 'Span of Control', fetch: () => api.reports.spanOfControl() },
  { id: 'department', label: 'Department Distribution', fetch: () => api.reports.departmentDistribution() },
  { id: 'matrix', label: 'Matrix Report', fetch: () => api.reports.matrixReport() },
  { id: 'location', label: 'Location Report', fetch: () => api.reports.locationReport() },
];

function exportCSV(data, filename) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(','),
    ...data.map(row => headers.map(h => `"${row[h] ?? ''}"`).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [activeReport, setActiveReport] = useState('span');
  const [data, setData] = useState([]);
  const [deptData, setDeptData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const report = REPORT_TYPES.find(r => r.id === activeReport);
    report.fetch()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeReport]);

  useEffect(() => {
    api.reports.departmentDistribution().then(setDeptData).catch(console.error);
  }, []);

  const handleExport = async (format) => {
    const exportData = await api.reports.export(activeReport === 'matrix' ? 'relationships' : 'employees');
    if (format === 'csv') exportCSV(exportData, `orms-${activeReport}-report.csv`);
    else exportJSON(exportData, `orms-${activeReport}-report.json`);
  };

  return (
    <div>
      <BackButton to="/dashboard" label="Back to Dashboard" />
      <PageHeader
        title="Reports & Analytics"
        subtitle="Data-driven insights for organizational decision making"
        action={
          <div className="flex gap-2">
            <button onClick={() => handleExport('csv')} className="btn-secondary flex items-center gap-2 text-sm">
              <FileSpreadsheet className="w-4 h-4" /> Export CSV
            </button>
            <button onClick={() => handleExport('json')} className="btn-secondary flex items-center gap-2 text-sm">
              <Download className="w-4 h-4" /> Export JSON
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar nav */}
        <div className="card lg:col-span-1 p-3">
          <nav className="space-y-1">
            {REPORT_TYPES.map(r => (
              <button
                key={r.id}
                onClick={() => setActiveReport(r.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeReport === r.id ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="lg:col-span-3 space-y-6">

          {/* ── Department Distribution Overview — horizontal bar chart ── */}
          {deptData.length > 0 && (() => {
            const barH  = 28;
            const chartH = Math.max(300, deptData.length * barH + 20);
            const labelW = Math.min(200, Math.max(100, Math.max(...deptData.map(d => (d.department || '').length)) * 6.5));
            return (
              <div className="card">
                <h3 className="font-semibold mb-4">Department Distribution Overview</h3>
                <div style={{ overflowY: 'auto', maxHeight: 420 }}>
                  <ResponsiveContainer width="100%" height={chartH}>
                    <BarChart data={deptData} layout="vertical"
                      margin={{ top: 4, right: 40, left: labelW, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="department"
                        tick={{ fontSize: 10, fill: '#374151' }}
                        width={labelW}
                        tickFormatter={v => v} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs">
                              <p className="font-semibold text-gray-800 mb-1">{label}</p>
                              <p className="text-blue-700">Employees: <strong>{payload[0].value}</strong></p>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="count" name="Employees" radius={[0, 4, 4, 0]}
                        label={{ position: 'right', fontSize: 9, fill: '#6b7280' }}>
                        {deptData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })()}

          {/* ── Active report panel ── */}
          <div className="card">
            <h3 className="font-semibold mb-4">
              {REPORT_TYPES.find(r => r.id === activeReport)?.label}
            </h3>

            {loading ? (
              <LoadingSpinner />
            ) : data.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No data available for this report</p>
            ) : activeReport === 'span' ? (() => {
                // Span of Control — horizontal bar, auto-sized label width
                const barH2  = 32;
                const chartH2 = Math.max(300, data.length * barH2 + 20);
                const labelW2 = Math.min(220, Math.max(120, Math.max(...data.map(d => (d.name || '').length)) * 6.5));
                return (
                  <div style={{ overflowY: 'auto', maxHeight: 480 }}>
                    <ResponsiveContainer width="100%" height={chartH2}>
                      <BarChart data={data} layout="vertical"
                        margin={{ top: 4, right: 50, left: labelW2, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                        <YAxis dataKey="name" type="category"
                          width={labelW2}
                          tick={{ fontSize: 10, fill: '#374151' }}
                          tickFormatter={v => v} />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            return (
                              <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs">
                                <p className="font-semibold text-gray-800 mb-1">{label}</p>
                                <p className="text-green-700">Direct Reports: <strong>{payload[0].value}</strong></p>
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="direct_reports" fill="#059669" radius={[0, 4, 4, 0]}
                          name="Direct Reports"
                          label={{ position: 'right', fontSize: 9, fill: '#6b7280' }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-gray-500">
                      {Object.keys(data[0]).map(key => (
                        <th key={key} className="px-4 py-2 font-medium capitalize">{key.replace(/_/g, ' ')}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, i) => (
                      <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="px-4 py-2">{val ?? '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
