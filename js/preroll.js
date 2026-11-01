// Iklan VAST pre-roll (HilltopAds): tampil sebelum video utama diputar.
// Aman gagal: jika iklan tidak bisa dimuat/diputar, video utama langsung jalan.

export const PREROLL_CONFIG = {
    enabled: true,
    autoplay: true,         // iklan diputar otomatis (tanpa suara) saat pemutar muncul; false = harus tekan tombol putar
    vastUrl: 'https://gregariousstretch.com/dCm_FMz.drGKN/vXZoGSUA/Kewmh9euEZ/UOl/kKP/TJcX1WOsDJMKwOMDT/c_t/NazyUu4QMfz/A/yUMsQK',
    fetchTimeoutMs: 6000,   // batas waktu mengambil VAST
    startTimeoutMs: 8000,   // batas waktu iklan mulai tayang sebelum dilewati
    cooldownMs: 0           // jeda antar iklan dalam satu sesi (0 = tiap halaman video)
};

const COOLDOWN_KEY = 'vid_preroll_at';

// ---------- Utilitas ----------
function injectStyles() {
    if (document.getElementById('preroll-styles')) return;
    const style = document.createElement('style');
    style.id = 'preroll-styles';
    style.textContent = `
    .video-container { position: relative; }
    .preroll-start { position: absolute; inset: 0; z-index: 3; display: grid; place-items: center;
        border: 0; padding: 0; cursor: pointer; background: rgba(0,0,0,.28); }
    .preroll-start span { width: 68px; height: 68px; border-radius: 50%; display: grid; place-items: center;
        background: rgba(255,59,78,.95); color: #fff; font-size: 26px; padding-left: 4px; box-shadow: 0 6px 24px rgba(0,0,0,.45); }
    .preroll-ui { position: absolute; inset: 0; z-index: 3; pointer-events: none; }
    .preroll-label { position: absolute; top: 10px; left: 10px; padding: 3px 10px; border-radius: 999px;
        background: rgba(0,0,0,.7); color: #fff; font-size: .75rem; font-weight: 600; }
    .preroll-visit, .preroll-skip, .preroll-sound { position: absolute; pointer-events: auto; border: 0; cursor: pointer;
        border-radius: 8px; background: rgba(0,0,0,.75); color: #fff; font-size: .8rem; font-weight: 600; padding: 8px 14px; }
    .preroll-visit { top: 10px; right: 10px; }
    .preroll-skip { right: 10px; bottom: 14px; }
    .preroll-sound { left: 10px; bottom: 14px; }
    .preroll-skip[disabled] { opacity: .8; cursor: default; }
    `;
    document.head.appendChild(style);
}

function expandMacros(url, errorCode = 900) {
    return url
        .replace(/\[(CACHEBUSTING|RANDOM)\]/g, () => String(Math.floor(Math.random() * 1e8)))
        .replace(/\[TIMESTAMP\]/g, encodeURIComponent(new Date().toISOString()))
        .replace(/\[ERRORCODE\]/g, String(errorCode))
        .replace(/\[CONTENTPLAYHEAD\]/g, '00:00:00.000');
}

function pixel(url, errorCode) {
    if (!url) return;
    try { new Image().src = expandMacros(url, errorCode); } catch (e) { /* abaikan */ }
}

function firePixels(urls, errorCode) {
    (urls || []).forEach(u => pixel(u, errorCode));
}

function parseTime(value) {
    // "HH:MM:SS(.mmm)" -> detik
    const m = /^(\d+):(\d+):(\d+(?:\.\d+)?)$/.exec((value || '').trim());
    return m ? (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]) : null;
}

function text(node) {
    return node ? (node.textContent || '').trim() : '';
}

async function fetchText(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { credentials: 'omit', signal: controller.signal });
        if (!res.ok) throw new Error('VAST HTTP ' + res.status);
        return await res.text();
    } finally {
        clearTimeout(timer);
    }
}

