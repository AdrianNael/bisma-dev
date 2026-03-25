/*
  Warnings:

  - A unique constraint covering the columns `[id_project,id_peserta]` on the table `tran_project` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `tran_project_id_project_id_peserta_key` ON `tran_project`(`id_project`, `id_peserta`);
