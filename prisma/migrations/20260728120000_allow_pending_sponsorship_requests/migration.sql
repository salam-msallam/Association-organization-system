-- Pending sponsorship requests are created before an employee and orphan are assigned.
ALTER TABLE `Sponsorship`
    MODIFY `orphanId` INTEGER NULL,
    MODIFY `employeeId` INTEGER NULL,
    MODIFY `amount` DECIMAL(10, 2) NOT NULL DEFAULT 10.00;
