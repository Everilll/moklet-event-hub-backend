import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventOwnershipService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cuma Account yang createdById-nya cocok (ketua event) yang boleh
   * lolos. Dipakai di EventsService, CategoriesService, SchedulesService,
   * dan CommitteeService — supaya aturan "cuma yang bikin event yang bisa
   * manage" konsisten di semua sub-resource, bukan dicek ulang beda-beda
   * di tiap service.
   */
  async assertOwner(eventId: string, accountId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event tidak ditemukan');
    if (event.createdById !== accountId) {
      throw new ForbiddenException('Kamu bukan penanggung jawab event ini');
    }
    return event;
  }

  /**
   * Dipakai untuk endpoint read-only yang boleh diakses ketua ATAU
   * anggota divisi yang sudah ditambahkan ke event tersebut (mis. lihat
   * daftar pendaftar) — beda dari assertOwner() yang cuma untuk ketua.
   */
  async assertOwnerOrCommitteeMember(eventId: string, accountId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        eventCommitteeMembers: {
          include: { student: { include: { account: true } } },
        },
      },
    });
    if (!event) throw new NotFoundException('Event tidak ditemukan');

    if (event.createdById === accountId) return event;

    const isCommitteeMember = event.eventCommitteeMembers.some(
      (m) => m.student.account?.id === accountId,
    );
    if (!isCommitteeMember) {
      throw new ForbiddenException('Kamu tidak punya akses ke event ini');
    }
    return event;
  }
}
