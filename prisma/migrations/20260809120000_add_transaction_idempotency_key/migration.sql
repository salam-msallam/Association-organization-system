ALTER TABLE `Transaction`
  ADD COLUMN `idempotencyKey` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `Transaction_idempotencyKey_key` ON `Transaction`(`idempotencyKey`);
