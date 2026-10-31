// Feed film: layout masonry (kolom dihitung via JS agar tidak "loncat" saat
// item ditambah) + render bertahap supaya DOM dan gambar tidak dimuat sekaligus.
import { movieCardHTML, enableImageFallback, ratioHeight } from './utils.js';

function columnCount() {
    const w = window.innerWidth;
    if (w > 1024) return 4;
    if (w > 768) return 3;
    return 2;
}

// Perkiraan tinggi teks judul relatif terhadap lebar kartu
const INFO_HEIGHT = 0.28;

export function createFeed({ container, moreButton = null, pageSize = 16 }) {
    let items = [];
    let rendered = 0;
    let cols = [];
    let heights = [];
    let currentCount = 0;

    enableImageFallback(container);

    function buildColumns() {
        currentCount = columnCount();
        container.innerHTML = '';
        cols = [];
        heights = [];
        for (let i = 0; i < currentCount; i++) {
            const col = document.createElement('div');
            col.className = 'masonry-col';
            container.appendChild(col);
            cols.push(col);
            heights.push(0);
        }
    }

    function place(movie) {
        let target = 0;
        for (let i = 1; i < heights.length; i++) {
            if (heights[i] < heights[target]) target = i;
        }
        cols[target].insertAdjacentHTML('beforeend', movieCardHTML(movie));
        heights[target] += ratioHeight(movie.aspect_ratio || '16:9') + INFO_HEIGHT;
    }

    function updateButton() {
        if (!moreButton) return;
        moreButton.hidden = rendered >= items.length;
    }

    function renderNext() {
        const next = items.slice(rendered, rendered + pageSize);
        next.forEach(place);
        rendered += next.length;
        updateButton();
    }

    function setItems(list) {
        items = list;
        rendered = 0;
        buildColumns();
        renderNext();
    }

    // Tampilkan pesan (loading / kosong / error) menggantikan isi grid
    function showMessage(html) {
        items = [];
        rendered = 0;
        cols = [];
        heights = [];
        container.innerHTML = html;
        updateButton();
    }

    // Susun ulang saat jumlah kolom berubah (rotasi layar / resize)
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (!items.length || columnCount() === currentCount) return;
            const count = rendered;
            buildColumns();
            items.slice(0, count).forEach(place);
        }, 200);
    });

    if (moreButton) {
        moreButton.addEventListener('click', renderNext);
        // Muat otomatis ketika tombol mendekati layar
        if ('IntersectionObserver' in window) {
            new IntersectionObserver((entries) => {
                if (entries.some(e => e.isIntersecting) && !moreButton.hidden) renderNext();
            }, { rootMargin: '600px 0px' }).observe(moreButton);
        }
    }

    return { setItems, showMessage };
}

export function skeletonHTML(count = 8) {
    return '<div class="skeleton-grid" aria-hidden="true">' +
        Array.from({ length: count }, () =>
            '<div class="skeleton-card"><div class="skeleton-thumb"></div><div class="skeleton-line"></div></div>'
        ).join('') + '</div>';
}
