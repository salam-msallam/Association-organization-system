-- Preserve the exact cancellation timestamp in endDate before removing the
-- redundant cancelledAt column. DATETIME(3) retains milliseconds.
ALTER TABLE `Sponsorship`
    MODIFY COLUMN `endDate` DATETIME(3) NULL;

UPDATE `Sponsorship`
SET `endDate` = `cancelledAt`
WHERE `cancelledAt` IS NOT NULL;

ALTER TABLE `Sponsorship`
    DROP COLUMN `cancelledAt`;
