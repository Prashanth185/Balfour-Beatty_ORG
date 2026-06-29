import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users, Building, MapPin, Briefcase, UserPlus, Network, FileText,
  User, UserCheck, UserX, Clock, TrendingUp, TrendingDown,
  X, ArrowLeft, ChevronRight, GitBranch, Award, Target,
  Search, Download, Filter,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, AreaChart, Area,
} from 'recharts';
import * as XLSX from 'xlsx';
import api from '../api/client';
import { PageHeader, LoadingSpinner } from '../components/common';

// ── Colour palette ─────────────────────────────────────────────────────────────
const COLORS = ['#2563eb','#059669','#d97706','#7c3aed','#dc2626','#0891b2','#4f46e5','#c026d3','#65a30d','#f59e0b','#06b6d4','#8b5cf6'];
const GENDER_COLORS = { male: '#2563eb', female: '#ec4899' };

// ── Shared date formatter — handles Excel serials, ISO dates, DD-MM-YYYY ──────
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatDate(raw) {
  if (!raw) return '—';
  const s = String(raw).trim();
  if (!s) return '—';

  // Excel serial number (e.g. 45999, 45684)
  const n = Number(s);
  if (!isNaN(n) && n > 1000 && n < 200000) {
    const dt = new Date(new Date(1900, 0, 1).getTime() + (n - 2) * 86400000);
    const dd  = String(dt.getDate()).padStart(2, '0');
    const mmm = MONTHS_SHORT[dt.getMonth()];
    const yy  = String(dt.getFullYear()).slice(-2);
    return `${dd}-${mmm}-${yy}`;
  }

  // Already a date string — try to parse it
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    const dd  = String(dt.getDate()).padStart(2, '0');
    const mmm = MONTHS_SHORT[dt.getMonth()];
    const yy  = String(dt.getFullYear()).slice(-2);
    return `${dd}-${mmm}-${yy}`;
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (m) {
    const dt2 = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    if (!isNaN(dt2.getTime())) {
      const dd  = String(dt2.getDate()).padStart(2, '0');
      const mmm = MONTHS_SHORT[dt2.getMonth()];
      const yy  = String(dt2.getFullYear()).slice(-2);
      return `${dd}-${mmm}-${yy}`;
    }
  }

  return s; // return as-is if unparseable
}

