-- The previous AnnualReport shape was unused and has no records. Redesign it
-- around the sponsorship so the donor and orphan are derived from one source.
ALTER TABLE `AnnualReport`
  DROP FOREIGN KEY `AnnualReport_orphanId_fkey`,
  DROP FOREIGN KEY `AnnualReport_employeeId_fkey`;

ALTER TABLE `AnnualReport`
  ADD COLUMN `sponsorshipId` INTEGER NOT NULL,
  ADD COLUMN `reportNumber` INTEGER NOT NULL,
  CHANGE COLUMN `mediaUrls` `imageUrl` VARCHAR(191) NOT NULL,
  DROP COLUMN `orphanId`,
  DROP COLUMN `year`,
  DROP COLUMN `content`;

CREATE UNIQUE INDEX `AnnualReport_sponsorshipId_reportNumber_key`
  ON `AnnualReport`(`sponsorshipId`, `reportNumber`);

ALTER TABLE `AnnualReport`
  ADD CONSTRAINT `AnnualReport_sponsorshipId_fkey`
    FOREIGN KEY (`sponsorshipId`) REFERENCES `Sponsorship`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `AnnualReport_employeeId_fkey`
    FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
