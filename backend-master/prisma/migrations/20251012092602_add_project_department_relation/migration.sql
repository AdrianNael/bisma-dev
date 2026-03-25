-- CreateTable
CREATE TABLE `tmst_project_department` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `project_id` INTEGER NOT NULL,
    `department_id` INTEGER NOT NULL,

    INDEX `tmst_project_department_department_id_idx`(`department_id`),
    UNIQUE INDEX `tmst_project_department_project_id_department_id_key`(`project_id`, `department_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tmst_project_department` ADD CONSTRAINT `tmst_project_department_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `tmst_project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tmst_project_department` ADD CONSTRAINT `tmst_project_department_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `tmst_department`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
