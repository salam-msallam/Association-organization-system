CREATE TABLE `OrphanEmergencyCoverage` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `orphanId` INTEGER NOT NULL,
  `sponsorshipId` INTEGER NOT NULL,
  `originalAmount` DECIMAL(10, 2) NOT NULL,
  `monthlySupport` DECIMAL(10, 2) NOT NULL,
  `supportedMonths` INTEGER NOT NULL DEFAULT 0,
  `startDate` DATETIME(3) NOT NULL,
  `endDate` DATETIME(3) NULL,
  `status` ENUM('ACTIVE', 'COMPLETED', 'STOPPED_NEW_SPONSOR', 'STOPPED_INSUFFICIENT_FUNDS') NOT NULL DEFAULT 'ACTIVE',
  `reason` ENUM('SPONSOR_CANCELLED', 'PAYMENT_INTERRUPTED') NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `OrphanEmergencyCoverage_orphanId_status_idx`(`orphanId`, `status`),
  INDEX `OrphanEmergencyCoverage_sponsorshipId_status_idx`(`sponsorshipId`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SponsorshipFundSupport` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `coverageId` INTEGER NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `balanceAfter` DECIMAL(12, 2) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `SponsorshipFundSupport_coverageId_createdAt_idx`(`coverageId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `OrphanEmergencyCoverage`
  ADD CONSTRAINT `OrphanEmergencyCoverage_orphanId_fkey`
  FOREIGN KEY (`orphanId`) REFERENCES `Orphan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `OrphanEmergencyCoverage`
  ADD CONSTRAINT `OrphanEmergencyCoverage_sponsorshipId_fkey`
  FOREIGN KEY (`sponsorshipId`) REFERENCES `Sponsorship`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `SponsorshipFundSupport`
  ADD CONSTRAINT `SponsorshipFundSupport_coverageId_fkey`
  FOREIGN KEY (`coverageId`) REFERENCES `OrphanEmergencyCoverage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
