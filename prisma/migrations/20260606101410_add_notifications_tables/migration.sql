-- DropIndex
DROP INDEX `request_aid_category_id_fkey` ON `request_aid`;

-- DropIndex
DROP INDEX `request_aid_sub_category_id_fkey` ON `request_aid`;

-- DropIndex
DROP INDEX `sub_categories_category_id_fkey` ON `sub_categories`;

-- DropIndex
DROP INDEX `wallet_transactions_wallet_id_fkey` ON `wallet_transactions`;

-- CreateTable
CREATE TABLE `notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `title` JSON NOT NULL,
    `message` JSON NOT NULL,
    `target_type` VARCHAR(191) NULL,
    `target_id` INTEGER NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
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
