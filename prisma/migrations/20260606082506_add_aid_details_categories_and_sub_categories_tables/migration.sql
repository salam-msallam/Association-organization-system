-- CreateTable
CREATE TABLE `aid_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `request_id` INTEGER NOT NULL,
    `academic_achievement` VARCHAR(191) NULL,
    `institution_name` VARCHAR(191) NULL,
    `year` VARCHAR(191) NULL,
    `number_individuals` INTEGER NULL,
    `project_name` VARCHAR(191) NULL,
    `project_category` VARCHAR(191) NULL,
    `number_of_people_supported` INTEGER NULL,
    `current_housing_situation` VARCHAR(191) NULL,
    `type_aid` ENUM('FOOD_BASKET', 'BABY_MILK') NULL,
    `current_rent` DECIMAL(10, 2) NULL,
    `current_place_of_residence` VARCHAR(191) NULL,
    `reason_for_lock` VARCHAR(191) NULL,
    `housing_specifications` VARCHAR(191) NULL,
    `media_urls` JSON NULL,

    UNIQUE INDEX `aid_details_request_id_key`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sub_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `category_id` INTEGER NOT NULL,
    `name` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

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
