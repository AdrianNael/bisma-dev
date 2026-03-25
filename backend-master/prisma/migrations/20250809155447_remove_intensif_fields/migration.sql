/*
  Warnings:

  - You are about to drop the column `intensif_per_jam` on the `tmst_project` table. All the data in the column will be lost.
  - You are about to drop the column `total_intensif` on the `tmst_project` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `tmst_project` DROP COLUMN `intensif_per_jam`,
    DROP COLUMN `total_intensif`;
