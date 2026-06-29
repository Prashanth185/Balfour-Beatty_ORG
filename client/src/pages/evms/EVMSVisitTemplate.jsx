/**
 * EVMSVisitTemplate — Premium Enterprise Executive Report
 * Visual-only upgrade: spacing, typography, borders, section dividers, cards
 * Logic, structure, sections, fields — all unchanged
 */
import { forwardRef } from 'react';

// ─── Helpers (unchanged) ──────────────────────────────────────────────────────
function fmt(d) {
  if (!d) return '—';
  try { return new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); }
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
  return list.filter(x=>p.includes(x.id)).map(x=>x[key]).join(', ')||'—';
}
function ini(name) {
  if (!name) return '?';
  const p=name.trim().split(/\s+/).filter(Boolean);
  if (p.length===1) return p[0].slice(0,2).toUpperCase();
  return (p[0][0]+p[p.length-1][0]).toUpperCase();
}

// ─── Design Tokens ────────────────────────────────────────────────────────────
const F       = "'Inter','Aptos','Segoe UI',Arial,sans-serif";
const PRIMARY = '#0F4C81';
const ACCENT  = '#2563EB';
const SUCCESS = '#16A34A';
const WARNING = '#B45309';
const TXT     = '#0F172A';
const SUB     = '#475569';
const MUT     = '#94A3B8';
const BG_PAGE = '#F1F5F9';
const BG_CARD = '#FFFFFF';
const BDR     = '#E2E8F0';
const BDR_LT  = '#F1F5F9';
const SHADOW  = '0 1px 4px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.05)';

