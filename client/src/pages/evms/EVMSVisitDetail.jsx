import TimelineTab from './EVMSTimelineTab';
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Save, X, Plus, Trash2, FileText, Users, Building2, Network,
         MessageSquare, Download, Printer, ChevronDown, Image } from 'lucide-react';
import { evms } from '../../api/client';
import EVMSVisitTemplate from './EVMSVisitTemplate';
import EVMSPrintModal from './EVMSPrintModal';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const TABS = ['Overview','Visitors','Hosts','Timeline','Documents','Comments'];
const STATUS_COLORS = {
  Planning:'bg-amber-100 text-amber-800', Approved:'bg-blue-100 text-blue-800',
  'In Progress':'bg-green-100 text-green-800', Completed:'bg-gray-100 text-gray-700',
  Cancelled:'bg-red-100 text-red-800',
};
const STATUS_OPTS = ['Planning','Approved','In Progress','Completed','Cancelled'];
const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400';

const ACTIVITY_ICONS = {
  'Airport Pickup': '🚗', 'Airport Drop': '🚕', 'Hotel Check-in': '🏨', 'Hotel Check-out': '🏨',
  'Breakfast': '☕', 'Lunch': '🍽️', 'Dinner': '🍷', 'Tea Break': '☕', 'Coffee Break': '☕',
  'Office Transfer': '🚗', 'Travel': '✈️', 'Factory Visit': '🏭', 'Site Visit': '🏗️',
  'Plant Visit': '🏭', 'Campus Visit': '🏫', 'Customer Visit': '🤝', 'Vendor Visit': '🤝',
  'Registration': '📝', 'Networking': '👥', 'Training': '📚', 'Workshop': '🛠️',
  'Project Briefing': '📊', 'Photo Session': '📸', 'Media Interaction': '📰',
  'Evening Walk': '🚶', 'Shopping': '🛍️', 'CEO Discussion': '💼', 'Security Check': '🔒',
  'Executive Welcome': '🎉', 'Board Review': '📋', 'Rest at Hotel': '🛏️', 'Free Time': '🎯',
};

function Badge({ label, colorClass }) {
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>{label}</span>;
}
function Field({ label, children }) {
  return <div><label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>{children}</div>;
}

