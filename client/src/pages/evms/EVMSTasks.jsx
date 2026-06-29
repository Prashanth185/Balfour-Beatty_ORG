import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { evms } from '../../api/client';

const PRIORITY_COLORS = {
  Low:'bg-gray-100 text-gray-600', Medium:'bg-blue-100 text-blue-700',
  High:'bg-amber-100 text-amber-800', Critical:'bg-red-100 text-red-800',
};

export default function EVMSTasks() {
  const [visits, setVisits] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    evms.visits.list().then(async (vs) => {
      setVisits(vs);
      const taskArrays = await Promise.all(vs.map(v => evms.tasks.list(v.id).then(ts => ts.map(t => ({ ...t, visit_name: v.visit_name })))));
      setAllTasks(taskArrays.flat());
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'All' ? allTasks : allTasks.filter(t => t.status === filter);

  const toggle = async (t) => {
    const next = t.status === 'Pending' ? 'In Progress' : t.status === 'In Progress' ? 'Completed' : 'Pending';
    await evms.tasks.update(t.id, { ...t, status: next });
    setAllTasks(prev => prev.map(x => x.id === t.id ? { ...x, status: next } : x));
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">All Tasks</h1>
      <div className="flex gap-2">
        {['All','Pending','In Progress','Completed'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${filter===s?'bg-primary-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{s}</button>
        ))}
        <span className="ml-auto text-xs text-gray-400 self-center">{filtered.length} tasks</span>
      </div>
      <div className="card space-y-2">
        {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"/></div> :
        filtered.length === 0 ? <p className="text-center text-gray-400 text-sm py-8">No tasks found</p> :
        filtered.map(t => (
          <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
            <button onClick={() => toggle(t)} className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${t.status==='Completed'?'bg-green-500 border-green-500':'border-gray-300'}`}>
              {t.status==='Completed'&&<span className="text-white text-[10px]">✓</span>}
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${t.status==='Completed'?'line-through text-gray-400':'text-gray-900'}`}>{t.task_name}</p>
              <p className="text-xs text-gray-400">
                <Link to={`/evms/visits/${t.visit_id}`} className="hover:text-primary-600">{t.visit_name}</Link>
                {t.owner&&` · ${t.owner}`}{t.due_date&&` · Due: ${t.due_date}`}
              </p>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${PRIORITY_COLORS[t.priority]||'bg-gray-100 text-gray-600'}`}>{t.priority}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
