CREATE TABLE "TcbsSession" (
    "username" TEXT NOT NULL,
    "apiKeyEnc" TEXT NOT NULL,
    "tokenEnc" TEXT NOT NULL,
    "tokenExp" TIMESTAMP(3),
    "custodyCode" TEXT NOT NULL DEFAULT '',
    "accountNo" TEXT NOT NULL DEFAULT '',
    "readOnly" BOOLEAN NOT NULL DEFAULT true,
    "needsReauth" BOOLEAN NOT NULL DEFAULT false,
    "extras" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TcbsSession_pkey" PRIMARY KEY ("username")
);
