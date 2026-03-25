-- AlterTable
ALTER TABLE `tmst_pengguna` MODIFY `status` ENUM('STAF', 'MAHASISWA', 'MANAGER', 'DIREKTORAT') NOT NULL;

-- AlterTable
ALTER TABLE `tmst_project` ADD COLUMN `kriteria` TEXT NULL,
    ADD COLUMN `kuota` INTEGER NULL,
    ADD COLUMN `pendaftaran_mulai` DATE NULL,
    ADD COLUMN `pendaftaran_selesai` DATE NULL,
    ADD COLUMN `status` ENUM('Draft', 'Open', 'Selection', 'Submitted', 'Approved', 'Rejected') NOT NULL DEFAULT 'Draft';

-- CreateTable
CREATE TABLE `job_applications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `master_project_id` INTEGER NOT NULL,
    `mahasiswa_id` VARCHAR(20) NOT NULL,
    `tanggal_lamaran` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('Menunggu', 'Diterima', 'Ditolak') NOT NULL DEFAULT 'Menunggu',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `job_applications` ADD CONSTRAINT `job_applications_master_project_id_fkey` FOREIGN KEY (`master_project_id`) REFERENCES `tmst_project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_applications` ADD CONSTRAINT `job_applications_mahasiswa_id_fkey` FOREIGN KEY (`mahasiswa_id`) REFERENCES `tmst_pengguna`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
