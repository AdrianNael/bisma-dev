/*
  Warnings:

  - The values [DIREKTORAT] on the enum `tmst_pengguna_status` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `tmst_pengguna` MODIFY `status` ENUM('STAF', 'MAHASISWA', 'MANAGER', 'DIRMAWA') NOT NULL;
