// Halaman utama: filter, urutan, pencarian, dan 30 video per halaman.
import { supabase } from './config.js';
import {
    LIST_COLUMNS, enableImageFallback, renderGrid, renderPager, onPagerClick,
    skeletonHTML, messageHTML
} from './common.js';

const PAGE_SIZE = 30;

const el = {
    grid: document.getElementById('movies-grid'),
    pager: document.getElementById('pager'),
    summary: document.getElementById('result-summary'),
    search: document.getElementById('search-input'),
    searchForm: document.getElementById('search-form'),
    categoryBtns: document.querySelectorAll('.chip'),
    tabBtns: document.querySelectorAll('.seg-btn')
};

enableImageFallback(el.grid);

// ---------- Penyimpanan sementara (kembali dari halaman detail tetap di posisi yang sama) ----------
const DATA_KEY = 'vid_movies_cache_v1';
const DATA_TTL = 3 * 60 * 1000;
const VIEW_KEY = 'vid_home_view_v1';

function readJSON(storage, key) {
    try { return JSON.parse(storage.getItem(key)); } catch (e) { return null; }
}
function writeJSON(storage, key, value) {
    try { storage.setItem(key, JSON.stringify(value)); } catch (e) { /* abaikan */ }
}

const saved = readJSON(sessionStorage, VIEW_KEY) || {};
const urlPage = Number(new URLSearchParams(location.search).get('hal'));

const state = {
    movies: [],
    category: saved.category || 'all',
    tab: saved.tab || 'recommended',
    search: saved.search || '',
    page: urlPage > 0 ? urlPage : (saved.page || 1),
    seed: saved.seed || Math.floor(Math.random() * 2 ** 31)
};

function saveView() {
    writeJSON(sessionStorage, VIEW_KEY, state_view());
    const url = new URL(location.href);
    if (state.page > 1) url.searchParams.set('hal', state.page);
    else url.searchParams.delete('hal');
    history.replaceState(null, '', url);
}
const state_view = () => ({
    category: state.category, tab: state.tab, search: state.search, page: state.page, seed: state.seed
});

// Acak yang stabil selama satu sesi (urutan tidak berubah saat pindah halaman / kembali dari detail)
function seededShuffle(array, seed) {
    const a = [...array];
    let t = seed >>> 0;
    const rand = () => {
        t += 0x6D2B79F5;
        let x = Math.imul(t ^ (t >>> 15), 1 | t);
        x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ---------- Data ----------
async function fetchMovies() {
    let { data, error } = await supabase
        .from('movies')
        .select(LIST_COLUMNS)
        .order('created_at', { ascending: false });

    if (error) {
        console.warn('Query kolom terpilih gagal, mencoba select(*):', error);
        ({ data, error } = await supabase
            .from('movies')
            .select('*')
            .order('created_at', { ascending: false }));
    }
    if (error) throw error;
    return data || [];
}

async function loadMovies() {
    const cached = readJSON(sessionStorage, DATA_KEY);
    if (cached && Date.now() - cached.t < DATA_TTL) {
        state.movies = cached.data;
        render();
        return;
    }
    try {
        el.grid.innerHTML = skeletonHTML(10);
        state.movies = await fetchMovies();
        writeJSON(sessionStorage, DATA_KEY, { t: Date.now(), data: state.movies });
        render();
    } catch (error) {
        console.error('Error loading movies:', error);
        el.grid.innerHTML = messageHTML('Gagal memuat video. Coba muat ulang halaman.');
        el.pager.hidden = true;
    }
}

// ---------- Tampilan ----------
function visibleMovies() {
    let list = [...state.movies];

    if (state.category !== 'all') {
        list = list.filter(m => (m.category?.toLowerCase() || 'lainnya') === state.category);
    }

    if (state.tab === 'latest') list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    else if (state.tab === 'popular') list.sort((a, b) => (b.views || 0) - (a.views || 0));
    else list = seededShuffle(list, state.seed);

    const q = state.search.trim().toLowerCase();
    if (q) {
        list = list.filter(m =>
            m.title?.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q));
    }
    return list;
}

function render({ scroll = false } = {}) {
    const list = visibleMovies();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    state.page = Math.min(Math.max(1, state.page), pages);

    if (!list.length) {
        el.grid.innerHTML = messageHTML('Tidak ada video yang cocok.');
        el.summary.textContent = '';
        renderPager(el.pager, { page: 1, pages: 1 });
        saveView();
        return;
    }

    const start = (state.page - 1) * PAGE_SIZE;
    renderGrid(el.grid, list.slice(start, start + PAGE_SIZE));
    renderPager(el.pager, { page: state.page, pages });
    el.summary.textContent =
        `Menampilkan ${start + 1}–${Math.min(start + PAGE_SIZE, list.length)} dari ${list.length} video`;
    saveView();

    if (scroll) document.getElementById('toolbar').scrollIntoView({ block: 'start' });
}

function syncControls() {
    el.categoryBtns.forEach(b => b.classList.toggle('is-active', b.dataset.category === state.category));
    el.tabBtns.forEach(b => b.classList.toggle('is-active', b.dataset.tab === state.tab));
    el.search.value = state.search;
}

// ---------- Interaksi ----------
el.categoryBtns.forEach(btn => btn.addEventListener('click', () => {
    state.category = btn.dataset.category;
    state.page = 1;
    syncControls();
    render();
}));

el.tabBtns.forEach(btn => btn.addEventListener('click', () => {
    state.tab = btn.dataset.tab;
    state.page = 1;
    syncControls();
    render();
}));

let searchTimer;
function applySearch() {
    const value = el.search.value.trim();
    if (value === state.search) return;
    state.search = value;
    state.page = 1;
    render();
}
el.search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applySearch, 250);
});
el.searchForm.addEventListener('submit', (e) => { e.preventDefault(); applySearch(); });

onPagerClick(el.pager, (page) => {
    state.page = page;
    render({ scroll: true });
});

syncControls();
loadMovies();
