-- Persist the exact billing month covered by each sponsorship payment.
-- Existing transactions remain NULL and are interpreted by the application
-- using their creation date and the sponsorship's first-payment rule.
ALTER TABLE `WalletTransaction`
  ADD COLUMN `coveredMonth` CHAR(7) NULL;

CREATE UNIQUE INDEX `WalletTransaction_referenceType_referenceId_coveredMonth_key`
  ON `WalletTransaction`(`referenceType`, `referenceId`, `coveredMonth`);
