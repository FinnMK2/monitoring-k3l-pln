# Panduan kontribusi tim K3L

## Pembagian tanggung jawab

| Anggota | Modul | Fitur | Branch untuk pekerjaan berikutnya |
| --- | --- | --- | --- |
| Nabila | Dashboard dan analitik monitoring | Beranda pemantauan, kartu statistik, grafik tren kepatuhan bulanan, distribusi status, kepatuhan per kategori, filter tahun dan periode | `feat/nabila-dashboard` |
| Aditya | Perencanaan dan manajemen kegiatan | Daftar kegiatan, tambah/edit/hapus kegiatan, kategori, PIC, target rencana, filter kegiatan, duplikasi rencana tahun baru | `feat/aditya-kegiatan` |
| Abel | Realisasi, log, dan integrasi data | Target vs realisasi, pencatatan progres, log aktivitas, tabel spreadsheet, sinkronisasi Google Sheets, data berdasarkan periode | `feat/abel-integrasi` |
| Mei | Autentikasi, hak akses, dan notifikasi | Login admin/tamu, role dan pembatasan akses, profil, logout, alert kegiatan pending, reminder WhatsApp | `feat/mei-autentikasi` |

## Lokasi kode saat ini

Path berikut relatif terhadap folder `SISTEM MONITORING K3 UPT PLN TANJUNG KARANG` di dalam repository.

| Anggota | Bagian kode yang terkait |
| --- | --- |
| Nabila | `frontend/src/App.jsx`: tampilan `beranda`, perhitungan statistik, grafik, dan filter periode |
| Aditya | `frontend/src/App.jsx`: `formulir-list`, `entri-baru`, handler tambah/edit/hapus dan tahun; `frontend/src/components/Modals.jsx`: dialog kegiatan dan tahun; `backend/AppsScript.js`: operasi kegiatan dan tahun |
| Abel | `frontend/src/components/LogAktivitas.jsx`; `frontend/src/App.jsx`: `requestGAS`, `fetchAvailableYears`, `fetchDataFromGAS`, `syncWithGAS`, `handleSaveRealisasi`; `frontend/vite.config.js`; `frontend/src/gas-config.js`; `backend/AppsScript.js`: pembacaan dan pembaruan data |
| Mei | `frontend/src/components/Login.jsx`; `frontend/src/App.jsx`: login/logout, pemeriksaan role dan notifikasi; `frontend/src/components/Modals.jsx`: profil/pengaturan; `backend/AppsScript.js`: login dan reminder WhatsApp |

`App.jsx`, `Modals.jsx`, dan `AppsScript.js` digunakan bersama oleh beberapa modul. Sepakati bagian yang dikerjakan sebelum mengubah file yang sama. Pemisahan komponen dapat dilakukan melalui pekerjaan tersendiri jika diperlukan.

## Mencatat pekerjaan yang sudah dilakukan bersama

Commit impor awal mencatat Abel sebagai author dan Nabila, Aditya, serta Mei sebagai co-author sesuai konfirmasi tim. Jobdesk di atas menjelaskan tanggung jawab fitur; riwayat Git dimulai pada saat proyek diimpor.

Gunakan email yang terhubung ke akun GitHub masing-masing agar atribusi commit dapat dikenali. Alamat noreply GitHub dapat dipakai jika diinginkan. Email author dan co-author tersimpan dalam metadata commit.

Untuk pekerjaan berikutnya yang dilakukan bersama, tambahkan trailer setelah satu baris kosong pada pesan commit:

```text
feat: ringkasan perubahan yang dikerjakan bersama

Co-authored-by: Nama Rekan <email-yang-disepakati>
```

Gunakan trailer hanya untuk rekan yang ikut mengerjakan perubahan tersebut. Referensi: [commit dengan beberapa author](https://docs.github.com/en/pull-requests/how-tos/commit-changes/creating-a-commit-with-multiple-authors).

## Alur kerja setelah repository GitHub tersedia

Pemilik repository menambahkan anggota tim sebagai collaborator. Setiap anggota melakukan clone repository dan mengatur identitas Git di repository lokalnya:

```powershell
git config user.name "Nama Anda"
git config user.email "email-GitHub-Anda"
```

Contoh memulai pekerjaan Abel dari `main` yang terbaru:

```powershell
git switch main
git pull --ff-only origin main
git switch -c feat/abel-integrasi
```

Setelah perubahan siap, periksa diff dan tambahkan file yang memang dikerjakan. Contoh berikut berlaku bila perubahan berada di komponen log:

```powershell
git diff
git add "SISTEM MONITORING K3 UPT PLN TANJUNG KARANG/frontend/src/components/LogAktivitas.jsx"
git diff --cached
git commit -m "feat: perbarui tampilan log aktivitas"
git push -u origin feat/abel-integrasi
```

Buat Pull Request menuju `main`, jelaskan perubahan dan hasil pemeriksaannya, lalu minta review anggota lain. Jika terjadi konflik, cocokkan kedua perubahan sebelum menggabungkannya.

Untuk merge pertama suatu branch fitur, opsi **Create a merge commit** mempertahankan commit masing-masing anggota. Jika memakai squash untuk perubahan beberapa orang, pastikan trailer co-author yang relevan tetap disertakan.

## Pemeriksaan perubahan

- Perubahan frontend: jalankan `npm run build` dari root repository.
- Perubahan logika backend: jalankan `npm --prefix "./SISTEM MONITORING K3 UPT PLN TANJUNG KARANG/frontend" test`.
- Perubahan alur login, tahun, atau navigasi: setelah build, jalankan `npm --prefix "./SISTEM MONITORING K3 UPT PLN TANJUNG KARANG/frontend" run test:browser`.

Tes backend dan browser yang tersedia menggunakan data simulasi. Pembaruan Apps Script di Google dilakukan terpisah dari push Git; ikuti panduan deployment di README frontend.
