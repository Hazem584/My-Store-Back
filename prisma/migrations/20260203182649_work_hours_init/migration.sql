-- CreateTable
CREATE TABLE "WorkDay" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "shift1Start" TIMESTAMP(3),
    "shift1End" TIMESTAMP(3),
    "shift2Start" TIMESTAMP(3),
    "shift2End" TIMESTAMP(3),
    "totalMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkDay_date_idx" ON "WorkDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "WorkDay_userId_date_key" ON "WorkDay"("userId", "date");

-- AddForeignKey
ALTER TABLE "WorkDay" ADD CONSTRAINT "WorkDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
