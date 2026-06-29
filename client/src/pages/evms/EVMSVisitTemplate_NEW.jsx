/**
 * EVMSVisitTemplate - Matches Reference Image Exactly
 * Clean blue theme with simplified sections
 * NO Activity Type, NO Location in template
 */
import { forwardRef } from 'react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

// ─── Colors (Reference Image Theme) ───────────────────────────────────────────
const BLU='#4169E1';     // Royal Blue
const BLU_L='#E6F0FF';   // Light blue bg
const BLU_D='#2952CC';   // Dark blue
const WHT='#FFFFFF';
const TXT='#1E293B';
const SUB='#64748B';
const MUT='#94A3B8';
const BDR='#E2E8F0';
const BG='#FFFFFF';
const BGS='#F8FAFC';

const GRN='#10B981';
const YEL='#F59E0B';
const PUR='#8B5CF6';
const PINK='#EC4899';

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Av({name,bg='#4169E1',sz=40}) {
  return (
    <div style={{
      width:`${sz}px`,height:`${sz}px`,minWidth:`${sz}px`,minHeight:`${sz}px`,
      borderRadius:'50%',background:bg,color:WHT,
      display:'flex',alignItems:'center',justifyContent:'center',
      fontSize:'14px',fontWeight:700,lineHeight:1,flexShrink:0,
    }}>
      {ini(name)}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const EVMSVisitTemplate = forwardRef(function EVMSVisitTemplate({visit},ref) {
  if (!visit) return null;
  
  const visitors  = visit.visitors  || [];
  const hosts     = visit.hosts     || [];
  const meetings  = visit.meetings  || [];
  const activities= visit.activities|| [];
  const today = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
  
  // Timeline: Merge meetings and activities
  const tl = [
    ...meetings.map(m=>({
      kind:'meeting',
      date:m.meeting_date,
      time:m.start_time,
      type:'Meeting',
      title:m.meeting_title||m.notes||'Meeting',
      visitors:m.visitor_ids,
      hosts:m.host_ids,
      desc:m.notes,
    })),
    ...activities.map(a=>({
      kind:'activity',
      date:a.activity_date,
      time:a.start_time,
      type:'Activity',
      title:a.description||'Activity',
      visitors:a.visitor_ids,
      hosts:a.host_ids,
      desc:a.description,
      // NO activity_type and NO location
    })),
  ].sort((a,b)=>{
    if(a.date!==b.date) return (a.date||'').localeCompare(b.date||'');
    return (a.time||'').localeCompare(b.time||'');
  });
  
  // Group by date
  const grp={};
  tl.forEach(item=>{
    const k=item.date||'TBD';
    if(!grp[k])grp[k]=[];
    grp[k].push(item);
  });
  const days=Object.entries(grp).sort(([a],[b])=>a.localeCompare(b));
  
  // Travel
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
    if(same)tv={
      a_ap:f.travel_arrival_airport,
      a_dt:f.travel_arrival_date,
      a_tm:f.travel_arrival_time,
      d_ap:f.travel_departure_airport,
      d_dt:f.travel_departure_date,
      d_tm:f.travel_departure_time,
    };
  }
  
  // Duration
  const durDays = (() => {
    if (!visit.start_date || !visit.end_date) return days.length || '—';
    try {
      const d=Math.round((new Date(visit.end_date+'T00:00:00')-new Date(visit.start_date+'T00:00:00'))/86400000)+1;
      return d;
    } catch { return days.length || '—'; }
  })();

  return (
    <div ref={ref} style={{
      width:'794px',
      minWidth:'794px',
      maxWidth:'794px',
      fontFamily:"'Inter','Segoe UI',Arial,sans-serif",
      background:BG,
      color:TXT,
      fontSize:'11px',
      lineHeight:'1.5',
    }}>
      <style>{CSS}</style>

      {/* ═══ HEADER ═══ */}
      <div style={{background:`linear-gradient(135deg, ${BLU_D} 0%, ${BLU} 100%)`,padding:'20px 24px',color:WHT}}>
        <div style={{fontSize:'10px',fontWeight:600,marginBottom:'4px',opacity:0.9}}>📊 EXECUTIVE VISIT MANAGEMENT SYSTEM</div>
        <div style={{fontSize:'24px',fontWeight:700,marginBottom:'4px'}}>Executive Visit Schedule</div>
        <div style={{fontSize:'13px',opacity:0.95}}>{visit.visit_name}</div>
        
        <div style={{marginTop:'16px',display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'16px'}}>
          <div><div style={{fontSize:'9px',opacity:0.8,marginBottom:'2px'}}>📅 VISIT DATES</div><div style={{fontSize:'11px',fontWeight:600}}>{fmt(visit.start_date)} - {fmt(visit.end_date)}</div></div>
          <div><div style={{fontSize:'9px',opacity:0.8,marginBottom:'2px'}}>⏱ DAYS</div><div style={{fontSize:'11px',fontWeight:600}}>{durDays} Days</div></div>
          <div><div style={{fontSize:'9px',opacity:0.8,marginBottom:'2px'}}>👤 COORDINATOR</div><div style={{fontSize:'11px',fontWeight:600}}>{visit.coordinator||'—'}</div></div>
          <div><div style={{fontSize:'9px',opacity:0.8,marginBottom:'2px'}}>📍 LOCATION</div><div style={{fontSize:'11px',fontWeight:600}}>{visit.host_location||'—'}</div></div>
        </div>
      </div>

      {/* ═══ BODY ═══ */}
      <div style={{padding:'20px 24px'}}>
        
        {/* SUMMARY CARDS */}
        <div className="section-block" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'20px'}}>
          <div style={{background:BLU_L,padding:'16px',borderRadius:'8px',textAlign:'center'}}>
            <div style={{fontSize:'32px',marginBottom:'4px'}}>👥</div>
            <div style={{fontSize:'28px',fontWeight:700,color:BLU,marginBottom:'2px'}}>{visitors.length}</div>
            <div style={{fontSize:'10px',color:SUB,fontWeight:600}}>VISITORS</div>
          </div>
          <div style={{background:'#F3E8FF',padding:'16px',borderRadius:'8px',textAlign:'center'}}>
            <div style={{fontSize:'32px',marginBottom:'4px'}}>🏢</div>
            <div style={{fontSize:'28px',fontWeight:700,color:PUR,marginBottom:'2px'}}>1</div>
            <div style={{fontSize:'10px',color:SUB,fontWeight:600}}>HOST COMPANY</div>
          </div>
          <div style={{background:'#DCFCE7',padding:'16px',borderRadius:'8px',textAlign:'center'}}>
            <div style={{fontSize:'32px',marginBottom:'4px'}}>📋</div>
            <div style={{fontSize:'28px',fontWeight:700,color:GRN,marginBottom:'2px'}}>{tl.length}</div>
            <div style={{fontSize:'10px',color:SUB,fontWeight:600}}>MEETINGS</div>
          </div>
          <div style={{background:'#FEF3C7',padding:'16px',borderRadius:'8px',textAlign:'center'}}>
            <div style={{fontSize:'32px',marginBottom:'4px'}}>📅</div>
            <div style={{fontSize:'28px',fontWeight:700,color:YEL,marginBottom:'2px'}}>{durDays} Days</div>
            <div style={{fontSize:'10px',color:SUB,fontWeight:600}}>DURATION</div>
          </div>
        </div>

        {/* VISITORS */}
        {visitors.length>0&&(
          <div className="section-block" style={{marginBottom:'20px'}}>
            <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'10px'}}>
              <span style={{fontSize:'16px'}}>👥</span>
              <span style={{fontSize:'12px',fontWeight:700,color:TXT}}>VISITORS</span>
            </div>
            <div style={{display:'flex',gap:'12px',flexWrap:'wrap'}}>
              {visitors.map((v,i)=>(
                <div key={v.id||i} style={{display:'flex',alignItems:'center',gap:'10px',background:BGS,padding:'12px 16px',borderRadius:'8px',border:`1px solid ${BDR}`,minWidth:'180px'}}>
                  <Av name={v.visitor_name} bg={BLU} sz={40}/>
                  <div>
                    <div style={{fontSize:'12px',fontWeight:600,color:TXT}}>{v.visitor_name}</div>
                    <div style={{fontSize:'10px',color:SUB}}>({ini(v.visitor_name)})</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TRAVEL DETAILS */}
        {tv&&(tv.a_ap||tv.a_dt||tv.d_ap||tv.d_dt)&&(
          <div className="section-block" style={{marginBottom:'20px'}}>
            <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'10px'}}>
              <span style={{fontSize:'16px'}}>✈️</span>
              <span style={{fontSize:'12px',fontWeight:700,color:TXT}}>TRAVEL DETAILS (COMMON FOR ALL VISITORS)</span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
              {(tv.a_ap||tv.a_dt)&&(
                <div style={{background:'#EFF6FF',padding:'16px',borderRadius:'8px',borderLeft:`4px solid ${BLU}`}}>
                  <div style={{fontSize:'11px',fontWeight:700,color:BLU,marginBottom:'8px'}}>✈ ARRIVAL</div>
                  <div style={{fontSize:'10px',color:SUB,marginBottom:'2px'}}>Date</div>
                  <div style={{fontSize:'11px',fontWeight:600,color:TXT,marginBottom:'6px'}}>{fmt(tv.a_dt)}</div>
                  <div style={{fontSize:'10px',color:SUB,marginBottom:'2px'}}>BAC</div>
                  <div style={{fontSize:'11px',fontWeight:600,color:TXT,marginBottom:'6px'}}>{tv.a_ap||'—'}</div>
                  {tv.a_tm&&<><div style={{fontSize:'10px',color:SUB,marginBottom:'2px'}}>Time</div><div style={{fontSize:'11px',fontWeight:600,color:TXT}}>{fmtTime(tv.a_tm)}</div></>}
                </div>
              )}
              {(tv.d_ap||tv.d_dt)&&(
                <div style={{background:'#F0FDF4',padding:'16px',borderRadius:'8px',borderLeft:`4px solid ${GRN}`}}>
                  <div style={{fontSize:'11px',fontWeight:700,color:GRN,marginBottom:'8px'}}>✈ DEPARTURE</div>
                  <div style={{fontSize:'10px',color:SUB,marginBottom:'2px'}}>Date</div>
                  <div style={{fontSize:'11px',fontWeight:600,color:TXT,marginBottom:'6px'}}>{fmt(tv.d_dt)}</div>
                  <div style={{fontSize:'10px',color:SUB,marginBottom:'2px'}}>BAC</div>
                  <div style={{fontSize:'11px',fontWeight:600,color:TXT,marginBottom:'6px'}}>{tv.d_ap||'—'}</div>
                  {tv.d_tm&&<><div style={{fontSize:'10px',color:SUB,marginBottom:'2px'}}>Time</div><div style={{fontSize:'11px',fontWeight:600,color:TXT}}>{fmtTime(tv.d_tm)}</div></>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* HOST COMPANY */}
        {hosts.length>0&&(
          <div className="section-block" style={{marginBottom:'20px'}}>
            <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'10px'}}>
              <span style={{fontSize:'16px'}}>🏢</span>
              <span style={{fontSize:'12px',fontWeight:700,color:TXT}}>HOST COMPANY</span>
            </div>
            <div style={{background:BGS,padding:'16px',borderRadius:'8px',border:`1px solid ${BDR}`}}>
              <div style={{fontSize:'11px',fontWeight:700,color:TXT,marginBottom:'12px'}}>Company: {visit.host_company||'GCC 88'}</div>
              
              {/* Company Head */}
              {hosts.filter(h=>h.is_company_head).map((h,i)=>(
                <div key={h.id||i} style={{background:'#FEF3C7',padding:'12px',borderRadius:'6px',marginBottom:'12px',border:`1px solid #FDE68A`}}>
                  <div style={{fontSize:'10px',fontWeight:600,color:SUB,marginBottom:'6px'}}>Company Head</div>
                  <div style={{fontSize:'11px',fontWeight:700,color:TXT}}>• {h.host_name}</div>
                  {h.designation&&<div style={{fontSize:'10px',color:SUB,marginLeft:'10px'}}>  {h.designation}</div>}
                </div>
              ))}
              
              {/* Host Team */}
              <div style={{fontSize:'10px',fontWeight:600,color:SUB,marginBottom:'6px'}}>Host Team</div>
              {hosts.filter(h=>!h.is_company_head).map((h,i)=>(
                <div key={h.id||i} style={{fontSize:'11px',color:TXT,marginBottom:'2px'}}>
                  • {h.host_name}{h.designation?` - ${h.designation}`:''}{h.company_name?` - ${h.company_name}`:''}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VISIT TIMELINE */}
        <div className="section-block" style={{marginBottom:'20px'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px'}}>
            <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
              <span style={{fontSize:'16px'}}>📅</span>
              <span style={{fontSize:'12px',fontWeight:700,color:TXT}}>VISIT TIMELINE</span>
            </div>
            <div style={{fontSize:'10px',color:SUB}}>{tl.length} items</div>
          </div>

          {days.map(([date,items],di)=>(
            <div key={date} className="timeline-day-block" style={{marginBottom:'16px',border:`1px solid ${BDR}`,borderRadius:'8px',overflow:'hidden'}}>
              {/* Day Header */}
              <div style={{background:`linear-gradient(135deg, ${BLU_D} 0%, ${BLU} 100%)`,padding:'8px 16px',color:WHT,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{fontSize:'12px',fontWeight:700}}>DAY {di+1}     {fmt(date)}</div>
                <div style={{fontSize:'10px'}}>{items.length} items</div>
              </div>
              
              {/* Timeline Table */}
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{background:BGS,borderBottom:`1px solid ${BDR}`}}>
                    <th style={{padding:'8px',fontSize:'9px',fontWeight:700,color:SUB,textAlign:'left',width:'60px'}}>TIME</th>
                    <th style={{padding:'8px',fontSize:'9px',fontWeight:700,color:SUB,textAlign:'left',width:'70px'}}>TYPE</th>
                    <th style={{padding:'8px',fontSize:'9px',fontWeight:700,color:SUB,textAlign:'left'}}>ACTIVITY</th>
                    <th style={{padding:'8px',fontSize:'9px',fontWeight:700,color:SUB,textAlign:'left',width:'120px'}}>VISITORS</th>
                    <th style={{padding:'8px',fontSize:'9px',fontWeight:700,color:SUB,textAlign:'left',width:'100px'}}>HOSTS</th>
                    <th style={{padding:'8px',fontSize:'9px',fontWeight:700,color:SUB,textAlign:'left',width:'150px'}}>DESCRIPTION</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item,ri)=>(
                    <tr key={ri} style={{borderBottom:`1px solid ${BDR}`,background:ri%2===0?WHT:BGS}}>
                      <td style={{padding:'8px',fontSize:'10px',fontWeight:600,color:BLU}}>{fmtTime(item.time)}</td>
                      <td style={{padding:'8px'}}>
                        <span style={{
                          fontSize:'9px',
                          fontWeight:700,
                          color:item.kind==='meeting'?BLU:GRN,
                          background:item.kind==='meeting'?BLU_L:'#DCFCE7',
                          padding:'2px 8px',
                          borderRadius:'4px',
                        }}>
                          {item.kind==='meeting'?'● Meeting':'● Activity'}
                        </span>
                      </td>
                      <td style={{padding:'8px',fontSize:'10px',fontWeight:600,color:TXT}}>{item.title}</td>
                      <td style={{padding:'8px',fontSize:'10px',color:SUB}}>{getNameList(item.visitors,visitors,'visitor_name')}</td>
                      <td style={{padding:'8px',fontSize:'10px',color:SUB}}>{getNameList(item.hosts,hosts,'host_name')}</td>
                      <td style={{padding:'8px',fontSize:'10px',color:SUB}}>{item.desc||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

      </div>

      {/* FOOTER */}
      <div className="page-footer" style={{padding:'12px 24px',borderTop:`1px solid ${BDR}`,display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:'9px',color:MUT}}>
        <span>Executive Visit Management System</span>
        <span>Generated on {today}</span>
        <span className="page-number"></span>
      </div>

    </div>
  );
});

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
  * {
    box-sizing: border-box;
  }
  
  .section-block {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  
  .timeline-day-block {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  
  @media print {
    @page {
      size: A4;
      margin: 15mm 10mm;
    }
    
    .section-block, .timeline-day-block {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    
    .page-footer {
      display: flex;
    }
    
    .page-number::before {
      content: "Page ";
    }
    
    .page-number::after {
      content: counter(page) " of " counter(pages);
    }
    
    thead {
      display: table-header-group;
    }
    
    tr {
      page-break-inside: avoid !important;
    }
  }
`;

export default EVMSVisitTemplate;
