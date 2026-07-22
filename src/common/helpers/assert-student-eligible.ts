import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Dipakai di TeamsService & RegistrationsService (individual). Dipisah
 * jadi pure helper function (bukan Injectable service) supaya kedua
 * modul bisa pakai tanpa perlu saling import module satu sama lain —
 * dua-duanya sama-sama pegang PrismaService sendiri.
 *
 * Bisa dipanggil di dalam $transaction dengan pass `tx` (transaction
 * client) sebagai pengganti `prisma`, supaya pengecekan ini konsisten
 * dengan data yang di-lock di transaksi yang sama.
 */
export async function assertStudentEligible(
  prisma: PrismaService | any, // atau Prisma.TransactionClient
  studentId: string,
) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { class: true },
  });

  if (!student || student.deletedAt) {
    throw new BadRequestException('Data siswa tidak valid atau sudah tidak aktif');
  }

  if (student.class.grade === 'XII') {
    throw new ForbiddenException(
      'Siswa kelas XII tidak diperkenankan mengikuti event kesiswaan',
    );
  }

  return student;
}
