import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Building2, Calendar, CheckSquare, Clock,
  Plus, UserPlus, Network, TrendingUp, ArrowRight,
  CalendarDays, BarChart3, Download, FileText, Printer,
  Image as ImageIcon,
} from 'lucide-react';
import { evms } from '../../api/client';
import EVMSVisitTemplate from './EVMSVisitTemplate';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ── Status badge colours ──────────────────────────────────────────────────────
const STATUS_COLORS = {
  Planning:     'bg-amber-50 text-amber-700 border border-amber-200',
  Approved:     'bg-blue-50 text-blue-700 border border-blue-200',
  'In Progress':'bg-emerald-50 text-emerald-700 border border-emerald-200',
  Completed:    'bg-gray-100 text-gray-600 border border-gray-200',
  Cancelled:    'bg-red-50 text-red-600 border border-red-200',
};

// ── Export engine ─────────────────────────────────────────────────────────────
const A4W = 794, A4H = 1123, EXP_SCALE = 3;
const MARG_PX = Math.round(8 * 96 / 25.4);

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

async function getCanvas() {
  const el = await waitForTemplateRoot();
  if (!el) throw new Error('Template element not found — please try again');
  return html2canvas(el, {
    scale: EXP_SCALE,
    useCORS: true,
    backgroundColor: '#F1F5F9',
    logging: false,
    width: A4W,
    windowWidth: A4W,
    imageTimeout: 0,
    removeContainer: true,
  });
}

async function runExportPDF(visitName) {
  const canvas = await getCanvas();

  const pageW    = A4W * EXP_SCALE;
  const pageH    = A4H * EXP_SCALE;
  const marginPx = MARG_PX * EXP_SCALE;
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

  pdf.save(`${(visitName || 'visit').replace(/[^a-zA-Z0-9 ]/g, '')}-schedule.pdf`);
}

async function runExportPNG(visitName) {
  const canvas = await getCanvas();
  const a = document.createElement('a');
  a.download = `${(visitName || 'visit').replace(/[^a-zA-Z0-9 ]/g, '')}-schedule.png`;
  a.href = canvas.toDataURL('image/png', 1.0);
  a.click();
}

