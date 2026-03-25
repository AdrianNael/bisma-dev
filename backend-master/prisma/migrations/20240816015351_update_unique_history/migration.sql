/*
  Warnings:

  - A unique constraint covering the columns `[id_payment,id_status]` on the table `payment_status_history` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id_project,id_status]` on the table `project_status_history` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id_timesheet,id_status]` on the table `timesheet_status_history` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `payment_status_history_id_payment_id_status_key` ON `payment_status_history`(`id_payment`, `id_status`);

-- CreateIndex
CREATE UNIQUE INDEX `project_status_history_id_project_id_status_key` ON `project_status_history`(`id_project`, `id_status`);

-- CreateIndex
CREATE UNIQUE INDEX `timesheet_status_history_id_timesheet_id_status_key` ON `timesheet_status_history`(`id_timesheet`, `id_status`);
