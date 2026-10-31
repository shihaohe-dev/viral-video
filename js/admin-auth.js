// Layar login + logout untuk admin.html
import { supabase } from './config.js';
import { requireAdmin, signIn, signOut } from './auth.js';

const $ = (id) => document.getElementById(id);
const LOGIN_LABEL = '<span class="btn-icon">🔐</span> Login';

function showPanel(isAdmin) {
    const loginScreen = $('login-screen');
    const adminPanel = $('admin-panel');
    if (loginScreen) loginScreen.style.display = isAdmin ? 'none' : 'block';
    if (adminPanel) adminPanel.style.display = isAdmin ? 'block' : 'none';
}

function setBusy(busy) {
    const btn = document.querySelector('#login-form .login-btn');
    const overlay = $('loading-overlay');
    if (overlay) overlay.style.display = busy ? 'flex' : 'none';
    if (btn) {
        btn.disabled = busy;
        btn.innerHTML = busy ? '<span class="btn-icon">⏳</span> Memproses...' : LOGIN_LABEL;
    }
}

async function init() {
    const result = await requireAdmin();
    showPanel(result.ok);
    if (result.ok && typeof window.loadAdsStats === 'function') window.loadAdsStats();
}

$('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('email').value.trim();
    const password = $('password').value;

    setBusy(true);
    const { error } = await signIn(email, password);
    if (error) {
        setBusy(false);
        alert('Email atau password salah!');
        return;
    }

    const result = await requireAdmin();
    if (!result.ok) {
        await signOut();
        setBusy(false);
        alert(result.reason === 'not-admin'
            ? 'Akun ini bukan admin.'
            : 'Gagal memeriksa akses admin. Pastikan SQL 01-persiapan sudah dijalankan di Supabase.');
        return;
    }

    // Muat ulang agar admin.js ikut memuat data film
    window.location.reload();
});

window.logout = async function logout() {
    if (!confirm('Apakah Anda yakin ingin logout?')) return;
    await signOut();
    window.location.reload();
};

// Logout dari tab lain -> kembali ke layar login
supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') showPanel(false);
});

document.addEventListener('DOMContentLoaded', init);
