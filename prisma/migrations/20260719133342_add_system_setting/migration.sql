-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" UUID NOT NULL,
    "currentTopAngkatan" INTEGER NOT NULL,
    "currentAcademicYear" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);
