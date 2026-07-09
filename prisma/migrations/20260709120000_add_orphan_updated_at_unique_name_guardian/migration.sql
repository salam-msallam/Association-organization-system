ALTER TABLE `Orphan`
ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

CREATE UNIQUE INDEX `Orphan_firstName_lastName_guardianName_key`
ON `Orphan`(`firstName`, `lastName`, `guardianName`);
