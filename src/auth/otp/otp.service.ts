import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { HashingService } from '../../common/hashing/hashing.service';
import * as nodemailer from 'nodemailer';
import { randomInt } from 'node:crypto';

@Injectable()
export class OtpService {
  private readonly transporter: nodemailer.Transporter;
  private readonly length: number;
  private readonly ttlSeconds: number;
  private readonly maxRequestsPerWindow: number;
  private readonly windowSeconds: number;
  private readonly fromAddress: string;
  private readonly allowedHd: string;

  private readonly requestLog = new Map<string, number[]>();

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly hashing: HashingService,
  ) {
    this.length = this.config.get<number>('OTP_LENGTH')!;
    this.ttlSeconds = this.config.get<number>('OTP_TTL_SECONDS')!;
    this.maxRequestsPerWindow = this.config.get<number>(
      'OTP_MAX_REQUESTS_PER_WINDOW',
    )!;
    this.windowSeconds = this.config.get<number>('OTP_WINDOW_SECONDS')!;
    this.fromAddress = this.config.get<string>('SMTP_FROM')!;
    this.allowedHd = this.config.get<string>('GOOGLE_ALLOWED_HD')!;

    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port: this.config.get<number>('SMTP_PORT'),
      secure: this.config.get<number>('SMTP_PORT') === 465,
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASSWORD'),
      },
    });
  }

  private checkRateLimit(email: string) {
    const now = Date.now();
    const windowMs = this.windowSeconds * 1000;
    const timestamps = (this.requestLog.get(email) ?? []).filter(
      (t) => now - t < windowMs,
    );

    if (timestamps.length >= this.maxRequestsPerWindow) {
      throw new BadRequestException(
        `Terlalu banyak permintaan OTP. Coba lagi dalam beberapa menit.`,
      );
    }

    timestamps.push(now);
    this.requestLog.set(email, timestamps);
  }

  private generateCode(): string {
    const min = 10 ** (this.length - 1);
    const max = 10 ** this.length - 1;
    return String(randomInt(min, max + 1));
  }

  private assertAllowedDomain(email: string) {
    const domain = email.split('@')[1];
    if (domain !== this.allowedHd) {
      throw new BadRequestException(
        `Hanya email institusi siswa (@${this.allowedHd}) yang bisa mendaftar sendiri. ` +
          `Akun panitia dibuatkan oleh Admin Kesiswaan.`,
      );
    }
  }

  async requestOtp(email: string): Promise<void> {
    this.checkRateLimit(email);

    const existing = await this.prisma.account.findUnique({ where: { email } });

    if (existing) {
    } else {
      this.assertAllowedDomain(email);
    }

    const code = this.generateCode();
    const otpHash = this.hashing.hash(code);
    const otpExpiresAt = new Date(Date.now() + this.ttlSeconds * 1000);

    await this.prisma.account.upsert({
      where: { email },
      create: { email, otpHash, otpExpiresAt },
      update: { otpHash, otpExpiresAt },
    });

    await this.transporter.sendMail({
      from: this.fromAddress,
      to: email,
      subject: 'Kode Verifikasi Moklet Event Hub',
      text: `Kode OTP kamu: ${code} (berlaku ${Math.floor(this.ttlSeconds / 60)} menit). Jangan bagikan kode ini ke siapa pun.`,
    });
  }

  async verifyOtp(email: string, code: string): Promise<void> {
    const account = await this.prisma.account.findUnique({ where: { email } });

    if (!account || !account.otpHash || !account.otpExpiresAt) {
      throw new UnauthorizedException('OTP tidak ditemukan, minta kode baru');
    }

    if (account.otpExpiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('OTP sudah kedaluwarsa, minta kode baru');
    }

    const isValid = this.hashing.verify(code, account.otpHash);
    if (!isValid) {
      throw new UnauthorizedException('Kode OTP salah');
    }

    await this.prisma.account.update({
      where: { email },
      data: { isVerified: true, otpHash: null, otpExpiresAt: null },
    });
  }
}
