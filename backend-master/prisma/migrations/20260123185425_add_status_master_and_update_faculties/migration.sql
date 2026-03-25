/*
  Warnings:

  - You are about to drop the column `status` on the `tmst_project` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `tmst_project` DROP COLUMN `status`,
    ADD COLUMN `id_status` INTEGER NOT NULL DEFAULT 1,
    MODIFY `nama` VARCHAR(255) NOT NULL;

-- AlterTable
ALTER TABLE `tmst_status_pembayaran` ADD COLUMN `deskripsi` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `tmst_status_project` ADD COLUMN `deskripsi` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `tmst_status_timesheet` ADD COLUMN `deskripsi` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `tran_payment` MODIFY `url_file_sp3` VARCHAR(255) NULL;

-- CreateTable
CREATE TABLE `tmst_status_master_project` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `status` VARCHAR(50) NOT NULL,
    `deskripsi` VARCHAR(255) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tmst_project` ADD CONSTRAINT `tmst_project_id_status_fkey` FOREIGN KEY (`id_status`) REFERENCES `tmst_status_master_project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
