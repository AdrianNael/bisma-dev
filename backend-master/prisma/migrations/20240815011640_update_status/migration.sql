/*
  Warnings:

  - Added the required column `id_status` to the `tran_project` table without a default value. This is not possible if the table is not empty.
  - Added the required column `id_status` to the `tran_timesheet` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `tran_project` ADD COLUMN `id_status` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `tran_timesheet` ADD COLUMN `id_status` INTEGER NOT NULL;

-- CreateTable
CREATE TABLE `tmst_status_project` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `status` VARCHAR(100) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tran_project` ADD CONSTRAINT `tran_project_id_status_fkey` FOREIGN KEY (`id_status`) REFERENCES `tmst_status_project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tran_timesheet` ADD CONSTRAINT `tran_timesheet_id_status_fkey` FOREIGN KEY (`id_status`) REFERENCES `tmst_status_timesheet`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
