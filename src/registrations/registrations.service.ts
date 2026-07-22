import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertStudentEligible } from '../common/helpers/assert-student-eligible';
import { IndividualRegistrationDto } from './dto/individual-registration.dto';

@Injectable()
export class RegistrationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pendaftaran individu -- khusus Category.maxMember === 1. Tidak ada
   * Team sama sekali di jalur ini (teamId selalu null). Anti-daftar-ganda
   * tetap dijaga lewat @@unique([studentId, categoryId]) yang sama
   * dengan jalur tim -- P2002 diteruskan ke PrismaExceptionFilter (409)
   * lewat GlobalExceptionFilter chain, tidak ditangkap manual di sini.
   */
  async registerIndividual(studentId: string, dto: IndividualRegistrationDto) {
    await assertStudentEligible(this.prisma, studentId);

    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new NotFoundException('Cabang lomba tidak ditemukan');
    if (category.maxMember !== 1) {
      throw new BadRequestException(
        'Cabang lomba ini untuk tim (maxMember>1) -- gunakan POST /teams',
      );
    }

    return this.prisma.registration.create({
      data: { studentId, categoryId: dto.categoryId, teamId: null },
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