function runPrint(visitName) {
  const el = document.getElementById('evms-template-root');
  if (!el) return;
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head>
    <title>${visitName} — Executive Visit Schedule</title>
    <meta charset="UTF-8"/>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; padding: 0; background: #fff; }
      @page { size: A4 portrait; margin: 0; }
      @media print {
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .avoid-break { page-break-inside: avoid !important; break-inside: avoid !important; }
        .tmpl-header { page-break-after: avoid !important; }
        .tmpl-footer { page-break-before: avoid !important; }
      }
      .avoid-break { page-break-inside: avoid; break-inside: avoid; }
    </style>
  </head><body>${el.outerHTML}</body></html>`);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 600);
}

// ── Export dropdown on each visit row ────────────────────────────────────────
function ExportDropdown({ visit, onLoadVisit }) {
  const [open,    setOpen]    = useState(false);
  const [working, setWorking] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const run = async (action) => {
    setOpen(false);
    setWorking(true);
    try {
      // Load full visit data (with visitors + travel + hosts + meetings)
      const fullVisit = await evms.visits.get(visit.id);
      // Put it in state so EVMSVisitTemplate renders it
      onLoadVisit(fullVisit);
      // Wait for React to re-render the hidden template
      await new Promise(r => setTimeout(r, 450));
      if (action === 'pdf')   await runExportPDF(fullVisit.visit_name);
      if (action === 'png')   await runExportPNG(fullVisit.visit_name);
      if (action === 'print') runPrint(fullVisit.visit_name);
    } catch (err) {
      alert('Export failed: ' + (err.message || 'Unknown error'));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div ref={ref} className="relative shrink-0" onClick={e => e.stopPropagation()}>
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(p => !p); }}
        disabled={working}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium
                   text-primary-600 bg-primary-50 hover:bg-primary-100 border border-primary-100
                   transition-colors disabled:opacity-50"
      >
        {working
          ? <span className="animate-spin inline-block w-3 h-3 border border-primary-500 border-t-transparent rounded-full"/>
          : <Download className="w-3 h-3"/>
        }
        <span>Export</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-[200] w-44 bg-white rounded-xl
                        border border-gray-200 shadow-xl py-1 text-sm overflow-hidden">
          <button onClick={() => run('pdf')}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 text-gray-700 text-left">
            <FileText className="w-3.5 h-3.5 text-red-500 shrink-0"/> Export PDF
          </button>
          <button onClick={() => run('png')}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 text-gray-700 text-left">
            <ImageIcon className="w-3.5 h-3.5 text-blue-500 shrink-0"/> Export PNG
          </button>
          <button onClick={() => run('print')}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 text-gray-700 text-left">
            <Printer className="w-3.5 h-3.5 text-gray-500 shrink-0"/> Print
          </button>
        </div>
      )}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, gradient, to }) {
  const inner = (
    <div className="group relative overflow-hidden rounded-2xl bg-white border border-gray-100
                    shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 p-5">
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300 ${gradient}`} />
      <div className="flex items-start justify-between">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${gradient} shadow-sm`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {to && <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all duration-200" />}
      </div>
      <div className="mt-4">
        <p className="text-3xl font-bold text-gray-900 tracking-tight">{value ?? 0}</p>
        <p className="text-sm text-gray-500 mt-1 font-medium">{label}</p>
      </div>
    </div>
  );
  return to
    ? <Link to={to} className="block focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-2xl">{inner}</Link>
    : inner;
}

// ── Quick Action Button ───────────────────────────────────────────────────────
function ActionBtn({ to, icon: Icon, label, description, gradient }) {
  return (
    <Link to={to}
      className="group flex items-center gap-4 p-4 rounded-2xl bg-white border border-gray-100
                 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${gradient} shadow-sm`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="text-xs text-gray-400 truncate">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all duration-200 shrink-0" />
    </Link>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function EVMSDashboard() {
  const [stats,         setStats]         = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [templateVisit, setTemplateVisit] = useState(null);

  useEffect(() => {
    setLoading(true);
    evms.dashboard().then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-28">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-9 w-9 border-[3px] border-primary-100 border-t-primary-600" />
        <p className="text-sm text-gray-400">Loading dashboard…</p>
      </div>
    </div>
  );

  if (!stats) return (
    <div className="flex items-center justify-center py-28">
      <p className="text-sm text-red-500">Failed to load dashboard data</p>
    </div>
  );

  return (
    <>
      <div className="space-y-7 max-w-7xl">

        {/* ── Page Header ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Executive Visit Management</h1>
            <p className="text-sm text-gray-500 mt-1">Manage visits, track meetings, and coordinate executive schedules</p>
          </div>
          <Link to="/evms/visits"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white
                       rounded-xl text-sm font-medium hover:bg-primary-700 shadow-sm hover:shadow transition-all duration-200">
            <BarChart3 className="w-4 h-4" /> View All Visits
          </Link>
        </div>

        {/* ── Quick Actions ────────────────────────────────────────────── */}
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Quick Actions</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ActionBtn to="/evms/visits/new"         icon={UserPlus}  gradient="bg-primary-600"  label="Add Visitor"       description="Create a new visit with visitors" />
            <ActionBtn to="/evms/hosts/new"          icon={Building2} gradient="bg-violet-600"   label="Add Host"          description="Register hosts for a visit" />
            <ActionBtn to="/evms/timeline/new"       icon={Network}   gradient="bg-emerald-600"  label="Visit Timeline"    description="Build complete visit itinerary" />
          </div>
        </section>

        {/* ── KPI Grid ─────────────────────────────────────────────────── */}
        <section>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Overview</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard icon={Calendar}    gradient="bg-primary-600"  label="Total Visits"       value={stats.totalVisits}        to="/evms/visits" />
            <KpiCard icon={Users}       gradient="bg-indigo-500"   label="Total Visitors"     value={stats.totalVisitors}      to="/evms/visitors" />
            <KpiCard icon={Building2}   gradient="bg-violet-600"   label="Total Hosts"        value={stats.totalHosts}         to="/evms/hosts" />
            <KpiCard icon={Network}     gradient="bg-cyan-600"     label="Meetings"           value={stats.totalMeetings}      to="/evms/meetings" />
            <KpiCard icon={CalendarDays} gradient="bg-emerald-500" label="Activities"         value={stats.totalActivities || 0}  to="/evms/activities" />
            <KpiCard icon={CheckSquare} gradient="bg-gray-500"     label="Completed"          value={stats.completedMeetings}  to="/evms/visits" />
          </div>
        </section>

        {/* ── Two-column content ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Recent Visits — with export button per row */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-visible">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center">
                  <CalendarDays className="w-3.5 h-3.5 text-primary-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-800">Recent Visits</h3>
              </div>
              <Link to="/evms/visits" className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="divide-y divide-gray-50 overflow-visible">
              {stats.recentVisits?.length > 0
                ? stats.recentVisits.map(v => (
                    <div key={v.id} className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50/70 transition-colors relative">
                      {/* Visit info — navigates to detail */}
                      <Link to={`/evms/visits/${v.id}`} className="flex-1 min-w-0 flex items-center gap-2 group">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate group-hover:text-primary-600 transition-colors">{v.visit_name}</p>
                          <p className="text-xs text-gray-400">{v.start_date || '—'} → {v.end_date || '—'}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${STATUS_COLORS[v.status] || 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                          {v.status}
                        </span>
                      </Link>
                      {/* Export dropdown */}
                      <ExportDropdown visit={v} onLoadVisit={setTemplateVisit} />
                    </div>
                  ))
                : (
                    <div className="px-5 py-10 text-center">
                      <CalendarDays className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                      <p className="text-sm text-gray-400 mb-3">No visits yet</p>
                      <Link to="/evms/visits/new"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700">
                        <Plus className="w-3.5 h-3.5" /> Add First Visit
                      </Link>
                    </div>
                  )
              }
            </div>
          </div>

          {/* Today's Meetings */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <Network className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-800">Today's Meetings</h3>
              </div>
              <Link to="/evms/meetings" className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {stats.todayMeetings?.length > 0
                ? stats.todayMeetings.map(m => (
                    <Link key={m.id} to={`/evms/visits/${m.visit_id}`}
                      className="flex gap-4 items-start px-5 py-3.5 hover:bg-gray-50/70 transition-colors">
                      <div className="shrink-0 text-center bg-primary-50 rounded-xl px-2.5 py-2 min-w-[58px]">
                        <p className="text-xs font-bold text-primary-700 leading-tight tabular-nums">{m.start_time || '—'}</p>
                        {m.end_time && <p className="text-[10px] text-primary-400 tabular-nums">{m.end_time}</p>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{m.meeting_title}</p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{m.visit_name}{m.location ? ` · ${m.location}` : ''}</p>
                      </div>
                    </Link>
                  ))
                : (
                    <div className="px-5 py-10 text-center">
                      <Clock className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                      <p className="text-sm text-gray-400 mb-3">No meetings today</p>
                      <Link to="/evms/timeline/new"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700">
                        <Plus className="w-3.5 h-3.5" /> Schedule in Timeline
                      </Link>
                    </div>
                  )
              }
            </div>
          </div>
        </div>

        {/* ── Recent Meetings Table ─────────────────────────────────────── */}
        {stats.recentMeetings?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-cyan-50 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-cyan-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-800">Recent Meetings</h3>
              </div>
              <Link to="/evms/meetings" className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80">
                    {['Meeting','Visit','Date','Time','Location'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stats.recentMeetings.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-900">{m.meeting_title}</td>
                      <td className="px-5 py-3">
                        <Link to={`/evms/visits/${m.visit_id}`} className="text-xs text-primary-600 hover:underline font-medium">{m.visit_name}</Link>
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs tabular-nums">{m.meeting_date || '—'}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs tabular-nums">
                        {m.start_time && m.end_time ? `${m.start_time} – ${m.end_time}` : m.start_time || '—'}
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{m.location || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* ── Hidden Export Template — rendered off-screen ─────────────── */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1, pointerEvents: 'none' }}>
        <EVMSVisitTemplate visit={templateVisit} />
      </div>
    </>
  );
}
