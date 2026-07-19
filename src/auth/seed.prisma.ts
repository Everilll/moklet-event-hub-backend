import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from 'generated/prisma/client';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'kesiswaan@smktelkom-mlg.sch.id';

  const existing = await prisma.account.findUnique({ where: { email } });
  if (existing) {
    console.log(`Akun admin dengan email ${email} sudah ada, skip seed.`);
    return;
  }

  const admin = await prisma.account.create({
    data: { email, role: 'ADMIN_KESISWAAN', isVerified: false },
  });

  console.log('Akun ADMIN_KESISWAAN dibuat:', admin.email);
  console.log('Login pertama kali lewat POST /auth/otp/request dengan email ini.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
