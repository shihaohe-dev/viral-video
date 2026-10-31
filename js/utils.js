// Helper bersama untuk index.html & detail.html

export const CATEGORY_NAMES = {
    colmek: 'COLMEK',
    berdua: 'BERDUA',
    bergilir: 'BERGILIR',
    lainnya: 'LAINNYA'
};

// Kolom yang dibutuhkan untuk daftar film (lebih ringan daripada select('*'))
export const LIST_COLUMNS =
    'id,title,description,category,views,created_at,thumbnail_url,aspect_ratio,video_url';

export function categoryName(category) {
    if (!category) return 'LAINNYA';
    return CATEGORY_NAMES[category] || String(category).toUpperCase();
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

const RATIO_CLASS = {
    '16:9': 'aspect-16-9',
    '9:16': 'aspect-9-16',
    '3:4': 'aspect-3-4',
    '4:3': 'aspect-4-3'
};

// Tinggi relatif (tinggi/lebar) untuk menghitung kolom masonry
const RATIO_HEIGHT = {
    '16:9': 9 / 16,
    '9:16': 16 / 9,
    '3:4': 4 / 3,
    '4:3': 3 / 4
};

export function aspectClass(ratio) {
    return RATIO_CLASS[ratio] || 'aspect-16-9';
}

export function ratioHeight(ratio) {
    return RATIO_HEIGHT[ratio] || RATIO_HEIGHT['16:9'];
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

export function movieCardHTML(movie) {
    const ratio = movie.aspect_ratio || '16:9';
    const title = String(movie.title ?? '');
    const safeTitle = escapeHtml(title);
    const badge = movie.category
        ? `<div class="category-badge category-${escapeHtml(movie.category)}">${escapeHtml(categoryName(movie.category))}</div>`
        : '';

    return `
    <a class="movie-card" href="detail.html?id=${encodeURIComponent(movie.id)}" data-id="${escapeHtml(movie.id)}">
        <div class="movie-thumbnail-container ${aspectClass(ratio)}">
            <img class="movie-thumbnail" src="${escapeHtml(thumbnailFor(movie))}" alt="${safeTitle}"
                 loading="lazy" decoding="async" data-ratio="${escapeHtml(ratio)}">
            ${badge}
        </div>
        <div class="movie-info">
            <h3 class="movie-title" title="${safeTitle}">${escapeHtml(truncate(title, 35))}</h3>
            <div class="movie-meta"><span class="movie-views">▶ ${formatViews(movie.views)}</span></div>
        </div>
    </a>`;
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
