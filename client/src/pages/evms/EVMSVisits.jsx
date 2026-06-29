import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2, Users, Building2, Network, UserPlus,
         MoreVertical, MessageSquare, Check, Download, FileText, Printer, Image, ArrowLeft } from 'lucide-react';
import { evms } from '../../api/client';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import EVMSVisitTemplate from './EVMSVisitTemplate';

const STATUS_OPTIONS_ALL = ['All','Planning','Approved','In Progress','Completed','Cancelled'];
const STATUS_OPTIONS     = ['Planning','Approved','In Progress','Completed','Cancelled'];
const STATUS_COLORS = {
  Planning:'bg-amber-100 text-amber-800', Approved:'bg-blue-100 text-blue-800',
  'In Progress':'bg-green-100 text-green-800', Completed:'bg-gray-100 text-gray-700', Cancelled:'bg-red-100 text-red-800',
};

// ── Export Utilities ──────────────────────────────────────────────────────────
const A4_W_PX      = 794;
const A4_H_PX      = 1123;
const EXPORT_SCALE = 3;
const MARGIN_PX    = Math.round(8 * 96 / 25.4);

async function waitForTemplateRoot(timeout = 4000) {
  await new Promise(r => setTimeout(r, 100));
  const start = performance.now();
  while (performance.now() - start < timeout) {
    const el = document.getElementById('evms-template-root') || document.querySelector('[id="evms-template-root"]');
    if (el) return el;
    await new Promise(r => requestAnimationFrame(r));
  }
  return null;
}

async function doExportPDF(visit) {
  const el = await waitForTemplateRoot();
  if (!el) return;
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

    const pageW    = A4_W_PX * EXPORT_SCALE;
    const pageH    = A4_H_PX * EXPORT_SCALE;
    const marginPx = MARGIN_PX * EXPORT_SCALE;
    const usableH  = pageH - marginPx * 2;
    const totalH   = canvas.height;
    const totalPages = Math.ceil(totalH / usableH);

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [pageW, pageH] });
    const imgData = canvas.toDataURL('image/png', 1.0);

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) pdf.addPage([pageW, pageH]);
      const srcY   = page * usableH;
      const sliceH = Math.min(usableH, totalH - srcY);
      pdf.addImage(imgData, 'PNG', 0, marginPx - srcY, pageW, totalH, '', 'FAST');
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageW, marginPx, 'F');
      pdf.rect(0, marginPx + sliceH, pageW, pageH - (marginPx + sliceH) + 1, 'F');
    }

    pdf.save(`${(visit.visit_name || 'visit').replace(/[^a-zA-Z0-9 ]/g, '')}-schedule.pdf`);
  } catch(err) { alert('Export failed: ' + err.message); }
}

async function doExportPNG(visit) {
  const el = await waitForTemplateRoot();
  if (!el) return;
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
}

