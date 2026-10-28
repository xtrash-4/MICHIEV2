# Analisa holmchrome.byholm.co

Diperiksa 29 Okt 2026, dari HTML, CSS dan bundle JS yang dikirim situs ke browser, ditambah tangkapan layar halaman yang sedang berjalan.

## 1. Stack

| Bagian | Temuan |
|---|---|
| Build | Vite (`/assets/index-[hash].js`, ~840 KB; CSS ~16 KB) |
| 3D | **Three.js** (renderer WebGL, `ShaderMaterial` + `onBeforeCompile`, render target untuk picking) |
| Animasi | **GSAP** (timeline untuk loader, transisi, dan reveal teks) |
| Lain-lain | Draco decoder (model 3D terkompresi), router SPA sendiri (`/`, `/index`, `/journal`, `/info`, `/privacy`, `/imprint`) |
| Bahasa kode | Komentar dan nama variabel dalam bahasa Turki (mis. `vizor`, `imlec`, `perde`, `sayac`) |
| DOM | Hampir kosong: `<main id="app">`. Semua dibangun oleh JS. Ada `<noscript>` sebagai cadangan untuk SEO. |

Komentar di HTML menyebut "template alıcısı" (pembeli template), jadi ini **template komersial** buatan studio HOLM.

## 2. Efek-efek utama dan cara kerjanya

### a. Loader iris kamera
- Fragment shader layar penuh. Bukaan diafragma = irisan dari N cakram besar; tiap cakram digeser menjauhi bukaan, jadi tepinya membentuk poligon bulat seperti iris asli.
- Bilah iris punya kilau metalik yang berputar sesuai sudut, garis sambungan antar bilah, dan tepi tajam yang terang.
- Foto hitam-putih berganti-ganti di dalam bukaan (iris menutup → ganti foto → membuka, dengan kilatan terang).
- Akhirnya bagian dalam bukaan jadi transparan (`uSeffaf`) dan iris membuka melebihi layar, jadi situsnya terlihat lewat lubang iris.

### b. Pita film 3D (halaman Work)
- Tiap frame adalah plane bersegmen. **Vertex shader** menekuk plane mengikuti kurva:
  - `stripS(i) = mod(i + scroll, total) - total/2` → posisi pusat frame di sepanjang pita (pembungkusan dihitung per frame supaya frame tidak robek).
  - `curvePos(s)` = gelombang sinus kecil yang amplitudonya naik sesuai kecepatan scroll (`rest + |vel| * amp`).
  - `curveBasis(s)` = basis tangen/normal + **puntiran** (twist) `0.68 * sin(2s + 0.7)` rad. Puntiran inilah yang membuat pita terlihat melayang dan meliuk.
- Proporsi film 35mm asli: pitch 38mm × lebar 35mm, jendela gambar 36×24mm. Lubang perforasi dibuang (`discard`) supaya latar terlihat tembus.
- Kamera di (0.6, -0.45, 2.37) melihat ke (0, 0.05, 0), seluruh grup diputar -0.1 rad (diagonal).
- Frame yang jauh memudar ke warna latar sesuai jarak dari kamera; tepi layar sedikit digelapkan.
- **Hitam-putih di pinggir, berwarna di tengah**: saturasi = `1 - smoothstep(0.3, 0.85, |posisi frame|)`.

### c. Scroll
- Wheel → `target -= deltaY * 0.0016`; `current` mengejar dengan peluruhan eksponensial (tau 0.32 s).
- Kecepatan dibatasi, lalu dikirim ke shader → makin cepat scroll, makin besar gelombangnya.
- Saat diam, scroll "ditarik magnet" ke frame terdekat.
- Intro: setelah loader, pita "meluncur" 2.2 unit dalam 2.6 detik (gelombangnya muncul karena kecepatan).

### d. Hover, loupe, ripple, fokus
- **Picking lewat GPU**: render 1 piksel di bawah kursor ke render target; R = id frame, GB = UV gambar. (Raycaster biasa tidak bisa, karena geometrinya ditekuk di shader.)
- **Hover**: frame terangkat ke arah kamera dan sisi yang jauh dari kursor sedikit melengkung.
- **Loupe**: kursor berubah jadi lingkaran 140px; di dalam lingkaran itu shader memperbesar gambar 1.35× dan menampilkannya berwarna.
- **Klik**: riak sinus menyebar dari titik klik (0.5 detik), lalu frame "terbang" ke depan kamera dan menjadi datar. Selama terbang ada gelombang kecil yang fasenya mengikuti progres terbang, jadi berhenti sendiri saat tiba.
- Latar memudar ke hitam dan panel info proyek muncul dengan reveal per baris.

### e. Halaman Info
- Scene sendiri yang dirender ke tekstur, lalu diberi pass akhir: **distorsi barrel**, sudut layar membulat, chromatic aberration, dan gelap di sudut, seperti layar viewfinder kamera.
- Bracket AF, data eksposur, dan nama besar dengan huruf yang naik satu per satu.
- Paragraf "dibaca" saat scroll: baris berubah dari redup ke terang.

