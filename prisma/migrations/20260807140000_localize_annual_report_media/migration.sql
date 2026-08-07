-- Store both localized annual-report images in one JSON value.
-- Existing reports keep working by using their previous image for both languages.
ALTER TABLE `AnnualReport`
  ADD COLUMN `mediaUrl` JSON NULL AFTER `sponsorshipId`;

UPDATE `AnnualReport`
SET `mediaUrl` = JSON_OBJECT('ar', `imageUrl`, 'en', `imageUrl`);

ALTER TABLE `AnnualReport`
  MODIFY COLUMN `mediaUrl` JSON NOT NULL AFTER `sponsorshipId`,
  DROP COLUMN `imageUrl`,
  MODIFY COLUMN `reportNumber` INTEGER NOT NULL AFTER `mediaUrl`,
  MODIFY COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) AFTER `reportNumber`;
