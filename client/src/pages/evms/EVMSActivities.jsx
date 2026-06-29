/**
 * EVMS — All Activities
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, Trash2, ArrowLeft } from 'lucide-react';
import { evms } from '../../api/client';

const ACTIVITY_ICONS = {
  'Airport Pickup': '🚗',
  'Airport Drop': '🚕',
  'Hotel Check-in': '🏨',
  'Hotel Check-out': '🏨',
  'Breakfast': '☕',
  'Lunch': '🍽️',
  'Dinner': '🍷',
  'Tea Break': '☕',
  'Office Transfer': '🚗',
  'Travel': '✈️',
  'Site Visit': '🏗️',
  'Factory Visit': '🏭',
  'Networking': '👥',
  'Registration': '📝',
  'Rest at Hotel': '🛏️',
  'Free Time': '🎯',
  'Custom': '📌',
};

function fmt(d) {
  if (!d) return '—';
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

function fmtTime(t) {
  if (!t) return '—';
  try {
    const [h, m] = t.split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  } catch {
    return t;
  }
}

export default function EVMSActivities() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    evms.visits
      .list()
      .then(async vs => {
        const all = await Promise.all(
          vs.map(v =>
            evms.visits.get(v.id).then(full =>
              (full.activities || []).map(a => ({ ...a, visit_name: v.visit_name }))
            )
          )
        );
        setRows(all.flat().sort((a, b) => {
          if (a.activity_date !== b.activity_date) return (b.activity_date || '').localeCompare(a.activity_date || '');
          return (b.start_time || '').localeCompare(a.start_time || '');
        }));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id, type) => {
    if (!confirm(`Delete activity "${type}"?`)) return;
    try {
      await evms.activities.delete(id);
      load();
    } catch (err) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  const filtered = search.trim()
    ? rows.filter(
        r =>
          r.activity_type?.toLowerCase().includes(search.toLowerCase()) ||
          r.location?.toLowerCase().includes(search.toLowerCase())
      )
    : rows;

  const navigate = useNavigate();

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

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">All Activities</h1>
        <Link
          to="/evms/activities/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
        >
          <Calendar className="w-4 h-4" /> Add Activity
        </Link>
      </div>

      <input
        type="text"
        placeholder="Search activities…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full max-w-sm px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
      />

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="pb-2 pr-4 font-semibold">Activity</th>
                <th className="pb-2 pr-4 font-semibold">Date</th>
                <th className="pb-2 pr-4 font-semibold">Time</th>
                <th className="pb-2 pr-4 font-semibold">Location</th>
                <th className="pb-2 pr-4 font-semibold">Visit</th>
                <th className="pb-2 pr-4 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/70 transition-colors">
                  <td className="py-3 pr-4 font-semibold text-gray-900">
                    <span className="mr-2">{ACTIVITY_ICONS[a.activity_type] || '📌'}</span>
                    {a.activity_type}
                  </td>
                  <td className="py-3 pr-4 text-gray-600">{fmt(a.activity_date)}</td>
                  <td className="py-3 pr-4 text-gray-600">
                    {fmtTime(a.start_time)}
                    {a.end_time && ` – ${fmtTime(a.end_time)}`}
                  </td>
                  <td className="py-3 pr-4 text-gray-600">{a.location || '—'}</td>
                  <td className="py-3 pr-4">
                    <Link
                      to={`/evms/visits/${a.visit_id}`}
                      className="text-primary-600 hover:text-primary-700 hover:underline text-xs font-medium"
                    >
                      {a.visit_name}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">
                    <button
                      onClick={() => handleDelete(a.id, a.activity_type)}
                      className="p-1 rounded hover:bg-red-50 text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-gray-400 text-sm">
                    No activities found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
