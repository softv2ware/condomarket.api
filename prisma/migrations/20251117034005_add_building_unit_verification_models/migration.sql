-- CreateEnum
CREATE TYPE "BuildingType" AS ENUM ('APARTMENT_COMPLEX', 'CONDOMINIUM', 'GATED_COMMUNITY', 'RESIDENTIAL_TOWER', 'MIXED_USE', 'OTHER');

-- CreateEnum
CREATE TYPE "BuildingStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VerificationMethod" AS ENUM ('INVITATION_CODE', 'UNIT_CODE_LASTNAME', 'MANUAL_APPROVAL');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN     "acceptedPaymentMethods" TEXT[];

-- CreateTable
CREATE TABLE "buildings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT DEFAULT 'USA',
    "type" "BuildingType" NOT NULL DEFAULT 'APARTMENT_COMPLEX',
    "status" "BuildingStatus" NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "adminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "floor" INTEGER,
    "type" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resident_buildings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "unitId" TEXT,
    "verificationMethod" "VerificationMethod",
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verificationData" JSONB,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "moveInDate" TIMESTAMP(3),
    "moveOutDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resident_buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation_codes" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "usedBy" TEXT,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitation_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "buildings_status_idx" ON "buildings"("status");

-- CreateIndex
CREATE INDEX "buildings_adminId_idx" ON "buildings"("adminId");

-- CreateIndex
CREATE INDEX "units_buildingId_idx" ON "units"("buildingId");

-- CreateIndex
CREATE UNIQUE INDEX "units_buildingId_unitNumber_key" ON "units"("buildingId", "unitNumber");

-- CreateIndex
CREATE INDEX "resident_buildings_buildingId_idx" ON "resident_buildings"("buildingId");

-- CreateIndex
CREATE INDEX "resident_buildings_userId_idx" ON "resident_buildings"("userId");

-- CreateIndex
CREATE INDEX "resident_buildings_verificationStatus_idx" ON "resident_buildings"("verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "resident_buildings_userId_buildingId_key" ON "resident_buildings"("userId", "buildingId");

-- CreateIndex
CREATE UNIQUE INDEX "invitation_codes_code_key" ON "invitation_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "invitation_codes_usedBy_key" ON "invitation_codes"("usedBy");

-- CreateIndex
CREATE INDEX "invitation_codes_buildingId_idx" ON "invitation_codes"("buildingId");

-- CreateIndex
CREATE INDEX "invitation_codes_code_idx" ON "invitation_codes"("code");

-- CreateIndex
CREATE INDEX "invitation_codes_isActive_idx" ON "invitation_codes"("isActive");

-- AddForeignKey
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resident_buildings" ADD CONSTRAINT "resident_buildings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resident_buildings" ADD CONSTRAINT "resident_buildings_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resident_buildings" ADD CONSTRAINT "resident_buildings_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resident_buildings" ADD CONSTRAINT "resident_buildings_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_codes" ADD CONSTRAINT "invitation_codes_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_codes" ADD CONSTRAINT "invitation_codes_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_codes" ADD CONSTRAINT "invitation_codes_usedBy_fkey" FOREIGN KEY ("usedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
