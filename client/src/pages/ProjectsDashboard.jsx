/**
 * ProjectsDashboard.jsx
 *
 * The multi-project home page. Shows all org chart projects with search,
 * create, open, rename, duplicate, archive, and delete capabilities.
 *
 * This is ADDITIVE — does not touch any existing page or component.
 */

import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FolderPlus, Search, MousePointer2, GitBranch, MoreVertical,
  Pencil, Copy, Archive, Trash2, RefreshCw, FolderOpen,
  Clock, X, Check, FolderArchive, Plus,
} from 'lucide-react';
import { projects as projectsApi } from '../api/client';
import { LoadingSpinner } from '../components/common';

// ── Relative time helper ──────────────────────────────────────────────────────
function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ── Create Project Modal ──────────────────────────────────────────────────────
function CreateProjectModal({ onClose, onCreate }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [projectId, setProjectId] = useState(null);
  const [description, setDescription] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [businessUnit, setBusinessUnit] = useState('');
  const [country, setCountry] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('traditional');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const createDraftProject = async () => {
    if (!name.trim()) {
      setError('Project name is required');
      return null;
    }
    if (projectId) return projectId;
    const proj = await projectsApi.create({
      name: name.trim(),
      type,
      description: description.trim() || null,
      organization_name: organizationName.trim() || null,
      business_unit: businessUnit.trim() || null,
      country: country.trim() || null,
      location: location.trim() || null,
      chart_type: type === 'traditional' ? 'traditional' : 'traditional',
    });
    setProjectId(proj.project_id);
    return proj.project_id;
  };

  const handleFileSelected = async (selectedFile) => {
    if (!selectedFile) return;
    const ext = (selectedFile.name || '').toLowerCase();
    if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
      setError('Only .xlsx and .xls files are supported');
      return;
    }
    setFile(selectedFile);
    setError('');
    try {
      const pid = await createDraftProject();
      if (!pid) return;
      const validation = await projectsApi.trad.validateImport(pid, selectedFile);
      setPreview(validation);
      setStep(3);
    } catch (err) {
      setError(err.message || 'Excel validation failed');
      setPreview(null);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Project name is required'); return; }
    if (type === 'manual') {
      setCreating(true); setError('');
      try {
        const proj = await createDraftProject();
        if (!proj) return;
        onCreate({ project_id: projectId || proj, name: name.trim(), type, status: 'active' });
        onClose();
      } catch (err) {
        setError(err.message || 'Failed to create project');
      } finally {
        setCreating(false);
      }
      return;
    }
    if (!file) { setError('Please upload an Excel file to create the project'); return; }
    setCreating(true); setError('');
    try {
      const pid = await createDraftProject();
      if (!pid) return;
      await projectsApi.trad.importExcel(pid, file, 'replace');
      onCreate({ project_id: pid, name: name.trim(), type, status: 'active' });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Create New Project</h2>
            <p className="text-sm text-gray-500 mt-0.5">Create a project, upload Excel data, and generate a traditional org chart</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {[1, 2, 3].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${step >= item ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {item}
                </div>
                <span className={step >= item ? 'text-gray-900 font-medium' : ''}>{['Project Info', 'Upload Excel', 'Preview & Save'][item - 1]}</span>
                {item < 3 && <span className="text-gray-300">→</span>}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleCreate} className="px-6 py-5 space-y-5">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Project Name *</label>
                <input ref={inputRef} type="text" value={name} onChange={(e) => { setName(e.target.value); setError(''); }} placeholder="e.g. GCC 2026" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows="3" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" placeholder="Optional project summary" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Organization Name</label>
                  <input type="text" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Business Unit</label>
                  <input type="text" value={businessUnit} onChange={(e) => setBusinessUnit(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Country</label>
                  <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
                  <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Project Type</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button type="button" onClick={() => setType('traditional')} className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${type === 'traditional' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className={`h-10 w-10 rounded-xl ${type === 'traditional' ? 'bg-emerald-200' : 'bg-gray-100'} flex items-center justify-center`}>
                      <GitBranch className={`w-5 h-5 ${type === 'traditional' ? 'text-emerald-700' : 'text-gray-500'}`} />
                    </div>
                    <div>
                      <p className={`font-semibold text-sm ${type === 'traditional' ? 'text-emerald-800' : 'text-gray-700'}`}>Traditional Org Chart</p>
                      <p className="text-xs text-gray-400">Auto-generated hierarchy from Excel</p>
                    </div>
                  </button>
                  <button type="button" onClick={() => setType('manual')} className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${type === 'manual' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className={`h-10 w-10 rounded-xl ${type === 'manual' ? 'bg-primary-200' : 'bg-gray-100'} flex items-center justify-center`}>
                      <MousePointer2 className={`w-5 h-5 ${type === 'manual' ? 'text-primary-700' : 'text-gray-500'}`} />
                    </div>
                    <div>
                      <p className={`font-semibold text-sm ${type === 'manual' ? 'text-primary-800' : 'text-gray-700'}`}>Manual Org Chart</p>
                      <p className="text-xs text-gray-400">Flexible canvas editing</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className={`rounded-2xl border-2 border-dashed p-6 text-center transition-all ${dragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-gray-50'}`}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFileSelected(e.dataTransfer.files?.[0]); }}>
                <p className="text-sm font-semibold text-gray-900">Upload Excel file</p>
                <p className="text-sm text-gray-500 mt-1">Browse or drag and drop .xlsx or .xls files</p>
                <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700">
                  <Plus className="w-4 h-4" />
                  Browse file
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => handleFileSelected(e.target.files?.[0])} />
                </label>
                {file && <p className="mt-3 text-sm text-gray-600">Selected: {file.name}</p>}
              </div>
            </div>
          )}

          {step === 3 && preview && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-800">Excel preview ready</p>
                <p className="text-sm text-emerald-700 mt-1">This import will create a project-scoped traditional chart with the following summary.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">Employees found</p>
                  <p className="text-lg font-semibold text-gray-900">{preview.total || 0}</p>
                </div>
                <div className="rounded-xl border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">Managers</p>
                  <p className="text-lg font-semibold text-gray-900">{preview.relationshipCount || 0}</p>
                </div>
                <div className="rounded-xl border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">Root nodes</p>
                  <p className="text-lg font-semibold text-gray-900">{preview.rootCount || 0}</p>
                </div>
                <div className="rounded-xl border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">Duplicates</p>
                  <p className="text-lg font-semibold text-gray-900">{preview.duplicateIds?.length || 0}</p>
                </div>
              </div>
              {preview.preview?.length > 0 && (
                <div className="rounded-xl border border-gray-200">
                  <div className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-700">Sample rows</div>
                  <div className="divide-y divide-gray-100">
                    {preview.preview.map((row, idx) => (
                      <div key={idx} className="flex items-center justify-between px-4 py-3 text-sm text-gray-600">
                        <span>{row.name}</span>
                        <span className="text-xs text-gray-400">{row.department || '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-between gap-3 pt-1">
            <button type="button" onClick={() => { if (step > 1) setStep(step - 1); else onClose(); }} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              {step === 1 ? 'Cancel' : 'Back'}
            </button>
            {step < 3 ? (
              <button type="button" onClick={async () => {
                if (step === 1) {
                  if (!name.trim()) { setError('Project name is required'); return; }
                  if (type === 'manual') {
                    setCreating(true); setError('');
                    try {
                      const pid = await createDraftProject();
                      if (!pid) return;
                      onCreate({ project_id: pid, name: name.trim(), type, status: 'active' });
                      onClose();
                    } catch (err) {
                      setError(err.message || 'Failed to create project');
                    } finally {
                      setCreating(false);
                    }
                  } else {
                    setStep(2);
                  }
                } else if (step === 2 && file) {
                  setStep(3);
                } else {
                  setError('Please upload a file to continue');
                }
              }} className="px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors">
                Continue
              </button>
            ) : (
              <button type="submit" disabled={creating || !name.trim() || !file} className="px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                {creating ? <><RefreshCw className="w-4 h-4 animate-spin" />Creating…</> : <><Plus className="w-4 h-4" />Create & Save Project</>}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Rename Modal ──────────────────────────────────────────────────────────────
function RenameModal({ project, onClose, onRename }) {
  const [name, setName] = useState(project.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 50); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    try {
      const updated = await projectsApi.rename(project.project_id, name.trim());
      onRename(updated);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to rename');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Rename Project</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving || !name.trim()} className="flex-1 px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirmation Modal ─────────────────────────────────────────────────
function DeleteModal({ project, onClose, onDelete }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await projectsApi.delete(project.project_id);
      onDelete(project.project_id);
      onClose();
    } catch (err) {
      alert(err.message || 'Failed to delete project');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Delete Project</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <span className="font-semibold text-gray-900">"{project.name}"</span>?
            All chart data, nodes, connections and share links will be permanently removed.
            This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {deleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              {deleting ? 'Deleting…' : 'Delete Project'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Project Card Action Menu ──────────────────────────────────────────────────
function ActionMenu({ project, onRename, onDuplicate, onArchive, onDelete, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const isArchived = project.status === 'archived';

  const actions = [
    { icon: Pencil, label: 'Rename', onClick: () => { onRename(); onClose(); }, color: 'text-gray-700' },
    { icon: Copy, label: 'Duplicate', onClick: () => { onDuplicate(); onClose(); }, color: 'text-gray-700' },
    {
      icon: isArchived ? RefreshCw : Archive,
      label: isArchived ? 'Restore' : 'Archive',
      onClick: () => { onArchive(); onClose(); },
      color: isArchived ? 'text-emerald-600' : 'text-amber-600',
    },
    { icon: Trash2, label: 'Delete', onClick: () => { onDelete(); onClose(); }, color: 'text-red-600' },
  ];

  return (
    <div
      ref={ref}
      className="absolute right-0 top-8 z-30 bg-white rounded-xl shadow-xl border border-gray-100 py-1 w-44 overflow-hidden"
    >
      {actions.map(({ icon: Icon, label, onClick, color }) => (
        <button
          key={label}
          type="button"
          onClick={onClick}
          className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${color}`}
        >
          <Icon className="w-4 h-4" />
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Project Card ──────────────────────────────────────────────────────────────
function ProjectCard({ project, onOpen, onRename, onDuplicate, onArchive, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isManual = project.type === 'manual';
  const isArchived = project.status === 'archived';
  const summaryItems = [
    { label: 'Employees', value: project.employee_count ?? 0 },
    { label: 'Departments', value: project.department_count ?? 0 },
    { label: 'Managers', value: project.manager_count ?? 0 },
  ];

  return (
    <div className={`relative bg-white rounded-2xl border transition-all group ${
      isArchived
        ? 'border-gray-200 opacity-70'
        : 'border-gray-200 hover:border-primary-300 hover:shadow-md'
    }`}>
      <button
        type="button"
        onClick={() => !isArchived && onOpen(project)}
        className={`w-full text-left p-5 ${isArchived ? 'cursor-default' : 'cursor-pointer'}`}
        disabled={isArchived}
      >
        <div className="flex items-start justify-between mb-3">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
            isManual ? 'bg-primary-100 text-primary-700' : 'bg-emerald-100 text-emerald-700'
          }`}>
            {isManual
              ? <MousePointer2 className="w-3.5 h-3.5" />
              : <GitBranch className="w-3.5 h-3.5" />}
            {isManual ? 'Manual' : 'Traditional'}
          </div>
          {isArchived && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-amber-100 text-amber-700">
              <Archive className="w-3 h-3" />Archived
            </span>
          )}
        </div>

        <p className="font-bold text-gray-900 text-base mb-1 leading-snug pr-6">{project.name}</p>
        <p className="text-xs text-gray-400 font-mono mb-3">{project.project_id}</p>
        {(project.organization_name || project.business_unit || project.location) && (
          <p className="text-sm text-gray-500 mb-3 line-clamp-2">
            {[project.organization_name, project.business_unit, project.location].filter(Boolean).join(' • ')}
          </p>
        )}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {summaryItems.map((item) => (
            <div key={item.label} className="rounded-xl bg-gray-50 px-2 py-2 text-center">
              <p className="text-[11px] text-gray-400">{item.label}</p>
              <p className="text-sm font-semibold text-gray-700">{item.value}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Clock className="w-3.5 h-3.5" />
          <span>Updated {relativeTime(project.updated_at)}</span>
        </div>
      </button>

      {/* Action menu button */}
      <div className="absolute top-4 right-4">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Project actions"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        {menuOpen && (
          <ActionMenu
            project={project}
            onRename={onRename}
            onDuplicate={onDuplicate}
            onArchive={onArchive}
            onDelete={onDelete}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </div>

      {/* Open button (hover) */}
      {!isArchived && (
        <div className="px-5 pb-5 pt-0">
          <button
            type="button"
            onClick={() => onOpen(project)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-gray-50 hover:bg-primary-50 hover:text-primary-700 text-gray-500 text-sm font-medium transition-colors border border-gray-100 hover:border-primary-200"
          >
            <FolderOpen className="w-4 h-4" />
            Open Project
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProjectsDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [projectList, setProjectList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [duplicating, setDuplicating] = useState(null);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await projectsApi.list({ status: showArchived ? 'archived' : 'active' });
      setProjectList(data);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProjects(); }, [showArchived]);
  useEffect(() => {
    if (location.search.includes('new=1')) {
      setShowCreateModal(true);
    }
  }, [location.search]);

  // Filter by search
  const filtered = searchQuery.trim()
    ? projectList.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.project_id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : projectList;

  const handleOpen = (project) => {
    if (project.type === 'manual') {
      navigate(`/projects/${project.project_id}/org-chart`);
    } else {
      navigate(`/projects/${project.project_id}/traditional-org-chart`);
    }
  };

  const handleDuplicate = async (project) => {
    setDuplicating(project.project_id);
    try {
      const copy = await projectsApi.duplicate(project.project_id);
      setProjectList((prev) => [copy, ...prev]);
    } catch (err) {
      alert(err.message || 'Failed to duplicate project');
    } finally {
      setDuplicating(null);
    }
  };

  const handleArchive = async (project) => {
    try {
      await projectsApi.archive(project.project_id);
      setProjectList((prev) => prev.filter((p) => p.project_id !== project.project_id));
    } catch (err) {
      alert(err.message || 'Failed to archive project');
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">My Projects</h1>
          <p className="text-sm text-gray-500 mt-1">Manage all your org chart projects</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition-colors shadow-sm"
        >
          <FolderPlus className="w-4 h-4" />
          New Project
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3 mb-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Active Projects</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{projectList.filter((p) => p.status !== 'archived').length}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Archived</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{projectList.filter((p) => p.status === 'archived').length}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Employees Imported</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{projectList.reduce((sum, p) => sum + (Number(p.employee_count) || 0), 0)}</p>
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search projects by name or ID…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowArchived((v) => !v)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
            showArchived
              ? 'bg-amber-50 border-amber-200 text-amber-700'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <FolderArchive className="w-4 h-4" />
          {showArchived ? 'Showing Archived' : 'Show Archived'}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSpinner message="Loading projects…" />
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          {searchQuery ? (
            <>
              <Search className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No projects match "{searchQuery}"</p>
              <p className="text-sm text-gray-400 mt-1">Try a different search term</p>
            </>
          ) : showArchived ? (
            <>
              <FolderArchive className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No archived projects</p>
            </>
          ) : (
            <>
              <FolderPlus className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">No projects yet</p>
              <p className="text-sm text-gray-400 mt-1 mb-6">Create your first org chart project to get started</p>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition-colors"
              >
                <FolderPlus className="w-4 h-4" />
                Create First Project
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => (
            <div key={project.project_id} className="relative">
              {duplicating === project.project_id && (
                <div className="absolute inset-0 z-10 bg-white/80 rounded-2xl flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 text-primary-600 animate-spin" />
                </div>
              )}
              <ProjectCard
                project={project}
                onOpen={handleOpen}
                onRename={() => setRenameTarget(project)}
                onDuplicate={() => handleDuplicate(project)}
                onArchive={() => handleArchive(project)}
                onDelete={() => setDeleteTarget(project)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {!loading && filtered.length > 0 && (
        <p className="text-xs text-gray-400 text-center mt-6">
          {filtered.length} project{filtered.length !== 1 ? 's' : ''}
          {searchQuery ? ` matching "${searchQuery}"` : ''}
        </p>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onCreate={(proj) => {
            setProjectList((prev) => [proj, ...prev]);
            if (proj.type === 'manual') {
              navigate(`/projects/${proj.project_id}/org-chart`);
            } else {
              navigate(`/projects/${proj.project_id}/traditional-org-chart`);
            }
          }}
        />
      )}
      {renameTarget && (
        <RenameModal
          project={renameTarget}
          onClose={() => setRenameTarget(null)}
          onRename={(updated) => {
            setProjectList((prev) => prev.map((p) => p.project_id === updated.project_id ? updated : p));
          }}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          project={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDelete={(pid) => setProjectList((prev) => prev.filter((p) => p.project_id !== pid))}
        />
      )}
    </div>
  );
}
