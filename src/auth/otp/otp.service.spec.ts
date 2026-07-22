import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpService } from './otp.service';
import { PrismaService } from '../../prisma/prisma.service';
import { HashingService } from '../../common/hashing/hashing.service';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue(true),
  }),
}));

jest.mock('../utils/domain.util', () => ({
  assertStudentDomain: jest.fn(),
}));

describe('OtpService', () => {
  let service: OtpService;
  let prisma: {
    account: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  };
  let hashing: { hash: jest.Mock; verify: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(async () => {
    prisma = {
      account: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
    hashing = {
      hash: jest.fn().mockReturnValue('hashed-otp'),
      verify: jest.fn(),
    };
    config = {
      get: jest.fn((key: string) => {
        const mockEnv: Record<string, any> = {
          OTP_LENGTH: 6,
          OTP_TTL_SECONDS: 300,
          OTP_MAX_REQUESTS_PER_WINDOW: 3,
          OTP_WINDOW_SECONDS: 600,
          SMTP_FROM: 'test@example.com',
          GOOGLE_ALLOWED_HD: 'test.com',
        };
        return mockEnv[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: PrismaService, useValue: prisma },
        { provide: HashingService, useValue: hashing },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);
    // Clear request log before each test
    (service as any).requestLog.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rate Limiting', () => {
    it('throws BadRequestException when rate limit is exceeded', async () => {
      prisma.account.findUnique.mockResolvedValue({ id: 'acc-1' });

      // Request 1
      await service.requestOtp('test@test.com');
      // Request 2
      await service.requestOtp('test@test.com');
      // Request 3
      await service.requestOtp('test@test.com');

      // Request 4 should fail
      await expect(service.requestOtp('test@test.com')).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyOtp', () => {
    it('throws UnauthorizedException if OTP is expired', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 'acc-1',
        otpHash: 'hashed-otp',
        otpExpiresAt: new Date(Date.now() - 10000), // Expired 10s ago
      });

      await expect(service.verifyOtp('test@test.com', '123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException if OTP is incorrect', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 'acc-1',
        otpHash: 'hashed-otp',
        otpExpiresAt: new Date(Date.now() + 10000), // Valid
      });
      hashing.verify.mockReturnValue(false);

      await expect(service.verifyOtp('test@test.com', 'wrong-code')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('updates account correctly if OTP is valid', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 'acc-1',
        otpHash: 'hashed-otp',
        otpExpiresAt: new Date(Date.now() + 10000), // Valid
      });
      hashing.verify.mockReturnValue(true);

      await service.verifyOtp('test@test.com', '123456');

      expect(prisma.account.update).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
        data: { isVerified: true, otpHash: null, otpExpiresAt: null },
      });
    });
  });
});
