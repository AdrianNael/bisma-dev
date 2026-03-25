/*
  Warnings:

  - Added the required column `status_date_change` to the `tran_payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status_date_change` to the `tran_project` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status_date_change` to the `tran_timesheet` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `tran_payment` ADD COLUMN `status_date_change` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `tran_project` ADD COLUMN `status_date_change` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `tran_timesheet` ADD COLUMN `status_date_change` DATETIME(3) NOT NULL;