// ---------- VAST ----------
async function loadVast(url, acc = null, depth = 0) {
    acc = acc || { impressions: [], errors: [], tracking: {}, clickTracking: [] };

    const xml = await fetchText(expandMacros(url), PREROLL_CONFIG.fetchTimeoutMs);
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    if (doc.querySelector('parsererror')) throw new Error('VAST tidak valid');

    const ad = doc.querySelector('Ad');
    if (!ad) throw new Error('VAST kosong (tidak ada iklan)');

    ad.querySelectorAll('Impression').forEach(n => text(n) && acc.impressions.push(text(n)));
    ad.querySelectorAll('Error').forEach(n => text(n) && acc.errors.push(text(n)));
    ad.querySelectorAll('Tracking').forEach(n => {
        const ev = n.getAttribute('event');
        if (ev && text(n)) (acc.tracking[ev] = acc.tracking[ev] || []).push(text(n));
    });
    ad.querySelectorAll('ClickTracking').forEach(n => text(n) && acc.clickTracking.push(text(n)));

    const wrapper = ad.querySelector('Wrapper');
    if (wrapper) {
        const next = text(wrapper.querySelector('VASTAdTagURI'));
        if (!next || depth >= 4) throw new Error('Wrapper VAST tidak dapat diikuti');
        return loadVast(next, acc, depth + 1);
    }

    const linear = ad.querySelector('InLine Linear');
    if (!linear) throw new Error('Tidak ada kreatif linear');

    // Pilih file video yang bisa diputar dan paling dekat dengan lebar 640px
    const probe = document.createElement('video');
    const files = [...linear.querySelectorAll('MediaFile')]
        .map(n => ({
            url: text(n),
            type: n.getAttribute('type') || '',
            delivery: n.getAttribute('delivery') || 'progressive',
            width: parseInt(n.getAttribute('width'), 10) || 640
        }))
        .filter(f => f.url && f.delivery !== 'streaming' && f.type.startsWith('video/') && probe.canPlayType(f.type) !== '');
    if (!files.length) throw new Error('Tidak ada file video yang didukung');
    files.sort((a, b) => Math.abs(a.width - 640) - Math.abs(b.width - 640));

    return {
        mediaUrls: files.map(f => f.url),
        impressions: acc.impressions,
        errors: acc.errors,
        tracking: acc.tracking,
        clickTracking: acc.clickTracking,
        clickThrough: text(linear.querySelector('ClickThrough')),
        skipOffset: linear.getAttribute('skipoffset') || ''
    };
}

