-- Add project_group_id column to tmst_project for cross-year project splitting
ALTER TABLE `tmst_project` 
ADD COLUMN `project_group_id` INT NULL AFTER `is_deleted`;

-- Add index for faster grouping queries
CREATE INDEX `tmst_project_project_group_id_idx` ON `tmst_project`(`project_group_id`);
