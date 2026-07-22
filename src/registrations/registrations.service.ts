import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertStudentEligible } from '../common/helpers/assert-student-eligible';
import { resolveGroupKey, checkAndConfirmQuota } from '../common/helpers/quota.helper';
import { IndividualRegistrationDto } from './dto/individual-registration.dto';
import { randomInt } from 'node:crypto';

@Injectable()
export class RegistrationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pendaftaran individu -- khusus Category.maxMember === 1.
   *
   * Individu juga kena kuota: diperlakukan sebagai "tim isi 1 orang".
   * Dibungkus transaction supaya quota check konsisten.
   *
   * Di mode PER_CLASS / PER_ANGKATAN: groupKey di-resolve dari data siswa,
   * lalu cek kuota (quotaConfirmed langsung true karena minMember = 1).
   *
   * Anti-daftar-ganda tetap dijaga lewat @@unique([studentId, categoryId]).
   */
  async registerIndividual(studentId: string, dto: IndividualRegistrationDto) {
    const student = await assertStudentEligible(this.prisma, studentId);

    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new NotFoundException('Cabang lomba tidak ditemukan');
    if (category.maxMember !== 1) {
      throw new BadRequestException(
        'Cabang lomba ini untuk tim (maxMember>1) -- gunakan POST /teams',
      );
    }

    const groupKey = resolveGroupKey(category.teamCompositionMode, student);

    return this.prisma.$transaction(async (tx) => {
      // Buat "tim virtual" untuk individu — konsisten dengan model kuota.
      // Tim ini langsung LOCKED karena individual gak bisa ditambah anggota.
      const code = String(randomInt(100000, 1000000));
      const team = await tx.team.create({
        data: {
          name: student.name, // Nama tim = nama siswa untuk individu
          code,
          status: 'LOCKED',
          categoryId: dto.categoryId,
          groupKey,
          quotaConfirmed: false,
        },
      });

      await tx.teamMember.create({
        data: { teamId: team.id, studentId, isLeader: true },
      });

      await tx.registration.create({
        data: { studentId, categoryId: dto.categoryId, teamId: team.id },
      });

      // Individu = minMember selalu 1, jadi langsung cek kuota & confirm
      await checkAndConfirmQuota(tx, team.id, category, 1);

      return tx.registration.findFirstOrThrow({
        where: { studentId, categoryId: dto.categoryId },
        include: { category: { include: { event: true } }, team: true },
      });
    });
  }

  async findMyRegistrations(studentId: string) {
    return this.prisma.registration.findMany({
      where: { studentId },
      include: { category: { include: { event: true } }, team: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
