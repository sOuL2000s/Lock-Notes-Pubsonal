// client/src/components/NoteViewer.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import PasswordModal from './PasswordModal';
import { api } from '../services/api';
import { renderMarkdown } from '../lib/markdown';
import {
  Edit, Trash2, Lock, Unlock, Calendar, ArrowLeft,
  History, Share2, Copy, Check, X, RotateCcw, Link2Off,
  Download, FileText, FileCode, FileType,
} from 'lucide-react';
import { exportAsMarkdown, exportAsText, exportAsPdf } from '../lib/exportNote';

function NoteViewer({ note, preVerifiedPassword = '', onEdit, onDelete, onBack }) {
  const [loading, setLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordAction, setPasswordAction] = useState('view');
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [viewPassword, setViewPassword] = useState('');

  // Version history
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState(null);
  const [restoringId, setRestoringId] = useState(null);

  // Share link
  const [showShare, setShowShare] = useState(false);
  const [shareToken, setShareToken] = useState('');
  const [shareExpiresAt, setShareExpiresAt] = useState(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [shareExpiresInDays, setShareExpiresInDays] = useState(7);

  // Export
  const [showExport, setShowExport] = useState(false);
  const [exportStatus, setExportStatus] = useState(null); // string | null
  const [exportError, setExportError] = useState(null);
  const contentRef = useRef(null);

  // Rendered HTML (memoized on content change)
  const renderedHtml = React.useMemo(
    () => renderMarkdown(note.content || '', { interactiveTasks: false }),
    [note.content]
  );

  useEffect(() => {
    if (preVerifiedPassword) handleAutoVerify(preVerifiedPassword);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preVerifiedPassword]);

  useEffect(() => {
    if (!preVerifiedPassword) {
      setIsPasswordVerified(false);
      setViewPassword('');
      setAttempts(0);
    }
  }, [note?._id, preVerifiedPassword]);

  // Reset sub-panels when note changes
  useEffect(() => {
    setShowVersions(false);
    setShowShare(false);
    setShowExport(false);
    setVersions([]);
    setShareToken('');
    setShareExpiresAt(null);
    setShareError(null);
    setVersionsError(null);
    setCopied(false);
    setExportStatus(null);
    setExportError(null);
  }, [note?._id]);

  const handleAutoVerify = async (password) => {
    if (!note?._id) return;
    try {
      await api.verifyPassword(note._id, password);
      setIsPasswordVerified(true);
      setViewPassword(password);
      setAttempts(0);
    } catch (error) {
      setIsPasswordVerified(false);
      setViewPassword('');
      setShowPasswordModal(true);
    }
  };

  const verifyPassword = async (password) => {
    try {
      await api.verifyPassword(note._id, password);
      return true;
    } catch (error) {
      if (error.message === 'INVALID_PASSWORD') throw new Error('Invalid password');
      throw error;
    }
  };

  const handlePasswordVerify = async (password) => {
    try {
      await verifyPassword(password);
      setIsPasswordVerified(true);
      setViewPassword(password);
      setShowPasswordModal(false);
      setAttempts(0);
      if (passwordAction === 'edit') onEdit(note, password);
      else if (passwordAction === 'delete') await onDelete(note._id, password);
      return true;
    } catch (error) {
      setAttempts((prev) => prev + 1);
      throw error;
    }
  };

  const handleViewRequest = () => {
    setPasswordAction('view');
    setShowPasswordModal(true);
  };

  const handleEditClick = () => {
    if (!isPasswordVerified) {
      setPasswordAction('edit');
      setShowPasswordModal(true);
    } else {
      onEdit(note, viewPassword);
    }
  };

  const handleDeleteClick = () => {
    if (!isPasswordVerified) {
      setPasswordAction('delete');
      setShowPasswordModal(true);
    } else {
      handleDelete(viewPassword);
    }
  };

  const handleDelete = async (password) => {
    setLoading(true);
    try {
      await onDelete(note._id, password);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const handleLocked = () => {
    setIsLocked(true);
    setTimeout(() => {
      setIsLocked(false);
      setAttempts(0);
    }, 30000);
  };

  // ---------- Version history ----------

  const loadVersions = useCallback(async () => {
    setVersionsLoading(true);
    setVersionsError(null);
    try {
      const data = await api.getVersions(note._id);
      setVersions(data.versions || []);
    } catch (err) {
      setVersionsError(err.response?.data?.error || err.message || 'VERSIONS_FAILED');
    } finally {
      setVersionsLoading(false);
    }
  }, [note._id]);

  const handleToggleVersions = () => {
    if (!showVersions) {
      setShowVersions(true);
      if (versions.length === 0 && !versionsLoading) loadVersions();
    } else {
      setShowVersions(false);
    }
  };

  const handleRestore = async (versionId) => {
    if (!isPasswordVerified) {
      setPasswordAction('restore');
      setShowPasswordModal(true);
      return;
    }
    setRestoringId(versionId);
    try {
      const updated = await api.restoreVersion(note._id, versionId, viewPassword);
      window.location.reload();
      void updated;
    } catch (err) {
      setVersionsError(err.response?.data?.error || err.message || 'RESTORE_FAILED');
    } finally {
      setRestoringId(null);
    }
  };

  // ---------- Share link ----------

  const handleToggleShare = () => {
    if (!showShare) {
      setShowShare(true);
      setShareError(null);
    } else {
      setShowShare(false);
    }
  };

  const handleGenerateShareLink = async () => {
    if (!isPasswordVerified) {
      setPasswordAction('share');
      setShowPasswordModal(true);
      return;
    }
    setShareLoading(true);
    setShareError(null);
    try {
      const data = await api.createShareLink(note._id, viewPassword, shareExpiresInDays);
      setShareToken(data.token);
      setShareExpiresAt(data.expiresAt);
    } catch (err) {
      setShareError(err.response?.data?.error || err.message || 'SHARE_FAILED');
    } finally {
      setShareLoading(false);
    }
  };

  const handleRevokeShareLink = async () => {
    if (!isPasswordVerified) return;
    setShareLoading(true);
    setShareError(null);
    try {
      await api.revokeShareLink(note._id, viewPassword);
      setShareToken('');
      setShareExpiresAt(null);
    } catch (err) {
      setShareError(err.response?.data?.error || err.message || 'REVOKE_FAILED');
    } finally {
      setShareLoading(false);
    }
  };

  const shareUrl = shareToken
    ? `${window.location.origin}/s/${shareToken}`
    : '';

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      const el = document.createElement('textarea');
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (err) { /* ignore */ }
      document.body.removeChild(el);
    }
  };

  // ---------- Export ----------

  const handleToggleExport = () => {
    setShowExport((v) => !v);
    setExportError(null);
    setExportStatus(null);
  };

  const handleExportMarkdown = () => {
    try {
      exportAsMarkdown(note);
    } catch (err) {
      setExportError(err.message || 'EXPORT_FAILED');
    }
  };

  const handleExportText = () => {
    try {
      exportAsText(note);
    } catch (err) {
      setExportError(err.message || 'EXPORT_FAILED');
    }
  };

  const handleExportPdf = async () => {
    setExportError(null);
    try {
      await exportAsPdf(note, contentRef.current, (msg) => setExportStatus(msg));
      setExportStatus('DONE');
      setTimeout(() => setExportStatus(null), 2000);
    } catch (err) {
      setExportError(err.message || 'PDF_EXPORT_FAILED');
      setExportStatus(null);
    }
  };

  // ---------- Locked state ----------

  if (!isPasswordVerified) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <button onClick={onBack} style={styles.backButton}>
            <ArrowLeft size={16} style={{ marginRight: '8px' }} />
            BACK
          </button>

          <div style={styles.lockContainer}>
            <Lock size={48} style={styles.lockIcon} />
            <h3 style={styles.lockTitle}>// ENCRYPTED_NOTE</h3>
            <p style={styles.lockDescription}>[ DECRYPTION_KEY_REQUIRED ]</p>
            <button onClick={handleViewRequest} style={styles.unlockButton}>
              <Unlock size={16} style={{ marginRight: '8px' }} />
              DECRYPT_NOTE
            </button>
          </div>
        </div>

        <PasswordModal
          isOpen={showPasswordModal}
          onClose={() => {
            setShowPasswordModal(false);
            setPasswordAction('view');
          }}
          onVerify={handlePasswordVerify}
          noteTitle={note?.title}
          action="view"
          attempts={attempts}
          maxAttempts={5}
          onLocked={handleLocked}
        />
      </div>
    );
  }

  // ---------- Unlocked view ----------

  return (
    <>
      <div style={styles.container}>
        <div style={styles.card}>
          <button onClick={onBack} style={styles.backButton}>
            <ArrowLeft size={16} style={{ marginRight: '8px' }} />
            BACK
          </button>

          <div style={styles.noteHeader}>
            <h2 style={styles.title}>{note.title}</h2>
            <span style={styles.verifiedBadge}>
              <Unlock size={12} style={{ marginRight: '4px' }} />
              DECRYPTED
            </span>
          </div>

          <div style={styles.meta}>
            <span style={styles.date}>
              <Calendar size={14} style={{ marginRight: '6px' }} />
              CREATED: {new Date(note.createdAt).toLocaleDateString()}
            </span>
            {note.updatedAt && note.updatedAt !== note.createdAt && (
              <span style={styles.date}>
                UPDATED: {new Date(note.updatedAt).toLocaleDateString()}
              </span>
            )}
            {typeof note.version === 'number' && (
              <span style={styles.date}>V{note.version}</span>
            )}
            <span style={styles.protected}>🔒 ENCRYPTED</span>
          </div>

          <div
            ref={contentRef}
            style={styles.content}
            className="note-preview"
            dangerouslySetInnerHTML={{ __html: renderedHtml || '<em>Empty note</em>' }}
          />

          <div style={styles.subActions}>
            <button
              type="button"
              onClick={handleToggleVersions}
              style={styles.subButton}
            >
              <History size={14} style={{ marginRight: '6px' }} />
              {showVersions ? 'HIDE_HISTORY' : 'VERSION_HISTORY'}
            </button>
            <button
              type="button"
              onClick={handleToggleShare}
              style={styles.subButton}
            >
              <Share2 size={14} style={{ marginRight: '6px' }} />
              {showShare ? 'HIDE_SHARE' : 'SHARE_LINK'}
            </button>
            <button
              type="button"
              onClick={handleToggleExport}
              style={styles.subButton}
            >
              <Download size={14} style={{ marginRight: '6px' }} />
              {showExport ? 'HIDE_EXPORT' : 'EXPORT'}
            </button>
          </div>

          {showVersions && (
            <div style={styles.panel}>
              <div style={styles.panelHeader}>
                <span style={styles.panelTitle}>// VERSION_HISTORY</span>
                <button onClick={() => setShowVersions(false)} style={styles.panelClose}>
                  <X size={14} />
                </button>
              </div>

              {versionsLoading && (
                <p style={styles.panelHint}>LOADING_VERSIONS…</p>
              )}

              {versionsError && (
                <p style={styles.panelError}>⚠️ {versionsError}</p>
              )}

              {!versionsLoading && !versionsError && versions.length === 0 && (
                <p style={styles.panelHint}>
                  [ NO_PREVIOUS_VERSIONS — SAVES_APPEAR_HERE_ONCE_YOU_EDIT_THIS_NOTE ]
                </p>
              )}

              {versions.map((v) => (
                <div key={v._id} style={styles.versionRow}>
                  <div style={styles.versionMeta}>
                    <span style={styles.versionTitle}>{v.title}</span>
                    <span style={styles.versionTime}>
                      V{v.version} · {new Date(v.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRestore(v._id)}
                    disabled={restoringId === v._id}
                    style={styles.restoreButton}
                    title="Restore this version"
                  >
                    <RotateCcw size={12} style={{ marginRight: '4px' }} />
                    {restoringId === v._id ? 'RESTORING…' : 'RESTORE'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {showShare && (
            <div style={styles.panel}>
              <div style={styles.panelHeader}>
                <span style={styles.panelTitle}>// SHARE_LINK</span>
                <button onClick={() => setShowShare(false)} style={styles.panelClose}>
                  <X size={14} />
                </button>
              </div>

              <p style={styles.panelHint}>
                [ GENERATES_A_READ-ONLY_LINK_THAT_WORKS_WITHOUT_THE_NOTE_PASSWORD ]
              </p>

              {shareError && <p style={styles.panelError}>⚠️ {shareError}</p>}

              {!shareToken ? (
                <div style={styles.shareRow}>
                  <label style={styles.shareLabel}>EXPIRES IN (DAYS)</label>
                  <select
                    value={shareExpiresInDays}
                    onChange={(e) => setShareExpiresInDays(parseInt(e.target.value, 10))}
                    style={styles.shareSelect}
                  >
                    <option value={1}>1</option>
                    <option value={3}>3</option>
                    <option value={7}>7</option>
                    <option value={14}>14</option>
                    <option value={30}>30</option>
                    <option value={90}>90</option>
                  </select>
                  <button
                    onClick={handleGenerateShareLink}
                    disabled={shareLoading}
                    style={styles.sharePrimary}
                  >
                    {shareLoading ? 'GENERATING…' : 'GENERATE_LINK'}
                  </button>
                </div>
              ) : (
                <div style={styles.shareResult}>
                  <div style={styles.shareUrlBox}>
                    <input
                      type="text"
                      value={shareUrl}
                      readOnly
                      onFocus={(e) => e.target.select()}
                      style={styles.shareUrlInput}
                    />
                    <button onClick={handleCopy} style={styles.copyButton}>
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                  {shareExpiresAt && (
                    <p style={styles.panelHint}>
                      EXPIRES: {new Date(shareExpiresAt).toLocaleString()}
                    </p>
                  )}
                  <button
                    onClick={handleRevokeShareLink}
                    disabled={shareLoading}
                    style={styles.revokeButton}
                  >
                    <Link2Off size={12} style={{ marginRight: '4px' }} />
                    {shareLoading ? 'REVOKING…' : 'REVOKE_LINK'}
                  </button>
                </div>
              )}
            </div>
          )}

          {showExport && (
            <div style={styles.panel}>
              <div style={styles.panelHeader}>
                <span style={styles.panelTitle}>// EXPORT_NOTE</span>
                <button onClick={() => setShowExport(false)} style={styles.panelClose}>
                  <X size={14} />
                </button>
              </div>

              <p style={styles.panelHint}>
                [ DOWNLOAD_THIS_NOTE_AS_A_FILE ]
              </p>

              {exportError && <p style={styles.panelError}>⚠️ {exportError}</p>}
              {exportStatus && !exportError && (
                <p style={styles.panelHint}>{exportStatus}</p>
              )}

              <div style={styles.exportRow}>
                <button
                  type="button"
                  onClick={handleExportMarkdown}
                  style={styles.exportButton}
                  title="Download as Markdown (.md)"
                >
                  <FileCode size={16} style={{ marginRight: '6px' }} />
                  MARKDOWN
                </button>
                <button
                  type="button"
                  onClick={handleExportText}
                  style={styles.exportButton}
                  title="Download as plain text (.txt)"
                >
                  <FileText size={16} style={{ marginRight: '6px' }} />
                  TEXT
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={!!exportStatus && exportStatus !== 'DONE'}
                  style={styles.exportButtonPrimary}
                  title="Download as PDF via browser print dialog"
                >
                  <FileType size={16} style={{ marginRight: '6px' }} />
                  {exportStatus && exportStatus !== 'DONE' ? exportStatus : 'PDF'}
                </button>
              </div>
            </div>
          )}

          <div style={styles.actions}>
            <button onClick={handleEditClick} style={styles.editButton} disabled={loading}>
              <Edit size={16} style={{ marginRight: '8px' }} />
              EDIT_NOTE
            </button>
            <button onClick={handleDeleteClick} style={styles.deleteButton} disabled={loading}>
              {loading ? 'PROCESSING...' : (
                <>
                  <Trash2 size={16} style={{ marginRight: '8px' }} />
                  DELETE_NOTE
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <PasswordModal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setPasswordAction('view');
        }}
        onVerify={handlePasswordVerify}
        noteTitle={note?.title}
        action={passwordAction}
        attempts={attempts}
        maxAttempts={5}
        onLocked={handleLocked}
      />
    </>
  );
}

const styles = {
  container: {
    padding: '20px 0',
    animation: 'fadeIn var(--t-base) both',
    width: '100%',
  },
  card: {
    backgroundColor: 'var(--bg-elev)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: 'clamp(24px, 4vw, 40px)',
    boxShadow: 'var(--shadow-1)',
    maxWidth: '800px',
    margin: '0 auto',
    width: '100%',
  },
  backButton: {
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--accent)',
    fontSize: 'clamp(0.8rem, 1.5vw, 0.9rem)',
    fontWeight: '600',
    cursor: 'pointer',
    padding: '8px 16px',
    marginBottom: '20px',
    borderRadius: 'var(--radius-sm)',
    transition: 'all var(--t-fast)',
    fontFamily: 'var(--font-mono)',
    display: 'inline-flex',
    alignItems: 'center',
  },
  noteHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '12px',
  },
  title: {
    color: 'var(--accent)',
    fontSize: 'clamp(1.5rem, 4vw, 2.2rem)',
    fontWeight: '700',
    margin: 0,
    wordBreak: 'break-word',
    fontFamily: 'var(--font-mono)',
  },
  verifiedBadge: {
    backgroundColor: 'var(--surface-2)',
    color: 'var(--accent)',
    padding: '4px 12px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.7rem',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
    whiteSpace: 'nowrap',
    border: '1px solid var(--border-strong)',
    display: 'flex',
    alignItems: 'center',
  },
  meta: {
    display: 'flex',
    gap: 'clamp(10px, 2vw, 20px)',
    flexWrap: 'wrap',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '1px solid var(--border)',
  },
  date: {
    color: 'var(--text-faint)',
    fontSize: 'clamp(0.7rem, 1.2vw, 0.8rem)',
    fontFamily: 'var(--font-mono)',
    display: 'flex',
    alignItems: 'center',
  },
  protected: {
    backgroundColor: 'var(--warning-soft)',
    color: 'var(--warning)',
    padding: '2px 12px',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'clamp(0.6rem, 1vw, 0.7rem)',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
    border: '1px solid var(--warning)',
  },
  content: {
    marginBottom: '30px',
    lineHeight: '1.8',
    color: 'var(--text)',
    fontSize: 'clamp(0.95rem, 1.5vw, 1.05rem)',
    fontFamily: 'var(--font-mono)',
  },
  subActions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    borderTop: '1px solid var(--border)',
    paddingTop: '16px',
    marginBottom: '4px',
  },
  subButton: {
    background: 'none',
    border: '1px dashed var(--border-strong)',
    color: 'var(--accent)',
    padding: '8px 14px',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '1px',
    display: 'inline-flex',
    alignItems: 'center',
    transition: 'all var(--t-fast)',
  },
  panel: {
    marginTop: '16px',
    padding: '16px',
    background: 'var(--surface-2)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-md)',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  panelTitle: {
    color: 'var(--accent)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8rem',
    letterSpacing: '1px',
    fontWeight: '700',
  },
  panelClose: {
    background: 'none',
    border: '1px solid var(--border)',
    color: 'var(--accent)',
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: 'var(--radius-sm)',
  },
  panelHint: {
    color: 'var(--text-faint)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.72rem',
    margin: '6px 0',
    letterSpacing: '0.5px',
  },
  panelError: {
    color: 'var(--danger)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.75rem',
    margin: '6px 0',
  },
  versionRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 10px',
    borderTop: '1px solid var(--border)',
    flexWrap: 'wrap',
  },
  versionMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  versionTitle: {
    color: 'var(--text)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.85rem',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '380px',
  },
  versionTime: {
    color: 'var(--text-faint)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.7rem',
  },
  restoreButton: {
    background: 'var(--surface-2)',
    color: 'var(--accent)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    padding: '6px 12px',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.7rem',
    letterSpacing: '1px',
    display: 'inline-flex',
    alignItems: 'center',
    transition: 'all var(--t-fast)',
  },
  shareRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    marginTop: '8px',
  },
  shareLabel: {
    color: 'var(--text-dim)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.72rem',
    letterSpacing: '1px',
  },
  shareSelect: {
    padding: '8px 10px',
    background: 'var(--bg-elev)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.75rem',
    outline: 'none',
  },
  sharePrimary: {
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 16px',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.72rem',
    letterSpacing: '1px',
    fontWeight: '700',
    transition: 'all var(--t-fast)',
  },
  shareResult: {
    marginTop: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  shareUrlBox: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
  },
  shareUrlInput: {
    flex: 1,
    padding: '10px 12px',
    background: 'var(--bg-elev)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.75rem',
    outline: 'none',
  },
  copyButton: {
    background: 'var(--surface-2)',
    color: 'var(--accent)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 12px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  revokeButton: {
    alignSelf: 'flex-start',
    background: 'none',
    color: 'var(--danger)',
    border: '1px solid var(--danger)',
    borderRadius: 'var(--radius-sm)',
    padding: '6px 12px',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.7rem',
    letterSpacing: '1px',
    display: 'inline-flex',
    alignItems: 'center',
    transition: 'all var(--t-fast)',
  },
  exportRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    marginTop: '8px',
  },
  exportButton: {
    flex: 1,
    minWidth: '110px',
    background: 'var(--surface-2)',
    color: 'var(--accent)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 14px',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.75rem',
    letterSpacing: '1px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all var(--t-fast)',
  },
  exportButtonPrimary: {
    flex: 1,
    minWidth: '110px',
    background: 'var(--accent-soft)',
    color: 'var(--accent)',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 14px',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.75rem',
    letterSpacing: '1px',
    fontWeight: '700',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all var(--t-fast)',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    borderTop: '1px solid var(--border)',
    paddingTop: '20px',
    marginTop: '20px',
  },
  editButton: {
    backgroundColor: 'var(--surface-2)',
    color: 'var(--accent)',
    padding: 'clamp(10px, 1.5vw, 12px) clamp(20px, 3vw, 28px)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: 'clamp(0.8rem, 1.2vw, 0.9rem)',
    fontWeight: '700',
    flex: 1,
    minWidth: '120px',
    transition: 'all var(--t-fast)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontFamily: 'var(--font-mono)',
  },
  deleteButton: {
    backgroundColor: 'var(--danger-soft)',
    color: 'var(--danger)',
    padding: 'clamp(10px, 1.5vw, 12px) clamp(20px, 3vw, 28px)',
    border: '1px solid var(--danger)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: 'clamp(0.8rem, 1.2vw, 0.9rem)',
    fontWeight: '700',
    flex: 1,
    minWidth: '120px',
    transition: 'all var(--t-fast)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontFamily: 'var(--font-mono)',
  },
  lockContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 20px',
    textAlign: 'center',
  },
  lockIcon: { color: 'var(--accent)', marginBottom: '16px', opacity: 0.6 },
  lockTitle: {
    fontSize: 'clamp(1.2rem, 2.5vw, 1.5rem)',
    color: 'var(--accent)',
    marginBottom: '8px',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '2px',
  },
  lockDescription: {
    fontSize: 'clamp(0.8rem, 1.5vw, 0.9rem)',
    color: 'var(--text-faint)',
    marginBottom: '24px',
    maxWidth: '400px',
    fontFamily: 'var(--font-mono)',
  },
  unlockButton: {
    backgroundColor: 'var(--surface-2)',
    color: 'var(--accent)',
    padding: '12px 32px',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all var(--t-fast)',
    boxShadow: 'var(--shadow-1)',
    fontFamily: 'var(--font-mono)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

export default NoteViewer;