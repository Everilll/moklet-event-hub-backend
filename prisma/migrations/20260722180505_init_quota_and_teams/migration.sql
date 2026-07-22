/*
  Warnings:

  - Added the required column `name` to the `Team` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TeamCompositionMode" AS ENUM ('FREE', 'PER_CLASS', 'PER_ANGKATAN');

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "eventId" UUID;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "maxTeamsPerGroup" INTEGER,
ADD COLUMN     "teamCompositionMode" "TeamCompositionMode" NOT NULL DEFAULT 'FREE';

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "angkatan" INTEGER;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "groupKey" TEXT,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "quotaConfirmed" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Announcement_eventId_idx" ON "Announcement"("eventId");

-- CreateIndex
CREATE INDEX "Team_categoryId_groupKey_idx" ON "Team"("categoryId", "groupKey");

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
