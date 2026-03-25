-- AlterTable
ALTER TABLE `tmst_department` ADD COLUMN `faculty_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `tmst_faculty` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `faculty` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `tmst_faculty_faculty_key`(`faculty`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tmst_project_faculty` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `project_id` INTEGER NOT NULL,
    `faculty_id` INTEGER NOT NULL,

    INDEX `tmst_project_faculty_faculty_id_idx`(`faculty_id`),
    UNIQUE INDEX `tmst_project_faculty_project_id_faculty_id_key`(`project_id`, `faculty_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `tmst_department_faculty_id_idx` ON `tmst_department`(`faculty_id`);

-- AddForeignKey
ALTER TABLE `tmst_department` ADD CONSTRAINT `tmst_department_faculty_id_fkey` FOREIGN KEY (`faculty_id`) REFERENCES `tmst_faculty`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tmst_project_faculty` ADD CONSTRAINT `tmst_project_faculty_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `tmst_project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tmst_project_faculty` ADD CONSTRAINT `tmst_project_faculty_faculty_id_fkey` FOREIGN KEY (`faculty_id`) REFERENCES `tmst_faculty`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