function doPrint(visit) {
  const el = document.getElementById('evms-template-root');
  if (!el) return;
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head>
    <title>${visit.visit_name} — Executive Visit Schedule</title>
    <meta charset="UTF-8"/>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; padding: 0; background: #fff; }
      @page { size: A4 portrait; margin: 0; }
      @media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .avoid-break { page-break-inside: avoid !important; } }
      .avoid-break { page-break-inside: avoid; }
    </style>
  </head><body>${el.outerHTML}</body></html>`);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 600);
}

// ── Export Action Menu ────────────────────────────────────────────────────────
function ExportActionMenu({ visit, onLoadTemplate }) {
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handle = async (action) => {
    setOpen(false);
    setLoading(true);
    try {
      // Ensure full visit data is loaded into hidden template
      const fullVisit = await evms.visits.get(visit.id);
      await onLoadTemplate(fullVisit);
      // Small delay to let React render the template
      await new Promise(r => setTimeout(r, 400));
      if (action === 'pdf')   await doExportPDF(fullVisit);
      if (action === 'png')   await doExportPNG(fullVisit);
      if (action === 'print') doPrint(fullVisit);
    } catch(err) { alert('Export failed: ' + err.message); }
    finally { setLoading(false); }
  };

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={e => { e.stopPropagation(); e.preventDefault(); setOpen(p => !p); }}
        disabled={loading}
        className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 disabled:opacity-50 transition-colors"
        title="Export options"
      >
        {loading ? <span className="animate-spin inline-block w-3 h-3 border border-primary-600 border-t-transparent rounded-full"/> : <Download className="w-3 h-3"/>}
        Export
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 z-[200] w-44 bg-white rounded-xl border border-gray-200 shadow-lg py-1 text-sm">
          <button onClick={() => handle('pdf')} className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-gray-700">
            <FileText className="w-3.5 h-3.5 text-red-500"/>Export PDF
          </button>
          <button onClick={() => handle('png')} className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-gray-700">
            <Image className="w-3.5 h-3.5 text-blue-500"/>Export PNG
          </button>
          <button onClick={() => handle('print')} className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-gray-700">
            <Printer className="w-3.5 h-3.5 text-gray-500"/>Print
          </button>
        </div>
      )}
    </div>
  );
}

// ── Three-dot action menu ─────────────────────────────────────────────────────
function VisitActionMenu({ visit, onStatusChange, onComment }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(p => !p); }}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
        title="Actions"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-48 bg-white rounded-xl border border-gray-200 shadow-lg py-1 text-sm">
          <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Set Status</p>
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              onClick={(e) => { e.stopPropagation(); onStatusChange(s); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors ${visit.status === s ? 'font-semibold' : ''}`}
            >
              {visit.status === s && <Check className="w-3.5 h-3.5 text-primary-600 shrink-0" />}
              {visit.status !== s && <span className="w-3.5 h-3.5 shrink-0" />}
              <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLORS[s]}`}>{s}</span>
            </button>
          ))}
          <div className="border-t border-gray-100 mt-1 pt-1">
            <button
              onClick={(e) => { e.stopPropagation(); onComment(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors text-gray-700"
            >
              <MessageSquare className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              Add Comment
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Comment Modal ─────────────────────────────────────────────────────────────
function CommentModal({ visit, onClose, onSaved }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await evms.comments.create(visit.id, { comment_text: text.trim(), comment_user: 'User' });
      onSaved();
      onClose();
    } catch (err) {
      alert(`Failed to save comment: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-base font-bold text-gray-900">Add Comment</h3>
        <p className="text-xs text-gray-500">{visit.visit_name}</p>
        <textarea
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none h-28 focus:outline-none focus:ring-2 focus:ring-primary-400"
          placeholder="Write your comment…"
          value={text}
          onChange={e => setText(e.target.value)}
          autoFocus
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving || !text.trim()} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Comment'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function EVMSVisits() {
  const navigate = useNavigate();
  const [visits, setVisits]         = useState([]);
  const [search, setSearch]         = useState('');
  const [status, setStatus]         = useState('All');
  const [loading, setLoading]       = useState(true);
  const [commentModal, setCommentModal] = useState(null);
  const [templateVisit, setTemplateVisit] = useState(null); // for export

  const load = () => {
    setLoading(true);
    evms.visits.list({ search, status }).then(async (vs) => {
      const enriched = await Promise.all(vs.map(async v => {
        const full = await evms.visits.get(v.id);
        return {
          ...v,
          visitorCount: full.visitors?.length || 0,
          hostCount:    full.hosts?.length    || 0,
          meetingCount: full.meetings?.length || 0,
          commentCount: full.comments?.length || 0,
        };
      }));
      setVisits(enriched);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(load, [search, status]);

  const handleStatusChange = async (visitId, newStatus) => {
    try {
      await evms.visits.patchStatus(visitId, newStatus);
      load();
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete visit "${name}"? This removes all related data.`)) return;
    await evms.visits.delete(id);
    load();
  };

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

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-gray-900">Visits</h1>
        <Link to="/evms/visits/new" className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> Add Visitor
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search visits…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400">
          {STATUS_OPTIONS_ALL.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {/* Visit Cards */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"/></div>
      ) : visits.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400 mb-4">No visits found</p>
          <Link to="/evms/visits/new" className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
            <UserPlus className="w-4 h-4" /> Add First Visitor
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visits.map(v => (
            <div key={v.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3 gap-2">
                <Link to={`/evms/visits/${v.id}`} className="text-base font-bold text-gray-900 hover:text-primary-600 leading-tight flex-1">{v.visit_name}</Link>
                <div className="flex items-center gap-1 shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[v.status]||'bg-gray-100 text-gray-700'}`}>{v.status}</span>
                  <VisitActionMenu
                    visit={v}
                    onStatusChange={(s) => handleStatusChange(v.id, s)}
                    onComment={() => setCommentModal(v)}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-4">{v.start_date||'—'} → {v.end_date||'—'}</p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-blue-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-blue-700">{v.visitorCount}</p>
                  <p className="text-[10px] text-blue-600 flex items-center justify-center gap-0.5"><Users className="w-3 h-3"/>Visitors</p>
                </div>
                <div className="bg-violet-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-violet-700">{v.hostCount}</p>
                  <p className="text-[10px] text-violet-600 flex items-center justify-center gap-0.5"><Building2 className="w-3 h-3"/>Hosts</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-green-700">{v.meetingCount}</p>
                  <p className="text-[10px] text-green-600 flex items-center justify-center gap-0.5"><Network className="w-3 h-3"/>Meetings</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link to={`/evms/visits/${v.id}`} className="flex-1 text-center py-1.5 text-xs font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100">View Details</Link>
                <Link to={`/evms/hosts/new?visitId=${v.id}`} className="flex-1 text-center py-1.5 text-xs font-medium text-violet-700 bg-violet-50 rounded-lg hover:bg-violet-100">Add Host</Link>
                <Link to={`/evms/meetings/new?visitId=${v.id}`} className="flex-1 text-center py-1.5 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100">Add Meeting</Link>
                <ExportActionMenu visit={v} onLoadTemplate={setTemplateVisit} />
                <button onClick={() => handleDelete(v.id, v.visit_name)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50"><Trash2 className="w-4 h-4"/></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comment Modal */}
      {commentModal && (
        <CommentModal
          visit={commentModal}
          onClose={() => setCommentModal(null)}
          onSaved={load}
        />
      )}

      {/* Hidden template for export — rendered off-screen */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1, pointerEvents: 'none' }}>
        <EVMSVisitTemplate visit={templateVisit} />
      </div>
    </div>
  );
}
