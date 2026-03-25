-- CreateTable
CREATE TABLE `tmst_department` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `department` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `tmst_department_department_key`(`department`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tmst_pengguna` ADD CONSTRAINT `tmst_pengguna_departemen_fkey` FOREIGN KEY (`departemen`) REFERENCES `tmst_department`(`department`) ON DELETE RESTRICT ON UPDATE CASCADE;
