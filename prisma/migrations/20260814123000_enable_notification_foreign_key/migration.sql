-- Use a storage engine that supports foreign keys for this relationship.
ALTER TABLE `User` ENGINE = InnoDB;
ALTER TABLE `Notification` ENGINE = InnoDB;

-- AddForeignKey
ALTER TABLE `Notification`
    ADD CONSTRAINT `Notification_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
