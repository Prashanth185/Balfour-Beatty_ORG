import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Crown, Users, Trash2, ArrowLeft, Plus, X, Check, Edit2, Save } from 'lucide-react';
import { evms } from '../../api/client';

const inp = 'w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400';

export default function EVMSHosts() {
  const navigate = useNavigate();
  const [visits,  setVisits]  = useState([]);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);

  // ── Add form state ──
  const [showAdd,      setShowAdd]      = useState(false);
  const [addVisitId,   setAddVisitId]   = useState('');
  const [addCompany,   setAddCompany]   = useState('');
  const [addIsHead,    setAddIsHead]    = useState(false);
  const [addHeadName,  setAddHeadName]  = useState('');
  const [addHeadDesig, setAddHeadDesig] = useState('');
  const [addMembers,   setAddMembers]   = useState([{ host_name: '' }]);
  const [addSaving,    setAddSaving]    = useState(false);
  const [addErrors,    setAddErrors]    = useState({});

  const setAddMember = (i, v) => setAddMembers(p => p.map((r, idx) => idx === i ? { host_name: v } : r));
  const addMemberRow  = () => setAddMembers(p => [...p, { host_name: '' }]);
  const delMemberRow  = (i) => setAddMembers(p => p.filter((_, idx) => idx !== i));

  // ── Edit state ──
  const [editId,   setEditId]   = useState(null);
  const [editForm, setEditForm] = useState({});
  const setE = (k,v) => setEditForm(p=>({...p,[k]:v}));

  const loadHosts = () => {
    setLoading(true);
    evms.visits.list().then(async (vs) => {
      const enriched = await Promise.all(vs.map(v =>
        evms.visits.get(v.id).then(full => ({ ...v, hosts: full.hosts || [] }))
      ));
      setVisits(enriched);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadHosts(); }, []);

  const handleDelete = async (hostId, hostName) => {
    if (!confirm(`Delete host "${hostName}"?`)) return;
    try { await evms.hosts.delete(hostId); loadHosts(); }
    catch (err) { alert(`Failed: ${err.message}`); }
  };

  const startEdit = (h) => {
    setEditId(h.id);
    setEditForm({ host_name: h.host_name||'', designation: h.designation||'', company_name: h.company_name||'', is_company_head: !!h.is_company_head });
  };
  const cancelEdit = () => { setEditId(null); setEditForm({}); };
  const saveEdit = async () => {
    if (!editForm.host_name?.trim()) return alert('Host Name required');
    await evms.hosts.update(editId, editForm);
    setEditId(null); setEditForm({}); loadHosts();
  };

  const handleAdd = async () => {
    const e = {};
    if (!addVisitId) e.visitId = 'Select a visit';
    const validMembers = addMembers.filter(m => m.host_name?.trim());
    if (!addIsHead && validMembers.length === 0) e.members = 'Add at least one team member or enable Company Head';
    if (addIsHead && !addHeadName.trim()) e.headName = 'Company Head name is required';
    setAddErrors(e);
    if (Object.keys(e).length) return;
    setAddSaving(true);
    try {
      // Save Company Head if enabled
      if (addIsHead && addHeadName.trim()) {
        await evms.hosts.create(addVisitId, {
          host_name: addHeadName.trim(),
          designation: addHeadDesig.trim(),
          company_name: addCompany.trim(),
          is_company_head: 1,
        });
      }
      // Save all valid team members
      for (const m of validMembers) {
        await evms.hosts.create(addVisitId, {
          host_name: m.host_name.trim(),
          company_name: addCompany.trim(),
          is_company_head: 0,
        });
      }
      setShowAdd(false);
      setAddHeadName(''); setAddHeadDesig(''); setAddCompany(''); setAddVisitId('');
      setAddIsHead(false); setAddMembers([{ host_name: '' }]); setAddErrors({});
      loadHosts();
    } catch (err) { alert(`Save failed: ${err.message}`); }
    finally { setAddSaving(false); }
  };

  const groupByCompany = (hosts) => {
    const map = {};
    hosts.forEach(h => {
      const key = h.company_name || 'Host Team';
      if (!map[key]) map[key] = { head: null, members: [] };
      if (h.is_company_head) map[key].head = h;
      else map[key].members.push(h);
    });
    return map;
  };

  const filteredVisits = search.trim()
    ? visits.filter(v =>
        v.hosts?.length > 0 && (
          v.visit_name.toLowerCase().includes(search.toLowerCase()) ||
          v.hosts.some(h =>
            h.host_name?.toLowerCase().includes(search.toLowerCase()) ||
            h.company_name?.toLowerCase().includes(search.toLowerCase())
          )
        )
      )
    : visits.filter(v => v.hosts?.length > 0);

  const allVisits = visits; // for add-form dropdown

  return (
    <div className="space-y-4">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/evms')}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4" /> Return to EVMS Dashboard
        </button>
        <button onClick={() => setShowAdd(s => !s)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">
          {showAdd ? <><X className="w-4 h-4"/> Cancel</> : <><Plus className="w-4 h-4"/> Add Host</>}
        </button>
      </div>

      <h1 className="text-xl font-bold text-gray-900">All Hosts</h1>

      {/* ── Inline Add Form ── */}
      {showAdd && (
        <div className="card border-violet-200 bg-violet-50 space-y-4 p-4">
          <h3 className="text-sm font-semibold text-violet-700 flex items-center gap-2">
            <Plus className="w-4 h-4"/> Add New Host(s)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Visit */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Visit <span className="text-red-500">*</span></label>
              <select className={`${inp} ${addErrors.visitId ? 'border-red-400' : ''}`}
                value={addVisitId} onChange={e => { setAddVisitId(e.target.value); setAddErrors(p=>({...p,visitId:null})); }}>
                <option value="">Select a visit…</option>
                {allVisits.map(v => <option key={v.id} value={v.id}>{v.visit_name}</option>)}
              </select>
              {addErrors.visitId && <p className="text-xs text-red-500 mt-1">{addErrors.visitId}</p>}
            </div>

            {/* Company */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Company</label>
              <input className={inp}
                placeholder="e.g. BB GCC, TCS, Microsoft"
                value={addCompany} onChange={e => setAddCompany(e.target.value)}/>
            </div>
          </div>

          {/* Company Head toggle */}
          <div className="border border-amber-200 bg-amber-50 rounded-xl p-3 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-amber-700 flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-500"/> Company Head
                <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full font-normal">Optional</span>
              </label>
              <div onClick={() => { setAddIsHead(p=>!p); setAddErrors(e=>({...e,headName:null})); }}
                className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${addIsHead ? 'bg-amber-500' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${addIsHead ? 'translate-x-5' : 'translate-x-0.5'}`}/>
              </div>
            </div>
            {addIsHead && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Head Name <span className="text-red-500">*</span></label>
                  <input className={`${inp} ${addErrors.headName ? 'border-red-400' : ''}`}
                    placeholder="Full name"
                    value={addHeadName} onChange={e => { setAddHeadName(e.target.value); setAddErrors(p=>({...p,headName:null})); }}/>
                  {addErrors.headName && <p className="text-xs text-red-500 mt-1">{addErrors.headName}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Designation</label>
                  <input className={inp} placeholder="e.g. Director, VP"
                    value={addHeadDesig} onChange={e => setAddHeadDesig(e.target.value)}/>
                </div>
              </div>
            )}
          </div>

          {/* Team Members */}
          <div className="border border-violet-200 bg-white rounded-xl p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-violet-500"/>
              <span className="text-sm font-semibold text-violet-700">Team Members</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full font-normal">Optional</span>
            </div>
            <div className="space-y-2">
              {addMembers.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className={inp} placeholder={`Member ${i+1} name`}
                    value={m.host_name}
                    onChange={e => setAddMember(i, e.target.value)}/>
                  {addMembers.length > 1 && (
                    <button onClick={() => delMemberRow(i)}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 shrink-0">
                      <Trash2 className="w-4 h-4"/>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addMemberRow}
              className="flex items-center gap-2 px-3 py-1.5 border-2 border-dashed border-violet-300 rounded-lg
                         text-violet-500 hover:border-violet-500 hover:text-violet-700 transition-colors w-full justify-center text-sm">
              <Plus className="w-4 h-4"/> Add Another Member
            </button>
            {addErrors.members && <p className="text-xs text-red-500">{addErrors.members}</p>}
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-1 border-t border-violet-200">
            <button onClick={() => { setShowAdd(false); setAddErrors({}); setAddIsHead(false); setAddHeadName(''); setAddHeadDesig(''); setAddMembers([{host_name:''}]); setAddCompany(''); setAddVisitId(''); }}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-white text-gray-600">
              Cancel
            </button>
            <button onClick={handleAdd} disabled={addSaving}
              className="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center gap-2">
              {addSaving ? 'Saving…' : <><Check className="w-4 h-4"/> Save Hosts</>}
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <input type="text" placeholder="Search hosts or companies…" value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full max-w-sm px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />

      {loading
        ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"/></div>
        : filteredVisits.length === 0
          ? <div className="card text-center py-10 text-gray-400 text-sm">No hosts found</div>
          : (
            <div className="space-y-6">
              {filteredVisits.map(v => {
                const companies = groupByCompany(v.hosts);
                return (
                  <div key={v.id} className="card space-y-4">
                    {/* Visit Header */}
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                      <Link to={`/evms/visits/${v.id}`}
                        className="text-base font-bold text-gray-900 hover:text-primary-600 transition-colors">
                        {v.visit_name}
                      </Link>
                      <span className="text-xs text-gray-400">{v.start_date || '—'} → {v.end_date || '—'}</span>
                    </div>

                    {/* Companies */}
                    <div className="space-y-5">
                      {Object.entries(companies).map(([companyName, group]) => (
                        <div key={companyName} className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-violet-500 shrink-0" />
                            <span className="text-sm font-bold text-violet-700">{companyName}</span>
                          </div>

                          {/* Company Head */}
                          {group.head && (
                            editId === group.head.id ? (
                              <div className="border border-primary-200 rounded-xl p-3 bg-primary-50 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <div><label className="block text-xs font-medium text-gray-500 mb-1">Host Name *</label>
                                    <input className={inp} value={editForm.host_name||''} onChange={e=>setE('host_name',e.target.value)}/></div>
                                  <div><label className="block text-xs font-medium text-gray-500 mb-1">Designation</label>
                                    <input className={inp} value={editForm.designation||''} onChange={e=>setE('designation',e.target.value)}/></div>
                                  <div className="col-span-2"><label className="block text-xs font-medium text-gray-500 mb-1">Company</label>
                                    <input className={inp} value={editForm.company_name||''} onChange={e=>setE('company_name',e.target.value)}/></div>
                                  <div className="col-span-2 flex items-center gap-2">
                                    <input type="checkbox" checked={!!editForm.is_company_head} onChange={e=>setE('is_company_head',e.target.checked)} className="rounded"/>
                                    <label className="text-xs text-gray-600">Company Head</label>
                                  </div>
                                </div>
                                <div className="flex gap-2 justify-end">
                                  <button onClick={cancelEdit} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-white flex items-center gap-1"><X className="w-3 h-3"/>Cancel</button>
                                  <button onClick={saveEdit} className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-1"><Save className="w-3 h-3"/>Save</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl p-3">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0">
                                  <Crown className="w-4 h-4 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-gray-900">{group.head.host_name}</p>
                                  <p className="text-xs text-amber-700">{group.head.designation || 'Company Head'}</p>
                                </div>
                                <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-semibold shrink-0">Company Head</span>
                                <button onClick={()=>startEdit(group.head)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400" title="Edit"><Edit2 className="w-3.5 h-3.5"/></button>
                                <button onClick={()=>handleDelete(group.head.id, group.head.host_name)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400" title="Delete"><Trash2 className="w-4 h-4"/></button>
                              </div>
                            )
                          )}

                          {/* Host Team */}
                          {group.members.length > 0 && (
                            <div>
                              <div className="flex items-center gap-1.5 mb-2">
                                <Users className="w-3.5 h-3.5 text-gray-400" />
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Host Team</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {group.members.map(h => (
                                  editId === h.id ? (
                                    <div key={h.id} className="col-span-full border border-primary-200 rounded-xl p-3 bg-primary-50 space-y-3">
                                      <div className="grid grid-cols-2 gap-3">
                                        <div><label className="block text-xs font-medium text-gray-500 mb-1">Host Name *</label>
                                          <input className={inp} value={editForm.host_name||''} onChange={e=>setE('host_name',e.target.value)}/></div>
                                        <div><label className="block text-xs font-medium text-gray-500 mb-1">Designation</label>
                                          <input className={inp} value={editForm.designation||''} onChange={e=>setE('designation',e.target.value)}/></div>
                                        <div className="col-span-2"><label className="block text-xs font-medium text-gray-500 mb-1">Company</label>
                                          <input className={inp} value={editForm.company_name||''} onChange={e=>setE('company_name',e.target.value)}/></div>
                                        <div className="col-span-2 flex items-center gap-2">
                                          <input type="checkbox" checked={!!editForm.is_company_head} onChange={e=>setE('is_company_head',e.target.checked)} className="rounded"/>
                                          <label className="text-xs text-gray-600">Company Head</label>
                                        </div>
                                      </div>
                                      <div className="flex gap-2 justify-end">
                                        <button onClick={cancelEdit} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-white flex items-center gap-1"><X className="w-3 h-3"/>Cancel</button>
                                        <button onClick={saveEdit} className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg flex items-center gap-1"><Save className="w-3 h-3"/>Save</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div key={h.id} className="flex items-center justify-between gap-2 p-2.5 bg-gray-50 border border-gray-100 rounded-lg">
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 text-white text-xs font-bold">
                                          {(h.host_name || '?')[0].toUpperCase()}
                                        </div>
                                        <p className="text-xs font-semibold text-gray-900 truncate">{h.host_name}</p>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button onClick={()=>startEdit(h)} className="p-1 rounded hover:bg-blue-50 text-blue-400" title="Edit"><Edit2 className="w-3.5 h-3.5"/></button>
                                        <button onClick={()=>handleDelete(h.id, h.host_name)} className="p-1 rounded hover:bg-red-50 text-red-400" title="Delete"><Trash2 className="w-3.5 h-3.5"/></button>
                                      </div>
                                    </div>
                                  )
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )
      }
    </div>
  );
}
