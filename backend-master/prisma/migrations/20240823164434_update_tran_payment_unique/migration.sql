/*
  Warnings:

  - A unique constraint covering the columns `[id_tmst_project,id_status,periode]` on the table `tran_payment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `tran_payment_id_tmst_project_id_status_periode_key` ON `tran_payment`(`id_tmst_project`, `id_status`, `periode`);
