/*
  Warnings:

  - You are about to drop the column `id_tran_project` on the `tran_payment` table. All the data in the column will be lost.
  - Added the required column `id_tmst_project` to the `tran_payment` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `tran_payment` DROP FOREIGN KEY `tran_payment_id_tran_project_fkey`;

-- AlterTable
ALTER TABLE `tran_payment` DROP COLUMN `id_tran_project`,
    ADD COLUMN `id_tmst_project` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `tran_payment` ADD CONSTRAINT `tran_payment_id_tmst_project_fkey` FOREIGN KEY (`id_tmst_project`) REFERENCES `tmst_project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
