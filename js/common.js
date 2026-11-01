// Kode bersama index.html & detail.html:
// helper data, kartu video, grid, tombol halaman, dan konfirmasi usia 18+.

export const CATEGORY_NAMES = {
    colmek: 'Colmek',
    berdua: 'Berdua',
    bergilir: 'Bergilir',
    lainnya: 'Lainnya'
};

// Kolom yang dibutuhkan untuk daftar film (lebih ringan daripada select('*'))
export const LIST_COLUMNS =
    'id,title,description,category,views,created_at,thumbnail_url,aspect_ratio,video_url';

export function categoryName(category) {
    if (!category) return 'Lainnya';
    return CATEGORY_NAMES[category] || String(category);
}

export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function truncate(text, max) {
    const str = String(text ?? '');
    return str.length > max ? str.slice(0, max) + '...' : str;
}

export function shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

export function formatViews(views) {
    const n = Number(views) || 0;
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}JT`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
}

// Placeholder gambar berupa SVG inline (tanpa request jaringan)
export function placeholderImage(text = 'Video', ratio = '16:9', color = '#4b4f8a') {
    const size = {
        '16:9': [400, 225],
        '9:16': [225, 400],
        '3:4': [300, 400],
        '4:3': [400, 300]
    }[ratio] || [400, 225];
    const [w, h] = size;
    const label = escapeHtml(truncate(text, 20));
    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
        `<rect width="100%" height="100%" fill="${color}"/>` +
        `<text x="50%" y="50%" fill="#ffffff" fill-opacity="0.85" font-family="sans-serif" ` +
        `font-size="${Math.round(w / 14)}" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

// Thumbnail dari URL video (YouTube, Google Drive, Vimeo), atau placeholder
export function generateThumbnailUrl(videoUrl, title = '', ratio = '16:9') {
    if (!videoUrl) return placeholderImage('No Video', ratio, '#1a1a1a');

    try {
        if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
            let id = null;
            if (videoUrl.includes('youtube.com/watch?v=')) {
                id = new URL(videoUrl).searchParams.get('v');
            } else if (videoUrl.includes('youtu.be/')) {
                id = videoUrl.split('youtu.be/')[1].split('?')[0];
            }
            if (id && id.length === 11) return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
        }

        if (videoUrl.includes('drive.google.com')) {
            let id = null;
            if (videoUrl.includes('/file/d/')) {
                id = videoUrl.split('/file/d/')[1].split('/')[0];
            } else if (videoUrl.includes('id=')) {
                id = new URL(videoUrl).searchParams.get('id');
            }
            if (id) return `https://lh3.googleusercontent.com/d/${id}=s400`;
        }

        if (videoUrl.includes('vimeo.com')) {
            const id = videoUrl.split('vimeo.com/')[1]?.split('/')[0]?.split('?')[0];
            if (id && /^\d+$/.test(id)) return `https://vumbnail.com/${id}.jpg`;
        }
    } catch (e) {
        // URL tidak valid -> pakai placeholder
    }

    let label = title && title.trim() ? title : '';
    if (!label && (videoUrl.includes('r2.dev') || videoUrl.includes('cloudflarestorage.com'))) {
        label = (videoUrl.split('/').pop() || '').split('.')[0].replace(/[-_]/g, ' ');
    }
    return placeholderImage(label || 'Video', ratio);
}

export function thumbnailFor(movie) {
    return movie.thumbnail_url || generateThumbnailUrl(movie.video_url, movie.title, movie.aspect_ratio || '16:9');
}

// Jika gambar gagal dimuat, ganti dengan placeholder (tanpa atribut onerror inline)
export function enableImageFallback(container) {
    container.addEventListener('error', (event) => {
        const img = event.target;
        if (!(img instanceof HTMLImageElement) || img.dataset.failed) return;
        img.dataset.failed = '1';
        img.src = placeholderImage('Thumbnail Error', img.dataset.ratio || '16:9', '#1a1a1a');
    }, true);
}

// ---------- Link yang harus diputar lewat embed (bukan tag <video>) ----------
// Link halaman Google Drive / YouTube / Vimeo bukan file video, jadi tidak bisa dipakai di <video src>.
export function embedUrlFor(url) {
    try {
        const u = new URL(String(url || '').trim());
        const host = u.hostname.replace(/^www\./, '');

        if (host === 'drive.google.com' || host === 'drive.usercontent.google.com' || host === 'docs.google.com') {
            const m = u.pathname.match(/\/file\/d\/([\w-]+)/);
            const id = m ? m[1] : u.searchParams.get('id');
            if (id) return `https://drive.google.com/file/d/${id}/preview`;
        }

        if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') {
            let id = null;
            if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
            else if (u.pathname === '/watch') id = u.searchParams.get('v');
            else {
                const p = u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/);
                if (p) id = p[1];
            }
            if (id && /^[\w-]{11}$/.test(id)) return `https://www.youtube.com/embed/${id}?rel=0&playsinline=1`;
        }

        if (host === 'vimeo.com' || host === 'player.vimeo.com') {
            const m = u.pathname.match(/(\d{6,})/);
            if (m) return `https://player.vimeo.com/video/${m[1]}`;
        }
    } catch (e) { /* bukan URL valid -> anggap file video biasa */ }
    return null;
}

