/**
 * EVMS Form — Host Information
 * Company Head and Host Team are both OPTIONAL.
 * You can add only a Company Head, only team members, or both.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Check, Building2, Crown, Users, ArrowLeft } from 'lucide-react';
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

const EMPTY_MEMBER = { host_name: '' };

export default function EVMSCreateHost() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preVisitId = searchParams.get('visitId') || '';

  const [visits,       setVisits]      = useState([]);
  const [visitId,      setVisitId]     = useState(preVisitId);
  const [companyName,  setCompanyName] = useState('');

  // Company Head — optional
  const [addHead,    setAddHead]    = useState(true);
  const [headName,   setHeadName]   = useState('');
  const [headDesig,  setHeadDesig]  = useState('');

  // Team members
  const [members,    setMembers]    = useState([{ ...EMPTY_MEMBER }]);

  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [errors,     setErrors]     = useState({});

  useEffect(() => { evms.visits.list().then(setVisits).catch(console.error); }, []);

  const setMember = (i, k, v) => setMembers(p => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const addMember  = () => setMembers(p => [...p, { ...EMPTY_MEMBER }]);
  const delMember  = (i) => setMembers(p => p.filter((_, idx) => idx !== i));

  const validate = () => {
    const e = {};
    if (!visitId) e.visitId = 'Please select a visit';
    if (addHead) {
      if (!headName.trim()) e.headName = 'Company Head name is required';
    }
    // At least one of head or a valid member must be provided
    const validMembers = members.filter(m => m.host_name?.trim());
    if (!addHead && validMembers.length === 0) {
      e.members = 'Add at least one team member or enable Company Head';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      // Save Company Head if enabled
      if (addHead && headName.trim()) {
        await evms.hosts.create(visitId, {
          host_name:       headName.trim(),
          designation:     headDesig.trim(),
          company_name:    companyName.trim(),
          is_company_head: 1,
        });
      }

      // Save all valid team members
      const validMembers = members.filter(m => m.host_name?.trim());
      for (const m of validMembers) {
        await evms.hosts.create(visitId, {
          host_name:       m.host_name.trim(),
          company_name:    companyName.trim(),
          is_company_head: 0,
        });
      }

      setSaved(true);
      setTimeout(() => navigate(`/evms/visits/${visitId}`), 900);
    } catch (err) {
      console.error('EVMS save hosts error:', err);
      alert(`Save failed: ${err.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const validMemberCount = members.filter(m => m.host_name?.trim()).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Back */}
      <button onClick={() => navigate('/evms')}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
        <ArrowLeft className="w-4 h-4" /> Return to EVMS Dashboard
      </button>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Host Information</h1>
        <p className="text-sm text-gray-500 mt-1">
          Add host company details. Company Head and Team Members are both optional — add one or both.
        </p>
      </div>

      {/* ── Visit Selection ── */}
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-100 pb-2">
          Link to Visit
        </h3>
        <div className="max-w-sm">
          <Field label="Select Visit" required>
            <select className={`${inp} ${errors.visitId ? 'border-red-400' : ''}`}
              value={visitId}
              onChange={e => { setVisitId(e.target.value); setErrors(p=>({...p,visitId:null})); }}>
              <option value="">Select a visit…</option>
              {visits.map(v => <option key={v.id} value={v.id}>{v.visit_name}</option>)}
            </select>
            {errors.visitId && <p className="text-xs text-red-500 mt-1">{errors.visitId}</p>}
          </Field>
        </div>
      </div>

      {/* ── Company Information ── */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-100 pb-2 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-violet-600" /> Company Information
        </h3>
        <Field label="Company Name">
          <input className={inp}
            placeholder="e.g. Balfour Beatty UK, TCS, Microsoft"
            value={companyName}
            onChange={e => setCompanyName(e.target.value)} />
        </Field>
      </div>

      {/* ── Company Head — OPTIONAL ── */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-500" /> Company Head
            <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full font-normal">Optional</span>
          </h3>
          {/* Toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-xs text-gray-500">{addHead ? 'Enabled' : 'Disabled'}</span>
            <div
              onClick={() => { setAddHead(p=>!p); setErrors(e=>({...e,headName:null})); }}
              className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${addHead ? 'bg-violet-600' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${addHead ? 'translate-x-5' : 'translate-x-0.5'}`}/>
            </div>
          </label>
        </div>

        {addHead ? (
          <>
            <p className="text-xs text-gray-400">The senior representative leading the host company during this visit.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Company Head Name" required>
                <input className={`${inp} ${errors.headName ? 'border-red-400' : ''}`}
                  placeholder="e.g. Prabhu Sankar"
                  value={headName}
                  onChange={e => { setHeadName(e.target.value); setErrors(p=>({...p,headName:null})); }} />
                {errors.headName && <p className="text-xs text-red-500 mt-1">{errors.headName}</p>}
              </Field>
              <Field label="Designation">
                <input className={inp}
                  placeholder="e.g. Director, Country Head, VP"
                  value={headDesig}
                  onChange={e => setHeadDesig(e.target.value)} />
              </Field>
            </div>
          </>
        ) : (
          <p className="text-xs text-gray-400 italic py-1">
            No Company Head will be added. Toggle to enable.
          </p>
        )}
      </div>

      {/* ── Host Team Members — OPTIONAL ── */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-600" /> Host Team
            <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full text-xs font-normal">
              {members.length} row{members.length !== 1 ? 's' : ''}
            </span>
            <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full font-normal">Optional</span>
          </h3>
        </div>
        <p className="text-xs text-gray-400">Additional hosts who will accompany the company during this visit. Leave empty to skip.</p>

        {/* Column Header */}
        <div className="hidden md:grid grid-cols-12 gap-2 px-1">
          <div className="col-span-11 text-xs font-semibold text-gray-500 uppercase">Host Name</div>
          <div className="col-span-1" />
        </div>

        {/* Member Rows */}
        <div className="space-y-2">
          {members.map((m, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg p-2">
              <div className="md:col-span-11">
                <input className={inp} placeholder="Host Name (leave blank to skip)"
                  value={m.host_name}
                  onChange={e => setMember(i, 'host_name', e.target.value)} />
              </div>
              <div className="md:col-span-1 flex justify-end">
                {members.length > 1 && (
                  <button onClick={() => delMember(i)}
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {errors.members && <p className="text-xs text-red-500">{errors.members}</p>}

        {/* Add row */}
        <button onClick={addMember}
          className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-xl
                     text-gray-500 hover:border-violet-400 hover:text-violet-600 transition-colors w-full justify-center text-sm">
          <Plus className="w-4 h-4" /> Add Another Host Member
        </button>

        {/* Summary + Save */}
        <div className="pt-1 border-t border-gray-100 space-y-2">
          <div className="flex gap-3 text-xs text-gray-500">
            <span className={`flex items-center gap-1 ${addHead && headName.trim() ? 'text-amber-600 font-semibold' : 'text-gray-400'}`}>
              <Crown className="w-3 h-3"/>
              {addHead && headName.trim() ? `Company Head: ${headName}` : 'No Company Head'}
            </span>
            <span className={`flex items-center gap-1 ${validMemberCount > 0 ? 'text-violet-600 font-semibold' : 'text-gray-400'}`}>
              <Users className="w-3 h-3"/>
              {validMemberCount > 0 ? `${validMemberCount} Team Member${validMemberCount!==1?'s':''}` : 'No Team Members'}
            </span>
          </div>

          <button onClick={handleSave} disabled={saving || saved}
            className="w-full flex items-center justify-center gap-2 py-3 bg-violet-600 text-white rounded-xl
                       font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors">
            {saved
              ? <><Check className="w-5 h-5" /> Hosts Saved!</>
              : saving
                ? 'Saving…'
                : `Save ${(addHead && headName.trim() ? 1 : 0) + validMemberCount} Host${(addHead && headName.trim() ? 1 : 0) + validMemberCount !== 1 ? 's' : ''}`
            }
          </button>
        </div>
      </div>

    </div>
  );
}
