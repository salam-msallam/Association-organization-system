-- AlterTable
ALTER TABLE `RequestAid`
    DROP COLUMN `withdrawalRequested`,
    DROP COLUMN `withdrawalRequestedAt`,
    DROP COLUMN `withdrawalReason`;
