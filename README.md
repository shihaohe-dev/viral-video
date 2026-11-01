# livevidhot (Vid18+)

## Struktur folder

```
/
├── index.html        Halaman utama (30 video per halaman + tombol halaman)
├── detail.html       Pemutar video (?id=...)
├── admin.html        Panel admin film (termasuk layar login)
├── admin-ads.html    Panel admin iklan
├── _headers          Cache & keamanan Cloudflare Pages
├── _redirects        Rewrite /v/judul-video-<id> -> detail.html
├── css/
│   ├── style.css     Gaya situs publik (index + detail)
│   └── admin.css     Gaya semua halaman admin
└── js/
    ├── config.js     Koneksi Supabase (satu-satunya tempat URL & key)
    ├── common.js     Helper, kartu video, grid, tombol halaman, konfirmasi 18+
    ├── home.js       Logika index.html
    ├── detail.js     Logika detail.html
    ├── preroll.js    Iklan VAST pre-roll (HilltopAds)
    ├── auth.js       Login/cek admin (Supabase Auth)
    ├── admin.js      Logika admin.html (+ layar login)
    └── admin-ads.js  Logika admin-ads.html
```

Jumlah video per halaman: ubah `PAGE_SIZE` di `js/home.js` (pakai kelipatan 30
agar baris grid selalu penuh di layar 2, 3, dan 5 kolom).

Konfigurasi dan query Supabase (tabel `movies`, `ads`, `ad_analytics`) tidak diubah.
Login admin memakai Supabase Auth + tabel `admin_users` (lihat `../supabase-sql/README.md`).

## Alamat video
Link video berbentuk `/v/judul-video-<id>`. Id di ujung dipakai untuk mencari video,
jadi judul kembar tidak bentrok dan judul boleh diganti tanpa mematikan link lama.
Link lama `detail.html?id=<id>` tetap berfungsi. Jangan ubah path di `detail.html`
menjadi relatif (harus `/css/...`, `/js/...`) karena halaman dibuka dari `/v/...`.
Tes lokal: `npx wrangler pages dev .` (server statis biasa tidak membaca `_redirects`).
