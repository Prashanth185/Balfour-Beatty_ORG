import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plane, ArrowLeft } from 'lucide-react';
import { evms } from '../../api/client';

function fmt(dateStr) {
  if (!dateStr) return null;
  try { return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }); }
  catch { return dateStr; }
}
function fmtTime(t) {
  if (!t) return null;
  try {
    const [h, m] = t.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${period}`;
  } catch { return t; }
}

export default function EVMSVisitors() {
  const navigate = useNavigate();
  const [rows,    setRows]    = useState([]);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    evms.visits.list().then(async (vs) => {
      const all = await Promise.all(vs.map(v =>
        evms.visits.get(v.id).then(full =>
          (full.visitors || []).map(vis => ({ ...vis, visit_name: v.visit_name }))
        )
      ));
      setRows(all.flat());
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = search.trim()
    ? rows.filter(r =>
        r.visitor_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.travel_arrival_airport?.toLowerCase().includes(search.toLowerCase())
      )
    : rows;

  const hasTravel = (v) =>
    v.travel_arrival_airport || v.travel_arrival_date ||
    v.travel_departure_airport || v.travel_departure_date;

  return (
    <div className="space-y-4">
      {/* Return to EVMS Dashboard Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/evms')}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Return to EVMS Dashboard
        </button>
      </div>

      <h1 className="text-xl font-bold text-gray-900">All Visitors</h1>
      <input type="text" placeholder="Search visitors…" value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full max-w-sm px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />

      <div className="card overflow-x-auto">
        {loading
          ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"/></div>
          : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 pr-4 font-semibold">Visitor Name</th>
                  <th className="pb-2 pr-4 font-semibold">Arrival</th>
                  <th className="pb-2 pr-4 font-semibold">Departure</th>
                  <th className="pb-2 pr-4 font-semibold">Travel</th>
                  <th className="pb-2 pr-4 font-semibold">Visit</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(v => (
                  <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50/70 transition-colors align-top">
                    <td className="py-3 pr-4 font-semibold text-gray-900">{v.visitor_name}</td>

                    {/* Arrival */}
                    <td className="py-3 pr-4">
                      {v.travel_arrival_airport || v.travel_arrival_date ? (
                        <div className="space-y-0.5">
                          {v.travel_arrival_airport && (
                            <p className="text-xs font-medium text-gray-700">{v.travel_arrival_airport}</p>
                          )}
                          {v.travel_arrival_date && (
                            <p className="text-xs text-gray-500">{fmt(v.travel_arrival_date)}</p>
                          )}
                          {v.travel_arrival_time && (
                            <p className="text-xs text-primary-600 font-medium">{fmtTime(v.travel_arrival_time)}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>

                    {/* Departure */}
                    <td className="py-3 pr-4">
                      {v.travel_departure_airport || v.travel_departure_date ? (
                        <div className="space-y-0.5">
                          {v.travel_departure_airport && (
                            <p className="text-xs font-medium text-gray-700">{v.travel_departure_airport}</p>
                          )}
                          {v.travel_departure_date && (
                            <p className="text-xs text-gray-500">{fmt(v.travel_departure_date)}</p>
                          )}
                          {v.travel_departure_time && (
                            <p className="text-xs text-primary-600 font-medium">{fmtTime(v.travel_departure_time)}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>

                    {/* Travel type badge */}
                    <td className="py-3 pr-4">
                      {hasTravel(v) ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-primary-700 rounded-full text-[10px] font-medium">
                          <Plane className="w-3 h-3" /> Scheduled
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>

                    <td className="py-3 pr-4">
                      <Link to={`/evms/visits/${v.visit_id}`}
                        className="text-primary-600 hover:text-primary-700 hover:underline text-xs font-medium">
                        {v.visit_name}
                      </Link>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="py-10 text-center text-gray-400 text-sm">No visitors found</td></tr>
                )}
              </tbody>
            </table>
          )}
      </div>
    </div>
  );
}
