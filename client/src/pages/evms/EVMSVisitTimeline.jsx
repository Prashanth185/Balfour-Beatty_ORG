/**
 * EVMS — Unified Visit Timeline - Professional Corporate Edition
 * Simplified form fields for executive visit management
 * Meeting: Date + Times + Visitors + Hosts + Description (no separate title/location)
 * Activity: Activity Type + Date + Times + Location + Visitors + Hosts (optional) + Description
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Check, Calendar, Clock, ArrowLeft } from 'lucide-react';
import { evms } from '../../api/client';

const inp = 'w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400';

// Predefined activity types (optional - users can also type manually)
const PREDEFINED_ACTIVITIES = [
  'Airport Pickup',
  'Airport Drop',
  'Hotel Check-in',
  'Hotel Check-out',
  'Breakfast',
  'Lunch',
  'Dinner',
  'Tea Break',
  'Coffee Break',
  'Office Transfer',
  'Travel',
  'Factory Visit',
  'Site Visit',
  'Plant Visit',
  'Campus Visit',
  'Customer Visit',
  'Vendor Visit',
  'Registration',
  'Networking',
  'Training',
  'Workshop',
  'Project Briefing',
  'Photo Session',
  'Media Interaction',
  'Evening Walk',
  'Shopping',
  'CEO Discussion',
  'Security Check',
  'Executive Welcome',
  'Board Review',
  'Rest at Hotel',
  'Free Time',
];

const ACTIVITY_ICONS = {
  'Airport Pickup': '🚗', 'Airport Drop': '🚕', 'Hotel Check-in': '🏨', 'Hotel Check-out': '🏨',
  'Breakfast': '☕', 'Lunch': '🍽️', 'Dinner': '🍷', 'Tea Break': '☕', 'Coffee Break': '☕',
  'Office Transfer': '🚗', 'Travel': '✈️', 'Factory Visit': '🏭', 'Site Visit': '🏗️',
  'Plant Visit': '🏭', 'Campus Visit': '🏫', 'Customer Visit': '🤝', 'Vendor Visit': '🤝',
  'Registration': '📝', 'Networking': '👥', 'Training': '📚', 'Workshop': '🛠️',
  'Project Briefing': '📊', 'Photo Session': '📸', 'Media Interaction': '📰',
  'Evening Walk': '🚶', 'Shopping': '🛍️', 'CEO Discussion': '💼', 'Security Check': '🔒',
  'Executive Welcome': '🎉', 'Board Review': '📋', 'Rest at Hotel': '🛏️', 'Free Time': '🎯',
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

// Custom Time Input with 12-hour AM/PM format - ALL DROPDOWNS
function TimeInput({ value, onChange, placeholder }) {
  // Parse value (can be 24h format from backend)
  const parse24 = (val) => {
    if (!val) return { hour: '', minute: '', period: 'AM' };
    try {
      const [h, m] = val.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return { hour: '', minute: '', period: 'AM' };
      const period = h >= 12 ? 'PM' : 'AM';
      const hour12 = h % 12 || 12;
      return { 
        hour: String(hour12).padStart(2, '0'), 
        minute: String(m).padStart(2, '0'), 
        period 
      };
    } catch {
      return { hour: '', minute: '', period: 'AM' };
    }
  };

  // Convert to 24h for storage
  const to24 = (hour, minute, period) => {
    if (!hour || minute === undefined || minute === null || minute === '') return '';
    try {
      let h = parseInt(hour);
      const m = parseInt(minute);
      if (isNaN(h) || isNaN(m)) return '';
      
      if (period === 'PM' && h !== 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;
      
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    } catch {
      return '';
    }
  };

  const parsed = parse24(value);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [period, setPeriod] = useState(parsed.period);

  useEffect(() => {
    const p = parse24(value);
    setHour(p.hour);
    setMinute(p.minute);
    setPeriod(p.period);
  }, [value]);

  const updateTime = (newHour, newMinute, newPeriod) => {
    const h = newHour;
    const m = newMinute;
    const p = newPeriod;
    
    if (h && (m === '00' || m) && p) {
      const time24 = to24(h, m, p);
      if (time24) {
        onChange(time24);
      }
    }
  };

  const handleHourChange = (e) => {
    const val = e.target.value;
    setHour(val);
    if (val && (minute === '00' || minute)) {
      updateTime(val, minute, period);
    }
  };

  const handleMinuteChange = (e) => {
    const val = e.target.value;
    setMinute(val);
    if (hour && (val === '00' || val)) {
      updateTime(hour, val, period);
    }
  };

  const handlePeriodChange = (e) => {
    const val = e.target.value;
    setPeriod(val);
    if (hour && (minute === '00' || minute)) {
      updateTime(hour, minute, val);
    }
  };

  // Generate hour options (01-12)
  const hourOptions = Array.from({ length: 12 }, (_, i) => {
    const h = String(i + 1).padStart(2, '0');
    return h;
  });

  // Generate minute options (00, 15, 30, 45)
  const minuteOptions = ['00', '15', '30', '45'];

  const selectStyle = 'w-full px-3 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white';

  return (
    <div className="grid grid-cols-3 gap-2">
      {/* Hour Dropdown */}
      <div>
        <select
          className={selectStyle}
          value={hour}
          onChange={handleHourChange}
        >
          <option value="">Hour</option>
          {hourOptions.map(h => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
      </div>

      {/* Minute Dropdown */}
      <div>
        <select
          className={selectStyle}
          value={minute}
          onChange={handleMinuteChange}
        >
          <option value="">Min</option>
          {minuteOptions.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* AM/PM Dropdown */}
      <div>
        <select
          className={selectStyle}
          value={period}
          onChange={handlePeriodChange}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
}

const EMPTY_ITEM = {
  type: 'meeting', // 'meeting' or 'activity'
  date: '',
  start_time: '',
  end_time: '',
  description: '', // Primary field for meetings
  activity_type: '', // For activities only - replaces activity_name
  location: '', // For activities only
  visitor_ids: [],
  host_ids: [], // Optional for activities, required for meetings
};

function TimelineItem({ item, index, visitors, hosts, onChange, onRemove, total }) {
  const toggleId = (key, id) => {
    const current = item[key] || [];
    onChange(key, current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
  };

  return (
    <div className="border-2 border-gray-200 rounded-xl p-4 bg-white shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            Timeline Item {index + 1}
          </span>
          {item.type === 'meeting' && <span className="text-base">🤝</span>}
          {item.type === 'activity' && <span className="text-base">📌</span>}
        </div>
        {total > 1 && (
          <button
            onClick={onRemove}
            className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Type Selection */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onChange('type', 'meeting')}
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
            item.type === 'meeting'
              ? 'border-primary-500 bg-primary-50 text-primary-700 font-semibold'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
          }`}
        >
          <span className="text-lg">🤝</span>
          <span className="text-sm">Meeting</span>
        </button>
        <button
          onClick={() => onChange('type', 'activity')}
          className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
            item.type === 'activity'
              ? 'border-violet-500 bg-violet-50 text-violet-700 font-semibold'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
          }`}
        >
          <span className="text-lg">📌</span>
          <span className="text-sm">Activity</span>
        </button>
      </div>

      {/* Simplified Fields - NO separate title for meetings, Location field for activities */}
      <div className="grid grid-cols-1 gap-3">
        <Field label="Date" required>
          <input
            type="date"
            className={inp}
            value={item.date}
            onChange={e => onChange('date', e.target.value)}
          />
        </Field>
        
        <Field label="Start Time" required>
          <TimeInput
            value={item.start_time}
            onChange={val => onChange('start_time', val)}
            placeholder="09:00 AM"
          />
        </Field>
        
        <Field label={item.type === 'meeting' ? 'Description' : 'Description'} required={item.type === 'meeting'}>
          <textarea
            className={`${inp} h-20 resize-none`}
            placeholder={
              item.type === 'meeting'
                ? 'e.g. Civil Discussion, OHL Progress Review, Structural Walkthrough, Safety Review, Project Kickoff, Weekly Review...'
                : 'Brief notes about this activity (optional)'
            }
            value={item.description}
            onChange={e => onChange('description', e.target.value)}
          />
          {item.type === 'meeting' && (
            <p className="text-[11px] text-gray-400 mt-1">
              💡 Describe the meeting purpose - no need for separate title
            </p>
          )}
        </Field>
      </div>

      {/* Visitors */}
      {visitors.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">
            Visitors {item.type === 'meeting' && <span className="text-red-500">*</span>}
          </p>
          <div className="flex flex-wrap gap-2">
            {visitors.map(v => (
              <button
                key={v.id}
                onClick={() => toggleId('visitor_ids', v.id)}
                className={`px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  (item.visitor_ids || []).includes(v.id)
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {v.visitor_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hosts - Optional for Activities, Required for Meetings */}
      {hosts.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">
            Hosts{' '}
            {item.type === 'meeting' && <span className="text-red-500">*</span>}
            {item.type === 'activity' && <span className="text-gray-400">(Optional)</span>}
          </p>
          <div className="flex flex-wrap gap-2">
            {hosts.map(h => (
              <button
                key={h.id}
                onClick={() => toggleId('host_ids', h.id)}
                className={`px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  (item.host_ids || []).includes(h.id)
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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

export default function EVMSVisitTimeline() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preVisitId = searchParams.get('visitId') || '';

  const [visits, setVisits] = useState([]);
  const [visitId, setVisitId] = useState(preVisitId);
  const [visitors, setVisitors] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [timeline, setTimeline] = useState([{ ...EMPTY_ITEM }]);
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

  const setItem = (i, k, v) => setTimeline(p => p.map((item, idx) => (idx === i ? { ...item, [k]: v } : item)));
  const addItem = () => setTimeline(p => [...p, { ...EMPTY_ITEM }]);
  const delItem = i => setTimeline(p => p.filter((_, idx) => idx !== i));

  const validate = () => {
    for (let i = 0; i < timeline.length; i++) {
      const item = timeline[i];
      if (item.type === 'meeting') {
        if (!item.description?.trim()) return { valid: false, msg: `Meeting ${i + 1}: Description is required` };
        if (!item.date) return { valid: false, msg: `Meeting ${i + 1}: Date is required` };
        if (!item.start_time) return { valid: false, msg: `Meeting ${i + 1}: Start Time is required` };
        if (!item.visitor_ids?.length) return { valid: false, msg: `Meeting ${i + 1}: At least one Visitor is required` };
        if (!item.host_ids?.length) return { valid: false, msg: `Meeting ${i + 1}: At least one Host is required` };
      }
      if (item.type === 'activity') {
        if (!item.date) return { valid: false, msg: `Activity ${i + 1}: Date is required` };
        if (!item.start_time) return { valid: false, msg: `Activity ${i + 1}: Start Time is required` };
      }
    }
    return { valid: true };
  };

  const handleSave = async () => {
    if (!visitId) return alert('Please select a visit');

    const validation = validate();
    if (!validation.valid) return alert(validation.msg);

    const validItems = timeline.filter(item => {
      if (item.type === 'meeting') return item.description?.trim() && item.date && item.start_time;
      if (item.type === 'activity') return item.date && item.start_time;
      return false;
    });

    if (validItems.length === 0) return alert('Add at least one timeline item');

    setSaving(true);
    try {
      for (const item of validItems) {
        if (item.type === 'meeting') {
          // Use description as the meeting title for backend compatibility
          await evms.meetings.create(visitId, {
            meeting_title: item.description.trim().substring(0, 100), // Use first 100 chars of description as title
            meeting_date: item.date,
            start_time: item.start_time,
            end_time: item.end_time,
            location: '', // No location field in simplified form
            notes: item.description,
            visitor_ids: item.visitor_ids || [],
            host_ids: item.host_ids || [],
          });
        } else {
          await evms.activities.create(visitId, {
            activity_type: item.activity_type || 'Activity',
            activity_date: item.date,
            start_time: item.start_time,
            end_time: item.end_time || '',
            location: item.location || '',
            description: item.description || '',
            visitor_ids: item.visitor_ids || [],
            host_ids: item.host_ids || [],
          });
        }
      }
      setSaved(true);
      setTimeout(() => navigate(`/evms/visits/${visitId}`), 900);
    } catch (err) {
      console.error('EVMS save timeline error:', err);
      alert(`Save failed: ${err.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const validCount = timeline.filter(item => {
    if (item.type === 'meeting') return item.description?.trim() && item.date && item.start_time;
    if (item.type === 'activity') return item.date && item.start_time;
    return false;
  }).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
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
        <h1 className="text-2xl font-bold text-gray-900">Visit Timeline</h1>
        <p className="text-sm text-gray-500 mt-1">
          Build the complete itinerary by adding meetings and activities in chronological order
        </p>
      </div>

      {/* Visit Selection */}
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-100 pb-2 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary-600" /> Select Visit
        </h3>
        <div className="max-w-sm">
          <Field label="Visit" required>
            <select className={inp} value={visitId} onChange={e => setVisitId(e.target.value)}>
              <option value="">Select a visit…</option>
              {visits.map(v => (
                <option key={v.id} value={v.id}>
                  {v.visit_name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {/* Timeline Items */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary-600" /> Timeline Items
            <span className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs font-normal">
              {timeline.length} item{timeline.length !== 1 ? 's' : ''}
            </span>
          </h3>
        </div>

        <div className="space-y-4">
          {timeline.map((item, i) => (
            <TimelineItem
              key={i}
              item={item}
              index={i}
              total={timeline.length}
              visitors={visitors}
              hosts={hosts}
              onChange={(k, v) => setItem(i, k, v)}
              onRemove={() => delItem(i)}
            />
          ))}
        </div>

        <button
          onClick={addItem}
          className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-all w-full justify-center text-sm font-medium"
        >
          <Plus className="w-5 h-5" /> Add Timeline Item
        </button>

        <button
          onClick={handleSave}
          disabled={saving || saved}
          className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors mt-2"
        >
          {saved ? (
            <>
              <Check className="w-5 h-5" /> Timeline Saved!
            </>
          ) : saving ? (
            `Saving ${validCount} item${validCount !== 1 ? 's' : ''}…`
          ) : (
            `Save Complete Timeline (${validCount} item${validCount !== 1 ? 's' : ''})`
          )}
        </button>
      </div>
    </div>
  );
}
