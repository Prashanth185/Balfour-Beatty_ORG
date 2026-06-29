import { useEffect, useState, useRef } from 'react';
import { X, Pencil, Camera, Trash2, Palette } from 'lucide-react';
import PhotoUpload from './PhotoUpload';

function normalizeValue(value) {
  return value == null ? '' : String(value);
}

// ─── NodeContextMenu ──────────────────────────────────────────────────────────
// Smart-positioned popup: opens near the click but always stays fully on-screen.
export function NodeContextMenu({
  node,
  position,
  employees,
  nodeColor = '',
  onClose,
  onEdit,
  onSave,
  onDelete,
}) {
  const panelRef = useRef(null);
  // clamped position — starts at raw click, adjusted after mount
  const [pos, setPos] = useState({ left: position.x, top: position.y });

  const [fields, setFields] = useState({
    employee_id: '',
    name: '',
    designation: '',
    department: '',
    manager_id: '',
    nodeColor: '',
  });
  const [photoFile,    setPhotoFile]    = useState(null);
  const [removePhoto,  setRemovePhoto]  = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');
  const fileInputRef = useRef(null);

  // Clamp position so the panel is always fully visible inside the viewport
  useEffect(() => {
    if (!panelRef.current) return;
    const { offsetWidth: w, offsetHeight: h } = panelRef.current;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const GAP = 12; // px gap from viewport edge
    let left = position.x;
    let top  = position.y;
    if (left + w + GAP > vw) left = vw - w - GAP;
    if (left < GAP)          left = GAP;
    if (top  + h + GAP > vh) top  = vh - h - GAP;
    if (top  < GAP)          top  = GAP;
    setPos({ left, top });
  }, [position]);

  useEffect(() => {
    if (!node) return;
    setFields({
      employee_id: normalizeValue(node.employee_id),
      name:        normalizeValue(node.name),
      designation: normalizeValue(node.designation),
      department:  normalizeValue(node.department),
      manager_id:  node.manager_id != null ? String(node.manager_id) : '',
      nodeColor:   nodeColor || '',
    });
    setPhotoFile(null);
    setRemovePhoto(false);
    setError('');
  }, [node, nodeColor]);

  const handleChange = (field) => (event) => {
    setFields((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSave = async () => {
    if (!onSave) { onClose?.(); return; }
    const managerId = fields.manager_id ? Number(fields.manager_id) : null;
    const updates = {
      employee_id: fields.employee_id || null,
      name:        fields.name        || null,
      designation: fields.designation || null,
      department:  fields.department  || null,
      manager_id:  managerId,
    };
    const nextColor = fields.nodeColor || null;
    try {
      setSaving(true);
      await onSave(node.id, updates, {
        photoFile,
        removePhoto,
        nodeColor: nextColor !== (nodeColor || null) ? nextColor : undefined,
      });
      onClose?.();
    } catch (err) {
      setError(err?.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setPhotoFile(file);
    setRemovePhoto(false);
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setRemovePhoto(true);
  };

  const managers = employees.filter((emp) => emp.id !== node.id);

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        ref={panelRef}
        className="absolute w-[320px] rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden"
        style={{
          left:     pos.left,
          top:      pos.top,
          maxWidth: 'calc(100vw - 24px)',
          maxHeight: 'calc(100vh - 24px)',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50 sticky top-0 z-10">
          <div>
            <p className="text-sm font-semibold text-gray-900 truncate">{node.name || 'Employee'}</p>
            <p className="text-xs text-gray-500">Node actions</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Employee ID</label>
            <input type="text" value={fields.employee_id} onChange={handleChange('employee_id')} className="input-field w-full" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Name</label>
            <input type="text" value={fields.name} onChange={handleChange('name')} className="input-field w-full" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Designation</label>
            <input type="text" value={fields.designation} onChange={handleChange('designation')} className="input-field w-full" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Department</label>
            <input type="text" value={fields.department} onChange={handleChange('department')} className="input-field w-full" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Reports To</label>
            <select value={fields.manager_id} onChange={handleChange('manager_id')} className="input-field w-full">
              <option value="">— None —</option>
              {managers.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}{emp.designation ? ` — ${emp.designation}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onEdit?.(node)}
              className="btn-secondary text-sm flex items-center justify-center gap-2">
              <Pencil className="w-4 h-4" /> Edit Employee
            </button>
            <button type="button" onClick={() => onDelete?.(node)}
              className="btn-secondary text-sm flex items-center justify-center gap-2 text-red-600 border-red-200 hover:bg-red-50">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>

          <div className="space-y-2">
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="btn-secondary text-sm w-full flex items-center justify-center gap-2">
              <Camera className="w-4 h-4" />
              Add / Change Photo
            </button>
            {(node.photo_url || photoFile) && (
              <button type="button" onClick={handleRemovePhoto}
                className="btn-secondary text-sm w-full flex items-center justify-center gap-2 text-red-600 border-red-200 hover:bg-red-50">
                <Trash2 className="w-4 h-4" /> Remove Photo
              </button>
            )}
            {photoFile   && <p className="text-xs text-green-600">Selected: {photoFile.name} — will upload on Save</p>}
            {removePhoto && <p className="text-xs text-red-600">Photo will be removed on Save.</p>}
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
              className="hidden" onChange={handlePhotoFile} />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
              <Palette className="w-3.5 h-3.5" /> Change Node Color
            </label>
            <div className="flex items-center gap-2">
              <input type="color" value={fields.nodeColor || '#2563eb'} onChange={handleChange('nodeColor')}
                className="w-10 h-9 rounded border border-gray-200 cursor-pointer" />
              <input type="text" value={fields.nodeColor} onChange={handleChange('nodeColor')}
                placeholder="#2563eb" className="input-field flex-1" />
              <button type="button" onClick={() => setFields((prev) => ({ ...prev, nodeColor: '' }))}
                className="btn-secondary text-xs">Default</button>
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50 sticky bottom-0">
          <button type="button" onClick={handleSave} disabled={saving}
            className="btn-primary flex-1 text-sm disabled:opacity-60">
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button type="button" onClick={onClose} className="btn-secondary text-sm flex-1">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── NodeEditModal ────────────────────────────────────────────────────────────
// Full-screen centered modal for editing an employee.
// Tracks photo_url locally so the PhotoUpload component sees the latest URL
// immediately after upload — without waiting for the parent to re-render.
export function NodeEditModal({ node, employees, onSave, onPhotoUpload, onPhotoRemove, onClose }) {
  const [form, setForm] = useState({
    employee_id: '',
    name:        '',
    designation: '',
    department:  '',
    manager_id:  '',
  });
  // Local photo URL — starts from node.photo_url, updated after each upload/remove
  // so PhotoUpload shows the correct server image without needing a full reload.
  const [localPhotoUrl, setLocalPhotoUrl] = useState(node?.photo_url || null);

  useEffect(() => {
    if (!node) return;
    setForm({
      employee_id: normalizeValue(node.employee_id),
      name:        normalizeValue(node.name),
      designation: normalizeValue(node.designation),
      department:  normalizeValue(node.department),
      manager_id:  node.manager_id != null ? String(node.manager_id) : '',
    });
    setLocalPhotoUrl(node.photo_url || null);
  }, [node]);

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSave = async () => {
    if (!onSave) return;
    await onSave(node.id, {
      employee_id: form.employee_id || null,
      name:        form.name        || null,
      designation: form.designation || null,
      department:  form.department  || null,
      manager_id:  form.manager_id ? Number(form.manager_id) : null,
    });
    onClose?.();
  };

  const handleUpload = async (file) => {
    if (!onPhotoUpload) return null;
    const result = await onPhotoUpload(node.id, file);
    // result may be the photo_url string or an object { photo_url }
    const url = typeof result === 'string' ? result : result?.photo_url;
    if (url) setLocalPhotoUrl(url);
    return url;
  };

  const handleRemove = async () => {
    if (!onPhotoRemove) return;
    await onPhotoRemove(node.id);
    setLocalPhotoUrl(null);
  };

  const managers = employees.filter((emp) => emp.id !== node.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Edit Employee</h2>
            <p className="text-xs text-gray-500">Update details and photo</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Employee ID</label>
              <input type="text" value={form.employee_id} onChange={handleChange('employee_id')} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Name</label>
              <input type="text" value={form.name} onChange={handleChange('name')} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Designation</label>
              <input type="text" value={form.designation} onChange={handleChange('designation')} className="input-field w-full" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Department</label>
              <input type="text" value={form.department} onChange={handleChange('department')} className="input-field w-full" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Reports To</label>
            <select value={form.manager_id} onChange={handleChange('manager_id')} className="input-field w-full">
              <option value="">— None —</option>
              {managers.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}{emp.designation ? ` — ${emp.designation}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <p className="text-sm font-semibold text-gray-900 mb-3">Profile Photo</p>
              <PhotoUpload
                name={node.name}
                photoUrl={localPhotoUrl}
                onUpload={handleUpload}
                onRemove={handleRemove}
              />
            </div>
            <div className="flex flex-col justify-between rounded-2xl border border-gray-100 p-4">
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-2">Save changes</p>
                <p className="text-xs text-gray-500">
                  Update name, designation, department, and reporting line.
                  Photos are saved immediately when you click Save Photo above.
                </p>
              </div>
              <button type="button" onClick={handleSave} className="btn-primary w-full mt-4">
                Save Employee
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── RemovePhotoModal ─────────────────────────────────────────────────────────
export function RemovePhotoModal({ employeeName, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Remove Photo</h2>
        </div>
        <div className="p-6 space-y-4 text-sm text-gray-700">
          <p>Remove the profile photo for <span className="font-semibold">{employeeName}</span>?</p>
          <p className="text-xs text-gray-500">The employee record will remain intact.</p>
        </div>
        <div className="flex items-center gap-3 px-6 pb-6">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="button" onClick={onConfirm} className="btn-primary flex-1 text-red-50 bg-red-600 hover:bg-red-700">
            Remove Photo
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── NodeDeleteModal ──────────────────────────────────────────────────────────
export function NodeDeleteModal({ node, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Delete Employee</h2>
        </div>
        <div className="p-6 space-y-4 text-sm text-gray-700">
          <p>Delete <span className="font-semibold">{node.name}</span> from the org chart?</p>
          <p className="text-xs text-gray-500">Their direct reports will be re-assigned to their manager.</p>
        </div>
        <div className="flex items-center gap-3 px-6 pb-6">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="button" onClick={() => onConfirm(node.id)}
            className="btn-primary flex-1 text-red-50 bg-red-600 hover:bg-red-700">
            Delete Employee
          </button>
        </div>
      </div>
    </div>
  );
}