// ---------- Alamat video: /v/judul-video-<id> ----------
// Id di ujung membuat alamat selalu unik, jadi dua video berjudul sama tidak bentrok.
export function slugify(text) {
    return String(text || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
        .slice(0, 60).replace(/-+$/g, '') || 'video';
}

export function movieLink(movie) {
    return `/v/${slugify(movie.title)}-${encodeURIComponent(movie.id)}`;
}

// Ambil id dari alamat: /v/judul-<id>, atau link lama detail.html?id=<id>
export function movieIdFromUrl() {
    const old = new URLSearchParams(location.search).get('id');
    if (old) return old;
    const last = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');
    const m = last.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)$/i);
    if (m) return m[1];
    // Cadangan: id berupa kode lain (huruf+angka) setelah tanda "-" terakhir
    const tail = last.split('-').pop();
    return tail && tail !== last ? tail : null;
}

// ---------- Kartu & grid (semua thumbnail berukuran sama: 16:9) ----------
export function movieCardHTML(movie) {
    const ratio = movie.aspect_ratio || '16:9';
    const title = String(movie.title ?? '');
    const safeTitle = escapeHtml(title);
    const cat = movie.category ? escapeHtml(movie.category) : 'lainnya';

    return `
    <a class="card" href="${movieLink(movie)}">
        <div class="thumb">
            <img src="${escapeHtml(thumbnailFor(movie))}" alt="${safeTitle}"
                 loading="lazy" decoding="async" data-ratio="${escapeHtml(ratio)}">
            <span class="tag tag-${cat}">${escapeHtml(categoryName(movie.category))}</span>
        </div>
        <h3 class="card-title" title="${safeTitle}">${escapeHtml(truncate(title, 60))}</h3>
        <p class="card-meta">▶ ${formatViews(movie.views)}</p>
    </a>`;
}

export function renderGrid(container, movies) {
    container.innerHTML = movies.map(movieCardHTML).join('');
}

export function skeletonHTML(count = 10) {
    return Array.from({ length: count }, () =>
        '<div class="card skeleton" aria-hidden="true"><div class="thumb"></div><div class="skel-line"></div></div>'
    ).join('');
}

export function messageHTML(text) {
    return `<div class="empty">${escapeHtml(text)}</div>`;
}

// ---------- Tombol halaman (Sebelumnya | 1 2 3 … 12 | Berikutnya) ----------
function pageList(page, pages) {
    const set = new Set([1, pages, page - 1, page, page + 1]);
    const nums = [...set].filter(n => n >= 1 && n <= pages).sort((a, b) => a - b);
    const out = [];
    nums.forEach((n, i) => {
        if (i && n - nums[i - 1] > 1) out.push('…');
        out.push(n);
    });
    return out;
}

export function renderPager(nav, { page, pages }) {
    if (pages <= 1) {
        nav.hidden = true;
        nav.innerHTML = '';
        return;
    }
    nav.hidden = false;
    const num = (n) => n === '…'
        ? '<span class="pager-gap" aria-hidden="true">…</span>'
        : `<button type="button" class="pager-num${n === page ? ' is-current' : ''}" data-page="${n}"` +
          `${n === page ? ' aria-current="page"' : ''} aria-label="Halaman ${n}">${n}</button>`;

    nav.innerHTML =
        `<button type="button" class="pager-step" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>‹ <span>Sebelumnya</span></button>` +
        `<div class="pager-nums">${pageList(page, pages).map(num).join('')}</div>` +
        `<span class="pager-status">Halaman ${page} dari ${pages}</span>` +
        `<button type="button" class="pager-step" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}><span>Berikutnya</span> ›</button>`;
}

export function onPagerClick(nav, handler) {
    nav.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-page]');
        if (!btn || btn.disabled) return;
        handler(Number(btn.dataset.page));
    });
}

// ---------- Konfirmasi usia 18+ (sekali per browser) ----------
(function ageGate() {
    const KEY = 'vid_age_ok';
    try { if (localStorage.getItem(KEY) === '1') return; } catch (e) { /* lanjut tampilkan */ }

    document.documentElement.classList.add('age-locked');
    const overlay = document.createElement('div');
    overlay.className = 'age-gate';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'age-gate-title');
    overlay.innerHTML = `
        <div class="age-gate-box">
            <div class="age-gate-badge">18+</div>
            <h2 id="age-gate-title">Khusus dewasa</h2>
            <p>Situs ini berisi konten dewasa. Dengan masuk, kamu menyatakan berusia 18 tahun atau lebih.</p>
            <div class="age-gate-actions">
                <button type="button" class="age-gate-yes">Saya 18+, masuk</button>
                <a class="age-gate-no" href="https://www.google.com">Keluar</a>
            </div>
        </div>`;

    const mount = () => {
        document.body.appendChild(overlay);
        const yes = overlay.querySelector('.age-gate-yes');
        yes.addEventListener('click', () => {
            try { localStorage.setItem(KEY, '1'); } catch (e) { /* abaikan */ }
            overlay.remove();
            document.documentElement.classList.remove('age-locked');
        });
        yes.focus();
    };
    if (document.body) mount();
    else document.addEventListener('DOMContentLoaded', mount);
})();