### f. Lainnya (belum dibuat ulang)
- **Index**: mode contact sheet, yaitu pita berubah jadi lembar kontak (`uSheetMix`) dengan tonjolan Gaussian dan tekukan sesuai kecepatan.
- **Journal**: halaman majalah yang dibalik (page curl), cetakan foto "dicuci" di bak developer (riak cairan, kilau basah), dan efek film terbakar (lubang dengan pinggiran bara).
- **Transisi antar halaman**: film maju lewat gate proyektor (motion blur di ruang film, weave, flicker).
- Teks menu "rolling" (teks digandakan lalu digeser -50% saat hover), panel menu dengan backdrop blur.

## 3. Hasil rekonstruksi (`index.html`)

Kodenya ditulis ulang sendiri, **bukan** salinan kode mereka. Isi:

- Loader iris + transisi halaman dengan iris (tutup → ganti halaman → buka)
- Pita film 3D: tekukan, puntiran, gelombang dari kecepatan, fade, B/W vs warna di tengah, perforasi, tulisan di tepi film
- Scroll wheel, drag/touch, magnet ke frame, panah kiri/kanan, intro meluncur
- Picking lewat GPU, hover lift/curl, loupe, kursor kustom dengan label VIEW
- Klik → ripple → frame terbang ke depan → mode proyek gelap, panel kiri/kanan, Prev/Next, Esc/Back
- HUD (nama, penghitung frame, eksposur), menu bulat + panel dengan blur, teks rolling
- Halaman Info: viewfinder (barrel, sudut bulat, chromatic aberration, grain), bracket AF, nama per huruf, paragraf yang menyala saat scroll
- Responsif (kamera mundur di layar potret, layout HP)

**Belum dibuat**: halaman Index (contact sheet), Journal (page flip, bak developer, film terbakar), dan transisi gate proyektor.

## 4. Cara pakai

1. Ganti `CONFIG` di bagian atas `<script type="module">`: `brand`, `stock`, `code`, dan daftar `photos` (judul, klien, ISO, f-stop, shutter).
2. Ganti `src` foto ke file milikmu sendiri, mis. `foto/01.jpg` (taruh di folder yang sama). Sekarang masih memakai gambar contoh dari picsum.photos.
3. Jalankan lewat server lokal (module + gambar tidak jalan dari `file://`):
   `python -m http.server 5178 --directory rollfilm` → buka http://localhost:5178
4. Angka-angka "rasa" ada di objek `P` (twist, kecepatan, loupe, fokus, dll).

## 5. Mode musik + lirik (autoplay)

Setelah loader muncul tombol **▶ PLAY**. Browser selalu memblokir suara sebelum pengunjung klik sekali, jadi tombol ini wajib. Setelah diklik, semuanya jalan sendiri:

- Lagu diputar, lalu tiap baris lirik muncul di waktunya dengan animasi naik per kata.
- Foto ikut ganti di waktu yang sama.
  - Mode **Strip**: pita film bergeser ke foto itu.
  - Mode **Focus**: foto terbang ke depan dan tampil besar.
- Pita film ikut bergelombang mengikuti bass lagu.
- Bar bawah berisi Play/Pause, waktu, garis progres (klik untuk lompat), dan tombol ganti mode Strip/Focus. Tombol **Spasi** = play/pause.
- Kalau file lagu belum ada, web tetap jalan dengan timer diam ("· demo"), jadi timing lirik dan foto bisa dicek dulu.

### Langkah pasang lagu kamu

1. Taruh lagu di `rollfilm/music/lagu.mp3` (atau ubah `CONFIG.music.src`).
2. Tulis lirik format LRC: `[menit:detik.perseratus] teks`. Contohnya ada di `music/lirik-contoh.lrc`.
   - Tambah `{n}` di akhir baris untuk memilih foto ke-n, mis. `[00:16.00] wajahmu {3}`.
   - Tanpa `{n}`, foto maju satu per satu.
   - Baris kosong seperti `[00:28.50]` membuat lirik hilang (jeda musik), tapi fotonya tetap ganti.
3. Tempel liriknya di `CONFIG.music.lrc`, **atau** isi `lrcSrc: 'music/lirik.lrc'`.
4. Kalau terasa telat atau kecepatan, atur:
   - `offset`: geser semua (detik). Positif = lebih cepat, negatif = lebih lambat.
   - `photoLead`: foto ganti sekian detik **sebelum** liriknya muncul.
5. `mode: 'strip'` atau `'focus'` untuk tampilan awal.

Cara cepat dapat timing: putar lagu di pemutar musik, catat detik tiap baris mulai, lalu tulis ke format di atas. Banyak lagu juga sudah punya file `.lrc` yang tinggal dipakai, asal lagunya milikmu atau kamu punya izin memakainya.

## 6. Versi satu halaman "About You" (index.html sekarang)

`index.html` sekarang hanya berisi pita film yang bergerak sendiri mengikuti lagu. Versi lengkap yang lama (menu, Info, mode proyek) disimpan di `versi-lengkap.html`.

