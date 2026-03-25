/*
  Warnings:

  - Added the required column `durasi` to the `tran_project` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `tran_project` ADD COLUMN `durasi` INTEGER NOT NULL;
