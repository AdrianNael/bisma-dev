-- CreateTable
CREATE TABLE `users` (
    `username` VARCHAR(100) NOT NULL,
    `password` VARCHAR(100) NOT NULL,
    `name` VARCHAR(100) NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    PRIMARY KEY (`username`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tmst_kategori_magang` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kategori` VARCHAR(255) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tran_insentif` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_kategori` INTEGER NOT NULL,
    `id_satuan` INTEGER NOT NULL,
    `besaran_insentif` INTEGER NOT NULL,
    `durasi_satuan` INTEGER NULL,

    UNIQUE INDEX `tran_insentif_id_kategori_key`(`id_kategori`),
    INDEX `tran_insentif_id_satuan_fkey`(`id_satuan`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tmst_satuan_insentif` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `satuan` VARCHAR(50) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tmst_project` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_kategori` INTEGER NOT NULL,
    `nama` VARCHAR(50) NOT NULL,
    `pic` VARCHAR(50) NOT NULL,
    `tanggal_mulai` DATE NOT NULL,
    `tanggal_selesai` DATE NOT NULL,
    `inisial_project` VARCHAR(5) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tran_project` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_project` INTEGER NOT NULL,
    `estimasi` INTEGER NOT NULL,
    `id_peserta` VARCHAR(50) NOT NULL,

    UNIQUE INDEX `tran_project_id_key`(`id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tmst_pengguna` (
    `id` VARCHAR(20) NOT NULL,
    `nama` VARCHAR(225) NOT NULL,
    `username` VARCHAR(20) NOT NULL,
    `departemen` VARCHAR(512) NOT NULL,
    `no_telp` VARCHAR(20) NOT NULL,
    `no_rekening` VARCHAR(30) NOT NULL,
    `status` ENUM('STAF', 'MAHASISWA', 'MANAGER') NOT NULL,

    UNIQUE INDEX `tmst_pengguna_id_key`(`id`),
    UNIQUE INDEX `tmst_pengguna_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tran_posisi_pengguna` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_pengguna` VARCHAR(50) NOT NULL,
    `id_posisi` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tmst_posisi` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `posisi` VARCHAR(512) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tran_timesheet` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_kategori_kegiatan` INTEGER NOT NULL,
    `id_tran_project` INTEGER NOT NULL,
    `tanggal` DATE NOT NULL,
    `jam_mulai` TIME NOT NULL,
    `jam_selesai` TIME NOT NULL,
    `deskripsi` VARCHAR(500) NOT NULL,
    `total_sesi` DOUBLE NOT NULL,

    INDEX `tran_timesheet_id_kategori_kegiatan_fkey`(`id_kategori_kegiatan`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tmst_status_timesheet` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `status` VARCHAR(50) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tmst_status_pembayaran` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `status` VARCHAR(50) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tmst_kategori_kegiatan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kegiatan` VARCHAR(50) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tran_payment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_tran_project` INTEGER NOT NULL,
    `periode` INTEGER NOT NULL,
    `total_tagihan` INTEGER NOT NULL,
    `url_file_sp3` VARCHAR(100) NOT NULL,
    `id_status` INTEGER NOT NULL,

    INDEX `tran_payment_id_status_fkey`(`id_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tran_insentif` ADD CONSTRAINT `tran_insentif_id_kategori_fkey` FOREIGN KEY (`id_kategori`) REFERENCES `tmst_kategori_magang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tran_insentif` ADD CONSTRAINT `tran_insentif_id_satuan_fkey` FOREIGN KEY (`id_satuan`) REFERENCES `tmst_satuan_insentif`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tmst_project` ADD CONSTRAINT `tmst_project_id_kategori_fkey` FOREIGN KEY (`id_kategori`) REFERENCES `tmst_kategori_magang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tmst_project` ADD CONSTRAINT `tmst_project_pic_fkey` FOREIGN KEY (`pic`) REFERENCES `tmst_pengguna`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tran_project` ADD CONSTRAINT `tran_project_id_peserta_fkey` FOREIGN KEY (`id_peserta`) REFERENCES `tmst_pengguna`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tran_project` ADD CONSTRAINT `tran_project_id_project_fkey` FOREIGN KEY (`id_project`) REFERENCES `tmst_project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tmst_pengguna` ADD CONSTRAINT `tmst_pengguna_username_fkey` FOREIGN KEY (`username`) REFERENCES `users`(`username`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tran_posisi_pengguna` ADD CONSTRAINT `tran_posisi_pengguna_id_pengguna_fkey` FOREIGN KEY (`id_pengguna`) REFERENCES `tmst_pengguna`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tran_posisi_pengguna` ADD CONSTRAINT `tran_posisi_pengguna_id_posisi_fkey` FOREIGN KEY (`id_posisi`) REFERENCES `tmst_posisi`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tran_timesheet` ADD CONSTRAINT `tran_timesheet_id_kategori_kegiatan_fkey` FOREIGN KEY (`id_kategori_kegiatan`) REFERENCES `tmst_kategori_kegiatan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tran_timesheet` ADD CONSTRAINT `tran_timesheet_id_tran_project_fkey` FOREIGN KEY (`id_tran_project`) REFERENCES `tran_project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tran_payment` ADD CONSTRAINT `tran_payment_id_status_fkey` FOREIGN KEY (`id_status`) REFERENCES `tmst_status_pembayaran`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tran_payment` ADD CONSTRAINT `tran_payment_id_tran_project_fkey` FOREIGN KEY (`id_tran_project`) REFERENCES `tran_project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
