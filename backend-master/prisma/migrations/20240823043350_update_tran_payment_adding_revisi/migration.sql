/*
  Warnings:

  - Added the required column `revisi` to the `tran_payment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `tran_payment` ADD COLUMN `revisi` VARCHAR(100) NOT NULL;
