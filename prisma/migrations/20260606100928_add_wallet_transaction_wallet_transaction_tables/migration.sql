/*
  Warnings:

  - You are about to alter the column `academic_achievement` on the `aid_details` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(1))`.
  - You are about to alter the column `institution_name` on the `aid_details` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Json`.
  - You are about to alter the column `project_name` on the `aid_details` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Json`.
  - You are about to alter the column `project_category` on the `aid_details` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Json`.
  - You are about to alter the column `current_housing_situation` on the `aid_details` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Json`.
  - You are about to alter the column `current_place_of_residence` on the `aid_details` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Json`.
  - You are about to alter the column `reason_for_lock` on the `aid_details` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Json`.
  - You are about to alter the column `housing_specifications` on the `aid_details` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Json`.

*/
-- DropIndex
DROP INDEX `request_aid_category_id_fkey` ON `request_aid`;

-- DropIndex
DROP INDEX `request_aid_sub_category_id_fkey` ON `request_aid`;

-- DropIndex
DROP INDEX `sub_categories_category_id_fkey` ON `sub_categories`;

-- AlterTable
ALTER TABLE `aid_details` MODIFY `academic_achievement` ENUM('HIGH_SCHOOL', 'DIPLOMA', 'BACHELOR', 'MASTER') NULL,
    MODIFY `institution_name` JSON NULL,
    MODIFY `project_name` JSON NULL,
    MODIFY `project_category` JSON NULL,
    MODIFY `current_housing_situation` JSON NULL,
    MODIFY `current_place_of_residence` JSON NULL,
    MODIFY `reason_for_lock` JSON NULL,
    MODIFY `housing_specifications` JSON NULL;

-- CreateTable
CREATE TABLE `wallets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `donor_id` INTEGER NOT NULL,
    `running_balance` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,

    UNIQUE INDEX `wallets_donor_id_key`(`donor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transactions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `donor_id` INTEGER NOT NULL,
    `stripe_payment_intent_id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `payment_status` ENUM('PENDING', 'SUCCESSFUL', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `reference_type` VARCHAR(191) NULL,
    `reference_id` INTEGER NULL,
    `type` ENUM('CHARGE', 'Deposit', 'WITHDRAWAL') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `transactions_stripe_payment_intent_id_key`(`stripe_payment_intent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wallet_transactions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `wallet_id` INTEGER NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `type` ENUM('CHARGE', 'Deposit', 'WITHDRAWAL') NOT NULL,
    `reference_type` VARCHAR(191) NULL,
    `reference_id` INTEGER NULL,
    `balance_after` DECIMAL(10, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `request_aid` ADD CONSTRAINT `request_aid_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `request_aid` ADD CONSTRAINT `request_aid_sub_category_id_fkey` FOREIGN KEY (`sub_category_id`) REFERENCES `sub_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `aid_details` ADD CONSTRAINT `aid_details_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `request_aid`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sub_categories` ADD CONSTRAINT `sub_categories_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallet_transactions` ADD CONSTRAINT `wallet_transactions_wallet_id_fkey` FOREIGN KEY (`wallet_id`) REFERENCES `wallets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
