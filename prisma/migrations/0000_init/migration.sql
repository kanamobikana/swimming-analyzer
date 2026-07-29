-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Specialty" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "costPerCredit" DOUBLE PRECISION NOT NULL,
    "creditDurationMin" INTEGER NOT NULL,
    "allowsDouble" BOOLEAN NOT NULL DEFAULT false,
    "realShortShare" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "realLongShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Specialty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "recurrence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageSpecialty" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,
    "mixShare" DOUBLE PRECISION NOT NULL,
    "contractedCredits" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "PackageSpecialty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalConfig" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "targetMargin" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0.1125,
    "noShowRate" DOUBLE PRECISION NOT NULL DEFAULT 0.105,
    "noShowRepassePct" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "utilizationBands" TEXT NOT NULL DEFAULT '[0.01,0.015,0.02,0.03,0.04,0.05,0.06,0.08,0.1]',
    "volumeBands" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalVersion" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "snapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PackageSpecialty_packageId_specialtyId_key" ON "PackageSpecialty"("packageId", "specialtyId");

-- CreateIndex
CREATE UNIQUE INDEX "ProposalVersion_proposalId_version_key" ON "ProposalVersion"("proposalId", "version");

-- AddForeignKey
ALTER TABLE "PackageSpecialty" ADD CONSTRAINT "PackageSpecialty_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageSpecialty" ADD CONSTRAINT "PackageSpecialty_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalVersion" ADD CONSTRAINT "ProposalVersion_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