// ─── Section Header ───────────────────────────────────────────────────────────
function SH({icon,title,sub,right}) {
  return (
    <div style={{marginBottom:'8px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
          <span style={{fontSize:'13px',lineHeight:1}}>{icon}</span>
          <span style={{fontSize:'11px',fontWeight:700,color:TXT,letterSpacing:'0.3px',textTransform:'uppercase'}}>{title}</span>
          {sub&&<span style={{fontSize:'9px',fontWeight:600,color:MUT,letterSpacing:'0.6px',textTransform:'uppercase',marginLeft:'3px'}}>{sub}</span>}
        </div>
        {right&&<span style={{fontSize:'9px',color:MUT,fontWeight:500}}>{right}</span>}
      </div>
      <div style={{height:'1px',background:`linear-gradient(90deg,${BDR} 0%,transparent 100%)`,marginTop:'5px'}}/>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
function Card({children,style={}}) {
  return (
    <div style={{
      background:BG_CARD,border:`1px solid ${BDR}`,borderRadius:'8px',
      boxShadow:SHADOW,overflow:'visible',...style,
    }}>{children}</div>
  );
}

// ─── Section Divider ──────────────────────────────────────────────────────────
function Divider() {
  return <div style={{height:'1px',background:BDR_LT,margin:'12px 0'}}/>;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const EVMSVisitTemplate = forwardRef(function EVMSVisitTemplate({visit},ref) {
  if (!visit) return null;

  const visitors  = visit.visitors   || [];
  const hosts     = visit.hosts      || [];
  const meetings  = visit.meetings   || [];
  const activities= visit.activities || [];
  const now = new Date();
  const today = now.toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'});
  const nowTm = now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});

  // Timeline merge + sort (unchanged)
  const tl=[
    ...meetings.map(m=>({
      kind:'meeting',date:m.meeting_date,time:m.start_time,
      title:m.meeting_title||m.notes||'Meeting',
      visitors:m.visitor_ids,hosts:m.host_ids,desc:m.notes,
    })),
    ...activities.map(a=>({
      kind:'activity',date:a.activity_date,time:a.start_time,
      title:a.description||'Activity',
      visitors:a.visitor_ids,hosts:a.host_ids,desc:a.description,
    })),
  ].sort((a,b)=>{
    if(a.date!==b.date) return (a.date||'').localeCompare(b.date||'');
    return (a.time||'').localeCompare(b.time||'');
  });

  const grp={};
  tl.forEach(item=>{const k=item.date||'TBD';if(!grp[k])grp[k]=[];grp[k].push(item);});
  const days=Object.entries(grp).sort(([a],[b])=>a.localeCompare(b));

  // Travel (unchanged)
  const wt=visitors.filter(v=>v.travel_arrival_airport||v.travel_arrival_date||v.travel_departure_airport||v.travel_departure_date);
  let tv=null;
  if(wt.length>=1){
    const f=wt[0];
    const same=wt.every(v=>
      v.travel_arrival_airport===f.travel_arrival_airport&&
      v.travel_arrival_date===f.travel_arrival_date&&
      v.travel_arrival_time===f.travel_arrival_time&&
      v.travel_departure_airport===f.travel_departure_airport&&
      v.travel_departure_date===f.travel_departure_date&&
      v.travel_departure_time===f.travel_departure_time
    );
    if(same)tv={a_ap:f.travel_arrival_airport,a_dt:f.travel_arrival_date,a_tm:f.travel_arrival_time,d_ap:f.travel_departure_airport,d_dt:f.travel_departure_date,d_tm:f.travel_departure_time};
  }

  // Duration (unchanged)
  const durDays=(()=>{
    if(!visit.start_date||!visit.end_date) return days.length||'—';
    try{return Math.round((new Date(visit.end_date+'T00:00:00')-new Date(visit.start_date+'T00:00:00'))/86400000)+1;}
    catch{return days.length||'—';}
  })();

  const companyHead=hosts.find(h=>h.is_company_head);
  const hostTeam=hosts.filter(h=>!h.is_company_head);
  const hostCompanyName=companyHead?.company_name||visit.host_company||hosts[0]?.company_name||'—';

  return (
    <div ref={ref} id="evms-template-root" style={{
      width:'794px',minWidth:'794px',maxWidth:'794px',
      fontFamily:F,background:BG_PAGE,color:TXT,
      fontSize:'11px',lineHeight:'1.45',
    }}>
      <style>{CSS}</style>

      {/* ══════════════════ HEADER ══════════════════ */}
      <div className="print-header-block" style={{
        background:`linear-gradient(135deg,#0A2D52 0%,${PRIMARY} 50%,${ACCENT} 100%)`,
        padding:'16px 24px 14px',color:'#fff',
      }}>
        {/* Brand line */}
        <div style={{fontSize:'8px',fontWeight:600,letterSpacing:'2px',
          color:'rgba(255,255,255,0.55)',textTransform:'uppercase',marginBottom:'6px'}}>
          Executive Visit Management System
        </div>

        {/* Title block */}
        <div style={{fontSize:'20px',fontWeight:700,letterSpacing:'-0.3px',lineHeight:1.2,marginBottom:'2px'}}>
          Executive Visit Schedule
        </div>
        <div style={{fontSize:'12px',fontWeight:500,color:'rgba(255,255,255,0.80)',marginBottom:'10px'}}>
          {visit.visit_name}
        </div>

        {/* Divider */}
        <div style={{height:'1px',background:'rgba(255,255,255,0.15)',marginBottom:'10px'}}/>

        {/* Meta row — 4 columns */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'0',borderRadius:'6px',
          background:'rgba(0,0,0,0.18)',overflow:'hidden'}}>
          {[
            {label:'VISIT DATES',value:`${fmt(visit.start_date)} – ${fmt(visit.end_date)}`},
            {label:'DURATION',value:`${durDays} Days`},
            {label:'COORDINATOR',value:visit.coordinator||'—'},
            {label:'LOCATION',value:visit.host_location||'—'},
          ].map(({label,value},i)=>(
            <div key={label} style={{
              padding:'7px 10px',
              borderRight:i<3?'1px solid rgba(255,255,255,0.10)':undefined,
            }}>
              <div style={{fontSize:'7px',fontWeight:700,letterSpacing:'1px',
                color:'rgba(255,255,255,0.45)',textTransform:'uppercase',marginBottom:'2px'}}>{label}</div>
              <div style={{fontSize:'10px',fontWeight:600,color:'#fff'}}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════ BODY ══════════════════ */}
      <div style={{padding:'14px 20px'}}>

        {/* ── STATS ROW ── */}
        <div className="section-block print-summary-block" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'8px',marginBottom:'14px'}}>
          {[
            {value:visitors.length, label:'VISITORS',    color:PRIMARY, icon:'👥'},
            {value:1,               label:'HOST COMPANY',color:ACCENT,  icon:'🏢'},
            {value:tl.length,       label:'SCHEDULE ITEMS',color:SUCCESS,icon:'📋'},
            {value:`${durDays}d`,   label:'DURATION',    color:WARNING,  icon:'📅'},
          ].map(({value,label,color,icon})=>(
            <div key={label} style={{
              background:BG_CARD,border:`1px solid ${BDR}`,borderRadius:'8px',
              padding:'9px 10px',textAlign:'center',boxShadow:SHADOW,
              borderTop:`2px solid ${color}`,
            }}>
              <div style={{fontSize:'18px',lineHeight:1,marginBottom:'3px'}}>{icon}</div>
              <div style={{fontSize:'20px',fontWeight:700,color,lineHeight:1,marginBottom:'2px'}}>{value}</div>
              <div style={{fontSize:'8px',fontWeight:700,color:MUT,letterSpacing:'0.6px',textTransform:'uppercase'}}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── VISITORS ── */}
        {visitors.length>0&&(<>
          <div className="section-block print-visitors-block">
            <SH icon="👥" title="Visitors" sub={`${visitors.length} Visitor${visitors.length!==1?'s':''}`}/>
            <Card style={{padding:'8px 14px'}}>
              {visitors.map((v,i)=>(
                <div key={v.id||i} style={{
                  display:'flex',alignItems:'center',gap:'6px',
                  padding:'4px 0',
                  borderBottom:i<visitors.length-1?`1px solid ${BDR_LT}`:'none',
                }}>
                  <span style={{color:PRIMARY,fontWeight:700,fontSize:'12px',flexShrink:0}}>•</span>
                  <span style={{fontSize:'11px',fontWeight:600,color:TXT,width:'100%',wordBreak:'break-word'}}>
                    {v.visitor_name}
                  </span>
                </div>
              ))}
            </Card>
          </div>
          <Divider/>
        </>)}

        {/* ── TRAVEL DETAILS ── */}
        {tv&&(tv.a_ap||tv.a_dt||tv.d_ap||tv.d_dt)&&(<>
          <div className="section-block print-travel-block">
            <SH icon="✈" title="Travel Details" sub="Common for All Visitors"/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>

              {/* Arrival */}
              {(tv.a_ap||tv.a_dt)&&(
                <div style={{
                  background:BG_CARD,border:`1px solid ${BDR}`,borderRadius:'8px',
                  overflow:'hidden',boxShadow:SHADOW,
                }}>
                  <div style={{background:PRIMARY,padding:'5px 12px',
                    display:'flex',alignItems:'center',gap:'5px'}}>
                    <span style={{fontSize:'11px'}}>✈</span>
                    <span style={{fontSize:'9px',fontWeight:700,color:'#fff',letterSpacing:'1px'}}>ARRIVAL</span>
                  </div>
                  <div style={{padding:'8px 12px',display:'grid',gridTemplateColumns:'70px 1fr',rowGap:'4px',fontSize:'10px'}}>
                    <span style={{color:MUT,fontWeight:500}}>Date</span>
                    <span style={{fontWeight:600,color:TXT}}>{fmt(tv.a_dt)}</span>
                    <span style={{color:MUT,fontWeight:500}}>Airport</span>
                    <span style={{fontWeight:600,color:TXT}}>{tv.a_ap||'—'}</span>
                    {tv.a_tm&&<><span style={{color:MUT,fontWeight:500}}>Time</span><span style={{fontWeight:600,color:TXT}}>{fmtTime(tv.a_tm)}</span></>}
                  </div>
                </div>
              )}

              {/* Departure */}
              {(tv.d_ap||tv.d_dt)&&(
                <div style={{
                  background:BG_CARD,border:`1px solid ${BDR}`,borderRadius:'8px',
                  overflow:'hidden',boxShadow:SHADOW,
                }}>
                  <div style={{background:SUCCESS,padding:'5px 12px',
                    display:'flex',alignItems:'center',gap:'5px'}}>
                    <span style={{fontSize:'11px'}}>✈</span>
                    <span style={{fontSize:'9px',fontWeight:700,color:'#fff',letterSpacing:'1px'}}>DEPARTURE</span>
                  </div>
                  <div style={{padding:'8px 12px',display:'grid',gridTemplateColumns:'70px 1fr',rowGap:'4px',fontSize:'10px'}}>
                    <span style={{color:MUT,fontWeight:500}}>Date</span>
                    <span style={{fontWeight:600,color:TXT}}>{fmt(tv.d_dt)}</span>
                    <span style={{color:MUT,fontWeight:500}}>Airport</span>
                    <span style={{fontWeight:600,color:TXT}}>{tv.d_ap||'—'}</span>
                    {tv.d_tm&&<><span style={{color:MUT,fontWeight:500}}>Time</span><span style={{fontWeight:600,color:TXT}}>{fmtTime(tv.d_tm)}</span></>}
                  </div>
                </div>
              )}
            </div>
          </div>
          <Divider/>
        </>)}

        {/* ── HOST COMPANY ── */}
        {hosts.length>0&&(<>
          <div className="section-block print-host-block">
            <SH icon="🏢" title="Host Company"/>
            <Card style={{padding:'10px 14px'}}>
              {/* Company name */}
              <div style={{fontSize:'11px',fontWeight:700,color:PRIMARY,
                paddingBottom:'8px',marginBottom:'8px',
                borderBottom:`1px solid ${BDR}`,
                display:'flex',alignItems:'center',gap:'6px'}}>
                <span style={{fontSize:'13px'}}>🏛</span>
                {hostCompanyName}
              </div>

              {/* Company Head */}
              {companyHead&&(
                <div style={{marginBottom:hostTeam.length?'8px':0}}>
                  <div style={{fontSize:'8px',fontWeight:700,color:MUT,letterSpacing:'1px',
                    textTransform:'uppercase',marginBottom:'5px'}}>Company Head</div>
                  <div style={{
                    background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:'6px',
                    padding:'6px 10px',
                    display:'flex',alignItems:'center',gap:'6px',
                  }}>
                    <span style={{color:WARNING,fontWeight:700,fontSize:'12px',flexShrink:0}}>•</span>
                    <span style={{fontSize:'11px',fontWeight:700,color:TXT,width:'100%',wordBreak:'break-word'}}>
                      {companyHead.host_name}
                    </span>
                  </div>
                </div>
              )}

              {/* Host Team */}
              {hostTeam.length>0&&(
                <div>
                  <div style={{fontSize:'8px',fontWeight:700,color:MUT,letterSpacing:'1px',
                    textTransform:'uppercase',marginBottom:'5px'}}>
                    Host Team · {hostTeam.length} Member{hostTeam.length!==1?'s':''}
                  </div>
                  <div style={{display:'flex',flexDirection:'column'}}>
                    {hostTeam.map((h,i)=>(
                      <div key={h.id||i} style={{
                        display:'flex',alignItems:'center',gap:'6px',
                        padding:'3px 0',
                        borderBottom:i<hostTeam.length-1?`1px solid ${BDR_LT}`:'none',
                      }}>
                        <span style={{color:SUB,fontWeight:700,fontSize:'11px',flexShrink:0}}>•</span>
                        <span style={{fontSize:'11px',fontWeight:600,color:TXT,width:'100%',wordBreak:'break-word'}}>
                          {h.host_name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
          <Divider/>
        </>)}

        {/* ── VISIT TIMELINE ── */}
        <div className="section-block print-timeline-block">
          <SH icon="📅" title="Visit Timeline" right={`${tl.length} items · ${days.length} day${days.length!==1?'s':''}`}/>

          {days.length===0&&(
            <div style={{textAlign:'center',padding:'16px',color:MUT,
              background:BG_CARD,border:`1px dashed ${BDR}`,borderRadius:'8px',
              fontSize:'11px'}}>No schedule items.</div>
          )}

          {days.map(([date,items],di)=>(
            <div key={date} className="timeline-day-block" data-date={date}
              style={{marginBottom: di<days.length-1?'10px':0}}>

              {/* Day header */}
              <div className="day-header" style={{
                background:`linear-gradient(90deg,${PRIMARY} 0%,${ACCENT} 100%)`,
                borderRadius:'7px 7px 0 0',
                padding:'6px 12px',
                display:'flex',alignItems:'center',justifyContent:'space-between',
              }}>
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <span style={{
                    background:'rgba(255,255,255,0.20)',borderRadius:'4px',
                    padding:'1px 6px',fontSize:'9px',fontWeight:700,
                    color:'#fff',letterSpacing:'0.5px',
                  }}>DAY {di+1}</span>
                  <span style={{fontSize:'11px',fontWeight:600,color:'#fff'}}>{fmt(date)}</span>
                </div>
                <span style={{fontSize:'9px',color:'rgba(255,255,255,0.70)'}}>
                  {items.length} item{items.length!==1?'s':''}
                </span>
              </div>

              {/* Table — using real <table> for reliable print row-keeping */}
              <div style={{
                background:BG_CARD,border:`1px solid ${BDR}`,
                borderTop:'none',borderRadius:'0 0 7px 7px',
                overflow:'hidden',boxShadow:SHADOW,
              }}>
                <table style={{width:'100%',borderCollapse:'collapse',tableLayout:'fixed'}}>
                  <colgroup>
                    <col style={{width:'62px'}}/>
                    <col style={{width:'72px'}}/>
                    <col style={{width:'130px'}}/>
                    <col style={{width:'110px'}}/>
                    <col/>
                  </colgroup>
                  <thead>
                    <tr style={{background:'#F8FAFC',borderBottom:`1px solid ${BDR}`}}>
                      {['TIME','TYPE','VISITORS','DESCRIPTION','HOSTS'].map(h=>(
                        <th key={h} style={{
                          padding:'5px 8px',fontSize:'8px',fontWeight:700,
                          color:SUB,textTransform:'uppercase',letterSpacing:'0.6px',
                          textAlign:'left',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item,ri)=>(
                      <tr key={ri} className="tl-row" data-kind={item.kind} style={{
                        background:ri%2===0?BG_CARD:'#FAFBFC',
                        borderBottom:ri<items.length-1?`1px solid ${BDR_LT}`:undefined,
                      }}>
                        <td style={{padding:'7px 8px',fontSize:'10px',fontWeight:700,color:PRIMARY,whiteSpace:'nowrap',verticalAlign:'top'}}>
                          {fmtTime(item.time)}
                        </td>
                        <td style={{padding:'7px 8px',verticalAlign:'top'}}>
                          <span style={{
                            display:'inline-block',
                            fontSize:'8px',fontWeight:700,letterSpacing:'0.3px',
                            padding:'1px 6px',borderRadius:'3px',
                            color:item.kind==='meeting'?ACCENT:SUCCESS,
                            background:item.kind==='meeting'?'#EFF6FF':'#F0FDF4',
                            border:`1px solid ${item.kind==='meeting'?'#BFDBFE':'#BBF7D0'}`,
                          }}>
                            {item.kind==='meeting'?'Meeting':'Activity'}
                          </span>
                        </td>
                        <td style={{padding:'7px 8px',fontSize:'9px',color:SUB,wordBreak:'break-word',lineHeight:'1.4',verticalAlign:'top'}}>{getNameList(item.visitors,visitors,'visitor_name')}</td>
                        <td style={{padding:'7px 8px',fontSize:'9px',color:SUB,wordBreak:'break-word',lineHeight:'1.4',verticalAlign:'top'}}>{item.desc||'—'}</td>
                        <td style={{padding:'7px 8px',fontSize:'9px',color:SUB,wordBreak:'break-word',lineHeight:'1.4',verticalAlign:'top'}}>{getNameList(item.hosts,hosts,'host_name')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          ))}
        </div>

      </div>

      {/* ══════════════════ FOOTER ══════════════════ */}
      <div className="page-footer" style={{
        margin:'0 20px',
        borderTop:`1px solid ${BDR}`,
        padding:'7px 0',
        display:'flex',alignItems:'center',justifyContent:'space-between',
        fontSize:'8px',color:MUT,
      }}>
        <span style={{fontWeight:700,color:SUB,letterSpacing:'0.3px'}}>Executive Visit Management System</span>
        <span>Generated on {today}, {nowTm}</span>
        {/* Page number only visible when printing — CSS counters don't work on screen */}
        <span className="page-number"></span>
      </div>

    </div>
  );
});

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS=`
  #evms-template-root * { box-sizing: border-box; }

  /* ── Screen: soft no-break hints ── */
  .section-block        { page-break-inside: avoid; break-inside: avoid; }
  .timeline-day-block   { page-break-inside: avoid; break-inside: avoid; }
  .day-header           { page-break-after:  avoid; break-after:  avoid; }

  /* ── TABLE: rows never break ── */
  #evms-template-root table { border-collapse: collapse; width: 100%; }
  #evms-template-root tr    { page-break-inside: avoid; break-inside: avoid; }

  /* Page number — hidden on screen, shown only when printing */
  .page-number { display: none; }

  @media print {
    .page-number {
      display: inline !important;
      font-weight: 600;
    }

    @page {
      size: A4 portrait;
      margin: 12mm;
    }

    html, body {
      width: 794px !important;
      margin: 0 !important;
      zoom: 1 !important;
      transform: none !important;
      -webkit-transform: none !important;
      overflow: visible !important;
    }

    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .section-block {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    .timeline-day-block {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-before: auto !important;
      break-before: auto !important;
    }

    .day-header {
      page-break-after: avoid !important;
      break-after: avoid !important;
    }

    tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    thead { display: table-header-group !important; }

    .page-footer { display: flex !important; }

    .page-number::before { content: ""; }
    .page-number::after  { content: ""; }

    p, li { orphans: 3; widows: 3; }
  }
`;

export default EVMSVisitTemplate;
