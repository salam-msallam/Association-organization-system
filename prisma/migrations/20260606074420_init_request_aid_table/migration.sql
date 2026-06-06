-- CreateTable
CREATE TABLE `request_aid` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `beneficiary_id` INTEGER NOT NULL,
    `employee_id` INTEGER NOT NULL,
    `category_id` INTEGER NOT NULL,
    `sub_category_id` INTEGER NULL,
    `first_name` VARCHAR(191) NOT NULL,
    `last_name` VARCHAR(191) NOT NULL,
    `beneficiary_father_name` VARCHAR(191) NOT NULL,
    `social_status` ENUM('SINGLE', 'MARRIED', 'WIDOWED', 'DIVORCED') NOT NULL,
    `address` JSON NOT NULL,
    `age` INTEGER NOT NULL,
    `isUnemployed` BOOLEAN NOT NULL DEFAULT false,
    `gender` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `title` JSON NOT NULL,
    `details` JSON NOT NULL,
    `description` JSON NOT NULL,
    `cost` DECIMAL(10, 2) NOT NULL,
    `current_payment` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `is_urgent` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
