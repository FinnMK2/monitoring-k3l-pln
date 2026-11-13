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

## Tim

| Anggota | Modul utama |
| --- | --- |
| Nabila | Dashboard dan analitik monitoring |
| Aditya | Perencanaan dan manajemen kegiatan |
| Abel | Realisasi, log, dan integrasi data |
| Mei | Autentikasi, hak akses, dan notifikasi |

Pembagian fitur, lokasi kode saat ini, dan alur kerja Git dijelaskan di [CONTRIBUTING.md](CONTRIBUTING.md).

Kode awal merupakan hasil kerja bersama. Commit impor awal mencatat anggota yang berkontribusi melalui author dan trailer `Co-authored-by`. Perubahan berikutnya dicatat melalui commit masing-masing anggota.
