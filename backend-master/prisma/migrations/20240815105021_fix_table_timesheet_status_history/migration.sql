/*
  Warnings:

  - You are about to drop the column `tran_projectId` on the `timesheet_status_history` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `timesheet_status_history` DROP FOREIGN KEY `timesheet_status_history_tran_projectId_fkey`;

-- AlterTable
ALTER TABLE `timesheet_status_history` DROP COLUMN `tran_projectId`;
