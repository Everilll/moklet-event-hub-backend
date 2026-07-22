import { BadRequestException } from '@nestjs/common';

/**
 * Resolve groupKey untuk sebuah tim berdasarkan mode komposisi.
 *
 * - FREE         → null (tidak ada grouping)
 * - PER_CLASS    → student.classId
 * - PER_ANGKATAN → student.angkatan as string
 */
export function resolveGroupKey(
  mode: string,
  student: { classId: string; angkatan: number | null },
): string | null {
  switch (mode) {
    case 'FREE':
      return null;
    case 'PER_CLASS':
      return student.classId;
    case 'PER_ANGKATAN':
      if (student.angkatan == null) {
        throw new BadRequestException('Data angkatan siswa belum terisi, hubungi admin');
      }
      return String(student.angkatan);
    default:
      return null;
  }
}

/**
 * Validasi lintas angkatan: di mode PER_CLASS dan PER_ANGKATAN,
 * anggota baru harus punya groupKey yang sama dengan tim.
 */
export function validateGroupKeyMatch(
  teamGroupKey: string | null,
  joinerGroupKey: string | null,
  mode: string,
): void {
  if (mode === 'FREE') return;
  if (teamGroupKey == null || joinerGroupKey == null) return;
  if (teamGroupKey !== joinerGroupKey) {
    const label = mode === 'PER_CLASS' ? 'kelas' : 'angkatan';
    throw new BadRequestException(
      `Cabang lomba ini mengharuskan semua anggota tim dari ${label} yang sama`,
    );
  }
}

/**
 * Cek kuota dan set quotaConfirmed = true jika memenuhi syarat.
 * Dipanggil DALAM transaction setelah menambah anggota ke tim.
 *
 * Returns true jika quotaConfirmed berubah dari false → true.
 */
export async function checkAndConfirmQuota(
  tx: any,
  teamId: string,
  category: {
    teamCompositionMode: string;
    maxTeamsPerGroup: number | null;
    minMember: number;
  },
  currentMemberCount: number,
): Promise<boolean> {
  // Belum capai minMember → belum bisa confirm
  if (currentMemberCount < category.minMember) return false;

  // Ambil tim terbaru (mungkin sudah quotaConfirmed dari sebelumnya)
  const team = await tx.team.findUniqueOrThrow({
    where: { id: teamId },
    select: { quotaConfirmed: true, groupKey: true },
  });

  // Sudah confirmed sebelumnya → skip (one-way flag)
  if (team.quotaConfirmed) return false;

  // Mode FREE → langsung confirm tanpa cek kuota
  if (category.teamCompositionMode === 'FREE' || category.maxTeamsPerGroup == null) {
    await tx.team.update({
      where: { id: teamId },
      data: { quotaConfirmed: true },
    });
    return true;
  }

  // Mode PER_CLASS / PER_ANGKATAN → cek kuota di groupKey yang sama
  const confirmedCount = await tx.team.count({
    where: {
      categoryId: (
        await tx.team.findUniqueOrThrow({
          where: { id: teamId },
          select: { categoryId: true },
        })
      ).categoryId,
      groupKey: team.groupKey,
      quotaConfirmed: true,
    },
  });

  if (confirmedCount >= category.maxTeamsPerGroup) {
    throw new BadRequestException(
      `Kuota tim untuk grup ini sudah penuh (${confirmedCount}/${category.maxTeamsPerGroup})`,
    );
  }

  await tx.team.update({
    where: { id: teamId },
    data: { quotaConfirmed: true },
  });
  return true;
}
