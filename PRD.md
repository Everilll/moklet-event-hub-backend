# Moklet Event Hub — Product Requirements Document (PRD) Final

> **Versi:** 2.0 (Final)  
> **Terakhir diperbarui:** 29 Juli 2026  
> **Status:** ✅ Backend 100% Selesai & Live di Production (Railway)

Dokumen ini merangkum keseluruhan spesifikasi produk **Moklet Event Hub** yang telah selesai diimplementasikan. Diperuntukkan untuk tim Backend sebagai *single source of truth*.

---

## 1. Konteks Produk

Platform manajemen event kesiswaan internal **SMK Telkom Malang (Moklet)**. Memfasilitasi seluruh siklus hidup event sekolah: dari pembuatan event oleh OSIS, pendaftaran lomba oleh siswa (individu maupun tim), hingga rekapitulasi data peserta oleh panitia.

**Skala data:** ±2.000 siswa aktif, puluhan event per tahun ajaran. Tidak membutuhkan *sharding* atau *caching* khusus.

---

## 2. Tech Stack

| Layer | Stack |
|---|---|
| Runtime / Framework | NestJS 11 (TypeScript) |
| Database | PostgreSQL (Prisma Accelerate / Prisma Postgres) |
| ORM | Prisma 7.8.0 (Driver Adapter: `@prisma/adapter-pg`) |
| Auth | JWT + Google OAuth 2.0 + OTP (Email) |
| File Storage | Cloudinary (Image, PDF) |
| Export | ExcelJS (`.xlsx`) |
| Deployment | Docker → Railway |
| Email | Resend (via SMTP / Nodemailer) |

---

## 3. Sistem Role & Hak Akses (RBAC)

### 3.1. Role Enum: `SISWA`, `PANITIA`, `ADMIN_KESISWAAN`

| Kasta | Role di DB | Siapa | Cara Mendapat Akun |
|---|---|---|---|
| **Admin Kesiswaan** | `ADMIN_KESISWAAN` | Guru / Staf TU / Pembina OSIS | Dibuat via *Database Seed* |
| **Panitia Inti (OSIS)** | `PANITIA` | Ketua OSIS / MPK | Dibuat oleh Admin (`POST /auth/panitia`) |
| **Panitia Event** | `SISWA` + tabel `EventCommitteeMember` | Siswa biasa yang direkrut untuk 1 event | Ditambahkan oleh Panitia Inti |
| **Siswa Biasa** | `SISWA` | Peserta lomba | Self-register (Google OAuth / Email+Password) |

### 3.2. Konsep Identity Binding
Akun login (`Account`) dan data sekolah (`Student`) adalah dua entitas terpisah.
Setelah siswa berhasil membuat akun dan terverifikasi, dia **wajib** menautkan akunnya ke data siswa resmi dari sekolah (`POST /auth/bind-identity`).
Constraint `Account.studentId @unique` menjamin relasi 1:1 yang ketat.

---

## 4. Domain Entity & Business Rules (Final)

### 4.1. `SystemSetting` (Singleton)
- Menyimpan `currentTopAngkatan` dan `currentAcademicYear`.
- Diperbarui sekali per tahun ajaran oleh Admin Kesiswaan.
- Digunakan untuk menghitung jenjang kelas siswa (X/XI/XII) secara dinamis berdasarkan formula: `jenjang = angkatan - currentTopAngkatan + 12`.

### 4.2. `Class` (Master Kelas)
- Fields: `grade`, `name`. Constraint: `@@unique([grade, name])`.
- Mendukung *Bulk Create* (`POST /classes/bulk`) untuk *setup* awal tahun ajaran.

### 4.3. `Student` (Master Siswa)
- Fields: `name`, `nis?`, `classId`, `angkatan?`, `photoUrl?`, `deletedAt?` (soft-delete).
- Mendukung import massal via Excel, sinkronisasi roster (`sync/preview` & `sync/execute`), dan export template promosi kelas.

### 4.4. `Account` (User Login)
- Fields: `email @unique`, `passwordHash?`, `role`, `isVerified`, `studentId? @unique`, `otpHash?`, `otpExpiresAt?`.
- Mendukung 3 jalur autentikasi: Google OAuth, Email+Password (tradisional), dan setup password setelah Google login.

