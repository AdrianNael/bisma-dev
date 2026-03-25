/*
  Warnings:

  - You are about to drop the column `status_date_change` on the `tran_payment` table. All the data in the column will be lost.
  - You are about to drop the column `status_date_change` on the `tran_project` table. All the data in the column will be lost.
  - You are about to drop the column `status_date_change` on the `tran_timesheet` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `tran_payment` DROP COLUMN `status_date_change`;

-- AlterTable
ALTER TABLE `tran_project` DROP COLUMN `status_date_change`;

-- AlterTable
ALTER TABLE `tran_timesheet` DROP COLUMN `status_date_change`;

-- CreateTable
CREATE TABLE `project_status_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_project` INTEGER NOT NULL,
    `id_status` INTEGER NOT NULL,
    `changed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `timesheet_status_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_timesheet` INTEGER NOT NULL,
    `id_status` INTEGER NOT NULL,
    `changed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `tran_projectId` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_status_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_payment` INTEGER NOT NULL,
    `id_status` INTEGER NOT NULL,
    `changed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `project_status_history` ADD CONSTRAINT `project_status_history_id_project_fkey` FOREIGN KEY (`id_project`) REFERENCES `tran_project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_status_history` ADD CONSTRAINT `project_status_history_id_status_fkey` FOREIGN KEY (`id_status`) REFERENCES `tmst_status_project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timesheet_status_history` ADD CONSTRAINT `timesheet_status_history_id_timesheet_fkey` FOREIGN KEY (`id_timesheet`) REFERENCES `tran_timesheet`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timesheet_status_history` ADD CONSTRAINT `timesheet_status_history_id_status_fkey` FOREIGN KEY (`id_status`) REFERENCES `tmst_status_timesheet`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `timesheet_status_history` ADD CONSTRAINT `timesheet_status_history_tran_projectId_fkey` FOREIGN KEY (`tran_projectId`) REFERENCES `tran_project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_status_history` ADD CONSTRAINT `payment_status_history_id_payment_fkey` FOREIGN KEY (`id_payment`) REFERENCES `tran_payment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_status_history` ADD CONSTRAINT `payment_status_history_id_status_fkey` FOREIGN KEY (`id_status`) REFERENCES `tmst_status_pembayaran`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
