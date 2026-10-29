# About You · Michie Archive

© 2026 Husni · Michie Archive. Created by Husni. All rights reserved. Lihat [LICENSE](LICENSE).

Satu halaman: pita film 3D yang bergerak mengikuti lagu "About You", dengan foto dan lirik yang berganti sesuai waktunya.

## Struktur

| Folder | Isi |
|---|---|
| `src/` | Kode yang bisa dibaca dan diedit (`src/index.html`). **Jangan di-deploy.** |
| `about-u/` | Bahan asli: lagu, foto, sampul, `sync-source.js` (waktu + lirik + foto) |
| `build/` | Script yang membuat versi deploy (`build.mjs`, `watermark.py`, `config.json`) |
| `dist/` | **Yang di-deploy.** Kode sudah diacak dan dikunci domain, foto sudah diberi watermark |

## Cara kerja sehari-hari

1. Edit `src/index.html` (atau ganti isi `about-u/`).
2. Cek lokal: `python -m http.server 5178`, buka http://localhost:5178/src/
3. Buat versi deploy: `npm install` (sekali saja), lalu `npm run dist`
4. Cek hasilnya di http://localhost:5178/dist/
5. Commit dan push. Vercel/Netlify hanya mengambil folder `dist/` (sudah diatur di `vercel.json` / `netlify.toml`).

## Domain

Kode di `dist/` hanya mau jalan di domain yang ada di `build/config.json` → `domains`.
Kalau sudah punya domain sendiri (mis. `michie.com`), tambahkan `"michie.com"` dan `".michie.com"`,
hapus `".vercel.app"` kalau tidak dipakai, lalu `npm run dist` dan push lagi.

## Perlindungan yang dipasang

- Kode diacak (obfuscate) dan dipadatkan. Teks lirik, shader, dan data waktu disimpan terenkode.
- Kunci domain: di domain lain halaman langsung jadi kosong.
- Watermark halus di pojok foto. Data EXIF asli (termasuk lokasi GPS) dibuang, diganti info hak cipta.
- Tanda © di tepi film dan di pojok layar.
- `robots.txt` memblokir crawler AI yang mematuhi aturan, header `noai`, dan foto/lagu tidak bisa ditampilkan langsung dari situs lain.
- Lisensi "All rights reserved".

Ini mempersulit peniruan, tapi tidak bisa mencegahnya 100%. Lihat bagian 8 di [ANALISA.md](ANALISA.md).
