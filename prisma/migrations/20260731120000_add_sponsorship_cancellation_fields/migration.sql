ALTER TABLE `Sponsorship`
    ADD COLUMN `cancelledAt` DATETIME(3) NULL,
    ADD COLUMN `cancellationSource` ENUM('DONOR', 'AUTOMATIC') NULL;
