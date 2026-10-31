// Autentikasi admin via Supabase Auth.
// Admin = user Supabase Auth yang juga terdaftar di tabel public.admin_users
// (dicek oleh fungsi SQL is_admin() di server, jadi tidak bisa dipalsukan dari browser).
import { supabase } from './config.js';

export async function signIn(email, password) {
    return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
    await supabase.auth.signOut();
}

// Hasil: { ok: true } atau { ok: false, reason: 'no-session' | 'not-admin' | 'rpc-error' }
export async function requireAdmin() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { ok: false, reason: 'no-session' };

    const { data, error } = await supabase.rpc('is_admin');
    if (error) {
        console.error('Gagal memeriksa admin (apakah SQL 01 sudah dijalankan?):', error);
        return { ok: false, reason: 'rpc-error' };
    }
    return data === true ? { ok: true, session } : { ok: false, reason: 'not-admin' };
}
