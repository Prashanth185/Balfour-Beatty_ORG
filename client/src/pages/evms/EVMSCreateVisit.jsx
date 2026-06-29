/**
 * EVMS Form 1 — Visitor Information (Common Travel Support)
 * Supports both Common Travel (all visitors share one schedule) and Individual Travel.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Check, Users, Plane, Info, ArrowLeft } from 'lucide-react';
import { evms } from '../../api/client';

const inp = 'w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400';
const STATUS_OPTS = ['Planning','Approved','In Progress','Completed','Cancelled'];

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const EMPTY_VISITOR_INDIVIDUAL = {
  visitor_name: '',
  arrival_location: '', arrival_date: '', arrival_time: '',
  departure_location: '', departure_date: '', departure_time: '',
};

// ── Visitor Row Component (Individual Travel) ────────────────────────────────
function VisitorRowIndividual({ row, index, total, onChange, onRemove }) {
  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Visitor {index + 1}</span>
        {total > 1 && (
          <button onClick={onRemove} className="p-1 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
      <Field label="Visitor Name" required>
        <input className={inp} placeholder="Full name" value={row.visitor_name} onChange={e => onChange('visitor_name', e.target.value)} />
      </Field>
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
          <Plane className="w-3.5 h-3.5 text-primary-500" /> Travel Details
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Arrival Location">
            <input className={inp} placeholder="e.g. Bengaluru Airport" value={row.arrival_location} onChange={e => onChange('arrival_location', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Arrival Date">
              <input type="date" className={inp} value={row.arrival_date} onChange={e => onChange('arrival_date', e.target.value)} />
            </Field>
            <Field label="Arrival Time">
              <input type="time" className={inp} value={row.arrival_time} onChange={e => onChange('arrival_time', e.target.value)} />
            </Field>
          </div>
          <Field label="Departure Location">
            <input className={inp} placeholder="e.g. Bengaluru Airport" value={row.departure_location} onChange={e => onChange('departure_location', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Departure Date">
              <input type="date" className={inp} value={row.departure_date} onChange={e => onChange('departure_date', e.target.value)} />
            </Field>
            <Field label="Departure Time">
              <input type="time" className={inp} value={row.departure_time} onChange={e => onChange('departure_time', e.target.value)} />
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Simple Visitor Name Row (Common Travel) ──────────────────────────────────
function VisitorRowCommon({ name, index, total, onChange, onRemove }) {
  return (
    <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
      <span className="text-xs text-gray-400 font-mono w-6">{index + 1}.</span>
      <input
        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
        placeholder="Visitor Name *"
        value={name}
        onChange={e => onChange(e.target.value)}
      />
      {total > 1 && (
        <button onClick={onRemove} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function EVMSCreateVisit() {
  const navigate  = useNavigate();
  const [saving, setSaving]       = useState(false);
  const [saved,  setSaved]        = useState(false);
  const [visit,  setVisit]        = useState({ status:'Planning' });
  const [travelMode, setTravelMode] = useState('common'); // 'common' | 'individual'

  // For common travel: just array of strings (visitor names)
  const [commonVisitors, setCommonVisitors] = useState(['']);
  const [commonTravel, setCommonTravel]     = useState({
    arrival_location: '', arrival_date: '', arrival_time: '',
    departure_location: '', departure_date: '', departure_time: '',
  });

  // For individual travel: array of objects (visitor + travel per row)
  const [individualVisitors, setIndividualVisitors] = useState([{ ...EMPTY_VISITOR_INDIVIDUAL }]);

  const setV = (k, v) => setVisit(p => ({ ...p, [k]: v }));
  const setComTrav = (k, v) => setCommonTravel(p => ({ ...p, [k]: v }));

  const addCommonVisitor = () => setCommonVisitors(p => [...p, '']);
  const delCommonVisitor = (i) => setCommonVisitors(p => p.filter((_, idx) => idx !== i));
  const setCommonVisitor = (i, val) => setCommonVisitors(p => p.map((v, idx) => idx === i ? val : v));

  const addIndividualVisitor = () => setIndividualVisitors(p => [...p, { ...EMPTY_VISITOR_INDIVIDUAL }]);
  const delIndividualVisitor = (i) => setIndividualVisitors(p => p.filter((_, idx) => idx !== i));
  const setIndividualVisitor = (i, k, v) => setIndividualVisitors(p => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r));

  const handleSave = async () => {
    if (!visit.visit_name?.trim())  return alert('Visit Name is required');
    if (!visit.visit_start_date)    return alert('Visit Start Date is required');
    if (!visit.visit_end_date)      return alert('Visit End Date is required');

    let validVisitors = [];
    if (travelMode === 'common') {
      validVisitors = commonVisitors.filter(n => n.trim()).map(n => ({ visitor_name: n.trim(), ...commonTravel }));
    } else {
      validVisitors = individualVisitors.filter(r => r.visitor_name?.trim());
    }

    if (validVisitors.length === 0) return alert('Add at least one visitor name');

    setSaving(true);
    try {
      // Create visit
      const existing = await evms.visits.list({ search: visit.visit_name });
      let visitId;
      const match = existing.find(v => v.visit_name.trim().toLowerCase() === visit.visit_name.trim().toLowerCase());
      if (match) {
        visitId = match.id;
      } else {
        const nv = await evms.visits.create({
          visit_name:  visit.visit_name.trim(),
          start_date:  visit.visit_start_date,
          end_date:    visit.visit_end_date,
          status:      visit.status || 'Planning',
          description: visit.description || '',
        });
        visitId = nv.id;
      }

      // Save visitors + travel
      for (const r of validVisitors) {
        const vis = await evms.visitors.create(visitId, { visitor_name: r.visitor_name });
        const hasTravel = r.arrival_location || r.arrival_date || r.arrival_time ||
                          r.departure_location || r.departure_date || r.departure_time;
        if (hasTravel) {
          await evms.travel.create(visitId, {
            visitor_id:        vis.id,
            arrival_airport:   r.arrival_location  || '',
            arrival_date:      r.arrival_date      || '',
            arrival_time:      r.arrival_time      || '',
            departure_airport: r.departure_location || '',
            departure_date:    r.departure_date    || '',
            departure_time:    r.departure_time    || '',
          });
        }
      }

      setSaved(true);
      setTimeout(() => navigate(`/evms/visits/${visitId}`), 900);
    } catch (err) {
      console.error('EVMS save visitors error:', err);
      alert(`Save failed: ${err.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const validCount = travelMode === 'common'
    ? commonVisitors.filter(n => n.trim()).length
    : individualVisitors.filter(r => r.visitor_name?.trim()).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Visitor Information</h1>
        <p className="text-sm text-gray-500 mt-1">Enter visit details, select travel type, then add visitors.</p>
      </div>

      {/* ── Visit Details ─────────────────────────────────────────────── */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-100 pb-2">Visit Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Field label="Visit Name" required>
              <input className={inp} value={visit.visit_name||''} onChange={e=>setV('visit_name',e.target.value)} placeholder="e.g. UK Visit, USA Leadership Visit" />
            </Field>
          </div>
          <Field label="Visit Start Date" required>
            <input type="date" className={inp} value={visit.visit_start_date||''} onChange={e=>setV('visit_start_date',e.target.value)} />
          </Field>
          <Field label="Visit End Date" required>
            <input type="date" className={inp} value={visit.visit_end_date||''} onChange={e=>setV('visit_end_date',e.target.value)} />
          </Field>
          <Field label="Status">
            <select className={inp} value={visit.status||'Planning'} onChange={e=>setV('status',e.target.value)}>
              {STATUS_OPTS.map(s=><option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Description / Notes">
            <input className={inp} value={visit.description||''} onChange={e=>setV('description',e.target.value)} placeholder="Optional notes" />
          </Field>
        </div>
      </div>

      {/* ── Travel Type Selection ────────────────────────────────────────*/}
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-100 pb-2">Travel Details Type</h3>
        <div className="flex items-start gap-5">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="travelMode"
              value="common"
              checked={travelMode === 'common'}
              onChange={() => setTravelMode('common')}
              className="mt-0.5"
            />
            <div>
              <span className="text-sm font-medium text-gray-800">Common Travel for All Visitors</span>
              <p className="text-xs text-gray-400 mt-0.5">All visitors share the same arrival and departure schedule</p>
            </div>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="travelMode"
              value="individual"
              checked={travelMode === 'individual'}
              onChange={() => setTravelMode('individual')}
              className="mt-0.5"
            />
            <div>
              <span className="text-sm font-medium text-gray-800">Individual Travel</span>
              <p className="text-xs text-gray-400 mt-0.5">Each visitor has their own travel schedule</p>
            </div>
          </label>
        </div>
        {travelMode === 'common' && (
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p>You'll enter one travel schedule that applies to all visitors automatically.</p>
          </div>
        )}
      </div>

      {/* ── Visitor Entry (Common Travel) ────────────────────────────────*/}
      {travelMode === 'common' && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
              <Users className="w-4 h-4 text-primary-600" /> Visitors
              <span className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs font-normal">{commonVisitors.length} visitor{commonVisitors.length !== 1 ? 's' : ''}</span>
            </h3>
          </div>
          <div className="space-y-2">
            {commonVisitors.map((name, i) => (
              <VisitorRowCommon
                key={i}
                name={name}
                index={i}
                total={commonVisitors.length}
                onChange={v => setCommonVisitor(i, v)}
                onRemove={() => delCommonVisitor(i)}
              />
            ))}
          </div>
          <button onClick={addCommonVisitor}
            className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors w-full justify-center text-sm">
            <Plus className="w-4 h-4" /> Add Another Visitor
          </button>

          {/* Common Travel Fields */}
          <div className="border-t border-gray-100 pt-4 mt-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-3">
              <Plane className="w-3.5 h-3.5 text-primary-500" /> Common Travel Details (Applied to All)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-primary-50/50 rounded-xl p-4 border border-primary-100">
              <Field label="Arrival Location">
                <input className={inp} placeholder="e.g. Bengaluru Airport" value={commonTravel.arrival_location} onChange={e=>setComTrav('arrival_location',e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Arrival Date">
                  <input type="date" className={inp} value={commonTravel.arrival_date} onChange={e=>setComTrav('arrival_date',e.target.value)} />
                </Field>
                <Field label="Arrival Time">
                  <input type="time" className={inp} value={commonTravel.arrival_time} onChange={e=>setComTrav('arrival_time',e.target.value)} />
                </Field>
              </div>
              <Field label="Departure Location">
                <input className={inp} placeholder="e.g. Bengaluru Airport" value={commonTravel.departure_location} onChange={e=>setComTrav('departure_location',e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Departure Date">
                  <input type="date" className={inp} value={commonTravel.departure_date} onChange={e=>setComTrav('departure_date',e.target.value)} />
                </Field>
                <Field label="Departure Time">
                  <input type="time" className={inp} value={commonTravel.departure_time} onChange={e=>setComTrav('departure_time',e.target.value)} />
                </Field>
              </div>
            </div>
          </div>

          <button onClick={handleSave} disabled={saving||saved}
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors mt-2">
            {saved ? <><Check className="w-5 h-5" /> All Visitors Saved!</> : saving ? `Saving ${validCount} visitor(s)…` : `Save All Visitors (${validCount})`}
          </button>
        </div>
      )}

      {/* ── Visitor Entry (Individual Travel) ─────────────────────────────*/}
      {travelMode === 'individual' && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
              <Users className="w-4 h-4 text-primary-600" /> Visitors (Individual Travel)
              <span className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs font-normal">{individualVisitors.length} visitor{individualVisitors.length !== 1 ? 's' : ''}</span>
            </h3>
          </div>
          <div className="space-y-4">
            {individualVisitors.map((row, i) => (
              <VisitorRowIndividual
                key={i}
                row={row}
                index={i}
                total={individualVisitors.length}
                onChange={(k, v) => setIndividualVisitor(i, k, v)}
                onRemove={() => delIndividualVisitor(i)}
              />
            ))}
          </div>
          <button onClick={addIndividualVisitor}
            className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors w-full justify-center text-sm">
            <Plus className="w-4 h-4" /> Add Another Visitor
          </button>
          <button onClick={handleSave} disabled={saving||saved}
            className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors mt-2">
            {saved ? <><Check className="w-5 h-5" /> All Visitors Saved!</> : saving ? `Saving ${validCount} visitor(s)…` : `Save All Visitors (${validCount})`}
          </button>
        </div>
      )}
    </div>
  );
}
