export interface ParsedStudentEmail {
  firstName: string;
  lastName: string;
  angkatan: number;
  jurusanCode: string;
}

/**
 * Format email siswa: firstname_lastname_{angkatan}{jurusan}@domain
 * Contoh: averil_mauladani_33rpl@student.smktelkom-mlg.sch.id
 *   -> firstName: "averil", lastName: "mauladani", angkatan: 33, jurusanCode: "rpl"
 *
 * Return null kalau format email tidak sesuai pola (biar caller bisa
 * fallback ke pesan "hubungi Admin Kesiswaan" alih-alih salah tebak).
 */
export function parseStudentEmail(email: string): ParsedStudentEmail | null {
  const localPart = email.split('@')[0];
  const match = localPart.match(/^([a-z]+)_([a-z]+)_(\d+)([a-z]+)$/i);

  if (!match) return null;

  const [, firstName, lastName, angkatanStr, jurusanCode] = match;
  return {
    firstName: firstName.toLowerCase(),
    lastName: lastName.toLowerCase(),
    angkatan: parseInt(angkatanStr, 10),
    jurusanCode: jurusanCode.toLowerCase(),
  };
}

export type Grade = 'X' | 'XI' | 'XII';

/**
 * grade = 12 - (angkatan - currentTopAngkatan)
 * currentTopAngkatan selalu merujuk ke angkatan yang SEKARANG kelas XII.
 *
 * Return null kalau hasilnya di luar X/XI/XII (misal angkatan tsb sudah
 * lulus lebih dari setahun lalu, atau belum diterima) — caller harus
 * treat ini sebagai "tidak ada kandidat", bukan error keras.
 */
export function calculateGrade(
  angkatan: number,
  currentTopAngkatan: number,
): Grade | null {
  const gradeNumber = 12 - (angkatan - currentTopAngkatan);
  switch (gradeNumber) {
    case 12:
      return 'XII';
    case 11:
      return 'XI';
    case 10:
      return 'X';
    default:
      return null;
  }
}
