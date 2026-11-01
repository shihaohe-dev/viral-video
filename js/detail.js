import { supabase } from './config.js';
import {
    LIST_COLUMNS, categoryName, aspectClass, formatViews, shuffle
} from './utils.js';
import { createFeed } from './feed.js';
import { setupPreroll } from './preroll.js';

const RELATED_LIMIT = 12;

// Elemen DOM
const elements = {
    videoContainer: document.getElementById('video-container'),
    videoPlayer: document.getElementById('video-player'),
    videoTitle: document.getElementById('video-title'),
    videoViews: document.getElementById('video-views'),
    videoCategory: document.getElementById('video-category'),
    videoDescription: document.getElementById('video-description'),
    shareBtn: document.getElementById('share-btn'),
    downloadBtn: document.getElementById('download-btn'),
    relatedGrid: document.getElementById('related-grid')
};

const relatedFeed = createFeed({ container: elements.relatedGrid, pageSize: RELATED_LIMIT });

// State
let currentMovie = null;
let viewCounted = false;
let preroll = null;

document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
    setupEventListeners();
});

async function initializeApp() {
    const movieId = new URLSearchParams(window.location.search).get('id');
    if (!movieId) {
        window.location.href = 'index.html';
        return;
    }
    await loadMovieDetail(movieId);
    if (currentMovie) {
        preroll = setupPreroll({ player: elements.videoPlayer, container: elements.videoContainer });
        await loadRelatedMovies();
    }
}

function setupEventListeners() {
    elements.shareBtn.addEventListener('click', handleShare);
    elements.downloadBtn.addEventListener('click', handleDownload);

    // Tambah views satu kali per kunjungan (bukan setiap pause/play)
    elements.videoPlayer.addEventListener('play', async () => {
        // Putaran iklan tidak dihitung sebagai views
        if (preroll && preroll.isAdActive()) return;
        if (currentMovie && !viewCounted) {
            viewCounted = true;
            await updateMovieViews(currentMovie.id);
        }
    });
}

async function loadMovieDetail(movieId) {
    try {
        const { data: movie, error } = await supabase
            .from('movies')
            .select('*')
            .eq('id', movieId)
            .single();

        if (error) throw error;

        if (movie) {
            currentMovie = movie;
            displayMovieDetail(movie);
        } else {
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error('Error loading movie detail:', error);
        window.location.href = 'index.html';
    }
}

function displayMovieDetail(movie) {
    const player = elements.videoPlayer;

    // Poster hanya bila thumbnail tersimpan di database; video baru dimuat saat ditekan play
    if (movie.thumbnail_url) player.poster = movie.thumbnail_url;
    player.preload = 'none';
    player.src = movie.video_url;

    elements.videoContainer.classList.add(aspectClass(movie.aspect_ratio || '16:9'));
    elements.videoTitle.textContent = movie.title;
    elements.videoViews.textContent = `▶ ${formatViews(movie.views)} penonton`;
    elements.videoCategory.textContent = categoryName(movie.category);
    elements.videoDescription.textContent = movie.description || 'Tidak ada deskripsi.';
    document.title = `${movie.title} - Vid18+`;

    elements.videoCategory.className = 'video-category';
    if (movie.category) elements.videoCategory.classList.add(`category-${movie.category}`);
}

// Video terkait (acak). Hanya kolom ringan dan jumlah terbatas.
async function loadRelatedMovies() {
    try {
        let { data: movies, error } = await supabase
            .from('movies')
            .select(LIST_COLUMNS)
            .neq('id', currentMovie.id)
            .order('created_at', { ascending: false })
            .limit(40);

        if (error) {
            console.warn('Query kolom terpilih gagal, mencoba select(*):', error);
            ({ data: movies, error } = await supabase
                .from('movies')
                .select('*')
                .neq('id', currentMovie.id)
                .order('created_at', { ascending: false })
                .limit(40));
        }
        if (error) throw error;

        const related = shuffle(movies || []).slice(0, RELATED_LIMIT);
        if (related.length === 0) {
            relatedFeed.showMessage('<div class="no-movies"><p>Tidak ada video lainnya.</p></div>');
            return;
        }
        relatedFeed.setItems(related);
    } catch (error) {
        console.error('Error loading related movies:', error);
        relatedFeed.showMessage('<div class="no-movies"><p>Gagal memuat video lainnya.</p></div>');
    }
}

async function updateMovieViews(movieId) {
    try {
        let newViews = null;

        // Cara utama: fungsi SQL increment_views (atomik, tidak perlu izin tulis ke tabel)
        const { data, error } = await supabase.rpc('increment_views', { movie_id: movieId });
        if (!error && typeof data === 'number') {
            newViews = data;
        } else {
            // Cadangan (sebelum SQL dijalankan): baca lalu tulis
            const { data: movie, error: readError } = await supabase
                .from('movies')
                .select('views')
                .eq('id', movieId)
                .single();
            if (readError) throw readError;

            newViews = (movie.views || 0) + 1;
            await supabase.from('movies').update({ views: newViews }).eq('id', movieId);
        }

        elements.videoViews.textContent = `▶ ${formatViews(newViews)} penonton`;
    } catch (error) {
        console.error('Error updating views:', error);
    }
}

function handleShare() {
    if (navigator.share) {
        navigator.share({
            title: currentMovie.title,
            text: currentMovie.description || '',
            url: window.location.href
        }).catch(console.error);
    } else {
        navigator.clipboard.writeText(window.location.href).then(() => {
            alert('Link berhasil disalin ke clipboard!');
        }).catch(() => {
            prompt('Salin link berikut:', window.location.href);
        });
    }
}

function handleDownload() {
    if (currentMovie.download_url) {
        window.open(currentMovie.download_url, '_blank', 'noopener');
    } else {
        alert('Link download tidak tersedia untuk film ini.');
    }
}