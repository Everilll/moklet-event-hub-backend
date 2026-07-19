import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { GoogleProfilePayload } from './strategies/google.strategy';
import { Account, Prisma } from 'generated/prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async handleGoogleLogin(profile: GoogleProfilePayload) {
    const account = await this.prisma.account.upsert({
      where: { email: profile.email },
      create: { email: profile.email },
      update: {},
    });

    return {
      email: account.email,
      isVerified: account.isVerified,
      ...(account.isVerified && { token: this.issueToken(account) }),
    };
  }

  issueToken(account: Account): string {
    const payload: JwtPayload = {
      sub: account.id,
      email: account.email,
      role: account.role as JwtPayload['role'],
      studentId: account.studentId,
    };
    return this.jwt.sign(payload);
  }

  async issueTokenAfterOtpVerified(email: string): Promise<string> {
    const account = await this.prisma.account.findUnique({ where: { email } });
    if (!account || !account.isVerified) {
      throw new UnauthorizedException('Akun belum terverifikasi');
    }
    return this.issueToken(account);
  }

  async getMe(accountId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        email: true,
        role: true,
        isVerified: true,
        studentId: true,
        student: {
          select: { id: true, name: true, photoUrl: true, class: true },
        },
      },
    });

    if (!account) {
      throw new UnauthorizedException('Akun tidak ditemukan');
    }

    return account;
  }

  async createPanitia(email: string) {
    const existing = await this.prisma.account.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('Email ini sudah terdaftar sebagai akun');
    }

    return this.prisma.account.create({
      data: { email, role: 'PANITIA', isVerified: false },
    });
  }

  async bindIdentity(accountId: string, studentId: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new UnauthorizedException('Akun tidak ditemukan');
    }

    if (account.studentId) {
      throw new BadRequestException('Akun ini sudah terhubung ke data siswa');
    }

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student || student.deletedAt) {
      throw new BadRequestException('Data siswa tidak ditemukan');
    }

    try {
      const updated = await this.prisma.account.update({
        where: { id: accountId },
        data: { studentId },
      });
      return updated;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw err;
      }
      throw err;
    }
  }
}
