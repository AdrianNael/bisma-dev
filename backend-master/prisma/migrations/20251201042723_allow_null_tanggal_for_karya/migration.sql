/*
  Warnings:

  - You are about to drop the `profile_pengguna` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE `tmst_project` MODIFY `tanggal_mulai` DATE NULL,
    MODIFY `tanggal_selesai` DATE NULL;

-- DropTable
DROP TABLE `profile_pengguna`;
