// client/src/components/SharedNote.jsx
import React from 'react';
import { Lock, Calendar, ArrowLeft, Eye } from 'lucide-react';
import { renderMarkdown } from '../lib/markdown';

function SharedNote({ note, onBack }) {
  const html = renderMarkdown(note.content || '', { interactiveTasks: false });

  const created = note.createdAt ? new Date(note.createdAt).toLocaleDateString() : '—';
  const updated = note.updatedAt ? new Date(note.updatedAt).toLocaleDateString() : null;
  const expires = note.shareExpiresAt ? new Date(note.shareExpiresAt).toLocaleDateString() : null;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <button onClick={onBack} style={styles.backButton}>
          <ArrowLeft size={16} style={{ marginRight: '8px' }} />
          BACK_TO_HOME
        </button>

        <div style={styles.noteHeader}>
          <h2 style={styles.title}>{note.title}</h2>
          <span style={styles.readonlyBadge}>
            <Eye size={12} style={{ marginRight: '4px' }} />
            READ-ONLY
          </span>
        </div>

        <div style={styles.meta}>
          <span style={styles.date}>
            <Calendar size={14} style={{ marginRight: '6px' }} />
            CREATED: {created}
          </span>
          {updated && updated !== created && (
            <span style={styles.date}>UPDATED: {updated}</span>
          )}
          {expires && (
            <span style={styles.expires}>
              <Lock size={12} style={{ marginRight: '4px' }} />
              EXPIRES: {expires}
            </span>
          )}
        </div>

        <div
          style={styles.content}
          className="note-preview"
          dangerouslySetInnerHTML={{ __html: html || '<em>Empty note</em>' }}
        />

        <div style={styles.footer}>
          <span style={styles.footerText}>
            [ SHARED_NOTE · NO PASSWORD REQUIRED · CONTENT NOT EDITABLE FROM THIS LINK ]
          </span>
        </div>
      </div>
    </div>
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
  readonlyBadge: {
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
    color: 'var(--text-dim)',
    opacity: 0.85,
    fontSize: 'clamp(0.7rem, 1.2vw, 0.8rem)',
    fontFamily: 'var(--font-mono)',
    display: 'flex',
    alignItems: 'center',
  },
  expires: {
    backgroundColor: 'var(--warning-soft)',
    color: 'var(--warning)',
    padding: '2px 12px',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'clamp(0.6rem, 1vw, 0.7rem)',
    fontWeight: '700',
    fontFamily: 'var(--font-mono)',
    border: '1px solid var(--warning)',
    display: 'flex',
    alignItems: 'center',
  },
  content: {
    marginBottom: '30px',
    lineHeight: '1.8',
    color: 'var(--text)',
    fontSize: 'clamp(0.95rem, 1.5vw, 1.05rem)',
    fontFamily: 'var(--font-mono)',
  },
  footer: {
    borderTop: '1px solid var(--border)',
    paddingTop: '16px',
  },
  footerText: {
    color: 'var(--text-faint)',
    fontSize: '0.7rem',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '1px',
  },
};

export default SharedNote;