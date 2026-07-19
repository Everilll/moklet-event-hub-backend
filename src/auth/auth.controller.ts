import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { 
  ApiBearerAuth, 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiCreatedResponse, 
  ApiOkResponse 
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { OtpService } from './otp/otp.service';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { BindIdentityDto } from './dto/bind-identity.dto';
import { CreatePanitiaDto } from './dto/create-panitia.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RawResponse, MessageResponse } from '../common/interceptors/transform.interceptor';
import type { GoogleProfilePayload } from './strategies/google.strategy';

@ApiTags('Autentikasi & Akun (Auth)')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly otpService: OtpService,
  ) {}

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Memicu login menggunakan Google OAuth' })
  @ApiResponse({ status: 302, description: 'Mengalihkan pengguna ke halaman login Google.' })
  googleLogin() {}

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Callback setelah sukses login Google' })
  @ApiOkResponse({ description: 'Mengembalikan data login awal dan status verifikasi akun.' })
  async googleCallback(@CurrentUser() profile: GoogleProfilePayload) {
    const result = await this.authService.handleGoogleLogin(profile);
    return new RawResponse(result);
  }

  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Meminta pengiriman kode OTP ke email' })
  @ApiOkResponse({ description: 'Kode OTP berhasil terkirim ke email siswa/panitia.' })
  async requestOtp(@Body() dto: RequestOtpDto) {
    await this.otpService.requestOtp(dto.email);
    return new MessageResponse(null, 'Kode OTP telah dikirim ke email kamu');
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verifikasi kode OTP untuk mendapatkan Access Token (JWT)' })
  @ApiOkResponse({ description: 'OTP Valid, mengembalikan JWT Token untuk akses fitur aplikasi.' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    await this.otpService.verifyOtp(dto.email, dto.code);
    const token = await this.authService.issueTokenAfterOtpVerified(dto.email);
    return new RawResponse({ token });
  }

  @Post('bind-identity')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Menghubungkan akun Google dengan data Siswa (Identity Binding)' })
  @ApiOkResponse({ description: 'Akun berhasil ditautkan ke identitas siswa.' })
  @ApiResponse({ status: 409, description: 'Konflik! Siswa sudah terikat dengan akun lain.' })
  async bindIdentity(
    @CurrentUser('sub') accountId: string,
    @Body() dto: BindIdentityDto,
  ) {
    const updated = await this.authService.bindIdentity(accountId, dto.studentId);
    return new MessageResponse(updated, 'Berhasil menghubungkan akun ke data siswa');
  }

  @Post('panitia')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN_KESISWAAN')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Membuat akun panitia baru (Khusus Kesiswaan)' })
  @ApiCreatedResponse({ description: 'Akun panitia berhasil didaftarkan di sistem.' })
  async createPanitia(@Body() dto: CreatePanitiaDto) {
    const created = await this.authService.createPanitia(dto.email);
    return new MessageResponse(
      created,
      'Akun panitia dibuat. Panitia login pertama kali lewat OTP di email tersebut.',
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Mengambil informasi detail akun yang sedang login' })
  @ApiOkResponse({ description: 'Mengembalikan data profil akun beserta relasi data siswanya.' })
  async me(@CurrentUser('sub') accountId: string) {
    return this.authService.getMe(accountId);
  }
}