Semua bahan ada di folder `about-u/` (diambil dari michie-archive, bagian About U):

| File | Isi |
|---|---|
| `lagu.mp3` | lagu (~60 detik) |
| `foto1.jpg` … `foto10.jpg` | 10 foto di pita |
| `album.jpg` | sampul di tombol play dan pojok kiri bawah |
| `sync-source.js` | salinan `index.js` mereka. Halaman membaca bagian `syncData` (waktu, lirik, foto) langsung dari file ini, jadi tidak ada lirik yang diketik ulang |

Cara kerja:
- Setelah loader iris, muncul tombol bulat (sampul album). Klik → lagu mulai.
- Tiap baris di `syncData` muncul di waktunya, dan pita bergeser ke foto pasangannya. Foto di tengah berwarna, sisanya hitam-putih.
- Pita bergelombang dan frame tengah sedikit "berdenyut" mengikuti bass.
- Klik pita = play/pause. Spasi = play/pause. Klik garis tipis paling bawah = lompat. Saat pause, pita bisa di-scroll/drag.
- Setelah lagu habis muncul "Play again".

Tipografi lirik (di tengah, di atas pita):
- Baris pendek (1–2 kata) → satu kata besar serif miring.
- Baris panjang → 2–3 baris bertangga, huruf sans tebal, kata terakhir serif miring.
- Huruf naik satu per satu dengan blur, lalu "terisi" putih seperti karaoke selama baris dinyanyikan.
- Di atasnya ada baris kecil: nomor baris, waktu, nomor frame.
- Baris yang diulang meninggalkan bayangan baris sebelumnya, dan diberi tanda ×2, ×3.

Pengaturan di `CONFIG` (atas `<script type="module">`):
- `offset`: geser semua lirik dan foto (detik). Positif = lebih cepat.
- `photoLead`: foto ganti sekian detik sebelum liriknya.
- `beat`: `false` kalau pita tidak mau ikut bass.
- `stock`, `code`: tulisan di tepi film. `title`, `artist`: judul di layar.
- Mau ganti lagu/lirik/foto: ganti file di `about-u/`, lalu ubah `syncData` di `sync-source.js` (format `{ time: 7.5, text: "...", img: "foto2.jpg" }`).

Jalankan tetap lewat server lokal: `python -m http.server 5178 --directory rollfilm`.

### Android dan perangkat lain

- **Kualitas otomatis**: di HP, tekstur foto diperkecil (maks 1024px), frame film lebih ringan, dan resolusi render dibatasi. Kalau frame rate turun di bawah ~45 fps, resolusi diturunkan sendiri sedikit demi sedikit.
- **HP tegak (portrait)**: pita lebih besar dan agak ke atas. Lirik pindah ke ruang kosong di bawah pita dengan tulisan gelap supaya jelas terbaca.
- **Layar lebar**: lirik tetap di tengah, di atas pita, dengan bayangan lembut di belakangnya.
- **Tidak kaku saat diam**: gelombang pita terus mengalir pelan, kamera melayang sedikit, dan foto tengah zoom pelan (Ken Burns). Saat lagu jalan, pita bergeser pelan melintasi foto. Lirik ikut melayang dan membesar pelan, dengan garis progres di bawahnya. Saat pause, pita bergoyang di sekitar foto yang sedang aktif. Sebelum play dan setelah selesai, pita berjalan pelan sendiri.
- **Gerak ikut perangkat**: kamera condong mengikuti mouse (desktop) atau kemiringan HP.
- **Fitur HP**: judul, sampul, dan tombol play/pause muncul di notifikasi/lock screen Android. Layar juga tidak meredup selama lagu diputar.
- Angka pengaturannya ada di `P`: `pan` (seberapa jauh pita bergeser per foto), `idleDrift`, `idleAfter`, `parallax`.

**Coba di HP**: jalankan server dengan `python -m http.server 5178 --directory rollfilm --bind 0.0.0.0`, lalu buka `http://<IP-komputer>:5178` di HP (satu WiFi). Kemiringan HP dan "layar tidak meredup" hanya jalan lewat **https**, jadi fitur itu baru aktif setelah web diunggah ke hosting seperti Vercel atau Netlify.

## 7. Catatan hak cipta

Situs asli adalah template berbayar milik HOLM, termasuk nama HOLMCHROME, foto potret, teks, dan kodenya. Rekonstruksi ini meniru **teknik dan rasa** efeknya dengan kode baru, memakai brand dan foto placeholder. Jangan pakai foto, logo, nama, atau teks mereka. Kalau mau versi yang benar-benar identik, beli templatenya dari mereka.

Isi folder `about-u/` (lagu, lirik, foto) milik pemiliknya masing-masing. Lagu "About You" milik The 1975 dan labelnya. Untuk dipakai pribadi tidak masalah, tapi kalau web ini mau dipublikasikan, pastikan kamu punya izin memakai lagu dan foto itu.
