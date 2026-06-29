/**
 * EVMSPrintModal — Print Configuration Popup
 * • Persists all settings across open/close (module-level store)
 * • Full 50–200% scale dropdown
 * • Custom scale input (25–500%)
 * • Live preview estimate updates on every change
 * • No existing EVMS functionality changed
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { X, Printer, Eye, Settings2 } from 'lucide-react';

// ── Module-level persistent store (survives modal open/close, resets on page refresh) ──
const _store = {
  paperSize:     'A4 Portrait',
  scaleDropdown: '100%',
  customScale:   '',
  margins:       'Normal',
  orientation:   'Portrait',
  // Section titles
  incHeaderTitle:  true,
  incVisitorsTitle:true,
  incTravelTitle:  true,
  incHostTitle:    true,
  incTimelineTitle:true,
  // Section content
  incHeader:    true,
  incSummary:   true,
  incVisitors:  true,
  incTravel:    true,
  incHost:      true,
  incTimeline:  true,
  selDays:      {},
  incMeetings:  true,
  incActivities:true,
  // Appearance
  theme:        'Color',
  fontSize:     'Medium',
  layout:       'Standard',
  mergeSections:false,
  // Smart pagination
  keepDays:    true,
  avoidSplit:  true,
  autoBreak:   true,
  repeatHeader:true,
};

// ── Build full 50–200% scale options ──
const SCALE_OPTIONS = [
  'Fit to Page',
  ...Array.from({ length: 151 }, (_, i) => `${i + 50}%`),
];

const SEL = 'px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white';
const CB  = 'w-4 h-4 rounded accent-blue-600 cursor-pointer';
const RB  = 'w-4 h-4 accent-blue-600 cursor-pointer';

function Section({ title, children }) {
  return (
    <div className="mb-4">
      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5 pb-1 border-b border-gray-100">
        {title}
      </div>
      {children}
    </div>
  );
}
function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-2">
      <span className="text-sm text-gray-700 min-w-0 shrink-0">{label}</span>
      {children}
    </div>
  );
}
function CbRow({ label, checked, onChange, indent = false }) {
  return (
    <label className={`flex items-center gap-2 cursor-pointer mb-1.5 ${indent ? 'ml-6' : ''}`}>
      <input type="checkbox" className={CB} checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

export default function EVMSPrintModal({ visit, onClose, onPrint }) {
  const days = useMemo(() => {
    const all = [
      ...(visit.meetings   || []).map(m => m.meeting_date),
      ...(visit.activities || []).map(a => a.activity_date),
    ].filter(Boolean);
    return [...new Set(all)].sort();
  }, [visit]);

  // Merge persisted selDays with any new days from this visit
  const initSelDays = useMemo(() => {
    const merged = { ..._store.selDays };
    days.forEach(d => { if (!(d in merged)) merged[d] = true; });
    return merged;
  }, [days]);

  // ── State — initialised from persistent store ──
  const [paperSize,    setPaperSize]    = useState(_store.paperSize);
  const [scaleDropdown,setScaleDropdown]= useState(_store.scaleDropdown);
  const [customScale,  setCustomScale]  = useState(_store.customScale);
  const [margins,      setMargins]      = useState(_store.margins);
  const [orientation,  setOrientation]  = useState(_store.orientation);
  // Section title checkboxes
  const [incHeaderTitle,  setIncHeaderTitle]  = useState(_store.incHeaderTitle);
  const [incVisitorsTitle,setIncVisitorsTitle]= useState(_store.incVisitorsTitle);
  const [incTravelTitle,  setIncTravelTitle]  = useState(_store.incTravelTitle);
  const [incHostTitle,    setIncHostTitle]    = useState(_store.incHostTitle);
  const [incTimelineTitle,setIncTimelineTitle]= useState(_store.incTimelineTitle);
  // Section content
  const [incHeader,    setIncHeader]    = useState(_store.incHeader);
  const [incSummary,   setIncSummary]   = useState(_store.incSummary);
  const [incVisitors,  setIncVisitors]  = useState(_store.incVisitors);
  const [incTravel,    setIncTravel]    = useState(_store.incTravel);
  const [incHost,      setIncHost]      = useState(_store.incHost);
  const [incTimeline,  setIncTimeline]  = useState(_store.incTimeline);
  const [selDays,      setSelDays]      = useState(initSelDays);
  const [incMeetings,  setIncMeetings]  = useState(_store.incMeetings);
  const [incActivities,setIncActivities]= useState(_store.incActivities);
  // Appearance
  const [theme,         setTheme]         = useState(_store.theme);
  const [fontSize,      setFontSize]      = useState(_store.fontSize);
  const [layout,        setLayout]        = useState(_store.layout);
  const [mergeSections, setMergeSections] = useState(_store.mergeSections);
  // Smart pagination
  const [keepDays,     setKeepDays]     = useState(_store.keepDays);
  const [avoidSplit,   setAvoidSplit]   = useState(_store.avoidSplit);
  const [autoBreak,    setAutoBreak]    = useState(_store.autoBreak);
  const [repeatHeader, setRepeatHeader] = useState(_store.repeatHeader);

  // ── Sync every state change back to persistent store ──
  const saveToStore = () => {
    Object.assign(_store, {
      paperSize, scaleDropdown, customScale, margins, orientation,
      incHeaderTitle, incVisitorsTitle, incTravelTitle, incHostTitle, incTimelineTitle,
      incHeader, incSummary, incVisitors, incTravel, incHost, incTimeline,
      selDays, incMeetings, incActivities,
      theme, fontSize, layout, mergeSections,
      keepDays, avoidSplit, autoBreak, repeatHeader,
    });
  };
  useEffect(() => { saveToStore(); });

  const toggleDay = (d, v) => setSelDays(p => ({ ...p, [d]: v }));

  // ── Resolve effective scale ──
  // Custom scale overrides dropdown if valid
  const effectiveScale = (() => {
    const c = parseInt(customScale);
    if (!isNaN(c) && c >= 25 && c <= 500) return `${c}%`;
    return scaleDropdown;
  })();

  // ── Live preview estimate ──
  const selectedSections = [incHeader, incSummary, incVisitors, incTravel, incHost].filter(Boolean).length;
  const selectedDayCount = incTimeline ? Object.values(selDays).filter(Boolean).length : 0;
  const totalItems = selectedSections + selectedDayCount;
  const scaleNum = parseFloat(effectiveScale) || 100;
  // More days or lower scale → more pages
  const estPages = Math.max(1, Math.ceil((selectedSections * 0.3 + selectedDayCount * 0.8) * (100 / scaleNum)));

  const handlePrint = () => {
    saveToStore();
    onPrint({
      paperSize, scale: effectiveScale, margins, orientation,
      incHeaderTitle, incVisitorsTitle, incTravelTitle, incHostTitle, incTimelineTitle,
      incHeader, incSummary, incVisitors, incTravel, incHost, incTimeline,
      selDays, incMeetings, incActivities,
      theme, fontSize, layout, mergeSections,
      keepDays, avoidSplit, autoBreak, repeatHeader,
    });
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-primary-600" />
              <h2 className="text-base font-bold text-gray-900">Print Executive Visit Schedule</h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Choose what to include in the printed schedule.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="overflow-y-auto flex-1 px-6 py-4">

          {/* PAPER SETTINGS */}
          <Section title="Paper Settings">
            <Row label="Paper Size">
              <select className={SEL} style={{ width: '170px' }}
                value={paperSize} onChange={e => setPaperSize(e.target.value)}>
                <option>A4 Portrait</option>
                <option>A4 Landscape</option>
                <option>A3 Portrait</option>
                <option>A3 Landscape</option>
              </select>
            </Row>

            {/* Scale — full 50–200% dropdown */}
            <Row label="Scale">
              <select className={SEL} style={{ width: '170px' }}
                value={customScale ? '' : scaleDropdown}
                onChange={e => { setScaleDropdown(e.target.value); setCustomScale(''); }}>
                {SCALE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </Row>

            {/* Custom Scale input */}
            <Row label={<span className="text-sm text-gray-600">Custom Scale <span className="text-xs text-gray-400">(overrides above)</span></span>}>
              <div className="flex items-center gap-1.5" style={{ width: '170px' }}>
                <input
                  type="number" min={25} max={500}
                  className={`${SEL} flex-1`}
                  placeholder="e.g. 135"
                  value={customScale}
                  onChange={e => setCustomScale(e.target.value)}
                />
                <span className="text-sm text-gray-500 shrink-0">%</span>
              </div>
            </Row>

            {/* Effective scale badge */}
            <div className="text-xs text-primary-600 font-semibold mb-2 ml-1">
              Effective scale: <span className="bg-primary-50 px-2 py-0.5 rounded-full">{effectiveScale}</span>
            </div>

            <Row label="Margins">
              <select className={SEL} style={{ width: '170px' }}
                value={margins} onChange={e => setMargins(e.target.value)}>
                <option>Narrow</option>
                <option>Normal</option>
                <option>Wide</option>
              </select>
            </Row>
            <Row label="Orientation">
              <div className="flex gap-4">
                {['Portrait','Landscape'].map(o=>(
                  <label key={o} className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-700">
                    <input type="radio" className={RB} name="orient" value={o}
                      checked={orientation===o} onChange={()=>setOrientation(o)}/>{o}
                  </label>
                ))}
              </div>
            </Row>
          </Section>

          {/* PRINT CONTENT */}
          <Section title="Print Content">
            {/* Helper note */}
            <p className="text-xs text-gray-400 mb-3">
              Uncheck a section title to hide its heading but keep the content.<br/>
              Uncheck a section to hide both title and content.
            </p>

            {/* Header */}
            <div className="mb-2">
              <CbRow label="Executive Visit Header" checked={incHeader} onChange={v=>{setIncHeader(v);if(!v)setIncHeaderTitle(false);}}/>
              {incHeader&&<CbRow label="Show header title bar" checked={incHeaderTitle} onChange={setIncHeaderTitle} indent/>}
            </div>

            {/* Summary */}
            <div className="mb-2">
              <CbRow label="Visit Summary (stats cards)" checked={incSummary} onChange={setIncSummary}/>
            </div>

            {/* Visitors */}
            <div className="mb-2">
              <CbRow label="Visitors" checked={incVisitors} onChange={v=>{setIncVisitors(v);if(!v)setIncVisitorsTitle(false);}}/>
              {incVisitors&&<CbRow label="Show Visitors section title" checked={incVisitorsTitle} onChange={setIncVisitorsTitle} indent/>}
            </div>

            {/* Travel */}
            <div className="mb-2">
              <CbRow label="Travel Details" checked={incTravel} onChange={v=>{setIncTravel(v);if(!v)setIncTravelTitle(false);}}/>
              {incTravel&&<CbRow label="Show Travel Details section title" checked={incTravelTitle} onChange={setIncTravelTitle} indent/>}
            </div>

            {/* Host Company */}
            <div className="mb-2">
              <CbRow label="Host Company" checked={incHost} onChange={v=>{setIncHost(v);if(!v)setIncHostTitle(false);}}/>
              {incHost&&<CbRow label="Show Host Company section title" checked={incHostTitle} onChange={setIncHostTitle} indent/>}
            </div>

            {/* Visit Timeline */}
            <div className="mb-1">
              <CbRow label="Visit Timeline" checked={incTimeline} onChange={v=>{setIncTimeline(v);if(!v)setIncTimelineTitle(false);}}/>
              {incTimeline&&(
                <>
                  <CbRow label="Show Visit Timeline section title" checked={incTimelineTitle} onChange={setIncTimelineTitle} indent/>
                  {days.length>0&&(
                    <div className="ml-6 mt-1 p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-gray-500">Select Days</p>
                        <div className="flex gap-2">
                          <button onClick={()=>setSelDays(Object.fromEntries(days.map(d=>[d,true])))}
                            className="text-xs text-primary-600 hover:underline">All</button>
                          <span className="text-gray-300">|</span>
                          <button onClick={()=>setSelDays(Object.fromEntries(days.map(d=>[d,false])))}
                            className="text-xs text-gray-400 hover:underline">None</button>
                        </div>
                      </div>
                      {days.map((d,i)=>(
                        <CbRow key={d}
                          label={`Day ${i+1} — ${new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}`}
                          checked={!!selDays[d]}
                          onChange={v=>toggleDay(d,v)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </Section>

          {/* TIMELINE OPTIONS */}
          <Section title="Timeline Options">
            <CbRow label="Print Meetings"   checked={incMeetings}   onChange={setIncMeetings}/>
            <CbRow label="Print Activities" checked={incActivities} onChange={setIncActivities}/>
          </Section>

          {/* APPEARANCE */}
          <Section title="Appearance">
            <Row label="Print Theme">
              <div className="flex gap-3 flex-wrap">
                {['Color','Black & White','High Contrast'].map(t=>(
                  <label key={t} className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-700">
                    <input type="radio" className={RB} name="theme" value={t}
                      checked={theme===t} onChange={()=>setTheme(t)}/>{t}
                  </label>
                ))}
              </div>
            </Row>
            <Row label="Font Size">
              <div className="flex gap-3 flex-wrap">
                {['Small','Medium','Large','Extra Large'].map(s=>(
                  <label key={s} className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-700">
                    <input type="radio" className={RB} name="fontsize" value={s}
                      checked={fontSize===s} onChange={()=>setFontSize(s)}/>{s}
                  </label>
                ))}
              </div>
            </Row>
          </Section>

          {/* LAYOUT */}
          <Section title="Layout">
            {[
              {v:'Compact',  desc:'More rows per page'},
              {v:'Standard', desc:'Current layout'},
              {v:'Spacious', desc:'Larger spacing for presentations'},
            ].map(({v,desc})=>(
              <label key={v} className="flex items-center gap-2 cursor-pointer mb-2">
                <input type="radio" className={RB} name="layout" value={v}
                  checked={layout===v} onChange={()=>setLayout(v)}/>
                <span className="text-sm text-gray-700 font-medium">{v}</span>
                <span className="text-xs text-gray-400">— {desc}</span>
              </label>
            ))}
            <div className="mt-2 pt-2 border-t border-gray-100">
              <CbRow
                label={<span>Merge small sections onto one page <span className="text-xs text-gray-400">(reduces wasted space)</span></span>}
                checked={mergeSections}
                onChange={setMergeSections}
              />
            </div>
          </Section>

          {/* SMART PAGINATION */}
          <Section title="Smart Pagination">
            <CbRow label="Keep each Day together"        checked={keepDays}     onChange={setKeepDays}/>
            <CbRow label="Avoid splitting tables"        checked={avoidSplit}   onChange={setAvoidSplit}/>
            <CbRow label="Auto page break"               checked={autoBreak}    onChange={setAutoBreak}/>
            <CbRow label="Repeat Day Header on new page" checked={repeatHeader} onChange={setRepeatHeader}/>
          </Section>

          {/* LIVE PREVIEW ESTIMATE */}
          <Section title="Preview">
            <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl p-3">
              <div className="flex items-center gap-3">
                <Eye className="w-5 h-5 text-blue-500 shrink-0"/>
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {totalItems} section{totalItems !== 1 ? 's' : ''} selected
                    {incTimeline && selectedDayCount > 0 && ` (${selectedDayCount} day${selectedDayCount!==1?'s':''})`}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Scale: <strong>{effectiveScale}</strong>
                    &nbsp;·&nbsp;
                    Estimated pages: <strong>{estPages}</strong>
                  </p>
                </div>
              </div>
              <Settings2 className="w-4 h-4 text-blue-300 shrink-0"/>
            </div>
          </Section>
        </div>

        {/* ── Footer Buttons ── */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 shrink-0">
          <button
            onClick={() => {
              setPaperSize('A4 Portrait'); setScaleDropdown('100%'); setCustomScale('');
              setMargins('Normal'); setOrientation('Portrait');
              setIncHeaderTitle(true); setIncVisitorsTitle(true); setIncTravelTitle(true);
              setIncHostTitle(true); setIncTimelineTitle(true);
              setIncHeader(true); setIncSummary(true); setIncVisitors(true);
              setIncTravel(true); setIncHost(true); setIncTimeline(true);
              setSelDays(Object.fromEntries(days.map(d=>[d,true])));
              setIncMeetings(true); setIncActivities(true);
              setTheme('Color'); setFontSize('Medium'); setLayout('Standard'); setMergeSections(false);
              setKeepDays(true); setAvoidSplit(true); setAutoBreak(true); setRepeatHeader(true);
            }}
            className="text-xs text-gray-400 hover:text-gray-600 underline transition-colors">
            Reset to defaults
          </button>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-white text-gray-600 transition-colors">
              Cancel
            </button>
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-semibold transition-colors">
              <Printer className="w-4 h-4"/> Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
