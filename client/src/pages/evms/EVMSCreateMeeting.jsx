/**
 * EVMS Form 3 — Meeting Schedule
 * Supports multiple meetings in one save. Meeting Title removed.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Plus, Trash2, Users } from 'lucide-react';
import { evms } from '../../api/client';

const inp = 'w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400';
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

const EMPTY_MEETING = {
  meeting_date: '',
  start_time: '',
  end_time: '',
  location: '',
  notes: '',
  visitor_ids: [],
  host_ids: [],
};

function MeetingRow({ row, index, total, visitors, hosts, onChange, onRemove }) {
  const toggleId = (key, id) => {
    const current = row[key] || [];
    onChange(key, current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
  };

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Meeting {index + 1}</span>
        {total > 1 && (
          <button onClick={onRemove} className="p-1 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Date">
          <input type="date" className={inp} value={row.meeting_date} onChange={e => onChange('meeting_date', e.target.value)} />
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
            <input className={inp} placeholder="e.g. Conference Room A" value={row.location} onChange={e => onChange('location', e.target.value)} />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Description">
            <textarea
              className={`${inp} h-16 resize-none`}
              placeholder="Meeting agenda, topics to discuss…"
              value={row.notes}
              onChange={e => onChange('notes', e.target.value)}
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

export default function EVMSCreateMeeting() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preVisitId = searchParams.get('visitId') || '';

  const [visits, setVisits] = useState([]);
  const [visitId, setVisitId] = useState(preVisitId);
  const [visitors, setVisitors] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [meetings, setMeetings] = useState([{ ...EMPTY_MEETING }]);
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

  const setMeeting = (i, k, v) => setMeetings(p => p.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const addMeeting = () => setMeetings(p => [...p, { ...EMPTY_MEETING }]);
  const delMeeting = (i) => setMeetings(p => p.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!visitId) return alert('Please select a visit');
    const valid = meetings.filter(m => m.meeting_date && m.start_time);
    if (valid.length === 0) return alert('Add at least one meeting with date and start time');

    setSaving(true);
    try {
      for (const m of valid) {
        await evms.meetings.create(visitId, {
          meeting_title: 'Meeting', // Required field but not displayed
          meeting_date: m.meeting_date,
          start_time: m.start_time,
          end_time: m.end_time || '',
          location: m.location || '',
          notes: m.notes || '',
          visitor_ids: m.visitor_ids || [],
          host_ids: m.host_ids || [],
        });
      }
      setSaved(true);
      setTimeout(() => navigate(`/evms/visits/${visitId}`), 900);
    } catch (err) {
      console.error('EVMS save meetings error:', err);
      alert(`Save failed: ${err.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const validCount = meetings.filter(m => m.meeting_date && m.start_time).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Meeting Schedule</h1>
        <p className="text-sm text-gray-500 mt-1">Schedule formal meetings between visitors and hosts</p>
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

      {/* Meetings */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
            <Users className="w-4 h-4 text-primary-600" /> Meetings
            <span className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs font-normal">
              {meetings.length} meeting{meetings.length !== 1 ? 's' : ''}
            </span>
          </h3>
        </div>

        <div className="space-y-4">
          {meetings.map((row, i) => (
            <MeetingRow
              key={i}
              row={row}
              index={i}
              total={meetings.length}
              visitors={visitors}
              hosts={hosts}
              onChange={(k, v) => setMeeting(i, k, v)}
              onRemove={() => delMeeting(i)}
            />
          ))}
        </div>

        <button
          onClick={addMeeting}
          className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors w-full justify-center text-sm"
        >
          <Plus className="w-4 h-4" /> Add Another Meeting
        </button>

        <button
          onClick={handleSave}
          disabled={saving || saved}
          className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors mt-2"
        >
          {saved ? (
            <>
              <Check className="w-5 h-5" /> All Meetings Saved!
            </>
          ) : saving ? (
            `Saving ${validCount} meeting${validCount !== 1 ? 's' : ''}…`
          ) : (
            `Save All Meetings (${validCount})`
          )}
        </button>
      </div>
    </div>
  );
}
