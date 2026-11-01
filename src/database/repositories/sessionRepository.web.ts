import { durablePut } from '../../offline/durableStorage.web';
import { runSingle } from '../index';
export async function saveSession(params: {
    token: string | null;
    userId?: string | null;
    payload?: unknown;
}) { await durablePut('table:session_local', [{ id: Date.now(), token: params.token, user_id: params.userId ?? null, payload_json: params.payload ? JSON.stringify(params.payload) : null, updated_at: new Date().toISOString() }]); localStorage.removeItem('@katu:offline:session_local'); }
export async function getSession() {
    // localStorage holds the active browser login. A second tab may have changed
    // accounts while IndexedDB still contains the previous session snapshot.
    const token = localStorage.getItem('@katu:token'), raw = localStorage.getItem('@katu:user');
    if (!token || !raw)
        return null;
    const payload = JSON.parse(raw);
    const row = await runSingle('SELECT * FROM session_local ORDER BY id DESC LIMIT 1');
    return { id: row?.id ?? 0, token, userId: payload.id, payload, updatedAt: row?.updated_at ?? null };
}
export async function clearSession() { await durablePut('table:session_local', []); localStorage.removeItem('@katu:offline:session_local'); }