// ── Export Menu ───────────────────────────────────────────────────────────────
function ExportMenu({ onExportPDF, onExportPNG, onPrint, onDownloadTemplate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700 transition-colors">
        <Download className="w-3.5 h-3.5" /> Export <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-[200] w-48 bg-white rounded-xl border border-gray-200 shadow-lg py-1 text-sm">
          <button onClick={() => { onExportPDF(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50 text-gray-700">
            <FileText className="w-4 h-4 text-red-500" /> Export as PDF
          </button>
          <button onClick={() => { onExportPNG(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50 text-gray-700">
            <Image className="w-4 h-4 text-blue-500" /> Export as PNG
          </button>
          <button onClick={() => { onPrint(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50 text-gray-700">
            <Printer className="w-4 h-4 text-gray-500" /> Print
          </button>
          <div className="border-t border-gray-100 mt-1 pt-1">
            <button onClick={() => { onDownloadTemplate(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50 text-gray-700">
              <Download className="w-4 h-4 text-green-500" /> Download Template
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab({ visit, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(visit);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  const save = async () => { await evms.visits.update(visit.id, form); onSaved(); setEditing(false); };
  if (!editing) return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={()=>setEditing(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50"><Edit2 className="w-3.5 h-3.5"/> Edit</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
        {[['Visit Name',visit.visit_name],['Start Date',visit.start_date],['End Date',visit.end_date],['Coordinator',visit.coordinator||'—']].map(([l,v])=>(
          <div key={l}><p className="text-xs text-gray-400">{l}</p><p className="font-medium text-gray-900">{v||'—'}</p></div>
        ))}
        <div><p className="text-xs text-gray-400">Status</p><Badge label={visit.status} colorClass={STATUS_COLORS[visit.status]||'bg-gray-100 text-gray-700'}/></div>
      </div>
      {visit.description&&<div><p className="text-xs text-gray-400 mb-1">Description</p><p className="text-sm text-gray-700">{visit.description}</p></div>}
      <div className="grid grid-cols-3 gap-3 pt-2">
        <div className="bg-blue-50 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-blue-700">{visit.visitors?.length||0}</p>
          <p className="text-xs text-blue-600 flex items-center justify-center gap-1"><Users className="w-3 h-3"/>Visitors</p>
        </div>
        <div className="bg-violet-50 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-violet-700">{visit.hosts?.length||0}</p>
          <p className="text-xs text-violet-600 flex items-center justify-center gap-1"><Building2 className="w-3 h-3"/>Hosts</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3 text-center">
          <p className="text-xl font-bold text-green-700">{(visit.meetings?.length||0) + (visit.activities?.length||0)}</p>
          <p className="text-xs text-green-600 flex items-center justify-center gap-1"><Network className="w-3 h-3"/>Timeline</p>
        </div>
      </div>
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[['visit_name','Visit Name','text'],['start_date','Start Date','date'],['end_date','End Date','date'],['coordinator','Coordinator','text']].map(([k,l,t])=>(
          <Field key={k} label={l}><input type={t} className={inp} value={form[k]||''} onChange={e=>set(k,e.target.value)}/></Field>
        ))}
        <Field label="Status"><select className={inp} value={form.status||'Planning'} onChange={e=>set('status',e.target.value)}>{STATUS_OPTS.map(s=><option key={s}>{s}</option>)}</select></Field>
      </div>
      <Field label="Description"><textarea className={`${inp} h-20 resize-none`} value={form.description||''} onChange={e=>set('description',e.target.value)}/></Field>
      <div className="flex gap-2 justify-end">
        <button onClick={()=>setEditing(false)} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50"><X className="w-3.5 h-3.5 inline mr-1"/>Cancel</button>
        <button onClick={save} className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700"><Save className="w-3.5 h-3.5 inline mr-1"/>Save</button>
      </div>
    </div>
  );
}

// ── Visitors Tab ──────────────────────────────────────────────────────────────
function VisitorsTab({ visitId, visitors, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  const save=async()=>{
    if(!form.visitor_name?.trim()) return alert('Name required');
    await evms.visitors.create(visitId, form);
    setForm({}); setShowForm(false); onRefresh();
  };
  const del=async(id)=>{ if(!confirm('Delete visitor?')) return; await evms.visitors.delete(id); onRefresh(); };

  function fmt(d) {
    if(!d) return null;
    try { return new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); }
    catch { return d; }
  }
  function fmtT(t) {
    if(!t) return null;
    try { const [h,m]=t.split(':').map(Number); return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`; }
    catch { return t; }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={()=>setShowForm(s=>!s)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          <Plus className="w-3.5 h-3.5"/>Add Visitor
        </button>
      </div>
      {showForm&&(
        <div className="border border-primary-200 rounded-xl p-4 bg-primary-50 space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <div><label className="block text-xs font-medium text-gray-500 mb-1">Visitor Name *</label>
              <input className={inp} value={form.visitor_name||''} onChange={e=>set('visitor_name',e.target.value)}/></div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={()=>setShowForm(false)} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-white">Cancel</button>
            <button onClick={save} className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700">Save</button>
          </div>
        </div>
      )}
      {visitors.length === 0
        ? <p className="text-center text-gray-400 text-sm py-8">No visitors added</p>
        : (
          <div className="space-y-3">
            {visitors.map(v => (
              <div key={v.id} className="flex gap-4 items-start p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {(v.visitor_name||'?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{v.visitor_name}</p>
                  {/* Travel details */}
                  {(v.travel_arrival_airport || v.travel_arrival_date || v.travel_departure_airport) ? (
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(v.travel_arrival_airport || v.travel_arrival_date) && (
                        <div className="flex items-start gap-1.5 bg-blue-50 rounded-lg px-3 py-2">
                          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mt-0.5 shrink-0">Arr</span>
                          <div>
                            {v.travel_arrival_airport && <p className="text-xs font-medium text-gray-700">{v.travel_arrival_airport}</p>}
                            {v.travel_arrival_date && <p className="text-xs text-gray-500">{fmt(v.travel_arrival_date)}{v.travel_arrival_time ? ` · ${fmtT(v.travel_arrival_time)}` : ''}</p>}
                          </div>
                        </div>
                      )}
                      {(v.travel_departure_airport || v.travel_departure_date) && (
                        <div className="flex items-start gap-1.5 bg-green-50 rounded-lg px-3 py-2">
                          <span className="text-[10px] font-bold text-green-600 uppercase tracking-wide mt-0.5 shrink-0">Dep</span>
                          <div>
                            {v.travel_departure_airport && <p className="text-xs font-medium text-gray-700">{v.travel_departure_airport}</p>}
                            {v.travel_departure_date && <p className="text-xs text-gray-500">{fmt(v.travel_departure_date)}{v.travel_departure_time ? ` · ${fmtT(v.travel_departure_time)}` : ''}</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 mt-1">No travel details</p>
                  )}
                </div>
                <button onClick={()=>del(v.id)} className="p-1 rounded hover:bg-red-50 text-red-400 shrink-0 self-start mt-1">
                  <Trash2 className="w-4 h-4"/>
                </button>
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}

// ── Hosts Tab ─────────────────────────────────────────────────────────────────
function HostsTab({ visitId, hosts, onRefresh }) {
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ is_company_head: false });
  const [editId, setEditId]       = useState(null);   // id of host being edited
  const [editForm, setEditForm]   = useState({});
  const set  = (k,v) => setForm(p=>({...p,[k]:v}));
  const setE = (k,v) => setEditForm(p=>({...p,[k]:v}));

  // ── Add new host ──
  const save = async () => {
    if (!form.host_name?.trim()) return alert('Host Name required');
    await evms.hosts.create(visitId, form);
    setForm({ is_company_head: false }); setShowForm(false); onRefresh();
  };

  // ── Delete ──
  const del = async (id) => {
    if (!confirm('Delete this host?')) return;
    await evms.hosts.delete(id); onRefresh();
  };

  // ── Start editing ──
  const startEdit = (h) => {
    setEditId(h.id);
    setEditForm({
      host_name: h.host_name || '',
      designation: h.designation || '',
      company_name: h.company_name || '',
      is_company_head: !!h.is_company_head,
    });
  };

  // ── Save edit ──
  const saveEdit = async () => {
    if (!editForm.host_name?.trim()) return alert('Host Name required');
    await evms.hosts.update(editId, editForm);
    setEditId(null); setEditForm({}); onRefresh();
  };

  const cancelEdit = () => { setEditId(null); setEditForm({}); };

  // Group by company
  const companies = {};
  hosts.forEach(h => {
    const key = h.company_name || 'Host Team';
    if (!companies[key]) companies[key] = { head: null, members: [] };
    if (h.is_company_head) companies[key].head = h;
    else companies[key].members.push(h);
  });

  // Inline edit form (reused for both head and member)
  const EditRow = ({ h }) => (
    <div className="border border-primary-200 rounded-xl p-3 bg-primary-50 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Host Name *</label>
          <input className={inp} value={editForm.host_name||''} onChange={e=>setE('host_name',e.target.value)}/>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Designation</label>
          <input className={inp} value={editForm.designation||''} onChange={e=>setE('designation',e.target.value)}/>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">Company</label>
          <input className={inp} value={editForm.company_name||''} onChange={e=>setE('company_name',e.target.value)}/>
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <input type="checkbox" id={`isHeadEdit_${h.id}`}
            checked={!!editForm.is_company_head}
            onChange={e=>setE('is_company_head',e.target.checked)}
            className="rounded"/>
          <label htmlFor={`isHeadEdit_${h.id}`} className="text-xs text-gray-600">This person is the Company Head</label>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={cancelEdit} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-white flex items-center gap-1">
          <X className="w-3 h-3"/> Cancel
        </button>
        <button onClick={saveEdit} className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-1">
          <Save className="w-3 h-3"/> Save
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={()=>setShowForm(s=>!s)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          <Plus className="w-3.5 h-3.5"/>Add Host
        </button>
      </div>

      {/* Add new host form */}
      {showForm&&(
        <div className="border border-primary-200 rounded-xl p-4 bg-primary-50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[['host_name','Host Name *','text'],['designation','Designation','text'],['company_name','Company','text']].map(([k,l,t])=>(
              <div key={k} className={k==='company_name'?'col-span-2':''}>
                <label className="block text-xs font-medium text-gray-500 mb-1">{l}</label>
                <input type={t} className={inp} value={form[k]||''} onChange={e=>set(k,e.target.value)}/>
              </div>
            ))}
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="isHead" checked={!!form.is_company_head} onChange={e=>set('is_company_head',e.target.checked)} className="rounded"/>
              <label htmlFor="isHead" className="text-xs text-gray-600">This person is the Company Head</label>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={()=>setShowForm(false)} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-white">Cancel</button>
            <button onClick={save} className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700">Save</button>
          </div>
        </div>
      )}

      {hosts.length === 0
        ? <p className="text-center text-gray-400 text-sm py-8">No hosts added</p>
        : (
          <div className="space-y-5">
            {Object.entries(companies).map(([companyName, group]) => (
              <div key={companyName} className="space-y-3">
                {/* Company label */}
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-violet-500"/>
                  <span className="text-sm font-bold text-violet-700">{companyName}</span>
                </div>

                {/* Company Head */}
                {group.head && (
                  editId === group.head.id
                    ? <EditRow h={group.head}/>
                    : (
                      <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-100 rounded-xl p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {(group.head.host_name||'?')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{group.head.host_name}</p>
                            <p className="text-xs text-amber-700">{group.head.designation||'Company Head'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-semibold">Head</span>
                          <button onClick={()=>startEdit(group.head)} className="p-1 rounded hover:bg-blue-50 text-blue-400" title="Edit">
                            <Edit2 className="w-3.5 h-3.5"/>
                          </button>
                          <button onClick={()=>del(group.head.id)} className="p-1 rounded hover:bg-red-50 text-red-400" title="Delete">
                            <Trash2 className="w-3.5 h-3.5"/>
                          </button>
                        </div>
                      </div>
                    )
                )}

                {/* Host Team Members */}
                {group.members.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.members.map(h => (
                      editId === h.id
                        ? <div key={h.id} className="col-span-1 sm:col-span-2"><EditRow h={h}/></div>
                        : (
                          <div key={h.id} className="flex items-center justify-between gap-2 p-2.5 bg-gray-50 border border-gray-100 rounded-lg">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                {(h.host_name||'?')[0].toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-gray-900 truncate">{h.host_name}</p>
                                {h.designation && <p className="text-[10px] text-gray-500 truncate">{h.designation}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={()=>startEdit(h)} className="p-1 rounded hover:bg-blue-50 text-blue-400" title="Edit">
                                <Edit2 className="w-3.5 h-3.5"/>
                              </button>
                              <button onClick={()=>del(h.id)} className="p-1 rounded hover:bg-red-50 text-red-400" title="Delete">
                                <Trash2 className="w-3.5 h-3.5"/>
                              </button>
                            </div>
                          </div>
                        )
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}

// ── Meetings Tab ──────────────────────────────────────────────────────────────
function MeetingsTab({ visitId, meetings, visitors, hosts, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ visitor_ids:[], host_ids:[] });
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  const toggleId=(k,id)=>setForm(p=>({...p,[k]:p[k].includes(id)?p[k].filter(x=>x!==id):[...p[k],id]}));
  const save=async()=>{
    if(!form.meeting_title?.trim()) return alert('Title required');
    await evms.meetings.create(visitId, form);
    setForm({visitor_ids:[],host_ids:[]}); setShowForm(false); onRefresh();
  };
  const del=async(id)=>{ if(!confirm('Delete?')) return; await evms.meetings.delete(id); onRefresh(); };
  const getNames=(ids,list,nameKey)=>{ const parsed=typeof ids==='string'?JSON.parse(ids||'[]'):ids||[]; return list.filter(x=>parsed.includes(x.id)).map(x=>x.short_name||x[nameKey]).join(', ')||'—'; };
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={()=>setShowForm(s=>!s)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700"><Plus className="w-3.5 h-3.5"/>Add Meeting</button></div>
      {showForm&&(
        <div className="border border-primary-200 rounded-xl p-4 bg-primary-50 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="md:col-span-3"><label className="block text-xs font-medium text-gray-500 mb-1">Meeting Title *</label><input className={inp} value={form.meeting_title||''} onChange={e=>set('meeting_title',e.target.value)}/></div>
            {[['meeting_date','Date','date'],['start_time','Start Time','time'],['end_time','End Time','time'],['location','Location','text']].map(([k,l,t])=>(
              <div key={k}><label className="block text-xs font-medium text-gray-500 mb-1">{l}</label><input type={t} className={inp} value={form[k]||''} onChange={e=>set(k,e.target.value)}/></div>
            ))}
          </div>
          {visitors.length>0&&<div><p className="text-xs text-gray-500 mb-1">Visitors</p><div className="flex flex-wrap gap-2">{visitors.map(v=><button key={v.id} onClick={()=>toggleId('visitor_ids',v.id)} className={`px-2 py-1 rounded-full text-xs ${form.visitor_ids.includes(v.id)?'bg-primary-600 text-white':'bg-gray-100 text-gray-600'}`}>{v.visitor_name}</button>)}</div></div>}
          {hosts.length>0&&<div><p className="text-xs text-gray-500 mb-1">Hosts</p><div className="flex flex-wrap gap-2">{hosts.map(h=><button key={h.id} onClick={()=>toggleId('host_ids',h.id)} className={`px-2 py-1 rounded-full text-xs ${form.host_ids.includes(h.id)?'bg-violet-600 text-white':'bg-gray-100 text-gray-600'}`}>{h.host_name}</button>)}</div></div>}
          <div className="flex gap-2 justify-end">
            <button onClick={()=>setShowForm(false)} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-white">Cancel</button>
            <button onClick={save} className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700">Save Meeting</button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {meetings.map(m=>(
          <div key={m.id} className="flex gap-3 items-start p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
            <div className="text-xs text-gray-400 w-20 shrink-0 pt-0.5 font-mono">{m.meeting_date||'—'}<br/>{m.start_time}–{m.end_time}</div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 text-sm">{m.meeting_title}</p>
              {m.location&&<p className="text-xs text-gray-500">📍 {m.location}</p>}
              <p className="text-xs text-gray-400 mt-0.5">
                {getNames(m.visitor_ids,visitors,'visitor_name') !== '—' && <span className="mr-2">👤 {getNames(m.visitor_ids,visitors,'visitor_name')}</span>}
                {getNames(m.host_ids,hosts,'host_name') !== '—' && <span>🏢 {getNames(m.host_ids,hosts,'host_name')}</span>}
              </p>
            </div>
            <button onClick={()=>del(m.id)} className="p-1 rounded hover:bg-red-50 text-red-400 shrink-0"><Trash2 className="w-4 h-4"/></button>
          </div>
        ))}
        {meetings.length===0&&<p className="text-center text-gray-400 text-sm py-8">No meetings yet</p>}
      </div>
    </div>
  );
}

// OLD Timeline Tab removed - now using EVMSTimelineTab.jsx component

// ── Documents Tab ─────────────────────────────────────────────────────────────
function DocumentsTab({ visitId, documents, onRefresh }) {
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType]     = useState('');
  const DOC_TYPES = ['Agenda','Flight Ticket','Hotel Confirmation','Presentation','Visitor Profile','Meeting Notes','Photo','Other'];
  const upload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file); fd.append('document_name', file.name);
      fd.append('document_type', docType || 'Other'); fd.append('uploaded_by', 'User'); fd.append('category', docType || 'General');
      await evms.documents.upload(visitId, fd); onRefresh();
    } catch (err) { alert(`Upload failed: ${err.message || ''}`); }
    finally { setUploading(false); e.target.value = ''; }
  };
  const del = async (id) => { if (!confirm('Delete document?')) return; try { await evms.documents.delete(id); onRefresh(); } catch (err) { alert(`Delete failed: ${err.message}`); } };
  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-primary-400 transition-colors">
        <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2"/>
        <p className="text-sm text-gray-500 mb-3">Upload a document</p>
        <div className="flex flex-wrap gap-2 justify-center mb-3">
          <select value={docType} onChange={e=>setDocType(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary-400">
            <option value="">Document Type</option>
            {DOC_TYPES.map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
        <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700">
          {uploading ? 'Uploading…' : 'Choose File'}
          <input type="file" className="hidden" onChange={upload} disabled={uploading}/>
        </label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {documents.map(d=>(
          <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
            <div className="w-9 h-9 bg-primary-100 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-primary-700 text-xs font-bold">{(d.document_type||'DOC').slice(0,3).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{d.document_name}</p>
              <p className="text-xs text-gray-400">{d.document_type} · {d.upload_date}</p>
            </div>
            {d.file_url&&<a href={d.file_url} target="_blank" rel="noreferrer" className="text-xs text-primary-600 hover:underline shrink-0">View</a>}
            <button onClick={()=>del(d.id)} className="p-1 rounded hover:bg-red-50 text-red-400 shrink-0"><Trash2 className="w-4 h-4"/></button>
          </div>
        ))}
        {documents.length===0&&<p className="text-gray-400 text-sm py-4 col-span-2 text-center">No documents uploaded</p>}
      </div>
    </div>
  );
}

// ── Comments Tab ──────────────────────────────────────────────────────────────
function CommentsTab({ visitId, comments, onRefresh }) {
  const [text, setText]     = useState('');
  const [saving, setSaving] = useState(false);
  const handleAdd = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await evms.comments.create(visitId, { comment_text: text.trim(), comment_user: 'User' });
      setText(''); onRefresh();
    } catch (err) { alert(`Failed: ${err.message}`); }
    finally { setSaving(false); }
  };
  const del = async (id) => { if (!confirm('Delete comment?')) return; await evms.comments.delete(id); onRefresh(); };
  return (
    <div className="space-y-4">
      {/* Add comment */}
      <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
        <textarea
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
          placeholder="Write a comment…" value={text} onChange={e => setText(e.target.value)}
        />
        <div className="flex justify-end">
          <button onClick={handleAdd} disabled={saving || !text.trim()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Add Comment'}
          </button>
        </div>
      </div>
      {/* Comment list */}
      {comments.length === 0 ? (
        <div className="text-center py-8">
          <MessageSquare className="w-8 h-8 text-gray-200 mx-auto mb-2"/>
          <p className="text-sm text-gray-400">No comments yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...comments].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).map(c => (
            <div key={c.id} className="flex gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center shrink-0 text-amber-800 text-xs font-bold">
                {(c.comment_user||'U')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-gray-800">{c.comment_user || 'User'}</span>
                  <span className="text-[10px] text-gray-400">{c.created_at ? new Date(c.created_at).toLocaleString() : ''}</span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{c.comment_text}</p>
              </div>
              <button onClick={() => del(c.id)} className="p-1 rounded hover:bg-red-50 text-red-300 shrink-0 self-start"><Trash2 className="w-3.5 h-3.5"/></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function EVMSVisitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [visit, setVisit]         = useState(null);
  const [tab, setTab]             = useState(0);
  const [loading, setLoading]     = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const templateRef = useRef(null);

  const load = () => {
    setLoading(true);
    evms.visits.get(id).then(setVisit).catch(console.error).finally(()=>setLoading(false));
  };
  useEffect(load, [id]);

  const getTemplateEl = () => document.getElementById('evms-template-root');
  const waitForTemplateRoot = async (timeout = 4000) => {
    await new Promise(r => setTimeout(r, 100));
    const start = performance.now();
    while (performance.now() - start < timeout) {
      const el = getTemplateEl() || document.querySelector('[id="evms-template-root"]');
      if (el) return el;
      await new Promise(r => requestAnimationFrame(r));
    }
    return null;
  };

  // A4 at 96 dpi: 794 × 1123 px. Scale 3 ≈ 288 DPI (near print-ready).
  const A4_W_PX    = 794;
  const A4_H_PX    = 1123;
  const EXPORT_SCALE = 3;
  const MARGIN_MM  = 8;      // matches @page margin
  const MARGIN_PX  = Math.round(MARGIN_MM * 96 / 25.4); // ~30px

  const exportPDF = async () => {
    const el = await waitForTemplateRoot(); if (!el) return;
    setExporting(true);
    try {
      // Render entire template at 3× scale
      const canvas = await html2canvas(el, {
        scale: EXPORT_SCALE,
        useCORS: true,
        backgroundColor: '#F1F5F9',
        logging: false,
        allowTaint: false,
        width: A4_W_PX,
        windowWidth: A4_W_PX,
        imageTimeout: 0,
        removeContainer: true,
      });

      // A4 page dimensions in scaled pixels
      const pageW = A4_W_PX * EXPORT_SCALE;
      const pageH = A4_H_PX * EXPORT_SCALE;
      const marginPx = MARGIN_PX * EXPORT_SCALE;
      const usableH = pageH - marginPx * 2; // usable height per page after margins

      const totalH = canvas.height;
      const totalPages = Math.ceil(totalH / usableH);

      // Create PDF sized exactly to A4
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [pageW, pageH],
      });

      const imgData = canvas.toDataURL('image/png', 1.0);

      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage([pageW, pageH]);

        const srcY  = page * usableH;          // source Y on the canvas
        const sliceH = Math.min(usableH, totalH - srcY); // height of this slice

        // We paint the full-width image, offset so only the current slice is visible
        // by shifting the image up by srcY and adding top margin
        pdf.addImage(
          imgData,
          'PNG',
          0,                        // x: left edge
          marginPx - srcY,          // y: shift up so the right slice shows at margin
          pageW,                    // width: full page width
          totalH,                   // height: full image height (intentionally taller than page)
          '',
          'FAST',
        );

        // Clip: white rectangles above and below the slice to hide overflow
        pdf.setFillColor(255, 255, 255);
        // Cover above-margin area
        pdf.rect(0, 0, pageW, marginPx, 'F');
        // Cover below-slice area (from margin+sliceH to page bottom)
        pdf.rect(0, marginPx + sliceH, pageW, pageH - (marginPx + sliceH) + 1, 'F');
      }

      pdf.save(`${(visit.visit_name || 'visit').replace(/[^a-zA-Z0-9 ]/g, '')}-schedule.pdf`);
    } catch(err) {
      console.error('PDF export error:', err);
      alert('Export failed: ' + err.message);
    } finally { setExporting(false); }
  };

  const exportPNG = async () => {
    const el = await waitForTemplateRoot(); if (!el) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(el, {
        scale: EXPORT_SCALE,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: A4_W_PX,
        windowWidth: A4_W_PX,
        imageTimeout: 0,
        removeContainer: true,
      });
      const link = document.createElement('a');
      link.download = `${(visit.visit_name || 'visit').replace(/[^a-zA-Z0-9 ]/g, '')}-schedule.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    } catch(err) { alert('Export failed: ' + err.message); }
    finally { setExporting(false); }
  };

  // Open modal instead of printing directly
  const openPrintModal = () => setShowPrintModal(true);

  // ── helpers used by doPrint ──────────────────────────────────────────────────
  const _fmt = (d) => {
    if (!d) return '—';
    try { return new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); }
    catch { return d; }
  };
  const _fmtT = (t) => {
    if (!t) return '—';
    try { const [h,m]=t.split(':').map(Number); return `${String(h%12||12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`; }
    catch { return t; }
  };
  const _ids = (raw) => { try { return typeof raw==='string'?JSON.parse(raw||'[]'):(Array.isArray(raw)?raw:[]); } catch { return []; } };
  const _names = (ids,list,key) => { const p=_ids(ids); const r=list.filter(x=>p.includes(x.id)).map(x=>x[key]).join(', '); return r||'—'; };
  const _dur = (V) => { try { return Math.round((new Date(V.end_date+'T00:00:00')-new Date(V.start_date+'T00:00:00'))/86400000)+1; } catch { return '—'; } };

  // ── Build a fresh print document from scratch ───────────────────────────────
  const doPrint = (cfg) => {
    setShowPrintModal(false);
    const V=visit, visitors=V.visitors||[], hosts=V.hosts||[],
          meetings=V.meetings||[], activities=V.activities||[];
    const now=new Date(),
          genDate=now.toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'}),
          genTime=now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});

    // colour palette
    const P='#0F4C81',A='#2563EB',G='#16A34A',W='#B45309',
          T='#0F172A',S='#475569',M='#94A3B8',BD='#E2E8F0',BG='#FFFFFF',BGS='#F8FAFC';

    // layout tokens
    const fontMap={Small:'10px',Medium:'12px',Large:'14px','Extra Large':'16px'};
    const baseFont=fontMap[cfg.fontSize]||'12px';
    const bfpx=parseInt(baseFont);
    const padMap={Compact:`${bfpx-3}px ${bfpx-2}px`,Standard:`${bfpx-1}px ${bfpx}px`,Spacious:`${bfpx+2}px ${bfpx+3}px`};
    const cellPad=padMap[cfg.layout]||padMap.Standard;
    const secGap=cfg.layout==='Compact'?'10px':cfg.layout==='Spacious'?'22px':'14px';
    const cardPad=cfg.layout==='Compact'?'8px 10px':cfg.layout==='Spacious'?'16px 20px':'10px 14px';
    const marginMap={Narrow:'6mm',Normal:'12mm',Wide:'20mm'};
    const margin=marginMap[cfg.margins]||'12mm';
    const paperMap={'A4 Portrait':'A4 portrait','A4 Landscape':'A4 landscape','A3 Portrait':'A3 portrait','A3 Landscape':'A3 landscape'};
    const pageSize=paperMap[cfg.paperSize]||'A4 portrait';
    const wrapPad=cfg.margins==='Narrow'?'12px':cfg.margins==='Wide'?'28px':'18px';
    const scaleCSS=cfg.scale==='Fit to Page'?'':
      `html,body{zoom:${cfg.scale} !important;transform:none !important;}`;
    const colourCSS=cfg.theme==='Black & White'?'body{filter:grayscale(1)}'
      :cfg.theme==='High Contrast'?'body{filter:contrast(1.5) brightness(0.9)}':'';

    // section heading helper — respects showTitle flag
    const sh=(icon,text,showTitle=true)=>showTitle?`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid ${P}">
      <span style="font-size:${bfpx+3}px">${icon}</span>
      <span style="font-size:${bfpx+2}px;font-weight:800;color:${T};text-transform:uppercase;letter-spacing:.5px">${text}</span>
    </div>`:'';
    const card=(c,ex='')=>`<div style="background:${BG};border:1px solid ${BD};border-radius:10px;padding:${cardPad};${ex}">${c}</div>`;

    // ── timeline: filter by type + selected days ──
    const tl=[
      ...meetings.map(m=>({kind:'meeting',date:m.meeting_date,time:m.start_time,
        title:m.meeting_title||m.notes||'Meeting',vids:m.visitor_ids,hids:m.host_ids,desc:m.notes})),
      ...activities.map(a=>({kind:'activity',date:a.activity_date,time:a.start_time,
        title:a.description||'Activity',vids:a.visitor_ids,hids:a.host_ids,desc:a.description})),
    ]
    .filter(i=>(i.kind==='meeting'?cfg.incMeetings:cfg.incActivities))
    .sort((a,b)=>{if(a.date!==b.date)return(a.date||'').localeCompare(b.date||'');return(a.time||'').localeCompare(b.time||'');});
    const grp={};
    tl.forEach(i=>{const k=i.date||'TBD';if(!grp[k])grp[k]=[];grp[k].push(i);});
    const allDays=Object.entries(grp).sort(([a],[b])=>a.localeCompare(b));
    const selDayEntries=cfg.incTimeline?allDays.filter(([d])=>cfg.selDays[d]!==false):[];

    // ── travel ──
    const wt=visitors.filter(v=>v.travel_arrival_airport||v.travel_arrival_date||v.travel_departure_airport||v.travel_departure_date);
    let tv=null;
    if(wt.length>=1){const f=wt[0];const same=wt.every(v=>v.travel_arrival_airport===f.travel_arrival_airport&&v.travel_arrival_date===f.travel_arrival_date&&v.travel_arrival_time===f.travel_arrival_time&&v.travel_departure_airport===f.travel_departure_airport&&v.travel_departure_date===f.travel_departure_date&&v.travel_departure_time===f.travel_departure_time);if(same)tv={a_ap:f.travel_arrival_airport,a_dt:f.travel_arrival_date,a_tm:f.travel_arrival_time,d_ap:f.travel_departure_airport,d_dt:f.travel_departure_date,d_tm:f.travel_departure_time};}
    const companyHead=hosts.find(h=>h.is_company_head),hostTeam=hosts.filter(h=>!h.is_company_head);
    const hostCo=companyHead?.company_name||V.host_company||hosts[0]?.company_name||'—';

    // ── build HTML sections ──
    const headerHTML=!cfg.incHeader?'':`
      <div class="no-break" style="background:linear-gradient(135deg,#0A2D52 0%,${P} 55%,${A} 100%);padding:${cardPad};color:#fff;border-radius:10px;margin-bottom:${secGap}">
        ${cfg.incHeaderTitle!==false?`<div style="font-size:${bfpx-2}px;opacity:.55;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px">Executive Visit Management System</div>`:''}
        <div style="font-size:${bfpx+10}px;font-weight:800;margin-bottom:3px">Executive Visit Schedule</div>
        <div style="font-size:${bfpx+2}px;opacity:.85;margin-bottom:12px">${V.visit_name}</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);background:rgba(0,0,0,.18);border-radius:6px;overflow:hidden">
          ${[['VISIT DATES',`${_fmt(V.start_date)} – ${_fmt(V.end_date)}`],['DURATION',`${_dur(V)} Days`],['COORDINATOR',V.coordinator||'—'],['LOCATION',V.host_location||'—']].map(([l,v],i)=>`<div style="padding:7px 12px;${i<3?'border-right:1px solid rgba(255,255,255,.1)':''}"><div style="font-size:${bfpx-3}px;opacity:.5;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px">${l}</div><div style="font-size:${bfpx}px;font-weight:600">${v}</div></div>`).join('')}
        </div>
      </div>`;

    const summaryHTML=!cfg.incSummary?'':`
      <div class="no-break" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:${secGap}">
        ${[[`👥`,visitors.length,'VISITORS',P],[`🏢`,'1','HOST CO.',A],[`📋`,tl.length,'ITEMS',G],[`📅`,`${_dur(V)}d`,'DURATION',W]].map(([ic,v,l,c])=>`
          <div style="background:${BG};border:1px solid ${BD};border-radius:8px;padding:${cardPad};text-align:center;border-top:3px solid ${c}">
            <div style="font-size:${bfpx+7}px;margin-bottom:3px">${ic}</div>
            <div style="font-size:${bfpx+9}px;font-weight:700;color:${c};line-height:1;margin-bottom:3px">${v}</div>
            <div style="font-size:${bfpx-2}px;font-weight:700;color:${M};text-transform:uppercase;letter-spacing:.5px">${l}</div>
          </div>`).join('')}
      </div>`;

    const visitorsHTML=(!cfg.incVisitors||!visitors.length)?'':`
      <div class="no-break" style="margin-bottom:${secGap}">
        ${sh('👥',`Visitors (${visitors.length})`,cfg.incVisitorsTitle!==false)}
        ${card(visitors.map((v,i)=>`<div style="display:flex;align-items:center;gap:8px;padding:${cellPad};${i<visitors.length-1?`border-bottom:1px solid ${BD}`:''}"><span style="color:${P};font-weight:700;font-size:${bfpx+2}px">•</span><span style="font-size:${bfpx+1}px;font-weight:600;color:${T}">${v.visitor_name}</span></div>`).join(''))}
      </div>`;

    const travelHTML=(!cfg.incTravel||!tv||(!(tv.a_ap||tv.a_dt)&&!(tv.d_ap||tv.d_dt)))?'':`
      <div class="no-break" style="margin-bottom:${secGap}">
        ${sh('✈','Travel Details — Common for All Visitors',cfg.incTravelTitle!==false)}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          ${(tv.a_ap||tv.a_dt)?`<div style="background:${BG};border:1px solid ${BD};border-radius:8px;overflow:hidden"><div style="background:${P};padding:5px 12px"><span style="color:#fff;font-size:${bfpx-1}px;font-weight:700;letter-spacing:1px">✈ ARRIVAL</span></div><div style="padding:${cardPad};display:grid;grid-template-columns:65px 1fr;gap:4px;font-size:${bfpx}px"><span style="color:${M}">Date</span><span style="font-weight:600">${_fmt(tv.a_dt)}</span><span style="color:${M}">Airport</span><span style="font-weight:600">${tv.a_ap||'—'}</span>${tv.a_tm?`<span style="color:${M}">Time</span><span style="font-weight:600">${_fmtT(tv.a_tm)}</span>`:''}</div></div>`:''}
          ${(tv.d_ap||tv.d_dt)?`<div style="background:${BG};border:1px solid ${BD};border-radius:8px;overflow:hidden"><div style="background:${G};padding:5px 12px"><span style="color:#fff;font-size:${bfpx-1}px;font-weight:700;letter-spacing:1px">✈ DEPARTURE</span></div><div style="padding:${cardPad};display:grid;grid-template-columns:65px 1fr;gap:4px;font-size:${bfpx}px"><span style="color:${M}">Date</span><span style="font-weight:600">${_fmt(tv.d_dt)}</span><span style="color:${M}">Airport</span><span style="font-weight:600">${tv.d_ap||'—'}</span>${tv.d_tm?`<span style="color:${M}">Time</span><span style="font-weight:600">${_fmtT(tv.d_tm)}</span>`:''}</div></div>`:''}
        </div>
      </div>`;

    const hostHTML=(!cfg.incHost||!hosts.length)?'':`
      <div class="no-break" style="margin-bottom:${secGap}">
        ${sh('🏢','Host Company',cfg.incHostTitle!==false)}
        ${card(`<div style="font-size:${bfpx+1}px;font-weight:700;color:${P};padding-bottom:8px;margin-bottom:8px;border-bottom:1px solid ${BD}">🏛 ${hostCo}</div>${companyHead?`<div style="font-size:${bfpx-1}px;font-weight:700;color:${M};text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Company Head</div><div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:6px;padding:${cellPad};margin-bottom:${hostTeam.length?'8px':'0'};font-size:${bfpx+1}px;font-weight:700;color:${T}">• ${companyHead.host_name}</div>`:''}${hostTeam.length?`<div style="font-size:${bfpx-1}px;font-weight:700;color:${M};text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Host Team · ${hostTeam.length} Member${hostTeam.length!==1?'s':''}</div>${hostTeam.map((h,i)=>`<div style="display:flex;align-items:center;gap:6px;padding:${cellPad};${i<hostTeam.length-1?`border-bottom:1px solid ${BD}`:''}"><span style="color:${S};font-weight:700">•</span><span style="font-size:${bfpx+1}px;font-weight:600;color:${T}">${h.host_name}</span></div>`).join('')}`:''}`)}
      </div>`;

    // ── Key rule: Timeline title + Day 1 are ONE atomic block (never split) ──
    const buildDayBlock=(date,items,dayNum)=>`
      <div class="day-block" style="margin-bottom:${secGap}">
        <div class="day-header" style="background:linear-gradient(90deg,${P},${A});padding:6px 12px;border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:space-between">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="background:rgba(255,255,255,.2);border-radius:4px;padding:2px 8px;font-size:${bfpx-1}px;font-weight:700;color:#fff">DAY ${dayNum}</span>
            <span style="font-size:${bfpx+1}px;font-weight:600;color:#fff">${_fmt(date)}</span>
          </div>
          <span style="font-size:${bfpx-1}px;color:rgba(255,255,255,.7)">${items.length} item${items.length!==1?'s':''}</span>
        </div>
        <div style="background:${BG};border:1px solid ${BD};border-top:none;border-radius:0 0 8px 8px;overflow:hidden">
          <table style="width:100%;border-collapse:collapse;font-size:${bfpx}px">
            <thead>
              <tr style="background:${BGS};border-bottom:1px solid ${BD}">
                ${['TIME','TYPE','VISITORS','DESCRIPTION','HOSTS'].map(h=>`<th style="padding:${cellPad};font-size:${bfpx-1}px;font-weight:700;color:${S};text-transform:uppercase;letter-spacing:.6px;text-align:left">${h}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${items.map((it,ri)=>`<tr style="background:${ri%2===0?BG:'#FAFBFC'};border-bottom:${ri<items.length-1?`1px solid #F1F5F9`:'none'}">
                <td style="padding:${cellPad};font-weight:700;color:${P};white-space:nowrap">${_fmtT(it.time)}</td>
                <td style="padding:${cellPad}"><span style="font-size:${bfpx-1}px;font-weight:700;padding:2px 7px;border-radius:4px;color:${it.kind==='meeting'?A:G};background:${it.kind==='meeting'?'#EFF6FF':'#F0FDF4'};border:1px solid ${it.kind==='meeting'?'#BFDBFE':'#BBF7D0'}">${it.kind==='meeting'?'Meeting':'Activity'}</span></td>
                <td style="padding:${cellPad};color:${S};word-break:break-word">${_names(it.vids,visitors,'visitor_name')}</td>
                <td style="padding:${cellPad};color:${S};word-break:break-word">${it.desc||'—'}</td>
                <td style="padding:${cellPad};color:${S};word-break:break-word">${_names(it.hids,hosts,'host_name')}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    const timelineTitle = (cfg.incTimelineTitle!==false)
      ? `<div class="timeline-title" style="display:flex;align-items:center;gap:8px;padding-bottom:6px;border-bottom:2px solid ${P};margin-bottom:8px">
           <span style="font-size:${bfpx+3}px">📅</span>
           <span style="font-size:${bfpx+2}px;font-weight:800;color:${T};text-transform:uppercase;letter-spacing:.5px">Visit Timeline — ${selDayEntries.length} Day${selDayEntries.length!==1?'s':''}, ${tl.length} item${tl.length!==1?'s':''}</span>
         </div>`
      : '';

    const timelineHTML=(!cfg.incTimeline||!selDayEntries.length)?'':`
      <div class="visit-timeline-section" style="margin-bottom:${secGap}">
        ${selDayEntries.map(([date,items],di)=>{
          // First day: title + day block wrapped together — inseparable
          if(di===0){
            return `<div class="no-break">${timelineTitle}${buildDayBlock(date,items,di+1)}</div>`;
          }
          return buildDayBlock(date,items,di+1);
        }).join('')}
      </div>`;

    const footerHTML=`<div style="margin-top:14px;padding-top:7px;border-top:1px solid ${BD};display:flex;align-items:center;justify-content:space-between;font-size:${bfpx-1}px;color:${M}"><span style="font-weight:700;color:${S}">Executive Visit Management System</span><span>Generated on ${genDate}, ${genTime}</span><span class="page-number"></span></div>`;

    const win=window.open('','_blank');
    win.document.write(`<!DOCTYPE html><html><head>
<title>${V.visit_name} — Executive Visit Schedule</title>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
body{background:#F1F5F9;font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:${baseFont};color:${T};-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
.wrap{padding:${wrapPad}}
@page{size:${pageSize};margin:${margin}}
@media print{
  html,body{margin:0 !important;padding:0 !important;background:#F1F5F9 !important;overflow:visible !important;transform:none !important;-webkit-transform:none !important}
  ${scaleCSS}${colourCSS}
  *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
  /* Never split a day block */
  .day-block{page-break-inside:avoid !important;break-inside:avoid !important;page-break-before:auto !important;break-before:auto !important}
  /* Day header must stay with its table */
  .day-header{page-break-after:avoid !important;break-after:avoid !important}
  /* Generic no-break */
  .no-break{page-break-inside:avoid !important;break-inside:avoid !important}
  /* Timeline title must never be alone — always followed by Day 1 */
  .timeline-title{page-break-after:avoid !important;break-after:avoid !important}
  /* The title+day1 wrapper */
  .visit-timeline-section{page-break-before:auto !important;break-before:auto !important;page-break-inside:avoid !important;break-inside:avoid !important}
  tr{page-break-inside:avoid !important;break-inside:avoid !important}
  thead{display:table-header-group !important}
  .page-number::before{content:""}
  .page-number::after{content:""}
  p,li{orphans:3;widows:3}
  /* Hide the JS-inserted spacer divs */
  .pg-break{display:block !important;height:0 !important;page-break-before:always !important;break-before:page !important}
}
.day-block{page-break-inside:avoid;break-inside:avoid}
.day-header{page-break-after:avoid;break-after:avoid}
.no-break{page-break-inside:avoid;break-inside:avoid}
.timeline-title{page-break-after:avoid;break-after:avoid}
.visit-timeline-section{page-break-inside:avoid;break-inside:avoid}
tr{page-break-inside:avoid;break-inside:avoid}
.pg-break{display:none}
</style></head>
<body><div class="wrap" id="print-wrap">${headerHTML}${summaryHTML}${visitorsHTML}${travelHTML}${hostHTML}${timelineHTML}${footerHTML}</div>

<script>
/* ── JS pagination: ensure timeline title never orphans ───────────────────────
   Runs after document paints (requestAnimationFrame × 2 to be safe).
   Measures how much vertical space remains on the current "page" at the point
   the timeline section starts. If less than the minimum block height (title +
   day header + table header + first row), inserts a page-break div before the
   timeline section so the browser starts a fresh page for it.
──────────────────────────────────────────────────────────────────────────────*/
(function() {
  function run() {
    // Page height in px (from @page margin already handled by browser)
    // We use the A4 content area: 297mm - 2×margin converted to px
    var marginMM = parseFloat('${margin}') || 12;
    var pageH = (297 - marginMM * 2) * (96 / 25.4);   // pt at 96dpi
    var pageW = (210 - marginMM * 2) * (96 / 25.4);

    var tlSection = document.querySelector('.visit-timeline-section');
    if (!tlSection) return;

    // Measure height of the "must stay together" anchor block
    // (timeline title + first day header + table header + first row)
    var tlTitle   = tlSection.querySelector('.timeline-title');
    var firstDay  = tlSection.querySelector('.day-block');
    if (!firstDay) return;

    var tlTitleH  = tlTitle  ? tlTitle.getBoundingClientRect().height  : 0;
    var dayHdrH   = (firstDay.querySelector('.day-header') || {getBoundingClientRect:()=>({height:0})}).getBoundingClientRect().height;
    var tblHdrH   = (firstDay.querySelector('thead')       || {getBoundingClientRect:()=>({height:0})}).getBoundingClientRect().height;
    var firstRowH = (firstDay.querySelector('tbody tr')    || {getBoundingClientRect:()=>({height:0})}).getBoundingClientRect().height;

    var minBlock = tlTitleH + dayHdrH + tblHdrH + firstRowH + 16; // 16px buffer

    // Find vertical position of the timeline section relative to page start
    var wrapTop   = document.getElementById('print-wrap').getBoundingClientRect().top;
    var tlTop     = tlSection.getBoundingClientRect().top - wrapTop;
    var pageNum   = Math.floor(tlTop / pageH);
    var usedOnPage = tlTop - pageNum * pageH;
    var remaining  = pageH - usedOnPage;

    // If remaining space is less than the minimum required block, force a page break
    if (remaining < minBlock && remaining > 0) {
      var br = document.createElement('div');
      br.className = 'pg-break';
      tlSection.parentNode.insertBefore(br, tlSection);
    }
  }
  // Run after two animation frames to ensure layout is complete
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      try { run(); } catch(e) { /* fail silently */ }
    });
  });
})();
</script>
</body></html>`);
    win.document.close();
    setTimeout(()=>{win.focus();win.print();},1200);
  };

  const downloadTemplate = exportPDF;

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"/></div>;
  if (!visit)  return <p className="text-center text-red-500 py-12">Visit not found</p>;

  const counts = [null, visit.visitors?.length, visit.hosts?.length, visit.meetings?.length, visit.documents?.length, visit.comments?.length];

  const tabContent = [
    <OverviewTab  key={0} visit={visit}              onSaved={load}/>,
    <VisitorsTab  key={1} visitId={id} visitors={visit.visitors||[]}  onRefresh={load}/>,
    <HostsTab     key={2} visitId={id} hosts={visit.hosts||[]}        onRefresh={load}/>,
    <TimelineTab  key={3} visitId={id} meetings={visit.meetings||[]} activities={visit.activities||[]} visitors={visit.visitors||[]} hosts={visit.hosts||[]} visitStart={visit.start_date} visitEnd={visit.end_date} onRefresh={load}/>,
    <DocumentsTab key={4} visitId={id} documents={visit.documents||[]} onRefresh={load}/>,
    <CommentsTab  key={5} visitId={id} comments={visit.comments||[]}   onRefresh={load}/>,
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={()=>navigate('/evms/visits')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="w-4 h-4"/> Back to Visits
        </button>
        <span className="text-gray-300">|</span>
        <h1 className="text-xl font-bold text-gray-900 flex-1">{visit.visit_name}</h1>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[visit.status]||'bg-gray-100 text-gray-700'}`}>{visit.status}</span>
        <ExportMenu
          onExportPDF={exportPDF}
          onExportPNG={exportPNG}
          onPrint={openPrintModal}
          onDownloadTemplate={downloadTemplate}
        />
      </div>

      {exporting && <div className="flex items-center gap-2 text-xs text-primary-600 px-1"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"/> Preparing export…</div>}

      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map((t,i)=>(
          <button key={i} onClick={()=>setTab(i)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab===i?'border-primary-600 text-primary-700':'border-transparent text-gray-500 hover:text-gray-800'}`}>
            {t}
            {counts[i]>0&&<span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-600 rounded-full">{counts[i]}</span>}
          </button>
        ))}
      </div>

      <div className="card">{tabContent[tab]}</div>

      {/* Hidden template — always rendered for export */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0, zIndex: -1 }}>
        <EVMSVisitTemplate ref={templateRef} visit={visit} />
      </div>

      {/* Print Configuration Modal */}
      {showPrintModal && (
        <EVMSPrintModal
          visit={visit}
          onClose={() => setShowPrintModal(false)}
          onPrint={doPrint}
        />
      )}
    </div>
  );
}
