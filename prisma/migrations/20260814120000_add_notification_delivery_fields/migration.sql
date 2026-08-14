-- AlterTable
ALTER TABLE `User`
    ADD COLUMN `notificationRegistrationId` VARCHAR(512)
    CHARACTER SET ascii COLLATE ascii_bin NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_notificationRegistrationId_key`
    ON `User`(`notificationRegistrationId`);

-- CreateIndex
CREATE INDEX `Notification_user_id_isRead_createdAt_idx`
    ON `Notification`(`user_id`, `isRead`, `createdAt`);

-- AddForeignKey
ALTER TABLE `Notification`
    ADD CONSTRAINT `Notification_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
