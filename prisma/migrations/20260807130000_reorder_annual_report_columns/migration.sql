ALTER TABLE `AnnualReport`
  DROP FOREIGN KEY `AnnualReport_employeeId_fkey`,
  DROP FOREIGN KEY `AnnualReport_sponsorshipId_fkey`;

ALTER TABLE `AnnualReport`
  MODIFY COLUMN `employeeId` INTEGER NOT NULL AFTER `id`,
  MODIFY COLUMN `sponsorshipId` INTEGER NOT NULL AFTER `employeeId`,
  MODIFY COLUMN `imageUrl` VARCHAR(191) NOT NULL AFTER `sponsorshipId`,
  MODIFY COLUMN `reportNumber` INTEGER NOT NULL AFTER `imageUrl`,
  MODIFY COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) AFTER `reportNumber`;

ALTER TABLE `AnnualReport`
  ADD CONSTRAINT `AnnualReport_employeeId_fkey`
    FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `AnnualReport_sponsorshipId_fkey`
    FOREIGN KEY (`sponsorshipId`) REFERENCES `Sponsorship`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