// ── Tiny section-card wrapper ──────────────────────────────────────────────────
function Widget({ title, children, className = '', noPadBottom = false }) {
  return (
    <div className={`card ${className}`} style={noPadBottom ? { paddingBottom: 0 } : {}}>
      <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}

// ── Single metric row inside a widget ─────────────────────────────────────────
function MetricRow({ label, value, color = 'text-gray-900', sub }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm font-bold ${color}`}>{value}{sub && <span className="text-xs font-normal text-gray-400 ml-1">{sub}</span>}</span>
    </div>
  );
}

// ── DrillDownModal — universal drill-down modal for every chart/card click ──────
// Fetches employees from /api/employees/master with given base filters.
// Supports local search, department/status/location filter, Excel/CSV export, View.
const DRILL_COLS = [
  { key: 'employee_id',   label: 'Employee ID' },
  { key: 'name',          label: 'Name' },
  { key: 'designation',   label: 'Designation' },
  { key: 'department',    label: 'Department' },
  { key: 'place',         label: 'Location' },
  { key: 'manager_name',  label: 'Manager' },
  { key: 'status',        label: 'Status' },
  { key: 'gender',        label: 'Gender' },
  { key: 'join_date',     label: 'Join Date' },
  { key: 'date_of_exit',  label: 'Exit Date' },
  { key: 'service_duration', label: 'Service' },
  { key: 'education',     label: 'Education' },
];

// ── Shared helpers for date parsing (mirrors dashboard.js server logic) ────────
function extractYr(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const n = Number(s);
  if (!isNaN(n) && n > 1000 && n < 200000) {
    return String(new Date(new Date(1900, 0, 1).getTime() + (n - 2) * 86400000).getFullYear());
  }
  if (/^\d{4}[-/]/.test(s)) return s.slice(0, 4);
  const m = s.match(/(\d{4})$/); return m ? m[1] : null;
}
function extractYM(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const n = Number(s);
  if (!isNaN(n) && n > 1000 && n < 200000) {
    const dt = new Date(new Date(1900, 0, 1).getTime() + (n - 2) * 86400000);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  }
  if (/^\d{4}[-/]\d{2}/.test(s)) return s.slice(0, 7).replace('/', '-');
  const m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}`;
  return null;
}
function parseLeadingNum(s) {
  const m = String(s || '').trim().match(/^(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}
// ACTIVE_STATUS check — mirrors ACTIVE_STATUS_SQL in server
function isActive(status) {
  if (!status) return true; // NULL = active
  const s = String(status).trim().toLowerCase();
  return s === 'live' || s === 'active';
}
function isExited(status) {
  const s = String(status || '').trim().toLowerCase();
  return ['leaver','exited','resigned','terminated','inactive'].includes(s);
}
function isGender(g, target) {
  const v = String(g || '').trim().toUpperCase();
  if (target === 'Male')   return v === 'M' || v === 'MALE';
  if (target === 'Female') return v === 'F' || v === 'FEMALE';
  if (target === 'Other')  return v !== 'M' && v !== 'MALE' && v !== 'F' && v !== 'FEMALE';
  return false;
}

function DrillDownModal({ title, baseFilter = {}, columns, onClose }) {
  const navigate   = useNavigate();
  const cols       = columns || DRILL_COLS;
  const [allRows,  setAllRows]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [deptF,    setDeptF]    = useState('All');
  const [statusF,  setStatusF]  = useState('All');
  const [locF,     setLocF]     = useState('All');
  const [showF,    setShowF]    = useState(false);
  const [sortMode, setSortMode] = useState('name-az');

  useEffect(() => {
    const token = localStorage.getItem('orms_token');
    console.log("TOKEN =", token);

    // ── Fetch ALL trad employees (full columns), then apply all filters client-side.
    // This guarantees drill-down counts match dashboard card counts exactly,
    // because both use the same raw dataset from trad_employees.
    api.tradOrgChart.listEmployees({ full: 1 })
      .then(async (data) => {
        // /api/trad-org-chart/employees returns a plain array
        let rows = Array.isArray(data) ? data : (data.employees || []);

        const {
          status,
          gender,
          department,
          place,
          education,
          serviceDuration,
          exitThisYear,
          joinThisYear,
          joinYear,
          joinMonth,
          spanBucket,
        } = baseFilter;

        const currentYear = String(new Date().getFullYear());

        // Status filter
        if (status === 'Active') {
          rows = rows.filter(e => isActive(e.status));
        } else if (status === 'Exited') {
          rows = rows.filter(e => isExited(e.status));
        }

        // Gender filter
        if (gender === 'Male')   rows = rows.filter(e => isGender(e.gender, 'Male'));
        if (gender === 'Female') rows = rows.filter(e => isGender(e.gender, 'Female'));
        if (gender === 'Other')  rows = rows.filter(e => isGender(e.gender, 'Other'));

        // Department filter
        if (department && department !== 'All') {
          rows = rows.filter(e => e.department === department);
        }

        // Place / Location filter
        if (place && place !== 'All') {
          rows = rows.filter(e => e.place === place);
        }

        // Education filter
        if (education && education !== 'All') {
          rows = rows.filter(e => (e.education || 'Unknown') === education);
        }

        // Service duration bucket filter
        if (serviceDuration) {
          const ranges = {
            '0–2 Yrs':  [0, 2],   '2–5 Yrs':   [2, 5],
            '5–10 Yrs': [5, 10],  '10+ Yrs':   [10, 99999],
            '0–1 Yr':   [0, 1],   '1–3 Yrs':   [1, 3],
            '3–5 Yrs':  [3, 5],
          };
          const [lo, hi] = ranges[serviceDuration] || [0, 99999];
          rows = rows.filter(e => {
            const n = parseLeadingNum(e.service_duration);
            return n !== null && n >= lo && n < hi;
          });
        }

        // Exit this year
        if (exitThisYear) {
          rows = rows.filter(e => extractYr(e.date_of_exit) === currentYear);
        }

        // Join this year (active)
        if (joinThisYear) {
          rows = rows.filter(e => extractYr(e.join_date) === currentYear);
        }

        // Join year (for Growth Trend by Year click)
        if (joinYear) {
          rows = rows.filter(e => extractYr(e.join_date) === String(joinYear));
        }

        // Join month (for Monthly Trend click, format YYYY-MM)
        if (joinMonth) {
          rows = rows.filter(e => extractYM(e.join_date) === joinMonth);
        }

        // Span of Control bucket — find managers whose direct-report count is in range
        if (spanBucket) {
          const bucketMap = { '2–3':[2,3], '4–6':[4,6], '7–10':[7,10], '10+':[11,99999] };
          const [lo, hi] = bucketMap[spanBucket] || [0, 99999];
          // Build manager_id → direct report count from the full employee list
          const countMap = {};
          rows.forEach(e => {
            if (e.manager_id) countMap[e.manager_id] = (countMap[e.manager_id] || 0) + 1;
          });
          // Re-filter to only managers in the bucket
          rows = rows
            .filter(e => { const c = countMap[e.id] || 0; return c >= lo && c <= hi; })
            .map(e => ({ ...e, direct_reports_count: countMap[e.id] || 0 }));
        }

        // Sort by name
        rows.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        setAllRows(rows);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Client-side search + filter + sort on top of already-filtered rows
  const rows = useMemo(() => {
    let r = allRows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      r = r.filter(e =>
        [e.name, e.employee_id, e.designation, e.department, e.place]
          .some(v => String(v || '').toLowerCase().includes(q))
      );
    }
    if (deptF !== 'All')   r = r.filter(e => e.department === deptF);
    if (statusF !== 'All') {
      if (statusF === 'Active') {
        const activeValues = new Set(['live','active']);
        r = r.filter(e => !e.status || activeValues.has(String(e.status).trim().toLowerCase()));
      } else if (statusF === 'Exited') {
        const exitedValues = new Set(['exited','leaver','resigned','terminated','inactive']);
        r = r.filter(e => exitedValues.has(String(e.status || '').trim().toLowerCase()));
      } else {
        r = r.filter(e => e.status === statusF);
      }
    }
    if (locF !== 'All') r = r.filter(e => (e.place || e.location) === locF);

    // Apply sort
    r = [...r];
    if (sortMode === 'name-az') {
      r.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    } else if (sortMode === 'name-za') {
      r.sort((a, b) => String(b.name || '').localeCompare(String(a.name || '')));
    } else if (sortMode === 'service-high') {
      r.sort((a, b) => (parseLeadingNum(b.service_duration) ?? -1) - (parseLeadingNum(a.service_duration) ?? -1));
    } else if (sortMode === 'service-low') {
      r.sort((a, b) => (parseLeadingNum(a.service_duration) ?? 99999) - (parseLeadingNum(b.service_duration) ?? 99999));
    } else if (sortMode === 'join-newest') {
      r.sort((a, b) => {
        const ya = extractYr(a.join_date) || '0', yb = extractYr(b.join_date) || '0';
        if (ya !== yb) return yb.localeCompare(ya);
        return String(extractYM(b.join_date) || '').localeCompare(String(extractYM(a.join_date) || ''));
      });
    } else if (sortMode === 'join-oldest') {
      r.sort((a, b) => {
        const ya = extractYr(a.join_date) || '9999', yb = extractYr(b.join_date) || '9999';
        if (ya !== yb) return ya.localeCompare(yb);
        return String(extractYM(a.join_date) || '').localeCompare(String(extractYM(b.join_date) || ''));
      });
    }
    return r;
  }, [allRows, search, deptF, statusF, locF, sortMode]);

  // Unique filter options from loaded rows
  const depts    = useMemo(() => ['All', ...new Set(allRows.map(e => e.department).filter(Boolean).sort())], [allRows]);
  const statuses = ['All', 'Active', 'Exited'];
  const locs     = useMemo(() => ['All', ...new Set(allRows.map(e => e.place || e.location).filter(Boolean).sort())], [allRows]);

  const displayStatus = s => {
    const normalized = String(s || '').trim().toLowerCase();
    if (!normalized || normalized === 'active' || normalized === 'live') return 'Active';
    if (['exited','resigned','terminated','inactive','leaver'].includes(normalized)) return 'Exited';
    return s || 'Active';
  };
  const statusBadge = s => {
    const d = displayStatus(s);
    return d === 'Active' ? 'bg-green-100 text-green-800' : d === 'Exited' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700';
  };

  const cellVal = (emp, key) => {
    if (key === 'status') return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(emp.status)}`}>
        {displayStatus(emp.status)}
      </span>
    );
    if (key === 'gender') {
      const g = String(emp.gender || '').toUpperCase();
      return g === 'M' ? 'Male' : g === 'F' ? 'Female' : (emp.gender || '—');
    }
    if (key === 'employee_id') return (
      <button onClick={() => { onClose(); navigate(`/trad-employee/${emp.id}`); }}
        className="text-primary-600 hover:underline font-mono text-xs">{emp[key] || '—'}</button>
    );
    // Date fields — convert Excel serials and date strings to DD-MMM-YY
    const DATE_KEYS = ['join_date','date_of_exit','date_of_join_in_bb','date_of_join_previous_company','dob'];
    if (DATE_KEYS.includes(key)) return formatDate(emp[key]);
    return emp[key] || '—';
  };

  const handleExport = (fmt) => {
    const exportRows = rows.map(emp => {
      const obj = {};
      cols.forEach(c => {
        let v = emp[c.key] || '';
        if (c.key === 'status') v = displayStatus(emp.status);
        if (c.key === 'gender') { const g = String(v).toUpperCase(); v = g === 'M' ? 'Male' : g === 'F' ? 'Female' : v; }
        // Format date fields for export too
        const DATE_KEYS = ['join_date','date_of_exit','date_of_join_in_bb','date_of_join_previous_company','dob'];
        if (DATE_KEYS.includes(c.key)) v = formatDate(emp[c.key]);
        obj[c.label] = v;
      });
      return obj;
    });
    if (fmt === 'excel') {
      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Employees');
      XLSX.writeFile(wb, `${title.replace(/[^a-z0-9]/gi,'_')}.xlsx`);
    } else {
      const headers = cols.map(c => c.label);
      const esc = v => `"${String(v).replace(/"/g,'""')}"`;
      const csv = [headers.map(esc).join(','), ...exportRows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
      a.download = `${title.replace(/[^a-z0-9]/gi,'_')}.csv`;
      a.click(); URL.revokeObjectURL(a.href);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">{title}</h2>
            {!loading && <p className="text-xs text-gray-400 mt-0.5">{rows.length} of {allRows.length} employees</p>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => handleExport('excel')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded-lg hover:bg-green-600">
              <Download className="w-3.5 h-3.5" /> Excel
            </button>
            <button onClick={() => handleExport('csv')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-xs font-semibold rounded-lg hover:bg-blue-600">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 ml-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="px-5 py-3 border-b border-gray-100 shrink-0 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input type="text" placeholder="Search name, ID, designation…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-400" />
            </div>
            {/* Sort selector */}
            <select value={sortMode} onChange={e => setSortMode(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white text-gray-600">
              <option value="name-az">A → Z</option>
              <option value="name-za">Z → A</option>
              <option value="service-high">Service: High → Low</option>
              <option value="service-low">Service: Low → High</option>
              <option value="join-newest">Join Date: Newest</option>
              <option value="join-oldest">Join Date: Oldest</option>
            </select>
            <button onClick={() => setShowF(f => !f)}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs transition-colors ${showF ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <Filter className="w-3.5 h-3.5" /> Filters
            </button>
          </div>
          {showF && (
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Department', val: deptF, set: setDeptF, opts: depts },
                { label: 'Status',     val: statusF, set: setStatusF, opts: statuses },
                { label: 'Location',   val: locF,   set: setLocF,   opts: locs },
              ].map(({ label, val, set, opts }) => (
                <div key={label} className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">{label}:</span>
                  <select value={val} onChange={e => set(e.target.value)}
                    className="text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-primary-400">
                    {opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-primary-600 rounded-full animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-gray-400 py-16 text-sm">No employees found</p>
          ) : (
            <table className="w-full text-xs min-w-max">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="border-b border-gray-200">
                  {cols.map(c => (
                    <th key={c.key} className="px-4 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{c.label}</th>
                  ))}
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(emp => (
                  <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    {cols.map(c => (
                      <td key={c.key} className="px-4 py-2.5 whitespace-nowrap">{cellVal(emp, c.key)}</td>
                    ))}
                    <td className="px-4 py-2.5">
                      <button onClick={() => { onClose(); navigate(`/trad-employee/${emp.id}`); }}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors">
                        View <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 shrink-0 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Showing {rows.length} employee{rows.length !== 1 ? 's' : ''}
            {rows.length < allRows.length ? ` (filtered from ${allRows.length})` : ''}
          </p>
          <button onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── EmployeeListModal kept as thin wrapper for backward compatibility ──────────
function EmployeeListModal({ title, filter, onClose }) {
  return <DrillDownModal title={title} baseFilter={filter || {}} onClose={onClose} />;
}

// ── Stat card definitions (EXISTING — unchanged) ───────────────────────────────
const statIcons = {
  employees: Users, departments: Building, businessUnits: Briefcase, locations: MapPin,
  maleEmployees: User, femaleEmployees: User, activeEmployees: UserCheck, exitedEmployees: UserX,
  avgServiceDuration: Clock, avgServiceInBB: Clock,
  newJoinersThisYear: TrendingUp, employeesLeftThisYear: TrendingDown,
};
const CARD_FILTERS = {
  employees:              {},
  maleEmployees:          { gender: 'Male', status: 'Active' },
  femaleEmployees:        { gender: 'Female', status: 'Active' },
  otherGender:            { gender: 'Other', status: 'Active' },
  activeEmployees:        { status: 'Active' },
  exitedEmployees:        { status: 'Exited' },
  newJoinersThisYear:     { joinThisYear: 'true', status: 'Active' },
  employeesLeftThisYear:  { status: 'Exited', exitThisYear: 'true' },
};

// ── Custom tooltip for bar/line charts ────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
}

// ── Dept Strength tooltip: includes % of total workforce ──────────────────────
function DeptTooltip({ active, payload, label, total }) {
  if (!active || !payload?.length) return null;
  const count = payload[0]?.value || 0;
  const pct   = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      <p className="text-blue-700">Employees: <strong>{count}</strong></p>
      <p className="text-gray-500">% Workforce: <strong>{pct}%</strong></p>
    </div>
  );
}

// ── Insight detail modal (Largest/Smallest Team, Orphans, Hierarchy) ──────────
function InsightModal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        <div className="px-6 py-3 border-t border-gray-100 shrink-0">
          <button onClick={onClose}
            className="w-full py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Small employee row inside insight modals ───────────────────────────────────
function EmpRow({ emp }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
        <span className="text-primary-700 text-xs font-semibold">{emp.name?.charAt(0) || '?'}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 truncate">{emp.name}</p>
        <p className="text-xs text-gray-400 truncate">{emp.designation || '—'} · {emp.department || '—'}</p>
      </div>
      <span className="text-xs font-mono text-gray-400 shrink-0">{emp.employee_id}</span>
    </div>
  );
}

// ── Main Dashboard Component ───────────────────────────────────────────────────
export default function Dashboard() {
  const [stats,       setStats]       = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [activeModal,   setActiveModal]   = useState(null);
  const [insightModal,  setInsightModal]  = useState(null); // { type }
  // drill = { title, baseFilter, columns? } — opens DrillDownModal for any chart click
  const [drill, setDrill] = useState(null);
  const openDrill = (title, baseFilter, columns) => setDrill({ title, baseFilter, columns });

  const loadStats = () => {
    api.dashboard.stats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadStats(); }, []);

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;
  if (!stats)  return <div className="text-center text-red-500 py-12">Failed to load dashboard</div>;

  // ── EXISTING stat cards (unchanged) ─────────────────────────────────────────
  const statCards = [
    { key: 'activeEmployees',      label: 'Active Employees',        value: stats.activeEmployees,        icon: statIcons.activeEmployees,      color: 'bg-green-500',   clickable: true  },
    { key: 'maleEmployees',        label: 'Active Male',             value: stats.maleEmployees,          icon: statIcons.maleEmployees,        color: 'bg-indigo-500',  clickable: true  },
    { key: 'femaleEmployees',      label: 'Active Female',           value: stats.femaleEmployees,        icon: statIcons.femaleEmployees,      color: 'bg-pink-500',    clickable: true  },
    ...(stats.otherGenderEmployees > 0 ? [{
      key: 'otherGender', label: 'Active — Unspecified Gender',
      value: stats.otherGenderEmployees, icon: statIcons.employees, color: 'bg-gray-500', clickable: true,
    }] : []),
    { key: 'newJoinersThisYear',   label: 'New Joiners This Year',   value: stats.newJoinersThisYear,     icon: statIcons.newJoinersThisYear,   color: 'bg-cyan-500',    clickable: true  },
    { key: 'employeesLeftThisYear',label: 'Employees Left This Year',value: stats.employeesLeftThisYear,  icon: statIcons.employeesLeftThisYear,color: 'bg-orange-500',  clickable: true  },
    { key: 'avgServiceDuration',   label: 'Avg Service (Active)',    value: `${stats.activeAvgServiceDuration ?? stats.avgServiceDuration} Yrs`, icon: statIcons.avgServiceDuration, color: 'bg-purple-500', clickable: false },
  ];

  const quickActions = [
    { to: '/employees/master', icon: Users,    label: 'Employee Master Data', desc: 'View and filter all employees' },
    { to: '/employees/add',    icon: UserPlus, label: 'Add Employee',          desc: 'Create new employee profile' },
    { to: '/relationships',    icon: Network,  label: 'Define Relationships',  desc: 'Set reporting lines' },
    { to: '/org-chart',        icon: Network,  label: 'View Org Chart',        desc: 'Visualize structure' },
    { to: '/reports',          icon: FileText, label: 'Generate Reports',      desc: 'Export analytics' },
  ];

  // ── Active-only derived data for middle section charts ───────────────────────
  // Use maleEmployees/femaleEmployees as primary source — they are always correct.
  // activeMale/activeFemale are the same values, kept for compatibility.
  const activeMale   = stats.maleEmployees   ?? 0;
  const activeFemale = stats.femaleEmployees ?? 0;
  const activeOther  = Math.max(0, (stats.activeEmployees ?? 0) - activeMale - activeFemale);

  const genderPieData = [
    { name: 'Male',   value: activeMale   },
    { name: 'Female', value: activeFemale },
    { name: 'Other',  value: activeOther  },
  ].filter(d => d.value > 0);

  const statusPieData = [
    { name: 'Active', value: stats.activeEmployees },
    { name: 'Exited', value: stats.exitedEmployees },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Workforce Analytics" />

      {/* ── ROW 1: Existing KPI cards (UNCHANGED) ────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {statCards.map(({ key, label, value, icon: Icon, color, clickable }) => (
          clickable ? (
            <button key={key} type="button"
              onClick={() => {
                const customCols =
                  key === 'employeesLeftThisYear' ? [
                    { key: 'employee_id',      label: 'Employee ID' },
                    { key: 'name',             label: 'Employee Name' },
                    { key: 'department',       label: 'Department' },
                    { key: 'designation',      label: 'Designation' },
                    { key: 'date_of_exit',     label: 'Date of Exit' },
                    { key: 'service_duration', label: 'Service Duration' },
                    { key: 'place',            label: 'Location' },
                  ] : key === 'newJoinersThisYear' ? [
                    { key: 'employee_id',        label: 'Employee ID' },
                    { key: 'name',               label: 'Employee Name' },
                    { key: 'gender',             label: 'Gender' },
                    { key: 'department',         label: 'Department' },
                    { key: 'designation',        label: 'Designation' },
                    { key: 'place',              label: 'Location' },
                    { key: 'date_of_join_in_bb', label: 'Date of Join in BB' },
                    { key: 'service_duration',   label: 'Service Duration' },
                    { key: 'status',             label: 'Status' },
                  ] : undefined;
                openDrill(label, CARD_FILTERS[key], customCols);
              }}
              className="stat-card text-left hover:shadow-md hover:ring-2 hover:ring-primary-200 transition-all cursor-pointer">
              <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-sm text-gray-500">{label}</p>
              </div>
            </button>
          ) : (
            <div key={key} className="stat-card">
              <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-sm text-gray-500">{label}</p>
              </div>
            </div>
          )
        ))}
      </div>

      {/* ── ROW 2: Active Employee Trend + Department Strength ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Employee Trend (By Year) — moved to top position */}
        {(stats.activeGrowthByYear ?? stats.growthByYear)?.length > 0 ? (
          <Widget title="Active Employee Trend (By Year)" className="pb-0" noPadBottom>
            <p className="text-xs text-gray-400 mb-2">Cumulative active workforce growth over time. Click a year to see employees who joined that year.</p>
            <div style={{ height: 340, overflow: 'hidden' }}>
            <ResponsiveContainer width="100%" height={340}>
              <AreaChart
                data={stats.activeGrowthByYear ?? stats.growthByYear}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                onClick={e => {
                  const yr = e?.activePayload?.[0]?.payload?.year;
                  if (yr) openDrill(`Active Employees — Joined in ${yr}`, { joinYear: yr, status: 'Active' },
                    [{key:'employee_id',label:'Employee ID'},{key:'name',label:'Employee Name'},{key:'designation',label:'Designation'},{key:'department',label:'Department'},{key:'place',label:'Location'},{key:'join_date',label:'Join Date'},{key:'service_duration',label:'Service Duration'}]);
                }}
                style={{ cursor: 'pointer' }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} ticks={[0,50,100,150,200,250,300,350,400]} domain={[0,400]} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs">
                      <p className="font-semibold text-gray-700 mb-1">{label}</p>
                      <p className="text-green-700">Total Active Workforce: <strong>{d?.count}</strong></p>
                      {d?.joinersThisYear !== undefined && (
                        <p className="text-gray-500">Joined This Year: <strong>{d.joinersThisYear}</strong></p>
                      )}
                    </div>
                  );
                }} />
                <Area type="monotone" dataKey="count" name="Total Active Workforce" stroke="#059669" fill="#d1fae5" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
            </div>
          </Widget>
        ) : (
          <Widget title="Active Employee Trend (By Year)">
            <p className="text-xs text-gray-400 py-8 text-center">No join date data available</p>
          </Widget>
        )}

        <Widget title="Department Strength (Active Employees)">
          {(stats.activeDeptDistribution ?? stats.employeesByDepartment)?.length > 0 ? (() => {
            const depts = stats.activeDeptDistribution ?? stats.employeesByDepartment; // ALL departments, no slice
            const barH  = 28; // px per bar
            const chartH = Math.max(220, depts.length * barH + 20);
            const labelW = Math.min(160, Math.max(80, Math.max(...depts.map(d => (d.department || '').length)) * 6.5));
            return (
              <div style={{ overflowY: 'auto', maxHeight: 420 }}>
                <ResponsiveContainer width="100%" height={chartH}>
                  <BarChart data={depts} layout="vertical"
                    margin={{ top: 4, right: 40, left: labelW, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="department"
                      tick={{ fontSize: 10, fill: '#374151' }}
                      width={labelW}
                      tickFormatter={v => v} />
                    <Tooltip content={<DeptTooltip total={stats.totalEmployees} />} />
                    <Bar dataKey="count" name="Employees" radius={[0, 4, 4, 0]}
                      label={{ position: 'right', fontSize: 9, fill: '#6b7280' }}
                      onClick={({ department }) => openDrill(`Department: ${department}`, { department, status: 'Active' },
                        [{key:'employee_id',label:'Employee ID'},{key:'name',label:'Name'},{key:'designation',label:'Designation'},{key:'place',label:'Location'},{key:'manager_name',label:'Manager'},{key:'status',label:'Status'}])}>
                      {depts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} style={{ cursor:'pointer' }} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })() : <p className="text-xs text-gray-400 py-8 text-center">No department data available</p>}
        </Widget>
      </div>

      {/* ── ROW 3: Gender Distribution + Experience Distribution ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Widget title="Gender Distribution">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col justify-center gap-4">
              {/* Single stacked horizontal bar */}
              {(() => {
                const total = activeMale + activeFemale + activeOther;
                const malePct   = total > 0 ? (activeMale   / total) * 100 : 0;
                const femalePct = total > 0 ? (activeFemale / total) * 100 : 0;
                const otherPct  = total > 0 ? (activeOther  / total) * 100 : 0;
                return (
                  <div>
                    {/* Stacked bar */}
                    <div className="flex w-full h-8 rounded-lg overflow-hidden">
                      {malePct > 0 && (
                        <button type="button"
                          onClick={() => openDrill('Male Employees', { gender: 'Male', status: 'Active' })}
                          className="h-full flex items-center justify-center hover:opacity-80 transition-opacity"
                          style={{ width: `${malePct}%`, backgroundColor: '#2563eb' }}
                          title={`Male: ${activeMale} (${malePct.toFixed(1)}%)`}>
                          {malePct > 12 && <span className="text-white text-[10px] font-bold px-1 truncate">{malePct.toFixed(1)}%</span>}
                        </button>
                      )}
                      {femalePct > 0 && (
                        <button type="button"
                          onClick={() => openDrill('Female Employees', { gender: 'Female', status: 'Active' })}
                          className="h-full flex items-center justify-center hover:opacity-80 transition-opacity"
                          style={{ width: `${femalePct}%`, backgroundColor: '#ec4899' }}
                          title={`Female: ${activeFemale} (${femalePct.toFixed(1)}%)`}>
                          {femalePct > 12 && <span className="text-white text-[10px] font-bold px-1 truncate">{femalePct.toFixed(1)}%</span>}
                        </button>
                      )}
                      {otherPct > 0 && (
                        <button type="button"
                          onClick={() => openDrill('Other / Unspecified Gender', { gender: 'Other', status: 'Active' })}
                          className="h-full flex items-center justify-center hover:opacity-80 transition-opacity"
                          style={{ width: `${otherPct}%`, backgroundColor: '#94a3b8' }}
                          title={`Other: ${activeOther} (${otherPct.toFixed(1)}%)`}>
                          {otherPct > 12 && <span className="text-white text-[10px] font-bold px-1 truncate">{otherPct.toFixed(1)}%</span>}
                        </button>
                      )}
                    </div>
                    {/* Legend */}
                    <div className="flex flex-wrap gap-3 mt-2">
                      {malePct > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: '#2563eb' }} />
                          <span className="text-[11px] text-gray-600">Male</span>
                        </div>
                      )}
                      {femalePct > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: '#ec4899' }} />
                          <span className="text-[11px] text-gray-600">Female</span>
                        </div>
                      )}
                      {otherPct > 0 && (
                        <div className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: '#94a3b8' }} />
                          <span className="text-[11px] text-gray-600">Other</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="space-y-1 pt-2">
              <MetricRow label="Male"   value={activeMale}   color="text-blue-600" />
              <MetricRow label="Female" value={activeFemale} color="text-pink-600" />
              <MetricRow label="Male %"
                value={(stats.activeEmployees ?? 0) > 0 ? ((activeMale / stats.activeEmployees) * 100).toFixed(1) + '%' : '—'} />
              <MetricRow label="Female %"
                value={(stats.activeEmployees ?? 0) > 0 ? ((activeFemale / stats.activeEmployees) * 100).toFixed(1) + '%' : '—'} />
            </div>
          </div>
        </Widget>

        <Widget title="Experience Distribution (Active Employees)">
          {(stats.activeExperience ?? stats.experienceDistribution)?.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.activeExperience ?? stats.experienceDistribution} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                style={{ cursor: 'pointer' }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Active Employees" radius={[4, 4, 0, 0]}
                  onClick={({ range }) => openDrill(`Active — Experience: ${range}`, { serviceDuration: range, status: 'Active' })}>
                  {(stats.activeExperience ?? stats.experienceDistribution).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} style={{ cursor:'pointer' }} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-gray-400 py-8 text-center">No service duration data available</p>}
        </Widget>
      </div>

      {/* ── ROW 4: Location Distribution + Education Distribution ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Widget title="Location Distribution (Active Employees)">
          {(stats.activeLocation ?? stats.locationDistribution)?.length > 0 ? (() => {
            const locs  = stats.activeLocation ?? stats.locationDistribution;
            const barH  = 28;
            const chartH = Math.max(220, locs.length * barH + 20);
            const labelW = Math.min(180, Math.max(80, Math.max(...locs.map(d => (d.location || '').length)) * 6.5));
            return (
              <div style={{ overflowY: 'auto', maxHeight: 420 }}>
                <ResponsiveContainer width="100%" height={chartH}>
                  <BarChart data={locs} layout="vertical"
                    margin={{ top: 4, right: 40, left: labelW, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="location"
                      tick={{ fontSize: 10, fill: '#374151' }}
                      width={labelW}
                      tickFormatter={v => v} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="Employees" radius={[0, 4, 4, 0]}
                      label={{ position: 'right', fontSize: 9, fill: '#6b7280' }}
                      onClick={({ location }) => openDrill(`Location: ${location}`, { place: location, status: 'Active' })}>
                      {locs.map((_, i) => <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} style={{ cursor:'pointer' }} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })() : <p className="text-xs text-gray-400 py-8 text-center">No location data available</p>}
        </Widget>

        <Widget title="Education Distribution (Active Employees)" className="pb-0" noPadBottom>
          {(stats.activeEducation ?? stats.educationDistribution)?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={(stats.activeEducation ?? stats.educationDistribution).slice(0, 8)} dataKey="count" nameKey="education"
                  cx="50%" cy="45%" innerRadius={45} outerRadius={75} paddingAngle={2}
                  style={{ cursor: 'pointer' }}
                  onClick={({ education }) => openDrill(`Active — Education: ${education}`, { education, status: 'Active' })}>
                  {(stats.activeEducation ?? stats.educationDistribution).slice(0, 8).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} layout="horizontal" verticalAlign="bottom" align="center" />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-gray-400 py-8 text-center">No education data available</p>}
        </Widget>
      </div>

      {/* ── ROW 5: Manager Span of Control + Hierarchy Insights ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Widget title="Manager Span of Control" className="pb-0" noPadBottom>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'Managers',               value: stats.managersCount, color: 'bg-blue-50 text-blue-700'   },
              { label: 'Individual Contributors', value: stats.icCount,       color: 'bg-green-50 text-green-700' },
              { label: 'Avg Team Size',            value: stats.avgTeamSize,   color: 'bg-purple-50 text-purple-700' },
            ].map(({ label, value, color }) => (
              <div key={label} className={`rounded-xl p-3 text-center ${color}`}>
                <p className="text-xl font-bold">{value}</p>
                <p className="text-xs mt-0.5 opacity-80">{label}</p>
              </div>
            ))}
          </div>
          {stats.spanDistribution?.some(d => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={stats.spanDistribution.filter(d => d.count > 0)}
                margin={{ top: 8, right: 24, left: 8, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="span" tick={{ fontSize: 12 }}
                  label={{ value: 'Number of Direct Reports', position: 'insideBottom', offset: -14, fontSize: 11, fill: '#6b7280' }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false}
                  label={{ value: 'Managers', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: '#6b7280' }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs">
                        <p className="font-semibold text-gray-800 mb-1">Team size: {label}</p>
                        <p className="text-purple-700">Managers: <strong>{payload[0].value}</strong></p>
                        <p className="text-gray-500">Employees managed: <strong>{payload[0].payload?.employees || '—'}</strong></p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="count" name="Managers" fill="#7c3aed" radius={[4, 4, 0, 0]}
                  label={{ position: 'top', fontSize: 10, fill: '#6b7280' }}
                  onClick={({ span }) => openDrill(`Managers with ${span} Direct Reports`, { spanBucket: span, status: 'Active' },
                    [{key:'employee_id',label:'Employee ID'},{key:'name',label:'Manager Name'},{key:'department',label:'Department'},{key:'designation',label:'Designation'},{key:'direct_reports_count',label:'Direct Reports Count'}])} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-xs text-gray-400 py-4 text-center">No reporting data available</p>}
        </Widget>

        <Widget title="Hierarchy &amp; ORMS Insights">
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { key: 'largestTeam',    label: 'Largest Team',      value: stats.largestTeam,          icon: Award,     color: 'text-green-600', bg: 'bg-green-50 hover:bg-green-100'  },
              { key: 'smallestTeam',   label: 'Smallest Team',     value: stats.smallestTeam,         icon: Target,    color: 'text-orange-600', bg: 'bg-orange-50 hover:bg-orange-100' },
              { key: 'orphans',        label: 'Orphan Employees',  value: stats.orphanCount,          icon: Users,     color: 'text-red-600',   bg: 'bg-red-50 hover:bg-red-100'      },
              { key: 'hierarchy',      label: 'Hierarchy Levels',  value: stats.totalHierarchyLevels, icon: GitBranch, color: 'text-blue-600',  bg: 'bg-blue-50 hover:bg-blue-100'    },
            ].map(({ key, label, value, icon: Icon, color, bg }) => (
              <button key={key} type="button"
                onClick={() => setInsightModal(key)}
                className={`${bg} rounded-xl p-3 flex items-center gap-2 text-left transition-colors cursor-pointer`}
                title={`Click to view ${label} details`}>
                <Icon className={`w-5 h-5 ${color} shrink-0`} />
                <div>
                  <p className={`text-lg font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="space-y-0.5">
            <MetricRow label="Max Reporting Depth"    value={stats.maxReportingDepth} />
            <MetricRow label="No Direct Reports"      value={stats.noDirectReports} />
            <MetricRow label="Cross-Dept Reporting"   value={stats.crossDeptCount} />
            <MetricRow label="Reporting Completeness" value={`${stats.reportingCompleteness}%`} color="text-green-700" />
            <MetricRow label="Total Relationships"    value={stats.totalRelationships} />
          </div>
        </Widget>
      </div>

      {/* ── ROW 6: Gender by Department + Quick Actions (existing) ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Widget title="Gender by Department (Active Employees)" className="pb-0" noPadBottom>
            {(stats.activeGenderByDept ?? stats.genderByDepartment)?.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={(stats.activeGenderByDept ?? stats.genderByDepartment).slice(0, 10)} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="department" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Bar dataKey="male"   name="Male"   fill="#2563eb" radius={[3, 3, 0, 0]}
                    style={{ cursor: 'pointer' }}
                    onClick={({ department }) => openDrill(`Male — ${department}`, { department, gender: 'Male', status: 'Active' })} />
                  <Bar dataKey="female" name="Female" fill="#ec4899" radius={[3, 3, 0, 0]}
                    style={{ cursor: 'pointer' }}
                    onClick={({ department }) => openDrill(`Female — ${department}`, { department, gender: 'Female', status: 'Active' })} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-xs text-gray-400 py-8 text-center">No gender/department data available</p>}
          </Widget>
        </div>

        {/* Quick Actions — EXISTING, UNCHANGED */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            {quickActions.map(({ to, icon: Icon, label, desc }) => (
              <Link key={to} to={to}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-primary-50 hover:border-primary-200 transition-colors">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── ROW 7: Monthly Joiners Trend — Active employees only ─────────────── */}
      {(stats.activeGrowthByMonth ?? stats.growthByMonth)?.length > 1 && (
        <Widget title="New Joiners Trend — Active Employees (Last 24 Months)">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={stats.activeGrowthByMonth ?? stats.growthByMonth} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
              onClick={e => {
                const mo = e?.activePayload?.[0]?.payload?.month;
                if (mo) {
                  // Format YYYY-MM → "January 2026" style title
                  let moLabel = mo;
                  try {
                    const [y, m] = mo.split('-');
                    moLabel = new Date(Number(y), Number(m) - 1, 1)
                      .toLocaleString('default', { month: 'long', year: 'numeric' });
                  } catch { /* use raw value */ }
                  openDrill(`New Joiners – ${moLabel}`, { joinMonth: mo, status: 'Active' },
                    [{key:'employee_id',label:'Employee ID'},{key:'name',label:'Employee Name'},{key:'department',label:'Department'},{key:'designation',label:'Designation'},{key:'gender',label:'Gender'},{key:'join_date',label:'Join Date'},{key:'status',label:'Status'}]);
                }
              }} style={{ cursor: 'pointer' }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={40} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="count" name="Joiners" stroke="#2563eb" strokeWidth={2} dot={{ r: 4, cursor: 'pointer' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </Widget>
      )}

      {/* ── ROW 8a: Employee Growth Trend (By Year) — moved to lower position ── */}
      {stats.growthByYear?.length > 0 && (
        <Widget title="Employee Growth Trend (Active Employees)">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={stats.growthByYear} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
              onClick={e => {
                const yr = e?.activePayload?.[0]?.payload?.year;
                if (yr) openDrill(`Active Employees Joined in ${yr}`, { joinYear: yr, status: 'Active' },
                  [{ key:'employee_id',label:'Employee ID'},{key:'name',label:'Employee Name'},{key:'department',label:'Department'},{key:'designation',label:'Designation'},{key:'gender',label:'Gender'},{key:'join_date',label:'Join Date'},{key:'status',label:'Status'}]);
              }} style={{ cursor: 'pointer' }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="count" name="Joiners" stroke="#2563eb" fill="#dbeafe" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Widget>
      )}

      {/* ── ROW 8b: Two new active charts ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* NEW CHART 1: Active Employees by Department (%) — donut chart */}
        <Widget title="Active Employees by Department (%)">
          {(stats.activeDeptPercentage ?? stats.activeDeptDistribution)?.length > 0 ? (() => {
            const data = stats.activeDeptPercentage ?? stats.activeDeptDistribution;
            const total = data.reduce((s, d) => s + d.count, 0);
            return (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="count"
                    nameKey="department"
                    cx="50%" cy="45%"
                    innerRadius={55}
                    outerRadius={100}
                    paddingAngle={2}
                    style={{ cursor: 'pointer' }}
                    onClick={({ department }) => openDrill(`Active — ${department}`, { department, status: 'Active' },
                      [{key:'employee_id',label:'Employee ID'},{key:'name',label:'Name'},{key:'designation',label:'Designation'},{key:'place',label:'Location'},{key:'status',label:'Status'}])}
                  >
                    {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const { department, count } = payload[0].payload;
                    const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
                    return (
                      <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs">
                        <p className="font-semibold text-gray-800 mb-1">{department}</p>
                        <p className="text-blue-700">Active: <strong>{count}</strong></p>
                        <p className="text-gray-500">Share: <strong>{pct}%</strong></p>
                      </div>
                    );
                  }} />
                  <Legend iconSize={9} wrapperStyle={{ fontSize: 10 }} layout="horizontal" verticalAlign="bottom" align="center" />
                </PieChart>
              </ResponsiveContainer>
            );
          })() : <p className="text-xs text-gray-400 py-8 text-center">No department data available</p>}
        </Widget>

        {/* NEW CHART 2: Active Employees by Service Duration */}
        <Widget title="Active Employees by Service Duration" className="pb-0" noPadBottom>
          {stats.activeServiceBuckets?.length > 0 ? (
            <div style={{ height: 280, overflow: 'hidden' }}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stats.activeServiceBuckets} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} tickCount={8} domain={[0, 'auto']} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Active Employees" radius={[4, 4, 0, 0]}
                  onClick={({ range }) => openDrill(`Active — Service Duration: ${range}`, { serviceDuration: range, status: 'Active' },
                    [{key:'employee_id',label:'Employee ID'},{key:'name',label:'Name'},{key:'designation',label:'Designation'},{key:'department',label:'Department'},{key:'place',label:'Location'},{key:'service_duration',label:'Service Duration'},{key:'status',label:'Status'}])}>
                  {stats.activeServiceBuckets.map((_, i) => (
                    <Cell key={i} fill={['#0891b2','#2563eb','#7c3aed','#059669','#d97706'][i % 5]} style={{ cursor:'pointer' }} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            </div>
          ) : <p className="text-xs text-gray-400 py-8 text-center">No service duration data available</p>}
        </Widget>
      </div>

      {/* ── BOTTOM SECTION: Historical & Reference Metrics ───────────────────── */}
      <div className="mt-2">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-200" />
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest px-2">
            Historical &amp; Reference Metrics — Since Company Start
          </h2>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
        <p className="text-xs text-gray-400 mb-4 text-center">
          These figures represent the complete company history including both active and exited employees.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[
            { label: 'Since Company Start — Total',  value: stats.historicalTotal   ?? stats.totalEmployees,    color: 'bg-slate-600',  filter: {} },
            { label: 'Historical Male',               value: stats.historicalMale    ?? stats.maleEmployees,     color: 'bg-slate-500',  filter: { gender: 'Male' } },
            { label: 'Historical Female',             value: stats.historicalFemale  ?? stats.femaleEmployees,   color: 'bg-slate-500',  filter: { gender: 'Female' } },
            { label: 'Total Exited Employees',        value: stats.historicalExited  ?? stats.exitedEmployees,   color: 'bg-slate-700',  filter: { status: 'Exited' } },
            { label: 'Avg Service Duration (All)',    value: `${stats.historicalAvgSD ?? stats.avgServiceDuration} Yrs`, color: 'bg-slate-400', filter: null },
            { label: 'Avg Service in BB (All)',       value: `${stats.historicalAvgSI ?? stats.avgServiceInBB} Yrs`,    color: 'bg-slate-400', filter: null },
          ].map(({ label, value, color, filter }) =>
            filter !== null ? (
              <button key={label} type="button"
                onClick={() => openDrill(label, filter)}
                className="stat-card text-left hover:shadow-md hover:ring-2 hover:ring-slate-300 transition-all cursor-pointer opacity-80">
                <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center shrink-0`}>
                  <Users className="w-5 h-5 text-white opacity-80" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-700">{value}</p>
                  <p className="text-xs text-gray-400">{label}</p>
                </div>
              </button>
            ) : (
              <div key={label} className="stat-card opacity-80">
                <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center shrink-0`}>
                  <Clock className="w-5 h-5 text-white opacity-80" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-700">{value}</p>
                  <p className="text-xs text-gray-400">{label}</p>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* ── Employee list modal (kept for backward compat — now delegates to DrillDownModal) */}
      {activeModal && (
        <EmployeeListModal
          title={activeModal.label}
          filter={activeModal.filter}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* ── Universal DrillDown modal — all chart/card clicks ────────────────── */}
      {drill && (
        <DrillDownModal
          title={drill.title}
          baseFilter={drill.baseFilter}
          columns={drill.columns}
          onClose={() => setDrill(null)}
        />
      )}

      {/* ── Insight modals (Largest Team, Smallest Team, Orphans, Hierarchy) ── */}
      {insightModal === 'largestTeam' && (
        <InsightModal
          title={`Largest Team — ${stats.largestTeamDetail?.teamSize ?? stats.largestTeam} members`}
          onClose={() => setInsightModal(null)}>
          {stats.largestTeamDetail ? (
            <>
              {stats.largestTeamDetail.manager && (
                <div className="mb-4 p-3 bg-green-50 rounded-xl border border-green-100">
                  <p className="text-xs text-green-600 font-semibold uppercase tracking-wide mb-1">Manager</p>
                  <p className="font-bold text-gray-900">{stats.largestTeamDetail.manager.name}</p>
                  <p className="text-xs text-gray-500">{stats.largestTeamDetail.manager.designation} · {stats.largestTeamDetail.manager.department}</p>
                  <p className="text-xs font-mono text-gray-400 mt-0.5">{stats.largestTeamDetail.manager.employee_id}</p>
                </div>
              )}
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                Team Members ({stats.largestTeamDetail.members.length})
              </p>
              {stats.largestTeamDetail.members.length > 0
                ? stats.largestTeamDetail.members.map(emp => <EmpRow key={emp.id} emp={emp} />)
                : <p className="text-sm text-gray-400 text-center py-4">No team members found</p>}
            </>
          ) : <p className="text-sm text-gray-400 text-center py-8">No team data available</p>}
        </InsightModal>
      )}

      {insightModal === 'smallestTeam' && (
        <InsightModal
          title={`Smallest Team — ${stats.smallestTeamDetail?.teamSize ?? stats.smallestTeam} member${(stats.smallestTeamDetail?.teamSize ?? stats.smallestTeam) !== 1 ? 's' : ''}`}
          onClose={() => setInsightModal(null)}>
          {stats.smallestTeamDetail ? (
            <>
              {stats.smallestTeamDetail.manager && (
                <div className="mb-4 p-3 bg-orange-50 rounded-xl border border-orange-100">
                  <p className="text-xs text-orange-600 font-semibold uppercase tracking-wide mb-1">Manager</p>
                  <p className="font-bold text-gray-900">{stats.smallestTeamDetail.manager.name}</p>
                  <p className="text-xs text-gray-500">{stats.smallestTeamDetail.manager.designation} · {stats.smallestTeamDetail.manager.department}</p>
                  <p className="text-xs font-mono text-gray-400 mt-0.5">{stats.smallestTeamDetail.manager.employee_id}</p>
                </div>
              )}
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                Team Members ({stats.smallestTeamDetail.members.length})
              </p>
              {stats.smallestTeamDetail.members.length > 0
                ? stats.smallestTeamDetail.members.map(emp => <EmpRow key={emp.id} emp={emp} />)
                : <p className="text-sm text-gray-400 text-center py-4">No direct reports found</p>}
            </>
          ) : <p className="text-sm text-gray-400 text-center py-8">No team data available</p>}
        </InsightModal>
      )}

      {insightModal === 'orphans' && (
        <InsightModal title={`Orphan Employees — No Manager (${stats.orphanCount ?? 0})`} onClose={() => setInsightModal(null)}>
          <p className="text-xs text-gray-500 mb-3">These active employees have no manager and do not manage anyone — they are completely outside the reporting hierarchy.</p>
          {(stats.orphanCount ?? 0) === 0
            ? <p className="text-sm text-gray-400 text-center py-8">No orphan employees found — all employees are part of the hierarchy</p>
            : stats.orphanEmployees?.length > 0
              ? stats.orphanEmployees.map(emp => <EmpRow key={emp.id} emp={emp} />)
              : <p className="text-sm text-gray-400 text-center py-8">No orphan employees found</p>}
        </InsightModal>
      )}

      {insightModal === 'hierarchy' && (
        <InsightModal title={`Hierarchy Breakdown — ${stats.totalHierarchyLevels} Level${stats.totalHierarchyLevels !== 1 ? 's' : ''}`} onClose={() => setInsightModal(null)}>
          <p className="text-xs text-gray-500 mb-4">Employee count at each reporting level, starting from top-level managers.</p>
          {stats.hierarchyByLevel?.length > 0 ? (
            <>
              <div className="space-y-2 mb-4">
                {stats.hierarchyByLevel.map(({ level, count }) => (
                  <div key={level} className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-gray-600 w-16 shrink-0">{level}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                      <div className="bg-blue-500 h-5 rounded-full flex items-center justify-end pr-2 transition-all"
                        style={{ width: `${Math.max(8, (count / (stats.activeEmployees || 1)) * 100)}%` }}>
                        <span className="text-white text-[10px] font-bold">{count}</span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 w-10 text-right shrink-0">{count}</span>
                  </div>
                ))}
              </div>
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                <p className="text-xs text-blue-700 font-semibold">Total Hierarchy Levels: {stats.totalHierarchyLevels}</p>
                <p className="text-xs text-blue-600 mt-0.5">Max Reporting Depth: {stats.maxReportingDepth}</p>
              </div>
            </>
          ) : <p className="text-sm text-gray-400 text-center py-8">No hierarchy data available</p>}
        </InsightModal>
      )}
    </div>
  );
}
