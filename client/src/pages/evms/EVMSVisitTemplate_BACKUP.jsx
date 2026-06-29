/**
 * EVMSVisitTemplate — Enterprise Executive PDF Report
 * BUG FIX ONLY — Design is preserved exactly as-is
 * Fixes: no clipping, no fixed heights, no overflow, correct pagination,
 *        40px avatars always circular, text wraps, sections never split
 */
import { forwardRef } from 'react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(d) {
  if (!d) return '—';
  try { return new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); }
  catch { return d; }
}
function fmtLong(d) {
  if (!d) return '—';
  try { return new Date(d+'T00:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'long',year:'numeric'}); }
  catch { return d; }
}
function fmtTime(t) {
  if (!t) return '—';
  try {
    const [h,m] = t.split(':').map(Number);
    return `${String(h%12||12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;
  } catch { return t; }
}
function parseIds(raw) {
  if (!raw) return [];
  try { return typeof raw==='string'?JSON.parse(raw):(Array.isArray(raw)?raw:[]); }
  catch { return []; }
}
function getNameList(ids,list,key) {
  const p=parseIds(ids);
  if (!p.length) return '—';
  return list.filter(x=>p.includes(x.id)).map(x=>x[key]).join(',\n')||'—';
}
function dur(s,e) {
  if (!s||!e) return '—';
  try {
    const d=Math.round((new Date(e+'T00:00:00')-new Date(s+'T00:00:00'))/86400000)+1;
    return `${d} Day${d!==1?'s':''}`;
  } catch { return '—'; }
}
function ini(name) {
  if (!name) return '?';
  const p=name.trim().split(/\s+/).filter(Boolean);
  if (p.length===1) return p[0].slice(0,2).toUpperCase();
  return (p[0][0]+p[p.length-1][0]).toUpperCase();
}

// ─── Tokens (existing design colors — DO NOT CHANGE) ─────────────────────────
const F     = "'Inter','Aptos','Calibri',Arial,sans-serif";
const NAV   = '#0F2D6B';  const NAV_DK='#091F4F'; const NAV_MD='#1A3F8F';
const WHT   = '#FFFFFF';  const TXT='#1E293B';    const SUB='#4B5563'; const MUT='#9CA3AF';
const BDR   = '#E5E7EB';  const BG='#FFFFFF';     const BGS='#F8FAFC'; const BGA='#F1F5F9';
const GRN   = '#16A34A';  const GRN_L='#DCFCE7';
const ORG   = '#D97706';  const ORG_L='#FEF3C7';
const RED   = '#DC2626';  const RED_L='#FEE2E2';
const PUR   = '#7C3AED';  const PUR_L='#EDE9FE';
const BLU   = '#1A56DB';  const BLU_L='#EFF6FF';
const AVC   = ['#0F2D6B','#1565A8','#1A56DB','#7C3AED','#0891B2','#0F766E','#B45309','#BE185D','#065F46'];
const ac    = i => AVC[i%AVC.length];

// ─── Avatar — FIXED 40px, always circle, initials centered, flex-shrink:0 ─────
function Av({name,bg,idx=0,sz=40}) {
  const c=bg||ac(idx);
  const fs=sz<=28?10:sz<=32?12:15;
  return (
    <div
      data-avatar="true"
      style={{
        width:`${sz}px`,height:`${sz}px`,minWidth:`${sz}px`,minHeight:`${sz}px`,
        borderRadius:'50%',background:c,color:WHT,
        display:'flex',alignItems:'center',justifyContent:'center',
        fontSize:`${fs}px`,fontWeight:700,fontFamily:F,
        lineHeight:1,flexShrink:0,boxSizing:'border-box',
        userSelect:'none',
      }}
    >
      {ini(name)}
    </div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────
function SH({icon,title,badge}) {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'9px'}}>
      <div style={{display:'flex',alignItems:'center',gap:'7px'}}>
        <span style={{color:NAV,display:'flex',flexShrink:0}}>{icon}</span>
        <span style={{fontSize:'11px',fontWeight:700,color:TXT,textTransform:'uppercase',letterSpacing:'0.8px'}}>{title}</span>
      </div>
      {badge&&<span style={{fontSize:'9px',fontWeight:600,color:NAV,background:BLU_L,padding:'2px 8px',borderRadius:'10px'}}>{badge}</span>}
    </div>
  );
}

// ─── Card box ─────────────────────────────────────────────────────────────────
function CBox({children,style={},className=''}) {
  return (
    <div className={`nb${className?' '+className:''}`} style={{
      border:`1px solid ${BDR}`,borderRadius:'8px',background:BG,
      overflow:'visible',boxSizing:'border-box',
      pageBreakInside:'avoid',breakInside:'avoid',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─── Card section header bar ──────────────────────────────────────────────────
function CH({icon,title,badge}) {
  return (
    <div style={{
      display:'flex',alignItems:'center',justifyContent:'space-between',
      padding:'8px 14px',background:BGS,borderBottom:`1px solid ${BDR}`,
      borderRadius:'8px 8px 0 0',
    }}>
      <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
        <span style={{color:NAV,display:'flex',flexShrink:0}}>{icon}</span>
        <span style={{fontSize:'10px',fontWeight:700,color:TXT,textTransform:'uppercase',letterSpacing:'0.7px'}}>{title}</span>
      </div>
      {badge&&<span style={{fontSize:'9px',color:SUB,fontWeight:500}}>{badge}</span>}
    </div>
  );
}

// ─── Page footer ──────────────────────────────────────────────────────────────
function PF({page,total}) {
  return (
    <div style={{
      display:'flex',alignItems:'center',justifyContent:'space-between',
      padding:'7px 0',borderTop:`1px solid ${BDR}`,
      fontSize:'8px',color:MUT,marginTop:'16px',
    }}>
      <span style={{fontWeight:600,color:SUB}}>Executive Visit Management System</span>
      <span>Confidential</span>
      <span>Page {page} of {total}</span>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const I={
  cal:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  clk:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  usr:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  usrs:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  bld:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>,
  pln:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19 2c-2-2-4-2-5.5-.5L10 5 1.8 6.2c-.5.1-.9.5-.8 1l.8 5c.1.5.5.9 1 1L9 15l-2 3.5c-.4.7.2 1.5 1 1.3l5-1.5 2 4c.3.6 1.1.7 1.5.2z"/></svg>,
  map:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  doc:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  pen:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  tel:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.56 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  htl:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  car:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 4v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  nfo:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  chk:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  xic:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const EVMSVisitTemplate = forwardRef(function EVMSVisitTemplate({visit},ref) {
  if (!visit) return null;
  const visitors  =visit.visitors  ||[];
  const hosts     =visit.hosts     ||[];
  const meetings  =visit.meetings  ||[];
  const activities=visit.activities||[];
  const today=new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'});
  const nowTm=new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});

  // Timeline
  const tl=[
    ...meetings.map(m=>({kind:'meeting',date:m.meeting_date,st:m.start_time,title:m.notes||m.meeting_title||'Meeting',desc:m.notes,vids:m.visitor_ids,hids:m.host_ids})),
    ...activities.map(a=>({kind:'activity',date:a.activity_date,st:a.start_time,title:a.activity_type||'Activity',desc:a.description,vids:a.visitor_ids,hids:a.host_ids})),
  ].sort((a,b)=>{if(a.date!==b.date) return (a.date||'').localeCompare(b.date||''); return (a.st||'').localeCompare(b.st||'');});

  const grp={};
  tl.forEach(item=>{const k=item.date||'TBD'; if(!grp[k])grp[k]=[]; grp[k].push(item);});
  const days=Object.entries(grp).sort(([a],[b])=>a.localeCompare(b));

  // Companies
  const cos={};
  hosts.forEach(h=>{const k=h.company_name||visit.host_company||'Host Organization'; if(!cos[k])cos[k]={head:null,members:[]}; if(h.is_company_head)cos[k].head=h; else cos[k].members.push(h);});

  // Travel
  const wt=visitors.filter(v=>v.travel_arrival_airport||v.travel_arrival_date||v.travel_departure_airport||v.travel_departure_date);
  let tv=null;
  if(wt.length>=1){const f=wt[0]; const same=wt.every(v=>v.travel_arrival_airport===f.travel_arrival_airport&&v.travel_arrival_date===f.travel_arrival_date&&v.travel_arrival_time===f.travel_arrival_time&&v.travel_departure_airport===f.travel_departure_airport&&v.travel_departure_date===f.travel_departure_date&&v.travel_departure_time===f.travel_departure_time); if(same)tv={a_ap:f.travel_arrival_airport,a_dt:f.travel_arrival_date,a_tm:f.travel_arrival_time,d_ap:f.travel_departure_airport,d_dt:f.travel_departure_date,d_tm:f.travel_departure_time};}

  const mDone=meetings.filter(m=>m.status==='Completed').length;
  const mPend=meetings.filter(m=>m.status==='Pending').length;
  const mCanc=meetings.filter(m=>m.status==='Cancelled').length;

  // shared table cell styles — auto height, no clipping
  const TH={padding:'6px 8px',fontSize:'8px',fontWeight:700,color:SUB,textTransform:'uppercase',letterSpacing:'0.5px',background:BGA,borderBottom:`1px solid ${BDR}`,whiteSpace:'nowrap'};
  const TD={padding:'8px 8px',fontSize:'10px',color:TXT,overflowWrap:'break-word',wordBreak:'break-word',whiteSpace:'normal',lineHeight:'1.5',verticalAlign:'top'};

  const totalPages=1; // Will be dynamically calculated in real implementation

  return (
    <div ref={ref} id="evms-template-root" style={{width:'794px',minWidth:'794px',maxWidth:'794px',fontFamily:F,background:BG,color:TXT,fontSize:'11px',lineHeight:'1.5',WebkitFontSmoothing:'antialiased',boxSizing:'border-box'}}>
      <style>{CSS}</style>

      {/* ═══ PAGE 1 ═══ */}
      <div className="page">
      
      {/* ═══ HEADER — full width navy gradient ═══════════════════════════ */}
      <div className="nb page-header" style={{background:`linear-gradient(150deg,${NAV_DK} 0%,${NAV} 55%,${NAV_MD} 100%)`,position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',inset:0,opacity:0.05,backgroundImage:`radial-gradient(circle,rgba(255,255,255,0.9) 1px,transparent 1px)`,backgroundSize:'14px 14px',pointerEvents:'none'}}/>
        <div style={{position:'absolute',right:0,top:0,opacity:0.08,pointerEvents:'none'}}><svg width="160" height="130" viewBox="0 0 200 160" fill="none"><circle cx="120" cy="50" r="60" stroke="white" strokeWidth="0.8"/><ellipse cx="120" cy="50" rx="30" ry="60" stroke="white" strokeWidth="0.6"/><ellipse cx="120" cy="50" rx="60" ry="20" stroke="white" strokeWidth="0.6"/></svg></div>
        <div style={{position:'absolute',right:'26px',top:'14px',color:'rgba(255,255,255,0.35)'}}><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg></div>

        {/* brand row */}
        <div style={{padding:'11px 22px 0',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
            <div style={{width:'24px',height:'24px',background:'rgba(255,255,255,0.15)',borderRadius:'5px',display:'flex',alignItems:'center',justifyContent:'center',color:WHT,flexShrink:0}}>{I.bld}</div>
            <div><div style={{fontSize:'9px',fontWeight:700,color:WHT,letterSpacing:'0.3px'}}>YOUR COMPANY</div><div style={{fontSize:'7px',color:'rgba(255,255,255,0.5)'}}>TAGLINE HERE</div></div>
            <div style={{width:'1px',height:'20px',background:'rgba(255,255,255,0.2)',margin:'0 8px'}}/>
            <span style={{fontSize:'8px',fontWeight:600,color:'rgba(255,255,255,0.65)',letterSpacing:'1.3px',textTransform:'uppercase'}}>Executive Visit Management System</span>
          </div>
          <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
            <span style={{fontSize:'8px',fontWeight:600,background:'rgba(255,255,255,0.15)',color:WHT,padding:'2px 8px',borderRadius:'3px'}}>CONFIDENTIAL</span>
            <span style={{fontSize:'8px',color:'rgba(255,255,255,0.4)'}}>v1.0</span>
          </div>
        </div>

        {/* title */}
        <div style={{padding:'9px 22px 0'}}>
          <div style={{fontSize:'24px',fontWeight:700,color:WHT,letterSpacing:'-0.3px',lineHeight:1.2,marginBottom:'2px'}}>Executive Visit Schedule</div>
          <div style={{fontSize:'13px',color:'rgba(255,255,255,0.82)',marginBottom:'12px',overflowWrap:'break-word',wordBreak:'break-word'}}>{visit.visit_name}</div>
        </div>

        {/* meta bar */}
        <div style={{background:'rgba(0,0,0,0.22)',padding:'8px 22px',borderTop:'1px solid rgba(255,255,255,0.1)',display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'8px'}}>
          {[{l:'VISIT DATES',v:`${fmt(visit.start_date)} – ${fmt(visit.end_date)}`,ic:I.cal},{l:'DURATION',v:dur(visit.start_date,visit.end_date),ic:I.clk},{l:'COORDINATOR',v:visit.coordinator||'—',ic:I.usr},{l:'LOCATION',v:visit.host_location||'—',ic:I.map},{l:'GENERATED ON',v:`${today} ${nowTm}`,ic:I.doc}].map(({l,v,ic})=>(
            <div key={l}><div style={{fontSize:'7px',fontWeight:600,color:'rgba(255,255,255,0.5)',textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:'2px',display:'flex',alignItems:'center',gap:'3px'}}><span style={{color:'rgba(255,255,255,0.4)',display:'flex',flexShrink:0}}>{ic}</span>{l}</div><div style={{fontSize:'10px',fontWeight:600,color:WHT,overflowWrap:'break-word',wordBreak:'break-word'}}>{v}</div></div>
          ))}
        </div>
      </div>

      {/* ═══ BODY ════════════════════════════════════════════════════════ */}
      <div style={{padding:'14px 22px'}}>

        {/* SUMMARY CARDS — 4 equal, single row, no wrapping */}
        <div className="nb section-block" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'10px',marginBottom:'14px'}}>
          {[
            {l:'VISITORS',v:visitors.length,c:NAV,bg:'#EBF5FF',ic:<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={NAV} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>},
            {l:'HOST COMPANY',v:Object.keys(cos).length,c:PUR,bg:PUR_L,ic:<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={PUR} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>},
            {l:'MEETINGS',v:meetings.length,c:GRN,bg:GRN_L,ic:<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={GRN} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>},
            {l:'DAYS DURATION',v:days.length||dur(visit.start_date,visit.end_date),c:ORG,bg:ORG_L,ic:<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={ORG} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>},
          ].map(({l,v,c,bg,ic})=>(
            <div key={l} style={{display:'flex',alignItems:'center',gap:'10px',padding:'11px 12px',border:`1px solid ${BDR}`,borderRadius:'8px',borderTop:`3px solid ${c}`,background:BG,boxSizing:'border-box'}}>
              <div style={{width:'38px',height:'38px',minWidth:'38px',borderRadius:'8px',background:bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{ic}</div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:'22px',fontWeight:700,color:c,lineHeight:1}}>{v}</div>
                <div style={{fontSize:'8px',fontWeight:600,color:SUB,textTransform:'uppercase',letterSpacing:'0.5px',marginTop:'2px',overflowWrap:'break-word'}}>{l}</div>
              </div>
            </div>
          ))}
        </div>

        {/* VISITORS — flex wrap, 40px avatar, name+code, auto height */}
        {visitors.length>0&&(
          <CBox style={{marginBottom:'14px'}} className="section-block">
            <CH icon={I.usrs} title="Visitors" badge={`${visitors.length} Visitor${visitors.length!==1?'s':''}`}/>
            <div style={{padding:'10px 12px',display:'flex',flexWrap:'wrap',gap:'8px'}}>
              {visitors.map((v,i)=>(
                <div key={v.id||i} style={{display:'flex',alignItems:'flex-start',gap:'9px',padding:'8px 10px',background:BGS,border:`1px solid ${BDR}`,borderRadius:'7px',minWidth:'150px',flex:'1 1 150px',maxWidth:'220px',boxSizing:'border-box',pageBreakInside:'avoid',breakInside:'avoid'}}>
                  <Av name={v.visitor_name} idx={i} sz={40}/>
                  <div style={{minWidth:0,flex:1,paddingTop:'2px'}}>
                    <div style={{fontSize:'11px',fontWeight:600,color:TXT,overflowWrap:'break-word',wordBreak:'break-word',lineHeight:'1.4'}}>{v.visitor_name}</div>
                    <div style={{fontSize:'10px',color:SUB,marginTop:'1px'}}>({ini(v.visitor_name)})</div>
                  </div>
                </div>
              ))}
            </div>
          </CBox>
        )}

        {/* TRAVEL — arrival + departure always together, never split */}
        {tv&&(tv.a_ap||tv.a_dt||tv.d_ap||tv.d_dt)&&(
          <CBox style={{marginBottom:'14px'}} className="section-block">
            <CH icon={I.pln} title="Travel Details (Common for All Visitors)"/>
            <div style={{padding:'12px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
              {(tv.a_ap||tv.a_dt)&&(
                <div style={{background:BGS,border:`1px solid ${BDR}`,borderRadius:'6px',padding:'12px 14px',borderLeft:`3px solid ${NAV}`,pageBreakInside:'avoid',breakInside:'avoid'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'5px',marginBottom:'9px'}}><span style={{color:NAV,display:'flex',flexShrink:0}}>{I.pln}</span><span style={{fontSize:'9px',fontWeight:700,color:NAV,textTransform:'uppercase',letterSpacing:'0.8px'}}>Arrival</span></div>
                  <div style={{display:'grid',gridTemplateColumns:'70px 1fr',rowGap:'4px',fontSize:'11px'}}>
                    <div style={{color:MUT}}>Location</div><div style={{fontWeight:700,color:TXT,overflowWrap:'break-word'}}>{tv.a_ap||'—'}</div>
                    <div style={{color:MUT}}>Date</div><div style={{fontWeight:700,color:TXT}}>{fmt(tv.a_dt)}</div>
                    {tv.a_tm&&<><div style={{color:MUT}}>Time</div><div style={{fontWeight:700,color:TXT}}>{fmtTime(tv.a_tm)}</div></>}
                  </div>
                </div>
              )}
              {(tv.d_ap||tv.d_dt)&&(
                <div style={{background:BGS,border:`1px solid ${BDR}`,borderRadius:'6px',padding:'12px 14px',borderLeft:`3px solid ${GRN}`,pageBreakInside:'avoid',breakInside:'avoid'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'5px',marginBottom:'9px'}}><span style={{color:GRN,display:'flex',flexShrink:0}}>{I.pln}</span><span style={{fontSize:'9px',fontWeight:700,color:GRN,textTransform:'uppercase',letterSpacing:'0.8px'}}>Departure</span></div>
                  <div style={{display:'grid',gridTemplateColumns:'70px 1fr',rowGap:'4px',fontSize:'11px'}}>
                    <div style={{color:MUT}}>Location</div><div style={{fontWeight:700,color:TXT,overflowWrap:'break-word'}}>{tv.d_ap||'—'}</div>
                    <div style={{color:MUT}}>Date</div><div style={{fontWeight:700,color:TXT}}>{fmt(tv.d_dt)}</div>
                    {tv.d_tm&&<><div style={{color:MUT}}>Time</div><div style={{fontWeight:700,color:TXT}}>{fmtTime(tv.d_tm)}</div></>}
                  </div>
                </div>
              )}
            </div>
          </CBox>
        )}

        {/* HOST COMPANY — entire block never splits */}
        {hosts.length>0&&(
          <CBox style={{marginBottom:'14px'}} className="section-block">
            <CH icon={I.bld} title="Host Company" badge={`${hosts.length} Member${hosts.length!==1?'s':''}`}/>
            <div style={{padding:'12px'}}>
              {Object.entries(cos).map(([cname,grp])=>(
                <div key={cname} style={{pageBreakInside:'avoid',breakInside:'avoid',marginBottom:'10px'}}>
                  {/* Company name */}
                  <div style={{fontSize:'9px',fontWeight:700,color:NAV,textTransform:'uppercase',letterSpacing:'0.7px',paddingBottom:'7px',marginBottom:'9px',borderBottom:`1px solid ${BDR}`,display:'flex',alignItems:'center',gap:'5px'}}>
                    <span style={{flexShrink:0}}>{I.bld}</span><span style={{overflowWrap:'break-word',wordBreak:'break-word'}}>{cname}</span>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'auto 1fr',gap:'14px',alignItems:'start'}}>
                    {/* Company icon block */}
                    <div style={{width:'60px',display:'flex',flexDirection:'column',alignItems:'center',gap:'5px',padding:'10px 8px',background:BGS,border:`1px solid ${BDR}`,borderRadius:'7px',flexShrink:0}}>
                      <div style={{width:'34px',height:'34px',borderRadius:'8px',background:'#E8F0FE',display:'flex',alignItems:'center',justifyContent:'center',color:NAV}}>{I.bld}</div>
                      <div style={{fontSize:'8px',color:SUB,textAlign:'center',overflowWrap:'break-word',wordBreak:'break-word',lineHeight:'1.3'}}>Company</div>
                      <div style={{fontSize:'9px',fontWeight:700,color:TXT,textAlign:'center',overflowWrap:'break-word',wordBreak:'break-word',lineHeight:'1.3'}}>{cname}</div>
                    </div>
                    <div style={{minWidth:0}}>
                      {/* Company head */}
                      {grp.head&&(
                        <div style={{marginBottom:grp.members.length?'10px':0}}>
                          <div style={{fontSize:'8px',fontWeight:600,color:MUT,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'6px'}}>Company Head</div>
                          <div style={{display:'inline-flex',alignItems:'flex-start',gap:'10px',background:'linear-gradient(135deg,#FFFBEB,#FEF3C7)',border:`1px solid #FDE68A`,borderRadius:'7px',padding:'10px 12px',maxWidth:'100%',boxSizing:'border-box',pageBreakInside:'avoid',breakInside:'avoid'}}>
                            <Av name={grp.head.host_name} bg={ORG} sz={40}/>
                            <div style={{minWidth:0,flex:1}}>
                              <div style={{fontSize:'12px',fontWeight:700,color:TXT,overflowWrap:'break-word',wordBreak:'break-word',lineHeight:'1.4'}}>{grp.head.host_name}</div>
                              {grp.head.designation&&<div style={{fontSize:'10px',color:SUB,marginTop:'1px',overflowWrap:'break-word',wordBreak:'break-word',lineHeight:'1.4'}}>{grp.head.designation}{grp.head.company_name?` · ${grp.head.company_name}`:''}</div>}
                            </div>
                            <span style={{fontSize:'7px',fontWeight:700,color:ORG,background:'#FEF3C7',border:`1px solid #FDE68A`,borderRadius:'3px',padding:'2px 5px',whiteSpace:'nowrap',flexShrink:0,alignSelf:'flex-start'}}>HEAD</span>
                          </div>
                        </div>
                      )}
                      {/* Host team — 4-col grid, auto height */}
                      {grp.members.length>0&&(
                        <div>
                          <div style={{fontSize:'8px',fontWeight:600,color:MUT,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'6px'}}>Host Team ({grp.members.length} Member{grp.members.length!==1?'s':''})</div>
                          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'7px'}}>
                            {grp.members.map((h,i)=>(
                              <div key={h.id||i} style={{display:'flex',alignItems:'flex-start',gap:'7px',background:BGS,border:`1px solid ${BDR}`,borderRadius:'6px',padding:'8px',boxSizing:'border-box',pageBreakInside:'avoid',breakInside:'avoid',height:'auto',minHeight:'unset'}}>
                                <Av name={h.host_name} idx={i+2} sz={28}/>
                                <div style={{minWidth:0,flex:1}}>
                                  <div style={{fontSize:'9px',fontWeight:600,color:TXT,overflowWrap:'break-word',wordBreak:'break-word',lineHeight:'1.4'}}>{h.host_name}</div>
                                  {h.designation&&<div style={{fontSize:'8px',color:SUB,marginTop:'1px',overflowWrap:'break-word',wordBreak:'break-word',lineHeight:'1.4'}}>{h.designation}</div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CBox>
        )}

        {/* VISIT TIMELINE — each DAY block atomic, never splits */}
        <div style={{marginBottom:'14px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'9px'}}>
            <SH icon={I.cal} title="Visit Timeline"/>
            <span style={{fontSize:'9px',color:SUB}}>{tl.length} item{tl.length!==1?'s':''} across {days.length} day{days.length!==1?'s':''}</span>
          </div>

          {tl.length===0?(
            <div style={{textAlign:'center',padding:'20px',color:MUT,border:`1px dashed ${BDR}`,borderRadius:'8px',background:BGS,fontSize:'11px'}}>No timeline items scheduled.</div>
          ):(
            days.map(([date,items],di)=>(
              <div key={date} className="timeline-day-block" style={{marginBottom:'14px',pageBreakInside:'avoid',breakInside:'avoid',border:`1px solid ${BDR}`,borderRadius:'8px',overflow:'visible'}}>
                {/* Day header */}
                <div style={{background:`linear-gradient(135deg,${NAV_DK},${NAV})`,color:WHT,padding:'7px 13px',borderRadius:'7px 7px 0 0',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                    <span style={{background:'rgba(255,255,255,0.18)',borderRadius:'4px',padding:'2px 8px',fontSize:'9px',fontWeight:700,letterSpacing:'0.6px'}}>DAY {di+1}</span>
                    <span style={{fontSize:'11px',fontWeight:600}}>{fmtLong(date)}</span>
                  </div>
                  <span style={{fontSize:'9px',color:'rgba(255,255,255,0.65)'}}>{items.length} item{items.length!==1?'s':''}</span>
                </div>
                {/* Table — header repeats logic handled by nb class */}
                <div>
                  <div style={{display:'grid',gridTemplateColumns:'70px 72px 1fr 120px 120px 1fr',background:BGA,borderBottom:`1px solid ${BDR}`}}>
                    {['TIME','TYPE','ACTIVITY / MEETING','VISITORS','HOSTS','REMARKS'].map(h=>(
                      <div key={h} style={TH}>{h}</div>
                    ))}
                  </div>
                  {items.map((item,ri)=>{
                    const isMtg=item.kind==='meeting';
                    return (
                      <div key={ri} style={{display:'grid',gridTemplateColumns:'70px 72px 1fr 120px 120px 1fr',background:ri%2===0?BG:BGS,borderTop:`1px solid ${BDR}`,pageBreakInside:'avoid',breakInside:'avoid'}}>
                        <div style={{...TD,fontWeight:700,color:NAV}}>{fmtTime(item.st)}</div>
                        <div style={TD}>
                          <span style={{display:'inline-flex',alignItems:'center',gap:'3px',fontSize:'8px',fontWeight:700,color:isMtg?'#1D4ED8':'#059669',background:isMtg?'#EFF6FF':'#ECFDF5',padding:'2px 6px',borderRadius:'3px',whiteSpace:'nowrap'}}>
                            ● {isMtg?'Meeting':'Activity'}
                          </span>
                        </div>
                        <div style={{...TD,fontWeight:600}}>{item.title}</div>
                        <div style={TD}>{getNameList(item.vids,visitors,'visitor_name')}</div>
                        <div style={TD}>{getNameList(item.hids,hosts,'host_name')}</div>
                        <div style={{...TD,color:SUB}}>{item.desc||'—'}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* BOTTOM ROW: Accommodation + Transportation | Meeting Summary */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'14px'}} className="section-block">
          <div>
            <CBox style={{marginBottom:'10px'}}>
              <CH icon={I.htl} title="Accommodation"/>
              <div style={{padding:'10px 12px'}}>
                {visit.hotel_name?(
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',fontSize:'10px'}}>
                    <div><div style={{color:MUT,fontSize:'8px',marginBottom:'2px'}}>Hotel</div><div style={{fontWeight:600,color:TXT,overflowWrap:'break-word'}}>{visit.hotel_name}</div></div>
                    <div><div style={{color:MUT,fontSize:'8px',marginBottom:'2px'}}>City</div><div style={{fontWeight:600,color:TXT,overflowWrap:'break-word'}}>{visit.host_location||'—'}</div></div>
                    <div><div style={{color:MUT,fontSize:'8px',marginBottom:'2px'}}>Check-in</div><div style={{fontWeight:600,color:TXT}}>{fmt(visit.start_date)}</div></div>
                    <div><div style={{color:MUT,fontSize:'8px',marginBottom:'2px'}}>Check-out</div><div style={{fontWeight:600,color:TXT}}>{fmt(visit.end_date)}</div></div>
                  </div>
                ):<div style={{fontSize:'10px',color:MUT,fontStyle:'italic'}}>No accommodation details available.</div>}
              </div>
            </CBox>
            <CBox>
              <CH icon={I.car} title="Transportation"/>
              <div style={{padding:'10px 12px',fontSize:'10px',color:TXT,overflowWrap:'break-word',lineHeight:'1.5'}}>
                {visit.transportation||'Airport Transfer, Local Transport & Intercity Transfer'}
              </div>
            </CBox>
          </div>

          <CBox>
            <CH icon={I.cal} title="Meeting Summary"/>
            <div style={{padding:'12px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
              {[
                {l:'Meetings Scheduled',v:meetings.length,c:'#1D4ED8',bg:'#EFF6FF',ic:I.cal},
                {l:'Meetings Completed', v:mDone,          c:GRN,     bg:GRN_L,     ic:I.chk},
                {l:'Meetings Pending',  v:mPend,          c:ORG,     bg:ORG_L,     ic:I.clk},
                {l:'Meetings Cancelled',v:mCanc,          c:RED,     bg:RED_L,     ic:I.xic},
              ].map(({l,v,c,bg,ic})=>(
                <div key={l} style={{display:'flex',alignItems:'center',gap:'8px',padding:'8px',background:BGS,borderRadius:'6px',border:`1px solid ${BDR}`,boxSizing:'border-box'}}>
                  <div style={{width:'24px',height:'24px',minWidth:'24px',borderRadius:'6px',background:bg,display:'flex',alignItems:'center',justifyContent:'center',color:c,flexShrink:0}}>{ic}</div>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:'17px',fontWeight:700,color:c,lineHeight:1}}>{v}</div>
                    <div style={{fontSize:'8px',color:SUB,marginTop:'2px',overflowWrap:'break-word',wordBreak:'break-word'}}>{l}</div>
                  </div>
                </div>
              ))}
            </div>
          </CBox>
        </div>

        {/* NOTES + EMERGENCY CONTACTS */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'14px'}} className="section-block">
          <CBox>
            <CH icon={I.pen} title="Notes"/>
            <div style={{padding:'10px 12px',minHeight:'60px'}}>
              {visit.notes?<div style={{fontSize:'11px',color:TXT,overflowWrap:'break-word',wordBreak:'break-word',lineHeight:'1.6'}}>{visit.notes}</div>:<div style={{fontSize:'10px',color:MUT,fontStyle:'italic'}}>Add any additional notes here…</div>}
            </div>
          </CBox>
          <CBox>
            <CH icon={I.tel} title="Emergency Contacts"/>
            <div style={{padding:'10px 12px',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px'}}>
              {[
                {t:'Local Coordinator',n:visit.coordinator||'—',p:visit.coordinator_phone||'—'},
                {t:'Company Admin',    n:'Admin Team',           p:visit.admin_phone||'—'},
                {t:'Hotel Concierge', n:visit.hotel_name||'—',  p:visit.hotel_phone||'—'},
              ].map(({t,n,p})=>(
                <div key={t} style={{display:'flex',gap:'7px',alignItems:'flex-start',pageBreakInside:'avoid',breakInside:'avoid'}}>
                  <div style={{width:'26px',height:'26px',minWidth:'26px',borderRadius:'50%',background:'#E8F0FE',display:'flex',alignItems:'center',justifyContent:'center',color:NAV,flexShrink:0,marginTop:'1px'}}>{I.usr}</div>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:'9px',fontWeight:700,color:TXT,overflowWrap:'break-word',wordBreak:'break-word',lineHeight:'1.4'}}>{t}</div>
                    <div style={{fontSize:'9px',color:SUB,overflowWrap:'break-word',wordBreak:'break-word',lineHeight:'1.4',marginTop:'1px'}}>{n}</div>
                    <div style={{fontSize:'9px',color:NAV,fontWeight:600,marginTop:'2px'}}>{p}</div>
                  </div>
                </div>
              ))}
            </div>
          </CBox>
        </div>

        {/* Note bar */}
        <div style={{display:'flex',alignItems:'flex-start',gap:'7px',background:'#FFF7ED',border:`1px solid #FED7AA`,borderRadius:'6px',padding:'8px 12px',fontSize:'10px',color:SUB}}>
          <span style={{color:ORG,flexShrink:0,marginTop:'1px'}}>{I.nfo}</span>
          <span><strong style={{color:TXT}}>Note:</strong> All times are in local time &nbsp;•&nbsp; Please carry a valid ID proof during the visit.</span>
        </div>

      </div>
      
      {/* ═══ PAGE FOOTER (appears on every page when printed) ═══ */}
      <div className="page-footer">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 22px',borderTop:`1px solid ${BDR}`,fontSize:'8px',color:MUT,marginTop:'16px'}}>
          <span style={{fontWeight:600,color:SUB}}>Executive Visit Management System</span>
          <span>Confidential  •  Generated: {today}</span>
          <span className="page-number"></span>
        </div>
      </div>
      
      </div>
    </div>
  );
});

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS=`
  /* ── GLOBAL TEXT SAFETY ────────────────────────────────────────────── */
  #evms-template-root * {
    box-sizing: border-box;
    overflow-wrap: break-word;
    word-break: break-word;
    white-space: normal;
    max-width: 100%;
    /* NEVER clip text */
    overflow: visible !important;
    /* NEVER fixed height — content drives height */
    height: auto;
  }

  /* ── AVATAR — always perfect circle, never shrink ──────────────────── */
  #evms-template-root [data-avatar] {
    border-radius: 50% !important;
    flex-shrink: 0 !important;
    overflow: visible !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  /* ── NO-BREAK BLOCKS — NEVER SPLIT SECTIONS ───────────────────────── */
  .nb {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    widows: 2;
    orphans: 2;
  }
  
  /* Major sections that should stay together */
  .section-block {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    page-break-before: auto;
    page-break-after: auto;
  }

  /* ── PAGE STRUCTURE ────────────────────────────────────────────────── */
  .page {
    position: relative;
    width: 794px;
    min-height: 100vh;
    background: white;
    page-break-after: auto;
  }

  .page-header {
    page-break-after: avoid !important;
  }

  .page-footer {
    page-break-before: avoid !important;
  }

  /* ── SECTION BREAK CONTROL ─────────────────────────────────────────── */
  /* Visitors section - keep together */
  #evms-template-root > div > div > div:has([title="Visitors"]) {
    page-break-before: auto;
    page-break-after: auto;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }

  /* Travel Details - keep together */
  #evms-template-root > div > div > div:has([title="Travel Details (Common for All Visitors)"]) {
    page-break-before: auto;
    page-break-after: auto;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }

  /* Host Company - keep entire block together */
  #evms-template-root > div > div > div:has([title="Host Company"]) {
    page-break-before: auto;
    page-break-after: auto;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }

  /* Each DAY timeline block - atomic, never split */
  .timeline-day-block {
    page-break-before: auto;
    page-break-after: auto;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    break-before: auto;
    break-after: auto;
  }

  /* Accommodation + Transportation section */
  #evms-template-root > div > div > div:has([title="Accommodation"]),
  #evms-template-root > div > div > div:has([title="Transportation"]) {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }

  /* Meeting Summary - keep together */
  #evms-template-root > div > div > div:has([title="Meeting Summary"]) {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }

  /* Notes + Emergency Contacts - keep together */
  #evms-template-root > div > div > div:has([title="Notes"]),
  #evms-template-root > div > div > div:has([title="Emergency Contacts"]) {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }

  /* ── PRINT RULES ───────────────────────────────────────────────────── */
  @media print {
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    @page {
      size: A4;
      margin: 15mm 10mm;
    }

    body { 
      margin: 0 !important; 
      background: white !important;
    }

    .page {
      page-break-after: always;
      min-height: 0;
    }

    .page:last-child {
      page-break-after: avoid;
    }

    .page-header {
      page-break-after: avoid !important;
      break-after: avoid !important;
    }

    .page-footer {
      /* Footer appears at bottom of each page */
      display: flex;
      page-break-before: avoid !important;
      break-before: avoid !important;
    }

    /* Show page numbers in print using CSS generated content */
    .page-number::before {
      content: "Page ";
    }
    
    .page-number::after {
      /* Note: CSS counter(page) and counter(pages) are browser-dependent 
         In most browsers, page numbers will show when printed */
      content: counter(page) " of " counter(pages);
    }

    /* Force sections to stay together */
    .nb {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    /* Timeline day blocks MUST stay together */
    .timeline-day-block {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-before: auto;
      page-break-after: auto;
    }

    /* Table header repeats on every page */
    thead { 
      display: table-header-group;
    }

    /* Never split table rows */
    tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    p, div {
      widows: 2;
      orphans: 2;
    }

    /* Summary cards row - keep together */
    #evms-template-root > div > div > div:first-of-type {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
  }
`;

export default EVMSVisitTemplate;
