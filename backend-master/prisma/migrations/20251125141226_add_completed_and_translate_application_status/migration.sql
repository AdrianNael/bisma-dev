/*
  Warnings:

  - You are about to alter the column `status` on the `job_applications` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(0))` to `Enum(EnumId(2))`.

*/
-- AlterTable
ALTER TABLE `job_applications` MODIFY `status` ENUM('Pending', 'Accepted', 'Rejected') NOT NULL DEFAULT 'Pending';

-- AlterTable
ALTER TABLE `tmst_project` MODIFY `status` ENUM('Draft', 'Open', 'Selection', 'Submitted', 'Approved', 'Completed', 'Rejected') NOT NULL DEFAULT 'Draft';
