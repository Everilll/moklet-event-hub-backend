# Moklet Event Hub — Backend Requirements

Dokumen ini untuk tim backend & AI agent planner yang akan mendesain schema database dan API. Fokusnya di domain entity, relasi, dan business rules — bukan UI/UX.

## Tech Stack

| Layer | Stack |
|---|---|
| Runtime/Framework | NestJS |
| Database | PostgreSQL |
| ORM | Prisma 7.8.0 |

## Konteks Singkat

Platform manajemen event kesiswaan 1 sekolah (SMK Telkom Malang). Skala data: ratusan–~2000 siswa, jumlah event & tim per event kecil. Tidak butuh sharding/caching khusus — desain schema relasional standar sudah cukup.

## Domain Entity & Business Rules

> Field yang disebut di bawah adalah kebutuhan minimal (fungsional), bukan struktur tabel final — silakan didesain lebih lanjut (naming, tipe data, index) sesuai konvensi Prisma.

### 1. `Student` (Data Master Siswa)
- Diinput/diedit/dihapus oleh Admin Kesiswaan (bukan cuma input sekali di awal — perlu CRUD penuh)
- Field minimal: nama, kelas, (opsional: NIS/NISN kalau ada)
- **Rule:** satu baris `Student` hanya boleh terpasang ke tepat satu `Account` — enforce dengan unique constraint (relasi 1:1 opsional dari sisi Student, wajib dari sisi Account setelah verifikasi)
- Kelas sebaiknya jadi entity terpisah (`Class`) kalau butuh dropdown bertingkat Kelas → Nama, biar gampang query "siswa di kelas X"

### 2. `Account` (User Login)
- Dibuat dari OAuth Gmail institusi
- Field: email institusi, role (`SISWA` / `PANITIA` / `ADMIN_KESISWAAN`), status verifikasi OTP
- **Rule:** akun `SISWA` wajib terhubung ke tepat satu `Student` (identity binding) sebelum bisa akses fitur registrasi
- **Rule:** email harus dari domain institusi (validasi di service layer, bukan DB, tapi worth dicatat)

### 3. `Event`
- Field: nama, deskripsi, status (`ONGOING` / `CLOSED`), tanggal event, dibuat oleh `PANITIA`
- Relasi: satu `Event` punya banyak `Category` (cabang lomba)
- **Rule:** `Event` dengan status `CLOSED` dikecualikan dari query listing utama (butuh index di kolom status)

### 4. `Category` (Cabang Lomba dalam satu Event)
- Field: nama cabang lomba, `min_member`, `max_member`, guidebook file (URL/path PDF)
- **Rule:** `max_member = 1` → alur individu; `max_member > 1` → alur tim
- Relasi: satu `Category` punya banyak `Team` dan/atau `Registration` (individu)

### 5. `Team`
- Field: kode tim (unique, 6 digit), `leaderId` (FK ke Student), status (`OPEN` / `LOCKED` / `FULL`), `categoryId`
- **Rule:** `current_count` idealnya dihitung dari relasi `TeamMember` (count), bukan disimpan redundant, kecuali butuh performa lebih — kalau disimpan redundant, wajib di-update dalam transaksi yang sama dengan insert/delete member
- **Rule:** status `FULL` otomatis ter-set ketika jumlah member == `max_member` dari `Category` terkait — kode tim jadi tidak valid untuk join
- **Rule:** status `LOCKED` di-set manual oleh leader, hanya boleh terjadi kalau jumlah member >= `min_member`
- **Rule:** join tim (insert `TeamMember`) wajib dibungkus transaksi dengan row-level lock (`SELECT ... FOR UPDATE` atau setara di Prisma) untuk cegah race condition saat slot terakhir direbutkan bersamaan

### 6. `TeamMember`
- Relasi many-to-many antara `Team` dan `Student`, dengan flag `isLeader`
- **Rule:** satu `Student` hanya boleh jadi member di satu `Team` per `Category` yang sama (unique constraint kombinasi `studentId` + `categoryId` lewat relasi, atau langsung di level `Registration` — lihat poin 7)
- **Rule:** member (bukan leader) boleh keluar (`DELETE`) selama `Team.status != LOCKED` dan `!= FULL`
- **Rule:** kalau leader keluar, kepemimpinan pindah ke member dengan `joinedAt` paling awal

### 7. `Registration`
- Merepresentasikan pendaftaran siswa ke suatu `Category` — baik individu maupun sebagai anggota tim
- Field: `studentId`, `categoryId`, `teamId` (nullable, null kalau individu), timestamp
- **Rule (anti-daftar ganda):** unique constraint pada kombinasi `studentId` + `categoryId` — inilah yang jadi sumber kebenaran untuk cek "sudah terdaftar di cabang ini apa belum", dipakai baik dari alur individu maupun tim
- Ini entity kunci yang dipakai Excel Exporter untuk generate rekap

### 8. `Announcement`
- Field: judul, isi, dibuat oleh `PANITIA`, timestamp
- **Rule:** query listing utama cuma ambil 3 terbaru; sisanya masuk halaman arsip (bisa cukup dengan `ORDER BY createdAt DESC` + pagination, gak perlu status terpisah kecuali mau soft-delete/unpublish)

### 9. `ExportLog` (opsional, kalau mau audit trail)
- Catatan kapan & oleh siapa Excel rekap di-generate untuk suatu `Category`/`Event`

## Cross-Cutting Business Rules (penting buat schema & service layer)

- **Identity binding:** `Student` ↔ `Account` harus 1:1 begitu terverifikasi — cegah race condition juga di sini kalau dua akun coba klaim `Student` yang sama bersamaan
- **Concurrency guard:** operasi yang mengubah jumlah anggota tim (`join`, `leave`) wajib transaksional
- **Cascade rules:** tentukan eksplisit — kalau `Student` dihapus dari data master (misal pindah sekolah), bagaimana nasib `Registration`/`TeamMember` terkait? (soft-delete lebih aman daripada hard delete demi histori rekap)
- **Enum yang dipakai:** `Role` (SISWA/PANITIA/ADMIN_KESISWAAN), `EventStatus` (ONGOING/CLOSED), `TeamStatus` (OPEN/LOCKED/FULL)

## Non-Functional Requirements (Backend)

- Rate limiting di endpoint OTP (cegah spam request kode verifikasi)
- Semua operasi yang mengubah state kuota (join/leave team) harus atomic (DB transaction)
- Export ke Excel harus tetap responsif meski diakses banyak panitia mendekati hari-H
- Skala data kecil (1 sekolah) — prioritaskan correctness & constraint di level DB (unique, foreign key, check constraint) daripada optimasi performa prematur

## Out of Scope (Backend)

- Live scoring / penjurian real-time
- Push notification service (versi awal)
- Integrasi akun guru/wali kelas