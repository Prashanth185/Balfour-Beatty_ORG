import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Mail, Phone, MapPin, Building, Briefcase, Edit, Calendar, User, GraduationCap, Clock, Building2, Image, FileText, Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import api from '../api/client';
import PhotoUpload from '../components/PhotoUpload';
import { BackButton, EmployeePhoto, LoadingSpinner, RELATIONSHIP_TYPES } from '../components/common';

// ── Helper: convert an image URL to base64 for jsPDF ────────────────────────
async function urlToBase64(url) {
  try {
    // Make URL absolute so fetch works from any context
    const absUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
    const res  = await fetch(absUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    // Determine MIME for jsPDF
    const mime = blob.type || 'image/jpeg';
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve({ dataUrl: reader.result, mime });
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ── Helper: section block HTML for off-screen PNG report ─────────────────────
function section(title, fields) {
  return `
    <div style="background:#f0f4fa;border-radius:8px;padding:14px 14px 8px;font-family:system-ui,sans-serif;">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;
                  color:#1e3a5f;background:#e2eaf6;border-radius:4px;padding:4px 8px;margin-bottom:10px;">
        ${title}
      </div>
      ${fields.map(([l, v]) => `
        <div style="margin-bottom:8px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">
          <div style="font-size:8px;color:#64748b;text-transform:uppercase;letter-spacing:.4px;">${l}</div>
          <div style="font-size:10.5px;font-weight:600;color:#1e293b;word-break:break-word;margin-top:2px;">${v}</div>
        </div>`).join('')}
    </div>`;
}

// ── Helper: draw initials avatar circle on PDF ────────────────────────────────
function drawInitialsAvatar(pdf, name, cx, cy, r) {
  pdf.setFillColor(37, 99, 235);
  pdf.circle(cx, cy, r, 'F');
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(28);
  pdf.setFont('helvetica', 'bold');
  pdf.text(initials, cx, cy + 9, { align: 'center' });
}

// ── Professional profile report generator ────────────────────────────────────
async function generateProfileReport(employee, format) {
  // A4 landscape: 297 × 210 mm  →  841.89 × 595.28 pt
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4', compress: true });
  const PW = pdf.internal.pageSize.getWidth();   // 841.89
  const PH = pdf.internal.pageSize.getHeight();  // 595.28

  const MARGIN   = 28;
  const GUTTER   = 18;
  const LEFT_W   = 175;   // left panel width
  const RIGHT_X  = MARGIN + LEFT_W + GUTTER;
  const RIGHT_W  = PW - RIGHT_X - MARGIN;
  const COL_W    = (RIGHT_W - GUTTER) / 2;  // two equal right columns

  const C_BG      = '#1e3a5f';   // dark navy header/left bg
  const C_ACCENT  = '#2563eb';   // blue accent
  const C_WHITE   = '#ffffff';
  const C_LIGHT   = '#f0f4fa';   // light section bg
  const C_TEXT    = '#1e293b';   // body text
  const C_MUTED   = '#64748b';   // label text
  const C_BORDER  = '#e2e8f0';   // rule lines

  const val = (v) => (v && String(v).trim()) ? String(v).trim() : '—';

  // ── Background ────────────────────────────────────────────────────────────
  // Full page light bg
  pdf.setFillColor(248, 250, 252);
  pdf.rect(0, 0, PW, PH, 'F');

  // Left panel dark bg
  pdf.setFillColor(30, 58, 95);
  pdf.roundedRect(MARGIN, MARGIN, LEFT_W, PH - MARGIN * 2, 10, 10, 'F');

  // Header bar across right panel
  pdf.setFillColor(37, 99, 235);
  pdf.roundedRect(RIGHT_X, MARGIN, RIGHT_W, 54, 8, 8, 'F');

  // ── Employee photo (left panel top) ─────────────────────────────────────
  const PHOTO_R  = 44;  // circle radius (pt)
  const PHOTO_CX = MARGIN + LEFT_W / 2;
  const PHOTO_CY = MARGIN + 24 + PHOTO_R;

  // White circle border ring
  pdf.setFillColor(255, 255, 255);
  pdf.circle(PHOTO_CX, PHOTO_CY, PHOTO_R + 3, 'F');

  if (employee.photo_url) {
    const photoResult = await urlToBase64(employee.photo_url);
    if (photoResult) {
      const { dataUrl, mime } = photoResult;
      // jsPDF cannot natively clip to a circle.
      // Use an offscreen canvas to draw the image clipped to a circle,
      // then pass that canvas data to addImage.
      const SIZE_PX = 200; // pixel size of the circle canvas
      const offCanvas = document.createElement('canvas');
      offCanvas.width  = SIZE_PX;
      offCanvas.height = SIZE_PX;
      const ctx = offCanvas.getContext('2d');
      // Draw circular clip path
      ctx.beginPath();
      ctx.arc(SIZE_PX / 2, SIZE_PX / 2, SIZE_PX / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      // Draw the image into the clipped circle
      await new Promise((resolve) => {
        const img = new window.Image();
        img.onload  = () => { ctx.drawImage(img, 0, 0, SIZE_PX, SIZE_PX); resolve(); };
        img.onerror = resolve; // proceed even if image fails
        img.src = dataUrl;
      });
      const circleDataUrl = offCanvas.toDataURL('image/png');
      pdf.addImage(
        circleDataUrl, 'PNG',
        PHOTO_CX - PHOTO_R, PHOTO_CY - PHOTO_R,
        PHOTO_R * 2, PHOTO_R * 2,
      );
    } else {
      // Fetch failed — show initials
      drawInitialsAvatar(pdf, employee.name, PHOTO_CX, PHOTO_CY, PHOTO_R);
    }
  } else {
    drawInitialsAvatar(pdf, employee.name, PHOTO_CX, PHOTO_CY, PHOTO_R);
  }

  // ── Left panel text ───────────────────────────────────────────────────────
  let ly = PHOTO_CY + PHOTO_R + 20;

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(13);
  pdf.setFont('helvetica', 'bold');
  const nameLines = pdf.splitTextToSize(val(employee.name), LEFT_W - 16);
  pdf.text(nameLines, PHOTO_CX, ly, { align: 'center' });
  ly += nameLines.length * 17 + 4;

  pdf.setFontSize(9.5);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(147, 197, 253); // light blue
  const desigLines = pdf.splitTextToSize(val(employee.designation), LEFT_W - 16);
  pdf.text(desigLines, PHOTO_CX, ly, { align: 'center' });
  ly += desigLines.length * 13 + 10;

  // Divider
  pdf.setDrawColor(255, 255, 255, 0.2);
  pdf.setLineWidth(0.4);
  pdf.line(MARGIN + 14, ly, MARGIN + LEFT_W - 14, ly);
  ly += 12;

  // Left panel fields
  const leftFields = [
    ['Employee ID',  val(employee.employee_id)],
    ['Department',   val(employee.department)],
    ['Status',       val(employee.status)],
    ['Gender',       val(employee.gender)],
    ['Place',        val(employee.place)],
    ['Education',    val(employee.education)],
    ['Manager',      val(employee.manager_name)],
  ];

  for (const [label, value] of leftFields) {
    if (ly > PH - MARGIN - 20) break;
    pdf.setFontSize(7.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(147, 197, 253);
    pdf.text(label.toUpperCase(), MARGIN + 10, ly);
    ly += 11;
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(255, 255, 255);
    const vlines = pdf.splitTextToSize(value, LEFT_W - 20);
    pdf.text(vlines[0], MARGIN + 10, ly);
    ly += 14;
  }

  // ── Right header bar content ──────────────────────────────────────────────
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(17);
  pdf.setFont('helvetica', 'bold');
  pdf.text('EMPLOYEE PROFILE', RIGHT_X + 16, MARGIN + 22);

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(219, 234, 254);
  pdf.text(`${val(employee.employee_id)}  ·  ${val(employee.designation)}  ·  ${val(employee.department)}`, RIGHT_X + 16, MARGIN + 40);

  // Report date top-right
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  pdf.setFontSize(8);
  pdf.setTextColor(219, 234, 254);
  pdf.text(`Generated: ${today}`, PW - MARGIN - 4, MARGIN + 34, { align: 'right' });

  // ── Right panel sections ──────────────────────────────────────────────────
  // Two-column layout: left half | right half
  const RIGHT_Y_START = MARGIN + 54 + 10;

  function drawSection(title, fields, sx, sy, sw, maxH) {
    // Section header
    pdf.setFillColor(240, 244, 250);
    pdf.roundedRect(sx, sy, sw, 18, 3, 3, 'F');
    pdf.setTextColor(30, 58, 95);
    pdf.setFontSize(8.5);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, sx + 8, sy + 12);
    sy += 22;

    for (const [label, value] of fields) {
      if (sy > MARGIN + maxH) break;
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 116, 139);
      pdf.text(label, sx + 4, sy);
      sy += 10;
      pdf.setFontSize(8.5);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 41, 59);
      const vlines = pdf.splitTextToSize(value, sw - 10);
      pdf.text(vlines[0], sx + 4, sy);
      // thin rule
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.3);
      pdf.line(sx + 4, sy + 4, sx + sw - 4, sy + 4);
      sy += 14;
    }
    return sy;
  }

  const maxContentH = PH - MARGIN - 10;

  // Left column (of right panel)
  const LCX = RIGHT_X;
  let lcy   = RIGHT_Y_START;

  lcy = drawSection('PERSONAL INFORMATION', [
    ['Employee ID',     val(employee.employee_id)],
    ['Full Name',       val(employee.name)],
    ['Gender',          val(employee.gender)],
    ['Date of Birth',   val(employee.dob)],
    ['Education',       val(employee.education)],
    ['Place',           val(employee.place)],
  ], LCX, lcy, COL_W, maxContentH - lcy + MARGIN);

  lcy += 8;

  lcy = drawSection('EMPLOYMENT HISTORY', [
    ['Join Date (Prev Company)', val(employee.date_of_join_previous_company)],
    ['Date of Join in BB',       val(employee.date_of_join_in_bb)],
    ['Join Date',                val(employee.join_date)],
    ['Date of Exit',             val(employee.date_of_exit)],
    ['Service Duration',         val(employee.service_duration)],
    ['Service in BB',            val(employee.service_in_bb)],
    ['Remarks',                  val(employee.remarks)],
  ], LCX, lcy, COL_W, maxContentH - lcy + MARGIN);

  // Right column (of right panel)
  const RCX = RIGHT_X + COL_W + GUTTER;
  let rcy   = RIGHT_Y_START;

  rcy = drawSection('ORGANIZATION', [
    ['Department',   val(employee.department)],
    ['Designation',  val(employee.designation)],
    ['Status',       val(employee.status)],
    ['Reports To',   val(employee.manager_name)],
    ['Manager ID',   val(employee.manager_employee_id)],
  ], RCX, rcy, COL_W, maxContentH - rcy + MARGIN);

  rcy += 8;

  rcy = drawSection('CURRENT & PREVIOUS EMPLOYMENT', [
    ['Imm. Previous Company',   val(employee.immediate_previous_company)],
    ['Currently Working At',    val(employee.currently_working_company)],
    ['Location (Current)',      val(employee.location_of_currently_working_company)],
    ['Went To Company',         val(employee.went_to_company)],
    ['Location (Went To)',      val(employee.location_of_went_to_company)],
  ], RCX, rcy, COL_W, maxContentH - rcy + MARGIN);

  // ── Footer ────────────────────────────────────────────────────────────────
  pdf.setDrawColor(226, 232, 240);
  pdf.setLineWidth(0.5);
  pdf.line(MARGIN, PH - 20, PW - MARGIN, PH - 20);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(148, 163, 184);
  pdf.text('CONFIDENTIAL — EMPLOYEE PROFILE REPORT', MARGIN, PH - 10);
  pdf.text(`Page 1 of 1`, PW - MARGIN, PH - 10, { align: 'right' });

  // ── Output ────────────────────────────────────────────────────────────────
  const safeName = (employee.employee_id || employee.name || 'Employee').replace(/[^a-zA-Z0-9]/g, '_');

  if (format === 'pdf') {
    pdf.save(`Employee_${safeName}.pdf`);
  } else {
    // PNG: jsPDF's datauristring is a PDF data URI — browsers cannot render
    // it as an <img>. Instead we build a lightweight off-screen HTML report
    // card and capture it with html2canvas (already a project dependency).
    const { default: html2canvas } = await import('html2canvas');

    // Build the off-screen report div
    const REPORT_W = 1200;
    const wrap = document.createElement('div');
    wrap.style.cssText = [
      'position:absolute',
      'left:-9999px',
      'top:0',
      `width:${REPORT_W}px`,
      'background:#f8fafc',
      'font-family:system-ui,sans-serif',
      'padding:32px',
      'box-sizing:border-box',
      'color:#1e293b',
      'z-index:-1',
    ].join(';');

    // Use a dedicated off-screen container so html2canvas only captures wrap,
    // not the live page (which happens with position:fixed elements).
    const offScreenHost = document.createElement('div');
    offScreenHost.style.cssText = 'position:absolute;left:-19999px;top:0;overflow:hidden;pointer-events:none;';
    offScreenHost.appendChild(wrap);

    const LEFT_W_PX = 240;
    const RIGHT_W_PX = REPORT_W - LEFT_W_PX - 64 - 24; // 64 outer pad, 24 gap

    wrap.innerHTML = `
      <div style="display:flex;gap:24px;align-items:flex-start;min-height:560px;">

        <!-- LEFT PANEL -->
        <div style="width:${LEFT_W_PX}px;flex-shrink:0;background:#1e3a5f;border-radius:12px;
                    padding:28px 20px;color:#fff;text-align:center;min-height:540px;">
          <div style="width:96px;height:96px;border-radius:50%;overflow:hidden;
                      background:#2563eb;margin:0 auto 16px;border:4px solid #fff;
                      display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:700;">
            ${employee.photo_url
              ? `<img src="${employee.photo_url}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous"/>`
              : `<span style="color:#fff">${(employee.name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</span>`}
          </div>
          <div style="font-size:16px;font-weight:700;margin-bottom:4px;">${val(employee.name)}</div>
          <div style="font-size:11px;color:#93c5fd;margin-bottom:16px;">${val(employee.designation)}</div>
          <hr style="border:none;border-top:1px solid rgba(255,255,255,0.2);margin-bottom:16px;"/>
          ${[
            ['Employee ID',  val(employee.employee_id)],
            ['Department',   val(employee.department)],
            ['Status',       val(employee.status)],
            ['Gender',       val(employee.gender)],
            ['Place',        val(employee.place)],
            ['Education',    val(employee.education)],
            ['Manager',      val(employee.manager_name)],
          ].map(([l,v]) => `
            <div style="text-align:left;margin-bottom:10px;">
              <div style="font-size:9px;text-transform:uppercase;color:#93c5fd;letter-spacing:.5px;">${l}</div>
              <div style="font-size:11px;font-weight:600;word-break:break-word;">${v}</div>
            </div>`).join('')}
        </div>

        <!-- RIGHT PANEL -->
        <div style="flex:1;display:flex;flex-direction:column;gap:16px;">

          <!-- Header bar -->
          <div style="background:#2563eb;border-radius:10px;padding:16px 20px;color:#fff;">
            <div style="font-size:18px;font-weight:700;">EMPLOYEE PROFILE</div>
            <div style="font-size:11px;color:#dbeafe;margin-top:4px;">
              ${val(employee.employee_id)} · ${val(employee.designation)} · ${val(employee.department)}
            </div>
          </div>

          <!-- Two column body -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">

            <!-- Col 1 -->
            <div style="display:flex;flex-direction:column;gap:16px;">
              ${section('PERSONAL INFORMATION', [
                ['Employee ID',   val(employee.employee_id)],
                ['Full Name',     val(employee.name)],
                ['Gender',        val(employee.gender)],
                ['Date of Birth', val(employee.dob)],
                ['Education',     val(employee.education)],
                ['Place',         val(employee.place)],
              ])}
              ${section('EMPLOYMENT HISTORY', [
                ['Join Date (Prev Co.)', val(employee.date_of_join_previous_company)],
                ['Date of Join in BB',  val(employee.date_of_join_in_bb)],
                ['Join Date',           val(employee.join_date)],
                ['Date of Exit',        val(employee.date_of_exit)],
                ['Service Duration',    val(employee.service_duration)],
                ['Service in BB',       val(employee.service_in_bb)],
                ['Remarks',             val(employee.remarks)],
              ])}
            </div>

            <!-- Col 2 -->
            <div style="display:flex;flex-direction:column;gap:16px;">
              ${section('ORGANIZATION', [
                ['Department',  val(employee.department)],
                ['Designation', val(employee.designation)],
                ['Status',      val(employee.status)],
                ['Reports To',  val(employee.manager_name)],
                ['Manager ID',  val(employee.manager_employee_id)],
              ])}
              ${section('CURRENT & PREVIOUS EMPLOYMENT', [
                ['Imm. Previous Company', val(employee.immediate_previous_company)],
                ['Currently Working At',  val(employee.currently_working_company)],
                ['Location (Current)',    val(employee.location_of_currently_working_company)],
                ['Went To Company',       val(employee.went_to_company)],
                ['Location (Went To)',    val(employee.location_of_went_to_company)],
              ])}
            </div>
          </div>

          <!-- Footer -->
          <div style="border-top:1px solid #e2e8f0;padding-top:8px;display:flex;
                      justify-content:space-between;font-size:9px;color:#94a3b8;">
            <span>CONFIDENTIAL — EMPLOYEE PROFILE REPORT</span>
            <span>Generated: ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</span>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(offScreenHost);

    // Small wait for images to load (the employee photo)
    await new Promise(r => setTimeout(r, 400));

    try {
      const canvas = await html2canvas(wrap, {
        backgroundColor: '#f8fafc',
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 15000,
        width:  wrap.scrollWidth,
        height: wrap.scrollHeight,
        windowWidth:  wrap.scrollWidth,
        windowHeight: wrap.scrollHeight,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
      });
      const link = document.createElement('a');
      link.download = `Employee_${safeName}.png`;
      link.href     = canvas.toDataURL('image/png', 1.0);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      document.body.removeChild(offScreenHost);
    }
  }
}

export default function EmployeeProfile() {
  const { id } = useParams();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('profile');
  const [exporting, setExporting] = useState(null); // 'png' | 'pdf' | null

  useEffect(() => {
    api.employees.get(id)
      .then(setEmployee)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleExport = async (format) => {
    setExporting(format);
    try {
      await generateProfileReport(employee, format);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed: ' + (err.message || 'Unknown error'));
    } finally {
      setExporting(null);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!employee) return <div className="text-center text-red-500 py-12">Employee not found</div>;

  const tabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'relationships', label: 'Relationships' },
    { id: 'projects', label: 'Projects' },
    { id: 'documents', label: 'Documents' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <BackButton to="/employees" label="Back to Employees" />
        {/* Export buttons — only shown on profile tab */}
        {tab === 'profile' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleExport('png')}
              disabled={!!exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 transition-colors"
            >
              {exporting === 'png'
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Image className="w-3.5 h-3.5" />}
              Export PNG
            </button>
            <button
              type="button"
              onClick={() => handleExport('pdf')}
              disabled={!!exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 transition-colors"
            >
              {exporting === 'pdf'
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <FileText className="w-3.5 h-3.5" />}
              Export PDF
            </button>
          </div>
        )}
      </div>

      {/* Profile content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="card text-center">
            <PhotoUpload
              name={employee.name}
              photoUrl={employee.photo_url}
              onUpload={async (file) => {
                const res = await api.employees.uploadPhoto(id, file);
                setEmployee((prev) => ({ ...prev, photo_url: res.photo_url }));
                return res.photo_url;
              }}
              onRemove={async () => {
                await api.employees.removePhoto(id);
                setEmployee((prev) => ({ ...prev, photo_url: null }));
              }}
            />
            <h2 className="text-xl font-bold text-gray-900 mt-4">{employee.name}</h2>
            <p className="text-sm text-primary-600 font-medium">{employee.designation}</p>
            <p className="text-xs text-gray-500 mt-1">{employee.employee_id}</p>

            <Link to={`/employees/${id}/edit`} className="btn-secondary w-full mt-4 flex items-center justify-center gap-2">
              <Edit className="w-4 h-4" /> Edit Profile
            </Link>

            <nav className="mt-6 space-y-1">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tab === t.id ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        <div className="lg:col-span-3">
          {tab === 'profile' && (
            <div className="space-y-6">
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">Personal & Professional Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InfoItem icon={Mail} label="Email" value={employee.email} />
                  <InfoItem icon={Phone} label="Phone" value={employee.phone} />
                  <InfoItem icon={Building} label="Department" value={employee.department} />
                  <InfoItem icon={Briefcase} label="Business Unit" value={employee.business_unit} />
                  <InfoItem icon={MapPin} label="Location" value={employee.location} />
                  <InfoItem icon={User} label="Gender" value={employee.gender} />
                  <InfoItem icon={MapPin} label="Place" value={employee.place} />
                  <InfoItem icon={Calendar} label="Date of Birth" value={employee.dob} />
                  <InfoItem icon={GraduationCap} label="Education" value={employee.education} />
                </div>
                {employee.bio && (
                  <div className="mt-6 pt-6 border-t border-gray-100">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Bio</h4>
                    <p className="text-sm text-gray-600 leading-relaxed">{employee.bio}</p>
                  </div>
                )}
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold mb-4">Employment History</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InfoItem icon={Calendar} label="Date of Join (Previous Company)" value={employee.date_of_join_previous_company} />
                  <InfoItem icon={Calendar} label="Date of Join in BB" value={employee.date_of_join_in_bb} />
                  <InfoItem icon={Calendar} label="Join Date" value={employee.join_date} />
                  <InfoItem icon={Calendar} label="Date of Exit" value={employee.date_of_exit} />
                  <InfoItem icon={Clock} label="Service Duration" value={employee.service_duration} />
                  <InfoItem icon={Clock} label="Service in BB" value={employee.service_in_bb} />
                  <InfoItem label="Status" value={employee.status} />
                  <InfoItem icon={Building2} label="Immediate Previous Company" value={employee.immediate_previous_company} />
                </div>
                {employee.remarks && (
                  <div className="mt-6 pt-6 border-t border-gray-100">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Remarks</h4>
                    <p className="text-sm text-gray-600 leading-relaxed">{employee.remarks}</p>
                  </div>
                )}
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold mb-4">Current & Previous Employment</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InfoItem icon={Building2} label="Currently Working Company" value={employee.currently_working_company} />
                  <InfoItem icon={MapPin} label="Location of Currently Working Company" value={employee.location_of_currently_working_company} />
                  <InfoItem icon={Building2} label="Went To Company" value={employee.went_to_company} />
                  <InfoItem icon={MapPin} label="Location of Went To Company" value={employee.location_of_went_to_company} />
                </div>
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold mb-4">Reports To</h3>
                {employee.manager_name ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-primary-600 font-medium">{employee.manager_name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-medium">{employee.manager_name}</p>
                      <p className="text-xs text-gray-500">{employee.manager_employee_id}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No manager assigned</p>
                )}
              </div>
            </div>
          )}

          {tab === 'relationships' && (
            <div className="space-y-4">
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">Reports To</h3>
                {employee.managers?.length > 0 ? (
                  <div className="space-y-3">
                    {employee.managers.map(m => (
                      <Link key={m.id} to={`/employees/${m.id}`} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                        <EmployeePhoto employee={m} size="sm" />
                        <div>
                          <p className="font-medium text-sm">{m.name}</p>
                          <p className="text-xs text-gray-500">{m.designation}</p>
                        </div>
                        <span className="ml-auto text-xs px-2 py-1 rounded-full bg-primary-50 text-primary-700">
                          {RELATIONSHIP_TYPES[m.relationship_type]?.label || m.relationship_type}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No managers assigned</p>
                )}
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold mb-4">Direct Reports</h3>
                {employee.directReports?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {employee.directReports.map(r => (
                      <Link key={r.id} to={`/employees/${r.id}`} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                        <EmployeePhoto employee={r} size="sm" />
                        <div>
                          <p className="font-medium text-sm">{r.name}</p>
                          <p className="text-xs text-gray-500">{r.designation}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No direct reports</p>
                )}
              </div>
            </div>
          )}

          {tab === 'projects' && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Projects</h3>
              {employee.projects?.length > 0 ? (
                <div className="space-y-3">
                  {employee.projects.map(p => (
                    <div key={p.id} className="p-4 rounded-lg border border-gray-100">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{p.name}</p>
                        <span className={`text-xs px-2 py-1 rounded-full ${p.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-600'}`}>
                          {p.status}
                        </span>
                      </div>
                      {p.role && <p className="text-sm text-gray-500 mt-1">Role: {p.role}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No projects assigned</p>
              )}
            </div>
          )}

          {tab === 'documents' && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Documents</h3>
              {employee.documents?.length > 0 ? (
                <div className="space-y-2">
                  {employee.documents.map(d => (
                    <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
                      <p className="text-sm font-medium">{d.title}</p>
                      <span className="text-xs text-gray-500">{d.doc_type}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No documents uploaded</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      {Icon && (
        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-gray-500" />
        </div>
      )}
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value || '—'}</p>
      </div>
    </div>
  );
}
