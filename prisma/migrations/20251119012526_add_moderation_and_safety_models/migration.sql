-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('LISTING', 'USER', 'REVIEW', 'MESSAGE', 'ORDER', 'BOOKING');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('INAPPROPRIATE', 'SCAM', 'HARASSMENT', 'SPAM', 'FAKE', 'VIOLATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'RESOLVED', 'ESCALATED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ModerationType" AS ENUM ('WARNING', 'RESTRICTION', 'SUSPENSION', 'BAN', 'CONTENT_REMOVAL');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportType" "ReportType" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "description" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "buildingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_actions" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "actionType" "ModerationType" NOT NULL,
    "status" "ModerationStatus" NOT NULL DEFAULT 'ACTIVE',
    "performedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "buildingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_reputations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sellerRating" DOUBLE PRECISION DEFAULT 0,
    "totalSales" INTEGER NOT NULL DEFAULT 0,
    "salesVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "buyerRating" DOUBLE PRECISION DEFAULT 0,
    "totalPurchases" INTEGER NOT NULL DEFAULT 0,
    "completionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "responseTime" INTEGER,
    "responseRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reliabilityScore" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "trustedSeller" BOOLEAN NOT NULL DEFAULT false,
    "fastResponder" BOOLEAN NOT NULL DEFAULT false,
    "topRated" BOOLEAN NOT NULL DEFAULT false,
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_reputations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocked_users" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "building_settings" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "requireListingApproval" BOOLEAN NOT NULL DEFAULT false,
    "allowedCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxListingsPerSeller" INTEGER NOT NULL DEFAULT 10,
    "autoModeration" BOOLEAN NOT NULL DEFAULT true,
    "autoHideThreshold" INTEGER NOT NULL DEFAULT 3,
    "communityGuidelines" TEXT,
    "customRules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "building_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reports_reporterId_idx" ON "reports"("reporterId");

-- CreateIndex
CREATE INDEX "reports_entityType_entityId_idx" ON "reports"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "reports_buildingId_idx" ON "reports"("buildingId");

-- CreateIndex
CREATE INDEX "reports_createdAt_idx" ON "reports"("createdAt");

-- CreateIndex
CREATE INDEX "moderation_actions_targetType_targetId_idx" ON "moderation_actions"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "moderation_actions_performedBy_idx" ON "moderation_actions"("performedBy");

-- CreateIndex
CREATE INDEX "moderation_actions_status_idx" ON "moderation_actions"("status");

-- CreateIndex
CREATE INDEX "moderation_actions_expiresAt_idx" ON "moderation_actions"("expiresAt");

-- CreateIndex
CREATE INDEX "moderation_actions_buildingId_idx" ON "moderation_actions"("buildingId");

-- CreateIndex
CREATE UNIQUE INDEX "user_reputations_userId_key" ON "user_reputations"("userId");

-- CreateIndex
CREATE INDEX "user_reputations_userId_idx" ON "user_reputations"("userId");

-- CreateIndex
CREATE INDEX "user_reputations_reliabilityScore_idx" ON "user_reputations"("reliabilityScore");

-- CreateIndex
CREATE INDEX "blocked_users_blockerId_idx" ON "blocked_users"("blockerId");

-- CreateIndex
CREATE INDEX "blocked_users_blockedId_idx" ON "blocked_users"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "blocked_users_blockerId_blockedId_key" ON "blocked_users"("blockerId", "blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "building_settings_buildingId_key" ON "building_settings"("buildingId");

-- CreateIndex
CREATE INDEX "building_settings_buildingId_idx" ON "building_settings"("buildingId");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_reputations" ADD CONSTRAINT "user_reputations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_users" ADD CONSTRAINT "blocked_users_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_users" ADD CONSTRAINT "blocked_users_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "building_settings" ADD CONSTRAINT "building_settings_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
