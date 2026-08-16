ALTER TABLE `Transaction`
  MODIFY `type` ENUM(
    'AID_REQUEST_DONATION',
    'SPONSORSHIP_DONATION',
    'GENERAL_DONATION',
    'QUICK_AID_FUND_DONATION',
    'WALLET_TOP_UP'
  ) NOT NULL;

ALTER TABLE `WalletTransaction`
  MODIFY `type` ENUM(
    'AID_REQUEST_DONATION',
    'SPONSORSHIP_DONATION',
    'GENERAL_DONATION',
    'QUICK_AID_FUND_DONATION',
    'WALLET_TOP_UP'
  ) NOT NULL;

CREATE TABLE `QuickAidDisbursement` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `beneficiaryId` INTEGER NOT NULL,
  `employeeId` INTEGER NOT NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `reason` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `QuickAidDisbursement_beneficiaryId_idx`(`beneficiaryId`),
  INDEX `QuickAidDisbursement_employeeId_idx`(`employeeId`),
  INDEX `QuickAidDisbursement_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `QuickAidDisbursement`
  ADD CONSTRAINT `QuickAidDisbursement_beneficiaryId_fkey`
  FOREIGN KEY (`beneficiaryId`) REFERENCES `Beneficiary`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `QuickAidDisbursement`
  ADD CONSTRAINT `QuickAidDisbursement_employeeId_fkey`
  FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
