/*
  Warnings:

  - You are about to drop the column `FamilyStatement` on the `beneficiary` table. All the data in the column will be lost.
  - You are about to alter the column `gender` on the `requestaid` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(7))`.
  - You are about to alter the column `status` on the `requestaid` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(8))`.
  - You are about to alter the column `status` on the `sponsorship` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(4))` to `Enum(EnumId(8))`.
  - The values [CHARGE,Deposit,WITHDRAWAL] on the enum `WalletTransaction_type` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `CountryCode` on the `user` table. All the data in the column will be lost.
  - You are about to alter the column `number` on the `user` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(20)`.
  - You are about to alter the column `countryName` on the `user` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(10)`.
  - The values [CHARGE,Deposit,WITHDRAWAL] on the enum `WalletTransaction_type` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[countryCode,number]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `familyStatement` to the `Beneficiary` table without a default value. This is not possible if the table is not empty.
  - Made the column `status` on table `beneficiary` required. This step will fail if there are existing NULL values in that column.

*/
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
ALTER TABLE `aiddetails` MODIFY `typeAid` ENUM('FOOD_BASKET', 'BABY_MILK', 'MEDICINE_INSURANCE', 'SURGERY', 'MEDICAL_DEVICES') NULL;

-- AlterTable
ALTER TABLE `beneficiary` DROP COLUMN `FamilyStatement`,
    ADD COLUMN `familyStatement` VARCHAR(191) NOT NULL,
    MODIFY `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `requestaid` MODIFY `employeeId` INTEGER NULL,
    MODIFY `gender` ENUM('MALE', 'FEMALE') NOT NULL,
    MODIFY `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `sponsorship` MODIFY `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `transaction` MODIFY `type` ENUM('DIRECT_DONATION', 'WALLET_DONATION') NOT NULL;

-- AlterTable
ALTER TABLE `user` DROP COLUMN `CountryCode`,
    ADD COLUMN `countryCode` VARCHAR(191) NOT NULL DEFAULT '+963',
    MODIFY `number` VARCHAR(20) NOT NULL,
    MODIFY `countryName` VARCHAR(10) NOT NULL DEFAULT 'syria';

-- AlterTable
ALTER TABLE `wallettransaction` MODIFY `type` ENUM('DIRECT_DONATION', 'WALLET_DONATION') NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_countryCode_number_key` ON `User`(`countryCode`, `number`);

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
