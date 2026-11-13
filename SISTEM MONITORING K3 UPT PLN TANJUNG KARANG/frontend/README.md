# Sistem Pemantauan K3L

Frontend React/Vite dengan data Google Spreadsheet melalui Google Apps Script.

## Menjalankan dan memeriksa

Jalankan `npm run dev` dari folder utama workspace, folder proyek di dalamnya, atau folder `frontend`. Ketiganya membuka aplikasi K3L yang sama di **http://127.0.0.1:5175/**. Port dibuat tetap agar tidak tertukar dengan server proyek lain. Jika port 5175 sedang dipakai, Vite akan melaporkan kesalahan dan tidak berpindah port diam-diam.

Jika muncul halaman "Vite development server for your Laravel application", alamat atau folder kerja yang digunakan berasal dari proyek Laravel lain. Aplikasi ini menggunakan React dengan backend Google Apps Script; tidak memerlukan Artisan atau Laravel Sail.

Dari folder `frontend`:

```sh
npm install
npm run dev
npm run build
npm test
npm run test:browser
```

Tes backend menggunakan Spreadsheet simulasi. Tes browser menggunakan hasil `dist`, Chrome/Edge yang sudah terpasang, dan respons API simulasi; tidak menulis ke Spreadsheet asli. Jika lokasi browser berbeda, set `K3L_TEST_BROWSER` ke executable Chromium. Screenshot tes disimpan di `frontend/test-results`.

## Memasang pembaruan Apps Script

Perubahan frontend dan backend harus dipasang bersamaan agar daftar tahun bekerja.

1. Buka Spreadsheet yang dipakai aplikasi, lalu **Extensions > Apps Script**.
2. Gunakan seluruh isi `../backend/AppsScript.js` sebagai kode backend. Pastikan tidak ada fungsi `doGet`/`doPost` versi lama yang menduplikasi handler tersebut di file lain. File lama `frontend/AppsScript.js` sudah dihapus karena hanya mendukung pembaruan realisasi dan tidak memiliki API pengelolaan tahun.
3. Pertahankan konfigurasi `SPREADSHEET_ID` dan konfigurasi operasional pada project Apps Script. Simpan kode.
4. Pilih **Deploy > Manage deployments > Edit**, pilih versi baru, lalu deploy pada deployment yang dipakai aplikasi. Mengedit kode saja belum memperbarui deployment berversi. Lihat [panduan deployment Google](https://developers.google.com/apps-script/concepts/deployments).
5. Buka URL `/exec?action=list_years` milik deployment. Respons sukses harus berisi daftar tahun tab yang tersedia, misalnya `{"status":"success","years":["2026","2027"]}`. Jika muncul `Permintaan GET tidak valid`, deployment masih memakai backend lama.
6. Build ulang frontend dan pasang isi folder `dist` pada hosting yang digunakan.

Alamat deployment default ada di `src/gas-config.js`. Saat pengembangan, Vite meneruskan `/gas` ke alamat tersebut. Hasil build menggunakan URL Apps Script secara langsung, sehingga tidak bergantung pada middleware Vite. Jika memakai deployment atau proxy sendiri, set `VITE_GAS_URL` sebelum build. Perubahan alamat melalui konfigurasi memerlukan build ulang.

### Jika daftar tahun gagal dimuat

Buka [pemeriksaan daftar tahun lokal](http://127.0.0.1:5175/gas?action=list_years) ketika Vite berjalan. Jika responsnya `{"status":"error","message":"Permintaan GET tidak valid"}`, server Apps Script dapat dijangkau tetapi deployment tersebut belum mendukung `list_years`. Memulai ulang Vite tidak memperbarui kode di Google.

Pasang kode `../backend/AppsScript.js` sesuai langkah di atas, dengan mempertahankan konfigurasi operasional project. Pada **Deploy > Manage deployments**, cocokkan deployment ID dengan bagian `/s/.../exec` di `src/gas-config.js` (atau URL `VITE_GAS_URL` jika digunakan). Pilih deployment itu, klik **Edit > New version > Deploy** agar URL tetap sama. Menyimpan kode atau memperbarui deployment lain belum memperbaiki URL yang dipakai aplikasi.

Periksa ulang hingga respons berisi `status: "success"` dan `years` sesuai tab Spreadsheet, kemudian klik **Coba lagi** di aplikasi. Daftar tahun tidak diisi dengan tahun perkiraan ketika layanan gagal. Pesan untuk tamu mengarahkan ke administrator; pesan untuk admin menjelaskan pembaruan deployment. Gangguan koneksi ditampilkan terpisah dari masalah versi backend.

## Perilaku login, sidebar, dan tahun

- Membuka atau me-refresh halaman selalu kembali ke login setelah animasi pembuka. Sesi admin/tamu tidak disimpan di browser. Kembali dari cache navigasi browser juga mengakhiri sesi.
- Sidebar mulai tertutup di desktop dan mobile, lalu menutup setelah memilih menu, klik di luar, memindahkan fokus ke konten, atau menekan Escape.
- Dropdown tahun dibaca dari tab Spreadsheet saat masuk, membuka dialog tahun, dan kembali memfokuskan web. Nama tab harus memuat tahun utuh antara 2000 dan 2100, misalnya `Proker KAM 2027` atau `2027`.
- Dialog **+ Tahun** menampilkan tahun yang sudah tersedia. Memilih atau memasukkan tahun yang sudah ada akan membuka data tersebut.
- **Duplikat Rencana** meminta konfirmasi **Iya/Tidak** sebelum mengirim permintaan. Salinan dibuat di Spreadsheet yang sama; target Plan dan format tetap disalin, nilai Actual dikosongkan, total Actual statis disetel ke 0, dan rumus total dipertahankan.
- Backend mengunci proses pembuatan agar permintaan bersamaan tidak membuat tab ganda. Jika penyiapan salinan gagal, hanya salinan yang baru dibuat yang dibatalkan. Tahun yang sudah ada tidak ditimpa.
- Tautan **Lihat di SPS** dan ekspor PDF mengikuti ID tab tahun yang aktif.

## Pemeriksaan setelah deployment

Masuk, pastikan 2027 muncul jika tabnya sudah tersedia, lalu buka tab itu. Untuk menambah tahun baru, pilih tahun sumber, isi tahun tujuan, periksa konfirmasi, dan lanjutkan hanya jika memang ingin membuat salinannya. Pastikan tab baru muncul di Spreadsheet, targetnya sama, realisasinya 0, dan tahun tetap tersedia setelah refresh dan login kembali.
