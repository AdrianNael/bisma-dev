-- AlterTable
ALTER TABLE `tran_payment` MODIFY `status_date_change` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP();

-- AlterTable
ALTER TABLE `tran_project` MODIFY `status_date_change` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP();

-- AlterTable
ALTER TABLE `tran_timesheet` MODIFY `status_date_change` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP();