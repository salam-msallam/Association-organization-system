-- Development data cleanup for the financial redesign.
-- This intentionally removes old financial-operation rows whose enum values no longer match the new model.
DELETE FROM `WalletTransaction`;
DELETE FROM `Transaction`;
UPDATE `Wallet` SET `runningBalance` = 0.00;
UPDATE `RequestAid` SET `currentPayment` = 0.00;

ALTER TABLE `Wallet`
  MODIFY `runningBalance` DECIMAL(12, 2) NOT NULL DEFAULT 0.00;

ALTER TABLE `Transaction`
  CHANGE `paymentStatus` `status` ENUM('PENDING', 'SUCCESSFUL', 'FAILED') NOT NULL DEFAULT 'PENDING',
  MODIFY `amount` DECIMAL(12, 2) NOT NULL,
  MODIFY `type` ENUM('AID_REQUEST_DONATION', 'SPONSORSHIP_DONATION', 'GENERAL_DONATION', 'WALLET_TOP_UP') NOT NULL,
  ADD COLUMN `currency` VARCHAR(191) NOT NULL DEFAULT 'usd';

ALTER TABLE `WalletTransaction`
  ADD COLUMN `transactionId` INTEGER NULL,
  MODIFY `amount` DECIMAL(12, 2) NOT NULL,
  MODIFY `type` ENUM('AID_REQUEST_DONATION', 'SPONSORSHIP_DONATION', 'GENERAL_DONATION', 'WALLET_TOP_UP') NOT NULL,
  ADD COLUMN `direction` ENUM('CREDIT', 'DEBIT') NOT NULL,
  MODIFY `balanceAfter` DECIMAL(12, 2) NOT NULL;

CREATE UNIQUE INDEX `WalletTransaction_transactionId_key` ON `WalletTransaction`(`transactionId`);

ALTER TABLE `WalletTransaction`
  ADD CONSTRAINT `WalletTransaction_transactionId_fkey`
  FOREIGN KEY (`transactionId`) REFERENCES `Transaction`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
