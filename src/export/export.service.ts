import { Injectable, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { EventOwnershipService } from '../events/event-ownership.service';

@Injectable()
export class ExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: EventOwnershipService,
  ) {}

  private async buildCategoryWorksheet(
    workbook: ExcelJS.Workbook,
    categoryId: string,
  ) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        event: true,
        registrations: {
          include: { student: { include: { class: true, account: true } } },
        },
        teams: {
          include: {
            teamMembers: { include: { student: { include: { class: true, account: true } } } },
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Cabang lomba tidak ditemukan');
    }

    let safeSheetName = category.name.replace(/[:\\/?*\[\]]/g, '').substring(0, 31);
    
    if (workbook.getWorksheet(safeSheetName)) {
      safeSheetName = `${safeSheetName.substring(0, 25)}_${category.id.substring(0, 4)}`;
    }

    const sheet = workbook.addWorksheet(safeSheetName);

    if (category.maxMember === 1) {
      sheet.columns = [
        { header: 'No', key: 'no', width: 5 },
        { header: 'Nama Peserta', key: 'name', width: 30 },
        { header: 'Kelas', key: 'grade', width: 15 },
        { header: 'Kontak / Email', key: 'email', width: 30 },
        { header: 'Waktu Daftar', key: 'registeredAt', width: 20 },
      ];

      category.registrations.forEach((reg, index) => {
        sheet.addRow({
          no: index + 1,
          name: reg.student.name,
          grade: reg.student.class.name,
          email: reg.student.account?.email || '-',
          registeredAt: reg.createdAt.toLocaleString('id-ID'),
        });
      });
    } else {
      const columns = [
        { header: 'No', key: 'no', width: 5 },
        { header: 'Kode Tim', key: 'code', width: 12 },
        { header: 'Nama Tim', key: 'teamName', width: 25 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Nama Ketua', key: 'leaderName', width: 25 },
        { header: 'Kelas Ketua', key: 'leaderGrade', width: 15 },
        { header: 'Kontak Ketua', key: 'leaderContact', width: 25 },
      ];

      for (let i = 2; i <= category.maxMember; i++) {
        columns.push({ header: `Nama Anggota ${i}`, key: `member${i}Name`, width: 25 });
        columns.push({ header: `Kelas Anggota ${i}`, key: `member${i}Grade`, width: 15 });
      }
      columns.push({ header: 'Waktu Daftar', key: 'registeredAt', width: 20 });
      
      sheet.columns = columns;

      category.teams.forEach((team, index) => {
        const leader = team.teamMembers.find((m) => m.isLeader);
        const members = team.teamMembers.filter((m) => !m.isLeader);
        
        const rowData: any = {
          no: index + 1,
          code: team.code,
          teamName: team.name,
          status: team.status,
          leaderName: leader ? leader.student.name : '-',
          leaderGrade: leader ? leader.student.class.name : '-',
          leaderContact: leader?.student.account?.email || '-',
          registeredAt: leader ? leader.joinedAt.toLocaleString('id-ID') : '-',
        };

        for (let i = 2; i <= category.maxMember; i++) {
          const member = members[i - 2];
          rowData[`member${i}Name`] = member ? member.student.name : '-';
          rowData[`member${i}Grade`] = member ? member.student.class.name : '-';
        }

        sheet.addRow(rowData);
      });
    }

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { horizontal: 'center' };

    return category;
  }

  async exportCategoryData(categoryId: string, accountId: string) {
    const categoryLookup = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!categoryLookup) throw new NotFoundException('Cabang lomba tidak ditemukan');

    await this.ownership.assertCanManage(categoryLookup.eventId, accountId);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Moklet Event Hub';
    workbook.created = new Date();

    const category = await this.buildCategoryWorksheet(workbook, categoryId);

    await this.prisma.exportLog.create({
      data: {
        categoryId: category.id,
        eventId: null,
        exportedById: accountId,
      },
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const cleanEventName = category.event.name.replace(/[^a-zA-Z0-9]/g, '_');
    const cleanCatName = category.name.replace(/[^a-zA-Z0-9]/g, '_');
    
    return {
      buffer: buffer as unknown as Buffer,
      fileName: `Data_Lomba_${cleanCatName}_${cleanEventName}.xlsx`,
    };
  }

  async exportEventData(eventId: string, accountId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { categories: true },
    });
    if (!event) throw new NotFoundException('Event tidak ditemukan');

    await this.ownership.assertCanManage(eventId, accountId);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Moklet Event Hub';
    workbook.created = new Date();

    if (event.categories.length === 0) {
      const sheet = workbook.addWorksheet('Belum Ada Lomba');
      sheet.addRow(['Event ini belum memiliki cabang lomba.']);
    } else {
      for (const category of event.categories) {
        await this.buildCategoryWorksheet(workbook, category.id);
      }
    }

    await this.prisma.exportLog.create({
      data: {
        categoryId: null,
        eventId: event.id,
        exportedById: accountId,
      },
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const cleanEventName = event.name.replace(/[^a-zA-Z0-9]/g, '_');
    
    return {
      buffer: buffer as unknown as Buffer,
      fileName: `Data_Seluruh_Lomba_${cleanEventName}.xlsx`,
    };
  }
}
