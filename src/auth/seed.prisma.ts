import { PrismaService } from "src/prisma/prisma.service";

const prisma = new PrismaService();

async function main() {
  await prisma.onModuleInit();

  const email = process.env.SEED_ADMIN_EMAIL || '';

  const existing = await prisma.account.findUnique({ where: { email } });
  if (existing) {
    console.log(`Akun admin dengan email ${email} sudah ada, skip seed.`);
    return;
  }

  const admin = await prisma.account.create({
    data: { email, role: 'ADMIN_KESISWAAN', isVerified: false },
  });

  console.log('Akun ADMIN_KESISWAAN dibuat:', admin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.onModuleDestroy();
  });