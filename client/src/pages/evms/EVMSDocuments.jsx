import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Trash2 } from 'lucide-react';
import { evms } from '../../api/client';

export default function EVMSDocuments() {
  const [rows, setRows]     = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    evms.visits.list().then(async (vs) => {
      const all = await Promise.all(vs.map(v =>
        evms.documents.list(v.id).then(ds => ds.map(d => ({ ...d, visit_name: v.visit_name })))
      ));
      setRows(all.flat());
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const del = async (id) => {
    if (!confirm('Delete document?')) return;
    await evms.documents.delete(id);
    load();
  };

  const filtered = search.trim()
    ? rows.filter(r => r.document_name?.toLowerCase().includes(search.toLowerCase()) || r.document_type?.toLowerCase().includes(search.toLowerCase()))
    : rows;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">All Documents</h1>
      <input type="text" placeholder="Search documents…" value={search} onChange={e => setSearch(e.target.value)}
        className="w-full max-w-sm px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
      <div className="card">
        {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"/></div> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map(d => (
              <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
                <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{d.document_name}</p>
                  <p className="text-xs text-gray-400">{d.document_type} · <Link to={`/evms/visits/${d.visit_id}`} className="hover:text-primary-600">{d.visit_name}</Link> · {d.upload_date}</p>
                </div>
                {d.file_url && <a href={d.file_url} target="_blank" rel="noreferrer" className="text-xs text-primary-600 hover:underline shrink-0">View</a>}
                <button onClick={() => del(d.id)} className="p-1 rounded hover:bg-red-50 text-red-400 shrink-0"><Trash2 className="w-4 h-4"/></button>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-gray-400 text-sm py-8 text-center col-span-2">No documents found</p>}
          </div>
        )}
      </div>
    </div>
  );
}
