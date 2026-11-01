import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { durableGet, durablePut, durableRemove } from '../offline/durableStorage';
export type DraftRecord = {
    ownerId: string;
    name: string;
    title: string;
    value: any;
    savedAt: string;
};
export function useDurableDraft(name: string, title: string, value: unknown, restore: (v: any) => void, dirty = true) { const { user } = useAuth(), [readyKey, setReadyKey] = useState<string | null>(null), [saving, setSaving] = useState(false), [error, setError] = useState(''), [savedAt, setSavedAt] = useState(''); const revision = useRef(0), disabled = useRef(false), restoreRef = useRef(restore); restoreRef.current = restore; const key = user?.id ? 'draft:' + user.id + ':' + name : null, encoded = JSON.stringify(value), ready = !!key && readyKey === key; useEffect(() => { let alive = true; setReadyKey(null); setSavedAt(''); setError(''); revision.current++; if (!key)
    return; disabled.current = false; void durableGet<DraftRecord>(key).then(old => { if (alive) {
    if (old) {
        restoreRef.current(old.value);
        setSavedAt(old.savedAt);
    }
    setReadyKey(key);
} }).catch(e => { if (alive) {
    setError(e.message);
} }); return () => { alive = false; }; }, [key]); useEffect(() => { if (!key || !ready || !dirty || disabled.current)
    return; const sequence = ++revision.current; setSaving(true); const record: DraftRecord = { ownerId: user!.id, name, title, value: JSON.parse(encoded), savedAt: new Date().toISOString() }; void durablePut(key, record).then(() => { if (sequence === revision.current) {
    setSaving(false);
    setError('');
    setSavedAt(record.savedAt);
} }).catch(e => { if (sequence === revision.current) {
    setSaving(false);
    setError(e.message);
} }); }, [key, ready, dirty, encoded, title, name, user]); async function clear() { disabled.current = true; revision.current++; if (key)
    await durableRemove(key); setSavedAt(''); setSaving(false); } return { ready, saving, error, savedAt, clear }; }
