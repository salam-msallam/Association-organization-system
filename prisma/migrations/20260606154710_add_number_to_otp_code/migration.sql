/*
  Warnings:

  - Added the required column `number` to the `Otp` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `otp` ADD COLUMN `number` VARCHAR(191) NOT NULL;