// ---------- Pemutaran ----------
export function setupPreroll({ player, container }) {
    const inactive = { isAdActive: () => false };

    if (!PREROLL_CONFIG.enabled || !PREROLL_CONFIG.vastUrl) return inactive;

    try {
        const last = Number(sessionStorage.getItem(COOLDOWN_KEY) || 0);
        if (PREROLL_CONFIG.cooldownMs > 0 && Date.now() - last < PREROLL_CONFIG.cooldownMs) return inactive;
    } catch (e) { /* abaikan */ }

    injectStyles();

    const contentSrc = player.getAttribute('src');
    let adData = null;
    let adActive = false;

    // Tombol putar menutupi video sampai iklan siap/gagal
    const startBtn = document.createElement('button');
    startBtn.type = 'button';
    startBtn.className = 'preroll-start';
    startBtn.setAttribute('aria-label', 'Putar video');
    startBtn.innerHTML = '<span>▶</span>';
    container.appendChild(startBtn);

    function playContent() {
        startBtn.remove();
        player.controls = true;
        player.play().catch(() => { /* pengguna bisa menekan play sendiri */ });
    }

    // Ambil VAST di awal agar siap saat tombol ditekan
    loadVast(PREROLL_CONFIG.vastUrl)
        .then(data => { adData = data; tryAutoStart(); })
        .catch(err => {
            console.warn('Iklan tidak dimuat:', err);
            startBtn.remove(); // tanpa iklan: pemutar normal
        });

    startBtn.addEventListener('click', () => {
        if (!adData) { playContent(); return; } // iklan belum siap -> langsung video
        startAd(adData, false);
    });

    // ---------- Putar otomatis: setelah konfirmasi 18+, iklan siap, dan pemutar terlihat ----------
    let autoTried = false;
    function tryAutoStart() {
        if (!PREROLL_CONFIG.autoplay || autoTried || adActive || !adData) return;
        if (document.hidden || document.documentElement.classList.contains('age-locked')) return;
        const rect = container.getBoundingClientRect();
        const visible = rect.bottom > 0 && rect.top < window.innerHeight &&
            Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0) >= rect.height * 0.4;
        if (!visible || !startBtn.isConnected) return;
        autoTried = true;
        startAd(adData, true);
    }
    if (PREROLL_CONFIG.autoplay) {
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(tryAutoStart, { threshold: [0.4] }).observe(container);
        }
        document.addEventListener('visibilitychange', tryAutoStart);
        new MutationObserver(tryAutoStart).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }

    function startAd(ad, auto) {
        adActive = true;
        startBtn.remove();
        player.controls = false;
        player.preload = 'auto';
        // Putar otomatis hanya diizinkan browser jika tanpa suara; ketukan pengguna boleh bersuara
        player.muted = !!auto;
        let mediaIndex = 0;
        player.src = ad.mediaUrls[0];

        const ui = document.createElement('div');
        ui.className = 'preroll-ui';
        ui.innerHTML = '<div class="preroll-label">Iklan</div>';
        container.appendChild(ui);

        let visit = null;
        if (ad.clickThrough) {
            visit = document.createElement('button');
            visit.type = 'button';
            visit.className = 'preroll-visit';
            visit.textContent = 'Kunjungi situs ↗';
            visit.addEventListener('click', openClick);
            ui.appendChild(visit);
        }

        let skipBtn = null;
        if (ad.skipOffset) {
            skipBtn = document.createElement('button');
            skipBtn.type = 'button';
            skipBtn.className = 'preroll-skip';
            skipBtn.disabled = true;
            skipBtn.addEventListener('click', () => {
                if (skipBtn.disabled) return;
                firePixels(ad.tracking.skip);
                endAd();
            });
            ui.appendChild(skipBtn);
        }

        let soundBtn = null;
        if (auto) {
            soundBtn = document.createElement('button');
            soundBtn.type = 'button';
            soundBtn.className = 'preroll-sound';
            soundBtn.textContent = '🔇 Nyalakan suara';
            soundBtn.addEventListener('click', () => { player.muted = false; soundBtn.remove(); soundBtn = null; });
            ui.appendChild(soundBtn);
        }

        const label = ui.querySelector('.preroll-label');
        const fired = {};
        let started = false;

        function track(name, urls) {
            if (fired[name]) return;
            fired[name] = true;
            firePixels(urls);
        }

        function skipSeconds() {
            if (!ad.skipOffset) return null;
            if (ad.skipOffset.endsWith('%')) {
                const pct = parseFloat(ad.skipOffset) / 100;
                return player.duration ? player.duration * pct : null;
            }
            return parseTime(ad.skipOffset);
        }

        function onPlaying() {
            if (started) return;
            started = true;
            clearTimeout(watchdog);
            try { sessionStorage.setItem(COOLDOWN_KEY, String(Date.now())); } catch (e) { /* abaikan */ }
            track('impression', ad.impressions);
            track('start', ad.tracking.start);
        }

        function onTimeUpdate() {
            const d = player.duration, t = player.currentTime;
            if (d) {
                if (t >= d * 0.25) track('firstQuartile', ad.tracking.firstQuartile);
                if (t >= d * 0.5) track('midpoint', ad.tracking.midpoint);
                if (t >= d * 0.75) track('thirdQuartile', ad.tracking.thirdQuartile);
                label.textContent = `Iklan · ${Math.max(0, Math.ceil(d - t))}d`;
            }
            if (skipBtn) {
                const at = skipSeconds();
                if (at === null) return;
                const remain = Math.ceil(at - t);
                if (remain > 0) {
                    skipBtn.textContent = `Lewati dalam ${remain}d`;
                } else {
                    skipBtn.disabled = false;
                    skipBtn.textContent = 'Lewati ▶';
                }
            }
        }

        function onEnded() {
            track('complete', ad.tracking.complete);
            endAd();
        }

        function onError() {
            // Coba file video berikutnya sebelum menyerah
            if (mediaIndex < ad.mediaUrls.length - 1) {
                mediaIndex += 1;
                player.src = ad.mediaUrls[mediaIndex];
                player.play().catch(() => {});
                return;
            }
            firePixels(ad.errors, 405);
            endAd();
        }

        // Klik pada video iklan = kunjungi pengiklan
        function onVideoClick() { if (adActive) openClick(); }

        function openClick() {
            if (!ad.clickThrough) return;
            firePixels(ad.clickTracking);
            window.open(expandMacros(ad.clickThrough), '_blank', 'noopener');
        }

        // Jika kembali dari tab pengiklan dan iklan terjeda, lanjutkan
        function resumeIfPaused() {
            if (adActive && !document.hidden && player.paused && !player.ended) player.play().catch(() => {});
        }

        const watchdog = setTimeout(() => {
            if (!started) { firePixels(ad.errors, 402); endAd(); }
        }, PREROLL_CONFIG.startTimeoutMs);

        function endAd(resume = true) {
            if (!adActive) return;
            adActive = false;
            clearTimeout(watchdog);
            player.removeEventListener('playing', onPlaying);
            player.removeEventListener('timeupdate', onTimeUpdate);
            player.removeEventListener('ended', onEnded);
            player.removeEventListener('error', onError);
            player.removeEventListener('click', onVideoClick);
            player.removeEventListener('pause', resumeIfPaused);
            document.removeEventListener('visibilitychange', resumeIfPaused);
            ui.remove();

            // Kembali ke video utama
            player.src = contentSrc;
            player.load();
            if (resume) {
                playContent();
            } else {
                // Autoplay diblokir browser: tampilkan lagi tombol putar, iklan tetap diputar saat diketuk
                player.muted = false;
                player.controls = true;
                container.appendChild(startBtn);
            }
        }

        player.addEventListener('playing', onPlaying);
        player.addEventListener('timeupdate', onTimeUpdate);
        player.addEventListener('ended', onEnded);
        player.addEventListener('error', onError);
        player.addEventListener('click', onVideoClick);
        player.addEventListener('pause', resumeIfPaused);
        document.addEventListener('visibilitychange', resumeIfPaused);

        player.play().catch((err) => {
            // Autoplay diblokir: otomatis -> kembali ke tombol putar; ketukan pengguna -> lewati iklan.
            // Error lain ditangani event 'error' / watchdog.
            if (err && err.name === 'NotAllowedError') {
                if (auto) endAd(false);
                else { firePixels(ad.errors, 400); endAd(); }
            }
        });
    }

    return { isAdActive: () => adActive };
}