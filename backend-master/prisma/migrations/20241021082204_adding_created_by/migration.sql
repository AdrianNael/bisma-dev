/*
  Warnings:

  - Added the required column `created_by` to the `tmst_project` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `tmst_project` ADD COLUMN `created_by` VARCHAR(50) NOT NULL;

-- AddForeignKey
ALTER TABLE `tmst_project` ADD CONSTRAINT `tmst_project_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `tmst_pengguna`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
