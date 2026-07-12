-- DropIndex
DROP INDEX `AnnualReport_employeeId_fkey` ON `annualreport`;

-- DropIndex
DROP INDEX `AnnualReport_orphanId_fkey` ON `annualreport`;

-- DropIndex
DROP INDEX `Otp_userId_fkey` ON `otp`;

-- DropIndex
DROP INDEX `RequestAid_beneficiaryId_fkey` ON `requestaid`;

-- DropIndex
DROP INDEX `RequestAid_categoryId_fkey` ON `requestaid`;

-- DropIndex
DROP INDEX `RequestAid_subCategoryId_fkey` ON `requestaid`;

-- DropIndex
DROP INDEX `RolePermission_permissionId_fkey` ON `rolepermission`;

-- DropIndex
DROP INDEX `Sponsorship_donorId_fkey` ON `sponsorship`;

-- DropIndex
DROP INDEX `Sponsorship_employeeId_fkey` ON `sponsorship`;

-- DropIndex
DROP INDEX `Sponsorship_orphanId_fkey` ON `sponsorship`;

-- DropIndex
DROP INDEX `SubCategory_categoryId_fkey` ON `subcategory`;

-- DropIndex
DROP INDEX `Transaction_donorId_fkey` ON `transaction`;

-- DropIndex
DROP INDEX `UserRole_roleId_fkey` ON `userrole`;

-- DropIndex
DROP INDEX `WalletTransaction_walletId_fkey` ON `wallettransaction`;

-- AlterTable
ALTER TABLE `requestaid` ADD COLUMN `withdrawalReason` JSON NULL,
    ADD COLUMN `withdrawalRequested` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `withdrawalRequestedAt` DATETIME(3) NULL;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Otp` ADD CONSTRAINT `Otp_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Donor` ADD CONSTRAINT `Donor_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Beneficiary` ADD CONSTRAINT `Beneficiary_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AnnualReport` ADD CONSTRAINT `AnnualReport_orphanId_fkey` FOREIGN KEY (`orphanId`) REFERENCES `Orphan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AnnualReport` ADD CONSTRAINT `AnnualReport_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sponsorship` ADD CONSTRAINT `Sponsorship_donorId_fkey` FOREIGN KEY (`donorId`) REFERENCES `Donor`(`userId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sponsorship` ADD CONSTRAINT `Sponsorship_orphanId_fkey` FOREIGN KEY (`orphanId`) REFERENCES `Orphan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sponsorship` ADD CONSTRAINT `Sponsorship_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `Employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RequestAid` ADD CONSTRAINT `RequestAid_beneficiaryId_fkey` FOREIGN KEY (`beneficiaryId`) REFERENCES `Beneficiary`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RequestAid` ADD CONSTRAINT `RequestAid_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RequestAid` ADD CONSTRAINT `RequestAid_subCategoryId_fkey` FOREIGN KEY (`subCategoryId`) REFERENCES `SubCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AidDetails` ADD CONSTRAINT `AidDetails_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `RequestAid`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubCategory` ADD CONSTRAINT `SubCategory_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Wallet` ADD CONSTRAINT `Wallet_donorId_fkey` FOREIGN KEY (`donorId`) REFERENCES `Donor`(`userId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_donorId_fkey` FOREIGN KEY (`donorId`) REFERENCES `Donor`(`userId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WalletTransaction` ADD CONSTRAINT `WalletTransaction_walletId_fkey` FOREIGN KEY (`walletId`) REFERENCES `Wallet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
