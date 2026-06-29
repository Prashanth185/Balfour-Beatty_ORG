import { useRef, useState, useEffect } from 'react';
import { Camera, Loader2, Trash2, Check } from 'lucide-react';
import { Avatar } from './common';

/**
 * PhotoUpload — two-step confirm flow
 *
 * Step 1: user picks file  → local blob preview shown, "Save Photo" button appears
 * Step 2: user clicks Save → upload executes, parent's onUpload() called,
 *                            parent updates photoUrl prop, blob discarded
 *
 * This means no upload occurs until the user explicitly confirms.
 * After save the parent receives the server URL and can refresh its state.
 */
export default function PhotoUpload({ name, photoUrl, onUpload, onRemove, disabled = false }) {
  const inputRef = useRef(null);
  const [pendingFile,  setPendingFile]  = useState(null);  // chosen but not yet saved
  const [blobPreview,  setBlobPreview]  = useState(null);  // blob: URL for pending file
  const [uploading,    setUploading]    = useState(false);
  const [removing,     setRemoving]     = useState(false);
  const [error,        setError]        = useState('');

  // When parent passes a new photoUrl (after save/reload), discard pending blob
  useEffect(() => {
    if (photoUrl && blobPreview) {
      URL.revokeObjectURL(blobPreview);
      setBlobPreview(null);
      setPendingFile(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoUrl]);

  // Revoke blob on unmount
  useEffect(() => {
    return () => { if (blobPreview) URL.revokeObjectURL(blobPreview); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please select a JPG, PNG or WebP image'); return; }
    if (file.size > 5 * 1024 * 1024)    { setError('Image must be under 5 MB'); return; }
    setError('');
    if (blobPreview) URL.revokeObjectURL(blobPreview);
    setBlobPreview(URL.createObjectURL(file));
    setPendingFile(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleSave = async () => {
    if (!pendingFile || !onUpload) return;
    setError('');
    setUploading(true);
    try {
      await onUpload(pendingFile);
      // Parent will update photoUrl prop → useEffect above discards blob
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    if (blobPreview) URL.revokeObjectURL(blobPreview);
    setBlobPreview(null);
    setPendingFile(null);
    setError('');
  };

  const handleRemove = async () => {
    if (!onRemove) return;
    setError('');
    setRemoving(true);
    try {
      await onRemove();
      if (blobPreview) { URL.revokeObjectURL(blobPreview); setBlobPreview(null); }
      setPendingFile(null);
    } catch (err) {
      setError(err.message || 'Remove failed');
    } finally {
      setRemoving(false);
    }
  };

  // Display: pending blob preview takes priority over server photoUrl
  const displayUrl = blobPreview || photoUrl || null;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Avatar */}
      <div className="relative">
        {displayUrl
          ? <img src={displayUrl} alt={name || 'Profile'} className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md" />
          : <Avatar name={name || '?'} size="xl" />}
        {(uploading || removing) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
        {pendingFile && !uploading && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center border-2 border-white" title="Not saved yet">
            <span className="text-white text-[9px] font-bold">!</span>
          </div>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={handleFileChange} disabled={disabled || uploading || removing} />

      {!pendingFile ? (
        <>
          <button type="button" onClick={() => inputRef.current?.click()}
            disabled={disabled || uploading || removing || !onUpload}
            className="btn-secondary text-sm flex items-center gap-2">
            <Camera className="w-4 h-4" />
            {photoUrl ? 'Change Photo' : 'Upload Profile Photo'}
          </button>
          {photoUrl && onRemove && (
            <button type="button" onClick={handleRemove} disabled={disabled || uploading || removing}
              className="btn-secondary text-sm flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50">
              {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {removing ? 'Removing...' : 'Remove Photo'}
            </button>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 w-full">
          <p className="text-xs text-amber-600 font-medium text-center">Photo selected — click Save to upload</p>
          <div className="flex gap-2 w-full">
            <button type="button" onClick={handleSave} disabled={uploading}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">
              {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Check className="w-4 h-4" /> Save Photo</>}
            </button>
            <button type="button" onClick={handleCancel} disabled={uploading}
              className="flex-1 flex items-center justify-center px-3 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-xs text-gray-400 text-center">Saved permanently in database</p>
    </div>
  );
}
