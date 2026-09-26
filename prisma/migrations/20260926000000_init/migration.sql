-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vault" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "def" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "proof" TEXT NOT NULL,
    "par" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "machineGaveUp" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "cracks" INTEGER NOT NULL DEFAULT 0,
    "bestTurns" INTEGER,
    "firstCrackAt" TIMESTAMP(3),
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastPlayedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "userId" TEXT,
    "player" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "turns" INTEGER NOT NULL,
    "moves" TEXT NOT NULL,
    "caughtBy" TEXT,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Crack" (
    "id" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "turns" INTEGER NOT NULL,
    "moves" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "first" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Crack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "Vault_code_key" ON "Vault"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Vault_hash_key" ON "Vault"("hash");

-- CreateIndex
CREATE INDEX "Vault_createdAt_idx" ON "Vault"("createdAt");

-- CreateIndex
CREATE INDEX "Vault_lastPlayedAt_idx" ON "Vault"("lastPlayedAt");

-- CreateIndex
CREATE INDEX "Vault_creatorId_idx" ON "Vault"("creatorId");

-- CreateIndex
CREATE INDEX "Attempt_vaultId_createdAt_idx" ON "Attempt"("vaultId", "createdAt");

-- CreateIndex
CREATE INDEX "Attempt_vaultId_outcome_idx" ON "Attempt"("vaultId", "outcome");

-- CreateIndex
CREATE INDEX "Attempt_userId_idx" ON "Attempt"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Crack_vaultId_userId_key" ON "Crack"("vaultId", "userId");

-- CreateIndex
CREATE INDEX "Crack_vaultId_turns_idx" ON "Crack"("vaultId", "turns");

-- CreateIndex
CREATE INDEX "Crack_userId_idx" ON "Crack"("userId");

-- AddForeignKey
ALTER TABLE "Vault" ADD CONSTRAINT "Vault_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "Vault"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Crack" ADD CONSTRAINT "Crack_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "Vault"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Crack" ADD CONSTRAINT "Crack_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
