import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, ArrowLeft } from 'lucide-react';
import { evms } from '../../api/client';

export default function EVMSMeetings() {
  const navigate = useNavigate();
  const [rows, setRows]     = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    evms.visits.list().then(async (vs) => {
      const all = await Promise.all(vs.map(v =>
        evms.meetings.list(v.id).then(ms => ms.map(m => ({ ...m, visit_name: v.visit_name })))
      ));
      setRows(all.flat());
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id, title) => {
    if (!confirm(`Delete meeting "${title}"? This action cannot be undone.`)) return;
    try {
      await evms.meetings.delete(id);
      load();
    } catch (err) {
      alert(`Failed to delete meeting: ${err.message}`);
    }
  };

  const filtered = search.trim()
    ? rows.filter(r => r.meeting_title.toLowerCase().includes(search.toLowerCase()) || r.visit_name.toLowerCase().includes(search.toLowerCase()))
    : rows;

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

      <h1 className="text-xl font-bold text-gray-900">All Meetings</h1>
      <input type="text" placeholder="Search meetings…" value={search} onChange={e => setSearch(e.target.value)}
        className="w-full max-w-sm px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
      <div className="card overflow-x-auto">
        {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"/></div> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b border-gray-100">
              {['Meeting Title','Visit','Date','Time','Location','',''].map(h => <th key={h} className="pb-2 pr-4 font-medium">{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 pr-4 font-medium text-gray-900">{m.meeting_title}</td>
                  <td className="py-2 pr-4"><Link to={`/evms/visits/${m.visit_id}`} className="text-primary-600 hover:underline text-xs">{m.visit_name}</Link></td>
                  <td className="py-2 pr-4 text-gray-600">{m.meeting_date||'—'}</td>
                  <td className="py-2 pr-4 text-gray-600">{m.start_time&&m.end_time?`${m.start_time}–${m.end_time}`:'—'}</td>
                  <td className="py-2 pr-4 text-gray-600">{m.location||'—'}</td>
                  <td className="py-2"><Link to={`/evms/visits/${m.visit_id}?tab=4`} className="text-xs text-primary-600 hover:underline">View</Link></td>
                  <td className="py-2">
                    <button
                      onClick={() => handleDelete(m.id, m.meeting_title)}
                      className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                      title="Delete meeting"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length===0&&<tr><td colSpan={7} className="py-8 text-center text-gray-400 text-sm">No meetings found</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
