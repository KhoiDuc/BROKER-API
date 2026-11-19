-- CreateTable
CREATE TABLE "ToeicDailyHistory" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "words" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToeicDailyHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ToeicDailyHistory_username_idx" ON "ToeicDailyHistory"("username");

-- CreateIndex
CREATE UNIQUE INDEX "ToeicDailyHistory_username_dateKey_key" ON "ToeicDailyHistory"("username", "dateKey");
