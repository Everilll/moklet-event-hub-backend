import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventOwnershipService } from '../events/event-ownership.service';

describe('TeamsService.leave', () => {
  let service: TeamsService;
  let tx: {
    team: { findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
    teamMember: { update: jest.Mock; delete: jest.Mock };
    registration: { deleteMany: jest.Mock };
    $queryRaw: jest.Mock;
  };
  let prisma: { $transaction: jest.Mock };

  const baseTeam = (overrides: any = {}) => ({
    id: 'team-1',
    status: 'OPEN',
    categoryId: 'cat-1',
    teamMembers: [
      { id: 'member-leader', studentId: 'student-leader', isLeader: true },
      { id: 'member-2', studentId: 'student-2', isLeader: false },
      { id: 'member-3', studentId: 'student-3', isLeader: false },
    ],
    ...overrides,
  });

  beforeEach(async () => {
    tx = {
      team: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
      teamMember: { update: jest.fn(), delete: jest.fn() },
      registration: { deleteMany: jest.fn() },
      $queryRaw: jest.fn(),
    };
    prisma = {
      $transaction: jest.fn((cb) => cb(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventOwnershipService, useValue: {} },
      ],
    }).compile();

    service = module.get<TeamsService>(TeamsService);
  });

  it('menolak leader leave tanpa newLeaderStudentId ketika tim masih punya anggota lain', async () => {
    tx.team.findUnique.mockResolvedValue(baseTeam());

    await expect(
      service.leave('student-leader', 'team-1', {}),
    ).rejects.toThrow(BadRequestException);

    expect(tx.teamMember.delete).not.toHaveBeenCalled();
  });

  it('menolak newLeaderStudentId yang bukan anggota tim yang sama', async () => {
    tx.team.findUnique.mockResolvedValue(baseTeam());

    await expect(
      service.leave('student-leader', 'team-1', { newLeaderStudentId: 'student-orang-lain' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('berhasil handoff leadership ke successor yang valid, lalu hapus membership yang leave', async () => {
    tx.team.findUnique.mockResolvedValue(baseTeam());
    tx.team.findUniqueOrThrow = jest.fn().mockResolvedValue({ id: 'team-1', teamMembers: [] });

    await service.leave('student-leader', 'team-1', { newLeaderStudentId: 'student-2' });

    expect(tx.teamMember.update).toHaveBeenCalledWith({
      where: { id: 'member-2' },
      data: { isLeader: true },
    });
    expect(tx.teamMember.delete).toHaveBeenCalledWith({ where: { id: 'member-leader' } });
    expect(tx.registration.deleteMany).toHaveBeenCalled();
  });

  it('anggota biasa (bukan leader) bisa leave tanpa perlu newLeaderStudentId', async () => {
    tx.team.findUnique.mockResolvedValue(baseTeam());
    tx.team.findUniqueOrThrow = jest.fn().mockResolvedValue({ id: 'team-1', teamMembers: [] });

    await service.leave('student-2', 'team-1', {});

    expect(tx.teamMember.update).not.toHaveBeenCalled(); // tidak ada handoff
    expect(tx.teamMember.delete).toHaveBeenCalledWith({ where: { id: 'member-2' } });
  });

  it('menghapus Team sepenuhnya kalau yang leave adalah satu-satunya anggota (leader tanpa anggota lain)', async () => {
    const lonelyTeam = baseTeam({
      teamMembers: [{ id: 'member-leader', studentId: 'student-leader', isLeader: true }],
    });
    tx.team.findUnique.mockResolvedValue(lonelyTeam);

    const result = await service.leave('student-leader', 'team-1', {});

    expect(tx.team.delete).toHaveBeenCalledWith({ where: { id: 'team-1' } });
    expect(result).toEqual({ deleted: true, teamId: 'team-1' });
  });

  it('menolak leave kalau tim berstatus LOCKED', async () => {
    tx.team.findUnique.mockResolvedValue(baseTeam({ status: 'LOCKED' }));

    await expect(service.leave('student-2', 'team-1', {})).rejects.toThrow(BadRequestException);
  });

  it('menolak leave kalau bukan anggota tim tersebut', async () => {
    tx.team.findUnique.mockResolvedValue(baseTeam());

    await expect(
      service.leave('student-bukan-anggota', 'team-1', {}),
    ).rejects.toThrow(NotFoundException);
  });
});
