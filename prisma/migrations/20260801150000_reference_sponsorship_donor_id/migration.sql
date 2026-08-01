-- Sponsorship.donorId previously stored Donor.userId. Convert the existing
-- values to Donor.id before replacing the foreign key.
ALTER TABLE `Sponsorship`
    DROP FOREIGN KEY `Sponsorship_donorId_fkey`,
    ADD COLUMN `donorRecordId` INTEGER NULL;

UPDATE `Sponsorship` AS `sponsorship`
INNER JOIN `Donor` AS `donor`
    ON `donor`.`userId` = `sponsorship`.`donorId`
SET `sponsorship`.`donorRecordId` = `donor`.`id`;

UPDATE `Sponsorship`
SET `donorId` = `donorRecordId`;

ALTER TABLE `Sponsorship`
    DROP COLUMN `donorRecordId`,
    ADD CONSTRAINT `Sponsorship_donorId_fkey`
    FOREIGN KEY (`donorId`) REFERENCES `Donor`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
