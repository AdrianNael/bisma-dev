-- CreateTable
CREATE TABLE `tmst_status_student_timesheet` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `status` VARCHAR(50) NOT NULL,
    `deskripsi` VARCHAR(255) NULL,

    UNIQUE INDEX `tmst_status_student_timesheet_status_key`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
