import { validate } from "../validation/validation.js";
import { approveValidation, rejectValidation } from "../validation/approval-admin-validation.js";
import { prismaClient } from "../application/database.js";
import { ResponseError } from "../error/response-error.js";

// Master Project Status IDs (tmst_status_master_project)
const MASTER_PROJECT_STATUS = { DRAFT: 1, OPEN: 2, WAITING_TIMESHEET_APPROVAL: 3, WAITING_PROJECT_APPROVAL: 4, PROJECT_APPROVED: 5, COMPLETED: 6, NEED_REVISION: 7 };

const approveService = async (projectId) => {
  const id = validate(approveValidation, projectId);

  return prismaClient.$transaction(async (tx) => {
    const project = await tx.tmst_project.findUnique({
      where: { id },
      select: {
        id: true,
        durasi_default: true,
        tmst_kategori_magang: {
          select: {
            tran_insentif: {
              select: {
                besaran_insentif: true,
                durasi_satuan: true,
                id_satuan: true,
                tmst_satuan_insentif: { select: { satuan: true } }
              }
            }
          }
        }
      }
    });

    if (!project) throw new ResponseError(404, "Project tidak ditemukan");

    const rate = Number(project.tmst_kategori_magang?.tran_insentif?.besaran_insentif || 0);
    const defaultDur = Number(project.durasi_default || 0);
    const durasiSatuan = Number(project.tmst_kategori_magang?.tran_insentif?.durasi_satuan || 50);
    const idSatuan = Number(project.tmst_kategori_magang?.tran_insentif?.id_satuan || 1);

    await tx.tmst_project.update({
      where: { id },
      data: { id_status: MASTER_PROJECT_STATUS.PROJECT_APPROVED },
    });

    await tx.job_application.updateMany({
      where: { master_project_id: id, status: "Pending" },
      data: { status: "Rejected" },
    });

    const tranRows = await tx.tran_project.findMany({
      where: { id_project: id },
      select: { id: true, durasi: true, estimasi: true }
    });

    // Identify rows that need updates and calculate their new values
    const rowsToUpdate = [];
    for (const row of tranRows) {
      const d = (Number(row.durasi || 0) > 0) ? Number(row.durasi) : defaultDur;

      // Calculate estimasi based on satuan type
      let e;
      if (Number(row.estimasi || 0) > 0) {
        e = Number(row.estimasi);
      } else {
        if (idSatuan === 2) {
          // Karya: estimasi = rate * durasi
          e = Math.round(rate * d);
        } else {
          // Waktu: convert durasi to sesi then multiply by rate
          const sesi = (d * 60) / Math.max(1, durasiSatuan);
          e = Math.round(rate * sesi);
        }
      }

      if ((Number(row.durasi || 0) !== d) || (Number(row.estimasi || 0) !== e)) {
        rowsToUpdate.push({ id: row.id, durasi: d, estimasi: e });
      }
    }

    // Batch update: group by same (durasi, estimasi) values to minimize queries
    // For most cases, all rows needing update will have same defaults
    if (rowsToUpdate.length > 0) {
      // Group by (durasi, estimasi) combination
      const updateGroups = new Map();
      for (const row of rowsToUpdate) {
        const key = `${row.durasi}_${row.estimasi}`;
        if (!updateGroups.has(key)) {
          updateGroups.set(key, { durasi: row.durasi, estimasi: row.estimasi, ids: [] });
        }
        updateGroups.get(key).ids.push(row.id);
      }

      // Execute batch updates for each group
      for (const [_key, group] of updateGroups) {
        await tx.tran_project.updateMany({
          where: { id: { in: group.ids } },
          data: { durasi: group.durasi, estimasi: group.estimasi }
        });
      }
    }

    return "OK";
  });
};


const rejectService = async (request) => {
  const { projectId, remarkProject } = validate(rejectValidation, request);
  const project = await prismaClient.tmst_project.findUnique({ where: { id: projectId } });
  if (!project) throw new ResponseError(404, "Project tidak ditemukan");

  await prismaClient.tmst_project.update({
    where: { id: projectId },
    data: { id_status: MASTER_PROJECT_STATUS.NEED_REVISION, remark_project: remarkProject },
  });

  return "OK";
};

const approve = async (projectId) => {
  return prismaClient.$transaction(async (tx) => {
    const approvedProject = await tx.tmst_project.update({
      where: { id: projectId },
      data: { id_status: MASTER_PROJECT_STATUS.PROJECT_APPROVED }
    });

    await tx.job_application.updateMany({
      where: {
        master_project_id: projectId,
        status: 'Pending'
      },
      data: {
        status: 'Rejected'
      }
    });

    return approvedProject;
  });
};

export default {
  approveService,
  rejectService,
  approve
};
