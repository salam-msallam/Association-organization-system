ALTER TABLE `Orphan`
  ADD COLUMN `priority` INTEGER NOT NULL DEFAULT 3,
  ADD CONSTRAINT `Orphan_priority_check` CHECK (`priority` BETWEEN 1 AND 5);

CREATE INDEX `Orphan_priority_createdAt_idx`
  ON `Orphan`(`priority`, `createdAt`);
