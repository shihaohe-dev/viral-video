import { supabase } from './config.js';
import { LIST_COLUMNS, shuffle } from './utils.js';
import { createFeed, skeletonHTML } from './feed.js';

// Elemen DOM
const elements = {
    moviesGrid: document.getElementById('movies-grid'),
    loadMore: document.getElementById('load-more'),
    searchInput: document.getElementById('search-input'),
    searchBtn: document.getElementById('search-btn'),
    categoryBtns: document.querySelectorAll('.category-btn'),
    tabBtns: document.querySelectorAll('.tab-btn')
};

const feed = createFeed({
    container: elements.moviesGrid,
    moreButton: elements.loadMore,
    pageSize: 16
});

// Cache sementara di sessionStorage agar kembali dari halaman detail tidak query ulang
const CACHE_KEY = 'vid_movies_cache_v1';
const CACHE_TTL = 3 * 60 * 1000; // 3 menit

function readCache() {
    try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const { t, data } = JSON.parse(raw);
        return Date.now() - t < CACHE_TTL ? data : null;
    } catch (e) {
        return null;
    }
}

function writeCache(data) {
    try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data }));
    } catch (e) {
        // penyimpanan penuh / dinonaktifkan -> abaikan
    }
}

// State
let allMovies = [];
let currentCategory = 'all';
let currentTab = 'recommended';
let currentSearch = '';

document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    await loadMovies();
});

function setupEventListeners() {
    elements.searchBtn.addEventListener('click', handleSearch);
    elements.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    // Pencarian langsung (ditunda sebentar agar tidak berat)
    let searchTimer;
    elements.searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(handleSearch, 250);
    });

    elements.categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.categoryBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCategory = btn.dataset.category;
            filterMovies();
        });
    });

    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;
            filterMovies();
        });
    });
}

async function fetchMovies() {
    // Ambil hanya kolom yang dipakai; jika gagal (mis. kolom berbeda) ulangi dengan select('*')
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
    const cached = readCache();
    if (cached) {
        allMovies = cached;
        filterMovies();
        return;
    }

    try {
        feed.showMessage(skeletonHTML());
        allMovies = await fetchMovies();
        writeCache(allMovies);
        filterMovies();
    } catch (error) {
        console.error('Error loading movies:', error);
        feed.showMessage(`
            <div class="no-movies">
                <p>Gagal memuat film. Silakan refresh halaman.</p>
            </div>`);
    }
}

function handleSearch() {
    const value = elements.searchInput.value.trim().toLowerCase();
    if (value === currentSearch) return;
    currentSearch = value;
    filterMovies();
}

// Filter berdasarkan kategori, tab, dan pencarian
function filterMovies() {
    let list = [...allMovies];

    if (currentCategory !== 'all') {
        list = list.filter(movie => (movie.category?.toLowerCase() || 'lainnya') === currentCategory);
    }

    switch (currentTab) {
        case 'latest':
            list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
        case 'popular':
            list.sort((a, b) => (b.views || 0) - (a.views || 0));
            break;
        case 'recommended':
        default:
            list = shuffle(list);
            break;
    }

    if (currentSearch) {
        list = list.filter(movie =>
            movie.title?.toLowerCase().includes(currentSearch) ||
            movie.description?.toLowerCase().includes(currentSearch)
        );
    }

    if (list.length === 0) {
        feed.showMessage(`
            <div class="no-movies">
                <p>Tidak ada film yang ditemukan.</p>
            </div>`);
        return;
    }
    feed.setItems(list);
}
