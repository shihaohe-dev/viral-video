// Konfirmasi usia 18+ (sekali per browser)
const KEY = 'vid_age_ok';

function isConfirmed() {
    try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; }
}

function confirmAge() {
    try { localStorage.setItem(KEY, '1'); } catch (e) { /* abaikan */ }
}

if (!isConfirmed()) {
    document.documentElement.classList.add('age-locked');

    const overlay = document.createElement('div');
    overlay.className = 'age-gate';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'age-gate-title');
    overlay.innerHTML = `
        <div class="age-gate-box">
            <div class="age-gate-badge">18+</div>
            <h2 id="age-gate-title">Konten Dewasa</h2>
            <p>Situs ini berisi konten khusus dewasa. Dengan melanjutkan, kamu menyatakan berusia 18 tahun atau lebih.</p>
            <div class="age-gate-actions">
                <button type="button" class="age-gate-yes">Saya 18+ — Masuk</button>
                <a class="age-gate-no" href="https://www.google.com">Keluar</a>
            </div>
        </div>`;

    const mount = () => {
        document.body.appendChild(overlay);
        overlay.querySelector('.age-gate-yes').addEventListener('click', () => {
            confirmAge();
            overlay.remove();
            document.documentElement.classList.remove('age-locked');
        });
        overlay.querySelector('.age-gate-yes').focus();
    };

    if (document.body) mount();
    else document.addEventListener('DOMContentLoaded', mount);
}
