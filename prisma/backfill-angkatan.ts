/**
 * Backfill script untuk mengisi Student.angkatan berdasarkan
 * Class.grade + SystemSetting.currentTopAngkatan.
 *
 * Formula:
 *   grade "X"   → angkatan = currentTopAngkatan
 *   grade "XI"  → angkatan = currentTopAngkatan - 1
 *   grade "XII" → angkatan = currentTopAngkatan - 2
 *
 * Cara pakai:
 *   npx ts-node prisma/backfill-angkatan.ts
 *
 * Setelah backfill selesai dan data sudah terverifikasi:
 *   1. Ubah Student.angkatan di schema.prisma dari Int? → Int
 *   2. Jalankan prisma migrate dev --name make-angkatan-required
 */
import { Pool } from 'pg';

const GRADE_OFFSET: Record<string, number> = {
  X: 0,
  XI: 1,
  XII: 2,
};

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable tidak ditemukan');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // 1. Ambil currentTopAngkatan
    const settingResult = await pool.query(
      'SELECT "currentTopAngkatan" FROM "SystemSetting" LIMIT 1',
    );

    if (settingResult.rows.length === 0) {
      console.error('❌ SystemSetting belum ada. Buat dulu sebelum backfill.');
      process.exit(1);
    }

    const currentTopAngkatan: number = settingResult.rows[0].currentTopAngkatan;
    console.log(`📌 currentTopAngkatan = ${currentTopAngkatan}`);

    // 2. Backfill per grade
    let totalUpdated = 0;

    for (const [grade, offset] of Object.entries(GRADE_OFFSET)) {
      const angkatan = currentTopAngkatan - offset;

      const result = await pool.query(
        `UPDATE "Student" s
         SET "angkatan" = $1
         FROM "Class" c
         WHERE s."classId" = c."id"
           AND c."grade" = $2
           AND s."angkatan" IS NULL`,
        [angkatan, grade],
      );

      const count = result.rowCount ?? 0;
      totalUpdated += count;
      console.log(`  ✅ Grade ${grade} → angkatan ${angkatan}: ${count} siswa diupdate`);
    }

    // 3. Cek sisa yang belum ke-backfill
    const remainingResult = await pool.query(
      'SELECT COUNT(*) as count FROM "Student" WHERE "angkatan" IS NULL',
    );
    const remaining = parseInt(remainingResult.rows[0].count, 10);

    console.log(`\n📊 Total diupdate: ${totalUpdated}`);
    if (remaining > 0) {
      console.warn(
        `⚠️  Masih ada ${remaining} siswa dengan angkatan NULL (grade tidak dikenali). Cek manual.`,
      );
    } else {
      console.log(
        '✅ Semua siswa sudah punya angkatan. Aman untuk ALTER kolom ke NOT NULL.',
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('❌ Backfill gagal:', err);
  process.exit(1);
});
