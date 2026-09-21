// client/src/hooks/useDebouncedAutosave.js
import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Debounced autosave hook.
 *
 * @param {object} params
 *   @param {string}   params.id              - note id (required to save)
 *   @param {object}   params.payload         - data to save when triggered
 *   @param {string}   params.password        - current password (for auth)
 *   @param {number}   params.version         - expected version for conflict detection
 *   @param {(payload, password, version) => Promise<any>} params.saveFn
 *   @param {number}   [params.delayMs=2500]  - debounce delay
 *   @param {boolean}  [params.enabled=true]  - enable/disable autosave
 *
 * @returns {
 *   status: 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'conflict',
 *   lastSavedAt: number|null,
 *   error: string|null,
 *   conflict: object|null,   // server copy on 409
 *   saveNow: () => Promise<void>,
 *   reset: () => void,
 * }
 */
export function useDebouncedAutosave({
  id,
  payload,
  password,
  version,
  saveFn,
  delayMs = 2500,
  enabled = true,
}) {
  const [status, setStatus] = useState('idle');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [error, setError] = useState(null);
  const [conflict, setConflict] = useState(null);

  const timerRef = useRef(null);
  const latestRef = useRef({ payload, password, version });
  const inFlightRef = useRef(false);
  const lastSerializedRef = useRef('');

  // Keep the latest values available to the debounced callback
  useEffect(() => {
    latestRef.current = { payload, password, version };
  }, [payload, password, version]);

  const serialize = (p) => JSON.stringify(p || {});

  const doSave = useCallback(async () => {
    if (!enabled || !id) return;
    if (inFlightRef.current) return;

    const { payload: p, password: pw, version: v } = latestRef.current;
    if (!pw) {
      // Autosave requires a password. Skip silently.
      return;
    }
    const serialized = serialize(p);
    if (serialized === lastSerializedRef.current) {
      // Nothing changed since last successful save
      setStatus('idle');
      return;
    }

    inFlightRef.current = true;
    setStatus('saving');
    setError(null);

    try {
      await saveFn(p, pw, v);
      lastSerializedRef.current = serialized;
      setLastSavedAt(Date.now());
      setStatus('saved');
      setConflict(null);
    } catch (err) {
      if (err && err.conflict) {
        setConflict(err.serverNote || null);
        setStatus('conflict');
      } else {
        setError(err?.message || 'AUTOSAVE_FAILED');
        setStatus('error');
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [enabled, id, saveFn]);

  // Schedule a save whenever payload changes
  useEffect(() => {
    if (!enabled || !id) return;
    const serialized = serialize(payload);
    if (serialized === lastSerializedRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus('pending');
    timerRef.current = setTimeout(() => {
      doSave();
    }, delayMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, enabled, id, delayMs, doSave]);

  const saveNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await doSave();
  }, [doSave]);

  const reset = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    lastSerializedRef.current = '';
    setStatus('idle');
    setLastSavedAt(null);
    setError(null);
    setConflict(null);
  }, []);

  // Warn before unload if there's a pending save
  useEffect(() => {
    const handler = (e) => {
      if (status === 'pending' || status === 'saving') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [status]);

  return { status, lastSavedAt, error, conflict, saveNow, reset };
}