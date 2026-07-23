-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "excludeGrade12" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "maxTotalTeams" INTEGER;
