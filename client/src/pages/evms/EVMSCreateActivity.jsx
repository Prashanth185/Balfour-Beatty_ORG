/**
 * EVMS — Activity Schedule Form
 * Supports adding multiple activities in one save
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Check, Plane, Coffee, Hotel, Utensils, Car, Building2, Users, FileText, Calendar, ArrowLeft } from 'lucide-react';
import { evms } from '../../api/client';

const inp = 'w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400';

const ACTIVITY_TYPES = [
  'Airport Pickup',
  'Airport Drop',
  'Hotel Check-in',
  'Hotel Check-out',
  'Breakfast',
  'Lunch',
  'Dinner',
  'Tea Break',
  'Office Transfer',
  'Travel',
  'Site Visit',
  'Factory Visit',
  'Networking',
  'Registration',
  'Rest at Hotel',
  'Free Time',
  'Custom',
];

const ACTIVITY_ICONS = {
  'Airport Pickup': '🚗',
  'Airport Drop': '🚕',
  'Hotel Check-in': '🏨',
  'Hotel Check-out': '🏨',
  'Breakfast': '☕',
  'Lunch': '🍽️',
  'Dinner': '🍷',
  'Tea Break': '☕',
  'Office Transfer': '🚗',
  'Travel': '✈️',
  'Site Visit': '🏗️',
  'Factory Visit': '🏭',
  'Networking': '👥',
  'Registration': '📝',
  'Rest at Hotel': '🛏️',
  'Free Time': '🎯',
  'Custom': '📌',
};

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

const EMPTY_ACTIVITY = {
  activity_type: '',
  activity_date: '',
  start_time: '',
  end_time: '',
  location: '',
  description: '',
  visitor_ids: [],
  host_ids: [],
};

function ActivityRow({ row, index, total, visitors, hosts, onChange, onRemove }) {
  const toggleId = (key, id) => {
    const current = row[key] || [];
    onChange(key, current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
  };

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Activity {index + 1}</span>
          {row.activity_type && (
            <span className="text-base">{ACTIVITY_ICONS[row.activity_type] || '📌'}</span>
          )}
        </div>
        {total > 1 && (
          <button onClick={onRemove} className="p-1 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <Field label="Activity Type" required>
            <select
              className={inp}
              value={row.activity_type}
              onChange={e => onChange('activity_type', e.target.value)}
            >
              <option value="">Select activity type…</option>
              {ACTIVITY_TYPES.map(t => (
                <option key={t} value={t}>
                  {ACTIVITY_ICONS[t] || ''} {t}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Date">
          <input type="date" className={inp} value={row.activity_date} onChange={e => onChange('activity_date', e.target.value)} />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Start Time">
            <input type="time" className={inp} value={row.start_time} onChange={e => onChange('start_time', e.target.value)} />
          </Field>
          <Field label="End Time">
            <input type="time" className={inp} value={row.end_time} onChange={e => onChange('end_time', e.target.value)} />
          </Field>
        </div>

        <div className="md:col-span-2">
          <Field label="Location">
            <input className={inp} placeholder="e.g. BIAL Airport, The Leela Hotel" value={row.location} onChange={e => onChange('location', e.target.value)} />
          </Field>
        </div>

        <div className="md:col-span-2">
          <Field label="Description">
            <textarea
              className={`${inp} h-16 resize-none`}
              placeholder="Optional details…"
              value={row.description}
              onChange={e => onChange('description', e.target.value)}
            />
          </Field>
        </div>
      </div>

      {/* Visitors */}
      {visitors.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Visitors</p>
          <div className="flex flex-wrap gap-2">
            {visitors.map(v => (
              <button
                key={v.id}
                onClick={() => toggleId('visitor_ids', v.id)}
                className={`px-2 py-1 rounded-full text-xs ${
                  (row.visitor_ids || []).includes(v.id)
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {v.visitor_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hosts */}
      {hosts.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Hosts</p>
          <div className="flex flex-wrap gap-2">
            {hosts.map(h => (
              <button
                key={h.id}
                onClick={() => toggleId('host_ids', h.id)}
                className={`px-2 py-1 rounded-full text-xs ${
                  (row.host_ids || []).includes(h.id)
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {h.host_name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function EVMSCreateActivity() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preVisitId = searchParams.get('visitId') || '';

  const [visits, setVisits] = useState([]);
  const [visitId, setVisitId] = useState(preVisitId);
  const [visitors, setVisitors] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [activities, setActivities] = useState([{ ...EMPTY_ACTIVITY }]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    evms.visits.list().then(setVisits).catch(console.error);
  }, []);

  useEffect(() => {
    if (visitId) {
      evms.visits.get(visitId).then(full => {
        setVisitors(full.visitors || []);
        setHosts(full.hosts || []);
      }).catch(console.error);
    }
  }, [visitId]);

  const setActivity = (i, k, v) => setActivities(p => p.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const addActivity = () => setActivities(p => [...p, { ...EMPTY_ACTIVITY }]);
  const delActivity = (i) => setActivities(p => p.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!visitId) return alert('Please select a visit');
    const valid = activities.filter(a => a.activity_type?.trim());
    if (valid.length === 0) return alert('Add at least one activity with an activity type');

    setSaving(true);
    try {
      for (const a of valid) {
        await evms.activities.create(visitId, a);
      }
      setSaved(true);
      setTimeout(() => navigate(`/evms/visits/${visitId}`), 900);
    } catch (err) {
      console.error('EVMS save activities error:', err);
      alert(`Save failed: ${err.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const validCount = activities.filter(a => a.activity_type?.trim()).length;

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
        <h1 className="text-2xl font-bold text-gray-900">Activity Schedule</h1>
        <p className="text-sm text-gray-500 mt-1">Add logistics, travel, meals, and other activities for the visit</p>
      </div>

      {/* Visit Selection */}
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-100 pb-2">Link to Visit</h3>
        <div className="max-w-sm">
          <Field label="Select Visit" required>
            <select className={inp} value={visitId} onChange={e => setVisitId(e.target.value)}>
              <option value="">Select a visit…</option>
              {visits.map(v => <option key={v.id} value={v.id}>{v.visit_name}</option>)}
            </select>
          </Field>
        </div>
      </div>

      {/* Activities */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary-600" /> Activities
            <span className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs font-normal">
              {activities.length} activit{activities.length !== 1 ? 'ies' : 'y'}
            </span>
          </h3>
        </div>

        <div className="space-y-4">
          {activities.map((row, i) => (
            <ActivityRow
              key={i}
              row={row}
              index={i}
              total={activities.length}
              visitors={visitors}
              hosts={hosts}
              onChange={(k, v) => setActivity(i, k, v)}
              onRemove={() => delActivity(i)}
            />
          ))}
        </div>

        <button
          onClick={addActivity}
          className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors w-full justify-center text-sm"
        >
          <Plus className="w-4 h-4" /> Add Another Activity
        </button>

        <button
          onClick={handleSave}
          disabled={saving || saved}
          className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors mt-2"
        >
          {saved ? (
            <>
              <Check className="w-5 h-5" /> All Activities Saved!
            </>
          ) : saving ? (
            `Saving ${validCount} activit${validCount !== 1 ? 'ies' : 'y'}…`
          ) : (
            `Save All Activities (${validCount})`
          )}
        </button>
      </div>
    </div>
  );
}
