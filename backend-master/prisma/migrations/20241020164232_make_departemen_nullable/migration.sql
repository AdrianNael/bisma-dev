-- DropForeignKey
ALTER TABLE `tmst_pengguna` DROP FOREIGN KEY `tmst_pengguna_departemen_fkey`;

-- AlterTable
ALTER TABLE `tmst_pengguna` MODIFY `departemen` VARCHAR(512) NULL;

-- AddForeignKey
ALTER TABLE `tmst_pengguna` ADD CONSTRAINT `tmst_pengguna_departemen_fkey` FOREIGN KEY (`departemen`) REFERENCES `tmst_department`(`department`) ON DELETE SET NULL ON UPDATE CASCADE;
