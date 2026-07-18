-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "otpExpiresAt" TIMESTAMP(3),
ADD COLUMN     "otpHash" TEXT;
