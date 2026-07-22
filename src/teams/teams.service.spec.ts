import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventOwnershipService } from '../events/event-ownership.service';

describe('TeamsService.leave', () => {
  let service: TeamsService;
  let tx: {
    team: { findUnique: jest.Mock; findUniqueOrThrow: jest.Mock; update: jest.Mock; delete: jest.Mock };
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
      team: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn(), delete: jest.fn() },
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

import * as assertEligible from '../common/helpers/assert-student-eligible';

describe('TeamsService.join', () => {
  let service: TeamsService;
  let tx: {
    team: { findUniqueOrThrow: jest.Mock; update: jest.Mock };
    teamMember: { create: jest.Mock };
    registration: { create: jest.Mock };
    $queryRaw: jest.Mock;
  };
  let prisma: { $transaction: jest.Mock; team: { findUnique: jest.Mock } };

  beforeEach(async () => {
    tx = {
      team: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
      teamMember: { create: jest.fn() },
      registration: { create: jest.fn() },
      $queryRaw: jest.fn(),
    };
    prisma = {
      $transaction: jest.fn((cb) => cb(tx)),
      team: { findUnique: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventOwnershipService, useValue: {} },
      ],
    }).compile();

    service = module.get<TeamsService>(TeamsService);
    jest.spyOn(assertEligible, 'assertStudentEligible').mockResolvedValue({} as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockTeam = (status: string, currentCount: number, maxMember: number) => ({
    id: 'team-1',
    status,
    categoryId: 'cat-1',
    category: { maxMember },
    teamMembers: Array(currentCount).fill({ id: 'member' }),
  });

  it('berhasil join tim yang berstatus OPEN dan kuota belum penuh', async () => {
    prisma.team.findUnique.mockResolvedValue({ id: 'team-1', code: '123456' });
    const team = mockTeam('OPEN', 1, 3);
    tx.team.findUniqueOrThrow.mockResolvedValue(team);

    await service.join('student-2', '123456');

    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.teamMember.create).toHaveBeenCalledWith({
      data: { teamId: 'team-1', studentId: 'student-2', isLeader: false },
    });
    expect(tx.registration.create).toHaveBeenCalledWith({
      data: { studentId: 'student-2', categoryId: 'cat-1', teamId: 'team-1' },
    });
    expect(tx.team.update).not.toHaveBeenCalled(); // Karena belum penuh (1+1 = 2 < 3)
  });

  it('berhasil join dan mengubah status jadi FULL jika kuota tepat terpenuhi', async () => {
    prisma.team.findUnique.mockResolvedValue({ id: 'team-1', code: '123456' });
    const team = mockTeam('OPEN', 2, 3);
    tx.team.findUniqueOrThrow.mockResolvedValue(team);

    await service.join('student-2', '123456');

    expect(tx.team.update).toHaveBeenCalledWith({
      where: { id: 'team-1' },
      data: { status: 'FULL' },
    });
  });

  it('menolak join jika status LOCKED', async () => {
    prisma.team.findUnique.mockResolvedValue({ id: 'team-1', code: '123456' });
    const team = mockTeam('LOCKED', 2, 3);
    tx.team.findUniqueOrThrow.mockResolvedValue(team);

    await expect(service.join('student-2', '123456')).rejects.toThrow(BadRequestException);
  });

  it('menolak join jika status FULL', async () => {
    prisma.team.findUnique.mockResolvedValue({ id: 'team-1', code: '123456' });
    const team = mockTeam('FULL', 3, 3);
    tx.team.findUniqueOrThrow.mockResolvedValue(team);

    await expect(service.join('student-2', '123456')).rejects.toThrow(BadRequestException);
  });

  it('menolak join jika kode tim tidak ditemukan', async () => {
    prisma.team.findUnique.mockResolvedValue(null);

    await expect(service.join('student-2', '123456')).rejects.toThrow(NotFoundException);
  });
});
