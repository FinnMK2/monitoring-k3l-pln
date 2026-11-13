# Sistem Monitoring K3L UPT PLN Tanjung Karang

Aplikasi pemantauan program K3L menggunakan React/Vite dan backend Google Apps Script yang terhubung ke Google Sheets.

## Menjalankan proyek

Dari direktori repository ini:

```powershell
npm --prefix "./SISTEM MONITORING K3 UPT PLN TANJUNG KARANG/frontend" ci
npm run dev
```

Buka **http://127.0.0.1:5175/**. Jika port tersebut sudah digunakan oleh aplikasi K3L, buka server yang sudah berjalan.

```powershell
npm run build
npm --prefix "./SISTEM MONITORING K3 UPT PLN TANJUNG KARANG/frontend" test
npm --prefix "./SISTEM MONITORING K3 UPT PLN TANJUNG KARANG/frontend" run test:browser
```

Tes browser memerlukan hasil build dan Chrome/Edge yang terpasang. Tes menggunakan API simulasi.

## Struktur

- `SISTEM MONITORING K3 UPT PLN TANJUNG KARANG/frontend`: aplikasi React, konfigurasi Vite, dan tes browser.
- `SISTEM MONITORING K3 UPT PLN TANJUNG KARANG/backend`: kode Google Apps Script dan tes backend.
- `package.json` di root: perintah untuk menjalankan frontend dari root repository.

Petunjuk konfigurasi dan deployment Apps Script tersedia di [panduan frontend](<SISTEM MONITORING K3 UPT PLN TANJUNG KARANG/frontend/README.md>).

## Hosting di Vercel

1. Push commit terbaru ke repository GitHub `FinnMK2/monitoring-k3l-pln`.
2. Masuk ke [Vercel](https://vercel.com/new) dengan akun yang dapat mengakses repository tersebut, lalu import repository.
3. Atur **Root Directory** menjadi `SISTEM MONITORING K3 UPT PLN TANJUNG KARANG/frontend`.
4. Gunakan **Framework Preset: Vite**, **Install Command: npm ci**, **Build Command: npm run build**, dan **Output Directory: dist**. Pilih **Node.js 24.x**, sesuai versi mayor yang digunakan untuk pemeriksaan lokal. File `frontend/vercel.json` sudah menetapkan perintah build dan routing aplikasi.
5. Klik **Deploy**, tunggu status **Ready**, kemudian buka URL yang diberikan Vercel.

Frontend menggunakan URL Apps Script di `frontend/src/gas-config.js` pada hasil build. Environment variable tambahan tidak diperlukan jika deployment tersebut tetap digunakan. Untuk menggantinya, tambahkan `VITE_GAS_URL` di Vercel dengan URL Web App Apps Script yang berakhiran `/exec`, lalu redeploy. Nilai ini adalah URL yang digunakan browser, bukan tempat menyimpan token atau password.

Backend Google Apps Script tetap dijalankan oleh Google. Folder backend tidak perlu diunggah sebagai fungsi Vercel. Pengaturan **Root Directory** di atas membuat Vercel memasang dependency dari package frontend yang benar.

Setelah deploy, buka aplikasi sebagai tamu dan pastikan daftar tahun serta data tampil. Untuk tautan reminder WhatsApp, ubah `FRONTEND_URL` di Apps Script menjadi URL produksi yang benar setelah Vercel memberikannya, simpan, dan perbarui deployment Apps Script yang dipakai aplikasi.

Referensi: [Vite di Vercel](https://vercel.com/docs/frameworks/frontend/vite), [konfigurasi build](https://vercel.com/docs/builds/configure-a-build).

## Tim

| Anggota | Modul utama |
| --- | --- |
| Nabila | Dashboard dan analitik monitoring |
| Aditya | Perencanaan dan manajemen kegiatan |
| Abel | Realisasi, log, dan integrasi data |
| Mei | Autentikasi, hak akses, dan notifikasi |

Pembagian fitur, lokasi kode saat ini, dan alur kerja Git dijelaskan di [CONTRIBUTING.md](CONTRIBUTING.md).

Kode awal merupakan hasil kerja bersama. Commit impor awal mencatat anggota yang berkontribusi melalui author dan trailer `Co-authored-by`. Perubahan berikutnya dicatat melalui commit masing-masing anggota.
