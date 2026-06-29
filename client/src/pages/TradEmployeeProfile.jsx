/**
 * TradEmployeeProfile.jsx
 *
 * Employee profile page for Traditional Org Chart employees (trad_employees table).
 * Used by Employee Management, Dashboard drill-down View buttons, and Employee Master Data.
 *
 * Route: /trad-employee/:id
 *
 * Supports: view, photo upload/remove, edit (via TradNodeActions modal), export PNG/PDF.
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Calendar, User, GraduationCap, Clock, Building2, MapPin, Building,
  Image, FileText, Loader2, Edit, Check, X,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import api from '../api/client';
import PhotoUpload from '../components/PhotoUpload';
import { BackButton, LoadingSpinner } from '../components/common';

// ── Shared date formatter (same logic as Dashboard.jsx formatDate) ────────────
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatDate(raw) {
  if (!raw) return '—';
  const s = String(raw).trim();
  if (!s) return '—';
  const n = Number(s);
  if (!isNaN(n) && n > 1000 && n < 200000) {
    const dt = new Date(new Date(1900, 0, 1).getTime() + (n - 2) * 86400000);
    return `${String(dt.getDate()).padStart(2,'0')}-${MONTHS_SHORT[dt.getMonth()]}-${String(dt.getFullYear()).slice(-2)}`;
  }
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    return `${String(dt.getDate()).padStart(2,'0')}-${MONTHS_SHORT[dt.getMonth()]}-${String(dt.getFullYear()).slice(-2)}`;
  }
  const m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (m) {
    const dt2 = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    if (!isNaN(dt2.getTime()))
      return `${String(dt2.getDate()).padStart(2,'0')}-${MONTHS_SHORT[dt2.getMonth()]}-${String(dt2.getFullYear()).slice(-2)}`;
  }
  return s;
}

// ── Helpers reused from EmployeeProfile (same PDF/PNG logic) ──────────────────
async function urlToBase64(url) {
  try {
    const absUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
    const res = await fetch(absUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    const mime = blob.type || 'image/jpeg';
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve({ dataUrl: reader.result, mime });
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

function drawInitialsAvatar(pdf, name, cx, cy, r) {
  pdf.setFillColor(37, 99, 235);
  pdf.circle(cx, cy, r, 'F');
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(28);
  pdf.setFont('helvetica', 'bold');
  pdf.text(initials, cx, cy + 9, { align: 'center' });
}

async function generateProfileReport(employee, format) {
  const val = v => (v && String(v).trim()) ? String(v).trim() : '—';
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4', compress: true });
  const PW = pdf.internal.pageSize.getWidth();
  const PH = pdf.internal.pageSize.getHeight();
  const MARGIN = 28, GUTTER = 18, LEFT_W = 175;
  const RIGHT_X = MARGIN + LEFT_W + GUTTER;
  const RIGHT_W = PW - RIGHT_X - MARGIN;
  const COL_W   = (RIGHT_W - GUTTER) / 2;

  pdf.setFillColor(248, 250, 252); pdf.rect(0, 0, PW, PH, 'F');
  pdf.setFillColor(30, 58, 95);   pdf.roundedRect(MARGIN, MARGIN, LEFT_W, PH - MARGIN * 2, 10, 10, 'F');
  pdf.setFillColor(37, 99, 235);  pdf.roundedRect(RIGHT_X, MARGIN, RIGHT_W, 54, 8, 8, 'F');

  const PHOTO_R = 44, PHOTO_CX = MARGIN + LEFT_W / 2, PHOTO_CY = MARGIN + 24 + PHOTO_R;
  pdf.setFillColor(255, 255, 255); pdf.circle(PHOTO_CX, PHOTO_CY, PHOTO_R + 3, 'F');

  if (employee.photo_url) {
    const pr = await urlToBase64(employee.photo_url);
    if (pr) {
      const SIZE_PX = 200;
      const oc = document.createElement('canvas');
      oc.width = oc.height = SIZE_PX;
      const ctx = oc.getContext('2d');
      ctx.beginPath(); ctx.arc(SIZE_PX/2, SIZE_PX/2, SIZE_PX/2, 0, Math.PI*2); ctx.closePath(); ctx.clip();
      await new Promise(r => { const img = new window.Image(); img.onload = () => { ctx.drawImage(img, 0, 0, SIZE_PX, SIZE_PX); r(); }; img.onerror = r; img.src = pr.dataUrl; });
      pdf.addImage(oc.toDataURL('image/png'), 'PNG', PHOTO_CX-PHOTO_R, PHOTO_CY-PHOTO_R, PHOTO_R*2, PHOTO_R*2);
    } else drawInitialsAvatar(pdf, employee.name, PHOTO_CX, PHOTO_CY, PHOTO_R);
  } else drawInitialsAvatar(pdf, employee.name, PHOTO_CX, PHOTO_CY, PHOTO_R);

  let ly = PHOTO_CY + PHOTO_R + 20;
  pdf.setTextColor(255,255,255); pdf.setFontSize(13); pdf.setFont('helvetica','bold');
  const nl = pdf.splitTextToSize(val(employee.name), LEFT_W-16);
  pdf.text(nl, PHOTO_CX, ly, { align:'center' }); ly += nl.length*17+4;
  pdf.setFontSize(9.5); pdf.setFont('helvetica','normal'); pdf.setTextColor(147,197,253);
  const dl = pdf.splitTextToSize(val(employee.designation), LEFT_W-16);
  pdf.text(dl, PHOTO_CX, ly, { align:'center' }); ly += dl.length*13+10;
  pdf.setDrawColor(255,255,255,0.2); pdf.setLineWidth(0.4);
  pdf.line(MARGIN+14, ly, MARGIN+LEFT_W-14, ly); ly += 12;

  for (const [label, value] of [
    ['Employee ID', val(employee.employee_id)], ['Department', val(employee.department)],
    ['Status', val(employee.status)],           ['Gender', val(employee.gender)],
    ['Place', val(employee.place)],             ['Education', val(employee.education)],
  ]) {
    if (ly > PH-MARGIN-20) break;
    pdf.setFontSize(7.5); pdf.setFont('helvetica','normal'); pdf.setTextColor(147,197,253);
    pdf.text(label.toUpperCase(), MARGIN+10, ly); ly += 11;
    pdf.setFontSize(9); pdf.setFont('helvetica','bold'); pdf.setTextColor(255,255,255);
    pdf.text(pdf.splitTextToSize(value, LEFT_W-20)[0], MARGIN+10, ly); ly += 14;
  }

  pdf.setTextColor(255,255,255); pdf.setFontSize(17); pdf.setFont('helvetica','bold');
  pdf.text('EMPLOYEE PROFILE', RIGHT_X+16, MARGIN+22);
  pdf.setFontSize(9); pdf.setFont('helvetica','normal'); pdf.setTextColor(219,234,254);
  pdf.text(`${val(employee.employee_id)}  ·  ${val(employee.designation)}  ·  ${val(employee.department)}`, RIGHT_X+16, MARGIN+40);
  const today = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
  pdf.setFontSize(8); pdf.text(`Generated: ${today}`, PW-MARGIN-4, MARGIN+34, { align:'right' });

  const RYS = MARGIN+54+10, maxH = PH-MARGIN-10;
  function ds(title, fields, sx, sy, sw, mxH) {
    pdf.setFillColor(240,244,250); pdf.roundedRect(sx,sy,sw,18,3,3,'F');
    pdf.setTextColor(30,58,95); pdf.setFontSize(8.5); pdf.setFont('helvetica','bold');
    pdf.text(title, sx+8, sy+12); sy += 22;
    for (const [l, v] of fields) {
      if (sy > MARGIN+mxH) break;
      pdf.setFontSize(7); pdf.setFont('helvetica','normal'); pdf.setTextColor(100,116,139); pdf.text(l, sx+4, sy); sy+=10;
      pdf.setFontSize(8.5); pdf.setFont('helvetica','bold'); pdf.setTextColor(30,41,59);
      pdf.text(pdf.splitTextToSize(v, sw-10)[0], sx+4, sy);
      pdf.setDrawColor(226,232,240); pdf.setLineWidth(0.3); pdf.line(sx+4, sy+4, sx+sw-4, sy+4); sy+=14;
    }
    return sy;
  }
  let lcy = RYS;
  lcy = ds('PERSONAL INFORMATION', [['Employee ID',val(employee.employee_id)],['Full Name',val(employee.name)],['Gender',val(employee.gender)],['Date of Birth',val(employee.dob)],['Education',val(employee.education)],['Place',val(employee.place)]], RIGHT_X, lcy, COL_W, maxH-lcy+MARGIN);
  lcy += 8;
  lcy = ds('EMPLOYMENT HISTORY', [['Join Date (Prev Co.)',val(employee.date_of_join_previous_company)],['Date of Join in BB',val(employee.date_of_join_in_bb)],['Join Date',val(employee.join_date)],['Date of Exit',val(employee.date_of_exit)],['Service Duration',val(employee.service_duration)],['Service in BB',val(employee.service_in_bb)],['Remarks',val(employee.remarks)]], RIGHT_X, lcy, COL_W, maxH-lcy+MARGIN);

  const RCX = RIGHT_X+COL_W+GUTTER; let rcy = RYS;
  rcy = ds('ORGANIZATION', [['Department',val(employee.department)],['Designation',val(employee.designation)],['Status',val(employee.status)],['Manager',val(employee.manager_name)]], RCX, rcy, COL_W, maxH-rcy+MARGIN);
  rcy += 8;
  rcy = ds('CURRENT & PREVIOUS EMPLOYMENT', [['Imm. Previous Company',val(employee.immediate_previous_company)],['Currently Working At',val(employee.currently_working_company)],['Location (Current)',val(employee.location_of_currently_working_company)],['Went To Company',val(employee.went_to_company)],['Location (Went To)',val(employee.location_of_went_to_company)]], RCX, rcy, COL_W, maxH-rcy+MARGIN);

  pdf.setDrawColor(226,232,240); pdf.setLineWidth(0.5); pdf.line(MARGIN, PH-20, PW-MARGIN, PH-20);
  pdf.setFontSize(7); pdf.setFont('helvetica','normal'); pdf.setTextColor(148,163,184);
  pdf.text('CONFIDENTIAL — EMPLOYEE PROFILE REPORT', MARGIN, PH-10);
  pdf.text('Page 1 of 1', PW-MARGIN, PH-10, { align:'right' });

  const safeName = (employee.employee_id || employee.name || 'Employee').replace(/[^a-zA-Z0-9]/g, '_');
  if (format === 'pdf') { pdf.save(`Employee_${safeName}.pdf`); return; }

  // PNG path
  const { default: html2canvas } = await import('html2canvas');
  const wrap = document.createElement('div');
  wrap.style.cssText = `position:absolute;left:-9999px;top:0;width:1200px;background:#f8fafc;font-family:system-ui,sans-serif;padding:32px;box-sizing:border-box;color:#1e293b;z-index:-1;`;
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-19999px;top:0;overflow:hidden;pointer-events:none;';
  host.appendChild(wrap);
  const v = x => (x && String(x).trim()) ? String(x).trim() : '—';
  wrap.innerHTML = `<div style="display:flex;gap:24px;align-items:flex-start;min-height:560px;">
    <div style="width:240px;flex-shrink:0;background:#1e3a5f;border-radius:12px;padding:28px 20px;color:#fff;text-align:center;min-height:540px;">
      <div style="width:96px;height:96px;border-radius:50%;overflow:hidden;background:#2563eb;margin:0 auto 16px;border:4px solid #fff;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:700;">
        ${employee.photo_url ? `<img src="${employee.photo_url}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous"/>` : `<span>${(employee.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</span>`}
      </div>
      <div style="font-size:16px;font-weight:700;margin-bottom:4px;">${v(employee.name)}</div>
      <div style="font-size:11px;color:#93c5fd;margin-bottom:16px;">${v(employee.designation)}</div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.2);margin-bottom:16px;"/>
      ${[['Employee ID',v(employee.employee_id)],['Department',v(employee.department)],['Status',v(employee.status)],['Gender',v(employee.gender)],['Place',v(employee.place)],['Education',v(employee.education)]].map(([l,x])=>`<div style="text-align:left;margin-bottom:10px;"><div style="font-size:9px;text-transform:uppercase;color:#93c5fd;letter-spacing:.5px;">${l}</div><div style="font-size:11px;font-weight:600;word-break:break-word;">${x}</div></div>`).join('')}
    </div>
    <div style="flex:1;display:flex;flex-direction:column;gap:16px;">
      <div style="background:#2563eb;border-radius:10px;padding:16px 20px;color:#fff;"><div style="font-size:18px;font-weight:700;">EMPLOYEE PROFILE</div><div style="font-size:11px;color:#dbeafe;">${v(employee.employee_id)} · ${v(employee.designation)} · ${v(employee.department)}</div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div style="display:flex;flex-direction:column;gap:12px;">${[['Employee ID',v(employee.employee_id)],['Full Name',v(employee.name)],['Gender',v(employee.gender)],['DOB',v(employee.dob)],['Education',v(employee.education)],['Place',v(employee.place)],['Join Date',v(employee.join_date)],['Date of Join in BB',v(employee.date_of_join_in_bb)],['Date of Exit',v(employee.date_of_exit)],['Service Duration',v(employee.service_duration)]].map(([l,x])=>`<div style="border-bottom:1px solid #e2e8f0;padding-bottom:6px;"><div style="font-size:8px;color:#64748b;text-transform:uppercase;">${l}</div><div style="font-size:10.5px;font-weight:600;color:#1e293b;">${x}</div></div>`).join('')}</div>
        <div style="display:flex;flex-direction:column;gap:12px;">${[['Department',v(employee.department)],['Designation',v(employee.designation)],['Status',v(employee.status)],['Manager',v(employee.manager_name)],['Imm. Prev. Company',v(employee.immediate_previous_company)],['Currently Working At',v(employee.currently_working_company)],['Went To Company',v(employee.went_to_company)],['Remarks',v(employee.remarks)]].map(([l,x])=>`<div style="border-bottom:1px solid #e2e8f0;padding-bottom:6px;"><div style="font-size:8px;color:#64748b;text-transform:uppercase;">${l}</div><div style="font-size:10.5px;font-weight:600;color:#1e293b;">${x}</div></div>`).join('')}</div>
      </div>
      <div style="border-top:1px solid #e2e8f0;padding-top:8px;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8;"><span>CONFIDENTIAL — EMPLOYEE PROFILE REPORT</span><span>Generated: ${today}</span></div>
    </div></div>`;
  document.body.appendChild(host);
  await new Promise(r => setTimeout(r, 400));
  try {
    const canvas = await html2canvas(wrap, { backgroundColor:'#f8fafc', scale:2, useCORS:true, allowTaint:false, logging:false, imageTimeout:15000, width:wrap.scrollWidth, height:wrap.scrollHeight, windowWidth:wrap.scrollWidth, windowHeight:wrap.scrollHeight, x:0, y:0, scrollX:0, scrollY:0 });
    const a = document.createElement('a');
    a.download = `Employee_${safeName}.png`;
    a.href = canvas.toDataURL('image/png', 1.0);
    document.body.appendChild(a); a.click(); a.remove();
  } finally { document.body.removeChild(host); }
}

// ── InfoItem ──────────────────────────────────────────────────────────────────
function InfoItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      {Icon && <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0"><Icon className="w-4 h-4 text-gray-500" /></div>}
      <div><p className="text-xs text-gray-500">{label}</p><p className="text-sm font-medium text-gray-900">{value || '—'}</p></div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TradEmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee,  setEmployee]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [exporting, setExporting] = useState(null);
  const [editing,   setEditing]   = useState(false);
  const [editForm,  setEditForm]  = useState({});
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    // trad_employees have numeric IDs; fetch via the trad org chart API
    api.tradOrgChart.listEmployees()
      .then(list => {
        const emp = list.find(e => String(e.id) === String(id));
        if (emp) { setEmployee(emp); setEditForm(emp); }
        else setEmployee(null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleExport = async (fmt) => {
    setExporting(fmt);
    try { await generateProfileReport(employee, fmt); }
    catch (err) { console.error('Export failed:', err); alert('Export failed: ' + (err.message || 'Unknown error')); }
    finally { setExporting(null); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.tradOrgChart.updateEmployee(id, {
        name: editForm.name, employee_id: editForm.employee_id,
        designation: editForm.designation, department: editForm.department,
      });
      setEmployee(prev => ({ ...prev, ...editForm }));
      setEditing(false);
    } catch (err) { alert('Save failed: ' + err.message); }
    finally { setSaving(false); }
  };

  if (loading) return <LoadingSpinner />;
  if (!employee) return (
    <div className="text-center py-12">
      <p className="text-red-500 font-medium">Employee not found</p>
      <button onClick={() => navigate('/employees')} className="mt-4 btn-secondary text-sm">← Back to Employee Management</button>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <BackButton to="/employees" label="Back to Employee Management" />
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => handleExport('png')} disabled={!!exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
            {exporting === 'png' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Image className="w-3.5 h-3.5" />} Export PNG
          </button>
          <button type="button" onClick={() => handleExport('pdf')} disabled={!!exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
            {exporting === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />} Export PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left panel */}
        <div className="lg:col-span-1">
          <div className="card text-center">
            <PhotoUpload
              name={employee.name}
              photoUrl={employee.photo_url}
              onUpload={async (file) => {
                const res = await api.tradOrgChart.uploadPhoto(id, file);
                setEmployee(prev => ({ ...prev, photo_url: res.photo_url }));
                return res.photo_url;
              }}
              onRemove={async () => {
                await api.tradOrgChart.removePhoto(id);
                setEmployee(prev => ({ ...prev, photo_url: null }));
              }}
            />
            <h2 className="text-xl font-bold text-gray-900 mt-4">{employee.name}</h2>
            <p className="text-sm text-primary-600 font-medium">{employee.designation}</p>
            <p className="text-xs text-gray-500 mt-1">{employee.employee_id}</p>
            <button type="button" onClick={() => { setEditForm({ ...employee }); setEditing(true); }}
              className="btn-secondary w-full mt-4 flex items-center justify-center gap-2">
              <Edit className="w-4 h-4" /> Edit Profile
            </button>
          </div>
        </div>

        {/* Right panel */}
        <div className="lg:col-span-3 space-y-6">
          {/* Edit form */}
          {editing && (
            <div className="card border-2 border-primary-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Edit Employee</h3>
                <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[['employee_id','Employee ID'],['name','Name'],['designation','Designation'],['department','Department']].map(([k,l]) => (
                  <div key={k}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
                    <input type="text" value={editForm[k] || ''} onChange={e => setEditForm(f => ({ ...f, [k]: e.target.value }))} className="input-field w-full" />
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-4">
                <button type="button" onClick={handleSave} disabled={saving}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}

          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InfoItem icon={User}          label="Employee ID"   value={employee.employee_id} />
              <InfoItem icon={User}          label="Gender"        value={employee.gender} />
              <InfoItem icon={Building}      label="Department"    value={employee.department} />
              <InfoItem icon={User}          label="Designation"   value={employee.designation} />
              <InfoItem icon={MapPin}        label="Place"         value={employee.place} />
              <InfoItem icon={GraduationCap} label="Education"     value={employee.education} />
              <InfoItem icon={Calendar}      label="DOB"           value={employee.dob} />
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Employment History</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InfoItem icon={Calendar} label="Date of Join (Previous Company)" value={formatDate(employee.date_of_join_previous_company)} />
              <InfoItem icon={Calendar} label="Date of Join in BB"              value={formatDate(employee.date_of_join_in_bb)} />
              <InfoItem icon={Calendar} label="Join Date"                        value={formatDate(employee.join_date)} />
              <InfoItem icon={Calendar} label="Date of Exit"                     value={formatDate(employee.date_of_exit)} />
              <InfoItem icon={Clock}    label="Service Duration"                 value={employee.service_duration} />
              <InfoItem icon={Clock}    label="Service in BB"                    value={employee.service_in_bb} />
              <InfoItem             label="Status"                           value={employee.status} />
              <InfoItem icon={Building2} label="Immediate Previous Company"     value={employee.immediate_previous_company} />
            </div>
            {employee.remarks && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-1">Remarks</p>
                <p className="text-sm text-gray-700">{employee.remarks}</p>
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Current & Previous Employment</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InfoItem icon={Building2} label="Currently Working Company"             value={employee.currently_working_company} />
              <InfoItem icon={MapPin}    label="Location of Currently Working Company" value={employee.location_of_currently_working_company} />
              <InfoItem icon={Building2} label="Went To Company"                       value={employee.went_to_company} />
              <InfoItem icon={MapPin}    label="Location of Went To Company"           value={employee.location_of_went_to_company} />
            </div>
          </div>

          {employee.manager_name && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Reports To</h3>
              <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-primary-600 font-medium">{employee.manager_name.charAt(0)}</span>
                </div>
                <div>
                  <p className="font-medium">{employee.manager_name}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