### 4.5. `Event`
- Fields: `name`, `description?`, `bannerUrl?`, `guidebookUrl?`, `status` (`ONGOING`/`CLOSED`), `eventDate`, `createdById`.
- Relasi: memiliki banyak `Category`, `EventSchedule`, `EventCommitteeMember`, `Announcement`.
- `@@index([status])` untuk *fast filtering* event aktif.

### 4.6. `EventCommitteeMember` (Panitia Event)
- Relasi *many-to-many* antara `Event` dan `Student`, ditambah `addedById` (siapa yang merekrut).
- Constraint: `@@unique([eventId, studentId])`.
- Memberikan hak akses manajerial (edit event, diskualifikasi tim, export data, buat pengumuman) kepada siswa biasa untuk 1 event spesifik.

### 4.7. `EventSchedule` (Dresscode per Hari)
- Fields: `eventId`, `date`, `dayLabel`, `dresscodeText`, `dresscodeImageUrl?`.
- Constraint: `@@unique([eventId, date])`.

### 4.8. `Category` (Cabang Lomba)
- Fields: `name`, `minMember`, `maxMember`, `teamCompositionMode` (`FREE`/`PER_CLASS`/`PER_ANGKATAN`), `maxTeamsPerGroup?`, `maxTotalTeams?`, `excludeGrade12` (default `true`).
- `maxMember = 1` → alur pendaftaran individu; `maxMember > 1` → alur pendaftaran tim.

### 4.9. `Team`
- Fields: `name`, `code @unique`, `status` (`OPEN`/`LOCKED`/`FULL`/`DISQUALIFIED`), `groupKey?`, `quotaConfirmed`, `categoryId`.
- **Transisi status:** `OPEN → FULL` (otomatis saat member penuh), `FULL → OPEN` (otomatis saat ada yang keluar), `OPEN → LOCKED` (manual oleh leader, syarat: count ≥ minMember), `* → DISQUALIFIED` (manual oleh panitia, final state).

### 4.10. `TeamMember`
- Fields: `teamId`, `studentId`, `isLeader`, `joinedAt`.
- Constraint: `@@unique([teamId, studentId])`.
- Operasi join/leave dibungkus `$transaction` dengan *row-level lock* untuk mencegah *race condition*.

### 4.11. `Registration` (Anti-Daftar-Ganda)
- Fields: `studentId`, `categoryId`, `teamId?` (null = individu).
- Constraint: `@@unique([studentId, categoryId])` — *single source of truth* untuk validasi "sudah terdaftar di lomba ini".

### 4.12. `Announcement`
- Fields: `title`, `content`, `eventId?` (null = pengumuman global), `createdById`.
- Pengumuman global hanya boleh dibuat oleh `PANITIA` atau `ADMIN_KESISWAAN`.
- Pengumuman spesifik event boleh dibuat oleh siapapun yang memiliki hak kelola event tersebut (termasuk `EventCommitteeMember`).

### 4.13. `ExportLog` (Audit Trail)
- Fields: `categoryId?`, `eventId?`, `exportedById`.
- Mencatat setiap aktivitas *download* Excel oleh panitia.

---

## 5. Cross-Cutting Business Rules

- **Concurrency Guard:** Semua operasi yang mengubah kuota tim (join, leave) wajib transaksional dengan *row-level lock*.
- **Cascade Policy:** `Student` menggunakan *soft-delete* (`deletedAt`). `EventSchedule` menggunakan `onDelete: Cascade`. Sisanya menggunakan `Restrict` atau `SetNull`.
- **Team Composition Validation:** Saat join tim, sistem memvalidasi kesesuaian kelas/angkatan berdasarkan `teamCompositionMode`.
- **Grade 12 Exclusion:** `excludeGrade12` per kategori lomba — bisa dinyalakan/dimatikan per cabang lomba.
- **Rate Limiting:** `@nestjs/throttler` di seluruh API + throttle ketat di endpoint login dan OTP.
- **File Upload:** Semua file (banner, guidebook, avatar, dresscode) di-*upload* ke Cloudinary via shared `UploadService`.

---

## 6. Non-Functional Requirements

- Semua operasi kuota tim harus *atomic* (DB transaction).
- Export Excel harus responsif meskipun diakses banyak panitia mendekati hari-H.
- Prioritaskan *correctness* & constraint di level DB (unique, FK, check) daripada optimasi performa prematur.
- Server di-*bind* ke `0.0.0.0` untuk kompatibilitas Docker/Railway.

---

## 7. Out of Scope

- Live scoring / penjurian real-time
- Push notification service
- Integrasi akun guru/wali kelas
- Payment gateway