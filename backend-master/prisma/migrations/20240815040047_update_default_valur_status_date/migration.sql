-- AlterTable
ALTER TABLE `tran_payment` MODIFY `status_date_change` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `tran_project` MODIFY `status_date_change` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `tran_timesheet` MODIFY `status_date_change` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
