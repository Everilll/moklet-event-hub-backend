-- CreateTable
CREATE TABLE "EventCommitteeMember" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "addedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventCommitteeMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventCommitteeMember_eventId_studentId_key" ON "EventCommitteeMember"("eventId", "studentId");

-- AddForeignKey
ALTER TABLE "EventCommitteeMember" ADD CONSTRAINT "EventCommitteeMember_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCommitteeMember" ADD CONSTRAINT "EventCommitteeMember_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCommitteeMember" ADD CONSTRAINT "EventCommitteeMember_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
