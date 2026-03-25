import { prismaClient } from "../application/database.js";
import {
  MONTHLY_CAP,
  listMonthKeysBetween,
  splitEqually,
  addToMap,
  monthKey,
} from "../helpers/month-allocation.js";
import { ResponseError } from "../error/response-error.js";

// Master Project Status IDs (tmst_status_master_project)
const MASTER_PROJECT_STATUS = { DRAFT: 1, OPEN: 2, SELECTION: 3, SUBMITTED: 4, APPROVED: 5, COMPLETED: 6, REJECTED: 7 };

function monthHuman(ym) {
  const [y, m] = ym.split("-").map(Number);
  const N = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  return `${N[m - 1]} ${y}`;
}

const getAvailableJobs = async (mahasiswaId = null) => {
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  // Set end of day for pendaftaran_mulai filter to include jobs created today
  const endOfDay = new Date(currentDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Get mahasiswa department and faculty if ID provided
  let mahasiswaDepartmentId = null;
  let mahasiswaFacultyId = null;
  if (mahasiswaId) {
    const mahasiswa = await prismaClient.tmst_pengguna.findUnique({
      where: { id: mahasiswaId },
      select: {
        departemen: true,
        tmst_department: {
          select: {
            id: true,
            faculty_id: true
          }
        }
      },
    });
    mahasiswaDepartmentId = mahasiswa?.tmst_department?.id ?? null;
    mahasiswaFacultyId = mahasiswa?.tmst_department?.faculty_id ?? null;
  }

  const jobs = await prismaClient.tmst_project.findMany({
    where: {
      id_status: MASTER_PROJECT_STATUS.OPEN,
      is_deleted: false,
      pendaftaran_mulai: { lte: endOfDay },
      pendaftaran_selesai: { gte: currentDate },
    },
    select: {
      id: true,
      nama: true,
      kriteria: true,
      kuota: true,
      pendaftaran_mulai: true,
      pendaftaran_selesai: true,
      tanggal_mulai: true,
      tanggal_selesai: true,
      durasi_default: true,
      project_group_id: true, // For grouping cross-year projects
      tmst_kategori_magang: {
        select: {
          kategori: true,
          tran_insentif: {
            select: {
              besaran_insentif: true,
              durasi_satuan: true,
              tmst_satuan_insentif: { select: { satuan: true } },
            },
          },
        },
      },
      tmst_pengguna: { select: { nama: true, email: true } },
      project_departments: {
        select: {
          department_id: true,
        }
      },
      project_faculties: {
        select: {
          faculty_id: true,
        }
      },
      _count: {
        select: { job_applications: { where: { status: "Accepted" } } },
      },
    },
    orderBy: { id: "desc" },
  });

  let myMap = {};
  if (mahasiswaId) {
    const myApps = await prismaClient.job_application.findMany({
      where: { mahasiswa_id: mahasiswaId },
      select: { master_project_id: true, status: true },
    });
    myApps.forEach((a) => {
      myMap[a.master_project_id] = a.status;
    });
  }

  const jobsWith = jobs
    .map((job) => ({
      ...job,
      sisa_kuota: (job.kuota || 0) - (job._count?.job_applications || 0),
      insentif: job.tmst_kategori_magang.tran_insentif
        ? {
          besaran: job.tmst_kategori_magang.tran_insentif.besaran_insentif,
          satuan:
            job.tmst_kategori_magang.tran_insentif.tmst_satuan_insentif
              .satuan,
        }
        : null,
      my_application_status: myMap[job.id] ?? null,
    }))
    .filter((job) => {
      // Filter out full quota jobs
      if (job.sisa_kuota <= 0) return false;

      const hasDeptRestriction = job.project_departments && job.project_departments.length > 0;
      const hasFacultyRestriction = job.project_faculties && job.project_faculties.length > 0;

      // If project has no restrictions (neither department nor faculty), show to all students
      if (!hasDeptRestriction && !hasFacultyRestriction) {
        return true;
      }

      // Check department restriction
      if (hasDeptRestriction) {
        if (mahasiswaDepartmentId) {
          const deptMatch = job.project_departments.some(
            (pd) => pd.department_id === mahasiswaDepartmentId
          );
          if (deptMatch) return true;
        }
      }

      // Check faculty restriction
      if (hasFacultyRestriction) {
        if (mahasiswaFacultyId) {
          const facultyMatch = job.project_faculties.some(
            (pf) => pf.faculty_id === mahasiswaFacultyId
          );
          if (facultyMatch) return true;
        }
      }

      // If has restrictions but no match, don't show
      return false;
    });

  // Merge grouped projects (cross-year splits) into single view
  const groupedJobs = new Map();
  const ungroupedJobs = [];

  for (const job of jobsWith) {
    if (job.project_group_id) {
      // Part of a group - merge with siblings
      if (!groupedJobs.has(job.project_group_id)) {
        groupedJobs.set(job.project_group_id, {
          ...job,
          // Store all project IDs in the group
          grouped_project_ids: [job.id],
          // Will update dates to show full range
          original_tanggal_mulai: job.tanggal_mulai,
          original_tanggal_selesai: job.tanggal_selesai,
        });
      } else {
        const existing = groupedJobs.get(job.project_group_id);
        existing.grouped_project_ids.push(job.id);

        // Extend date range to include all splits
        if (new Date(job.tanggal_mulai) < new Date(existing.tanggal_mulai)) {
          existing.tanggal_mulai = job.tanggal_mulai;
        }
        if (new Date(job.tanggal_selesai) > new Date(existing.tanggal_selesai)) {
          existing.tanggal_selesai = job.tanggal_selesai;
        }

        // Merge durasi
        existing.durasi_default = (existing.durasi_default || 0) + (job.durasi_default || 0);

        // Use first project's application status (all should be same for grouped)
        if (!existing.my_application_status && job.my_application_status) {
          existing.my_application_status = job.my_application_status;
        }
      }
    } else {
      // Not grouped - add as-is
      ungroupedJobs.push(job);
    }
  }

  // Combine grouped and ungrouped, sort by ID desc
  const mergedJobs = [...groupedJobs.values(), ...ungroupedJobs]
    .sort((a, b) => b.id - a.id);

  return mergedJobs;
};

const getJobDetail = async (jobId, mahasiswaId = null) => {
  const job = await prismaClient.tmst_project.findUnique({
    where: { id: Number(jobId) },
    select: {
      id: true,
      nama: true,
      kriteria: true,
      kuota: true,
      pendaftaran_mulai: true,
      pendaftaran_selesai: true,
      tanggal_mulai: true,
      tanggal_selesai: true,
      remark_project: true,
      durasi_default: true,
      tmst_kategori_magang: {
        select: {
          kategori: true,
          tran_insentif: {
            select: {
              besaran_insentif: true,
              durasi_satuan: true,
              tmst_satuan_insentif: { select: { satuan: true } },
            },
          },
        },
      },
      tmst_pengguna: {
        select: { nama: true, departemen: true, no_telp: true, email: true },
      },
      _count: {
        select: { job_applications: { where: { status: "Accepted" } } },
      },
    },
  });
  if (!job) throw new ResponseError(404, "Lowongan tidak ditemukan");

  let myStatus = null;
  if (mahasiswaId) {
    const mine = await prismaClient.job_application.findFirst({
      where: { master_project_id: Number(jobId), mahasiswa_id: mahasiswaId },
      select: { status: true },
    });
    myStatus = mine?.status ?? null;
  }

  const sisa_kuota = (job.kuota || 0) - (job._count?.job_applications || 0);

  return {
    ...job,
    sisa_kuota,
    my_application_status: myStatus,
    insentif: job.tmst_kategori_magang.tran_insentif
      ? {
        besaran: job.tmst_kategori_magang.tran_insentif.besaran_insentif,
        satuan:
          job.tmst_kategori_magang.tran_insentif.tmst_satuan_insentif.satuan,
        durasi_satuan: job.tmst_kategori_magang.tran_insentif.durasi_satuan,
      }
      : null,
    batasan: {
      max_jam_per_hari: 4,
      max_jam_per_minggu: 10,
      max_jam_per_bulan: 40,
    },
  };
};

const applyJob = async (jobId, mahasiswaId) => {
  const jobIdNum = Number(jobId);
  if (!Number.isInteger(jobIdNum)) {
    throw new ResponseError(400, "Job ID tidak valid");
  }

  // First, check if this job is part of a group
  const jobWithGroup = await prismaClient.tmst_project.findUnique({
    where: { id: jobIdNum },
    select: { project_group_id: true },
  });

  // Get all project IDs to apply to (either just this one, or all in group)
  let projectIdsToApply = [jobIdNum];
  if (jobWithGroup?.project_group_id) {
    const groupProjects = await prismaClient.tmst_project.findMany({
      where: {
        project_group_id: jobWithGroup.project_group_id,
        is_deleted: false,
      },
      select: { id: true },
    });
    projectIdsToApply = groupProjects.map(p => p.id);
  }

  // Check for existing applications for ANY project in the group
  const existingApps = await prismaClient.job_application.findFirst({
    where: {
      master_project_id: { in: projectIdsToApply },
      mahasiswa_id: mahasiswaId
    },
  });
  if (existingApps)
    throw new ResponseError(400, "Anda sudah pernah melamar lowongan ini");

  const job = await prismaClient.tmst_project.findUnique({
    where: { id: jobIdNum },
    select: {
      id_status: true,
      kuota: true,
      pendaftaran_selesai: true,
      tanggal_mulai: true,
      tanggal_selesai: true,
      durasi_default: true,
      project_group_id: true,
      tmst_kategori_magang: {
        select: {
          tran_insentif: {
            select: { tmst_satuan_insentif: { select: { satuan: true } } },
          },
        },
      },
      _count: {
        select: { job_applications: { where: { status: "Accepted" } } },
      },
    },
  });

  if (!job) throw new ResponseError(404, "Lowongan tidak ditemukan");
  if (job.id_status !== MASTER_PROJECT_STATUS.OPEN)
    throw new ResponseError(400, "Lowongan sudah tidak terbuka");
  const now = new Date();
  const end = new Date(job.pendaftaran_selesai);
  end.setHours(23, 59, 59, 999);
  if (now > end) {
    throw new ResponseError(400, "Periode pendaftaran sudah berakhir");
  }

  const sisaKuota = (job.kuota || 0) - (job._count?.job_applications || 0);
  if (sisaKuota <= 0)
    throw new ResponseError(400, "Kuota lowongan sudah penuh");

  // For grouped projects, get full date range
  let effectiveStartDate = job.tanggal_mulai;
  let effectiveEndDate = job.tanggal_selesai;
  let totalDurasiDefault = job.durasi_default || 0;

  if (job.project_group_id) {
    const groupProjects = await prismaClient.tmst_project.findMany({
      where: {
        project_group_id: job.project_group_id,
        is_deleted: false,
      },
      select: { tanggal_mulai: true, tanggal_selesai: true, durasi_default: true },
      orderBy: { tanggal_mulai: 'asc' },
    });

    if (groupProjects.length > 1) {
      effectiveStartDate = groupProjects[0].tanggal_mulai;
      effectiveEndDate = groupProjects[groupProjects.length - 1].tanggal_selesai;
      totalDurasiDefault = groupProjects.reduce((sum, p) => sum + (p.durasi_default || 0), 0);
    }
  }

  const satuan =
    job.tmst_kategori_magang?.tran_insentif?.tmst_satuan_insentif?.satuan || "";
  const isJam = String(satuan).toLowerCase() === "jam";

  if (isJam) {
    const totalPlan = Math.floor(Number(totalDurasiDefault) || 0);
    if (totalPlan <= 0)
      throw new ResponseError(
        400,
        "Durasi per mahasiswa belum diatur oleh staf"
      );

    const usedMap = await getUsedHoursByMonth(mahasiswaId);

    const keys = listMonthKeysBetween(effectiveStartDate, effectiveEndDate);
    const shares = splitEqually(totalPlan, keys.length);

    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const used = Math.floor(usedMap[k] || 0);
      const plan = shares[i];
      if (used + plan > MONTHLY_CAP) {
        throw new ResponseError(
          400,
          `Kuota jam untuk ${monthHuman(k)} tidak mencukupi. ` +
          `Terapakai: ${used} jam, rencana: ${plan} jam, batas: ${MONTHLY_CAP} jam.`
        );
      }
    }
  }

  // Create applications for ALL projects in the group (or just the one)
  const applications = await prismaClient.$transaction(
    projectIdsToApply.map(projectId =>
      prismaClient.job_application.create({
        data: {
          master_project_id: projectId,
          mahasiswa_id: mahasiswaId,
          status: "Pending",
        },
      })
    )
  );

  // Return the first application (primary one)
  return applications[0];
};

const getMyApplications = async (mahasiswaId) => {
  const applications = await prismaClient.job_application.findMany({
    where: { mahasiswa_id: mahasiswaId },
    select: {
      id: true,
      tanggal_lamaran: true,
      status: true,
      project: {
        select: {
          id: true,
          nama: true,
          tanggal_mulai: true,
          tanggal_selesai: true,
          tmst_kategori_magang: { select: { kategori: true } },
          tmst_pengguna: { select: { nama: true } },
        },
      },
    },
    orderBy: { tanggal_lamaran: "desc" },
  });

  return applications;
};

const selectApplicant = async (applicationId, status) => {
  const idNum = Number(applicationId);

  // If not accepting (e.g. Rejected), update this + sibling for crossing year
  if (status !== "Accepted") {
    return prismaClient.$transaction(async (tx) => {
      const app = await tx.job_application.findUnique({
        where: { id: idNum },
        select: {
          mahasiswa_id: true,
          master_project_id: true,
          project: { select: { project_group_id: true } },
        },
      });

      // Update the current application
      const updated = await tx.job_application.update({
        where: { id: idNum },
        data: { status },
      });

      // Auto-reject sibling for crossing year projects
      const groupId = app?.project?.project_group_id;
      if (groupId && app) {
        const siblings = await tx.tmst_project.findMany({
          where: { project_group_id: groupId, is_deleted: false, id: { not: app.master_project_id } },
          select: { id: true },
        });

        for (const sib of siblings) {
          await tx.job_application.updateMany({
            where: {
              master_project_id: sib.id,
              mahasiswa_id: app.mahasiswa_id,
              status: { not: status },
            },
            data: { status },
          });
        }
      }

      return updated;
    });
  }

  // Use transaction to ensure tran_project is created atomically with status update
  return prismaClient.$transaction(async (tx) => {
    // First get application details
    const app = await tx.job_application.findUnique({
      where: { id: idNum },
      select: {
        mahasiswa_id: true,
        master_project_id: true,
        status: true,
        project: {
          select: {
            id: true,
            project_group_id: true, // Check if part of split group
            tanggal_mulai: true,
            tanggal_selesai: true,
            durasi_default: true,
            tmst_kategori_magang: {
              select: {
                tran_insentif: {
                  select: {
                    besaran_insentif: true,
                    durasi_satuan: true,
                    id_satuan: true,
                    tmst_satuan_insentif: { select: { satuan: true } }
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!app) {
      throw new ResponseError(404, "Application tidak ditemukan");
    }

    // Check if already accepted
    if (app.status === "Accepted") {
      throw new ResponseError(400, "Lamaran sudah diterima sebelumnya");
    }

    // Check if tran_project already exists (prevent duplicate)
    const existingTranProject = await tx.tran_project.findFirst({
      where: {
        id_project: app.master_project_id,
        id_peserta: app.mahasiswa_id
      }
    });

    if (existingTranProject) {
      // tran_project already exists, just update status
      return tx.job_application.update({
        where: { id: idNum },
        data: { status: "Accepted" },
      });
    }

    const satuan =
      app.project?.tmst_kategori_magang?.tran_insentif?.tmst_satuan_insentif
        ?.satuan || "";
    const isJam = String(satuan).toLowerCase() === "jam";
    const totalPlan = Math.floor(Number(app.project?.durasi_default) || 0);

    // Check monthly cap for jam-based projects
    if (isJam && totalPlan > 0) {
      const usedMap = await getUsedHoursByMonth(app.mahasiswa_id);
      const keys = listMonthKeysBetween(
        app.project.tanggal_mulai,
        app.project.tanggal_selesai
      );
      const shares = splitEqually(totalPlan, keys.length);

      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const used = Math.floor(usedMap[k] || 0);
        const plan = shares[i];
        if (used + plan > MONTHLY_CAP) {
          throw new ResponseError(
            400,
            `Kuota jam untuk ${monthHuman(
              k
            )} tidak mencukupi. Terpakai: ${used} jam, rencana: ${plan} jam, batas: ${MONTHLY_CAP} jam.`
          );
        }
      }
    }

    // Compute estimasi helper function
    const computeEstimasi = (durasi, rate, durasiSatuan, idSatuan) => {
      if (idSatuan === 2) {
        return Math.round(rate * Number(durasi || 0));
      } else {
        const sesi = (Number(durasi || 0) * 60) / Math.max(1, durasiSatuan);
        return Math.round(rate * sesi);
      }
    };

    const rate = Number(app.project?.tmst_kategori_magang?.tran_insentif?.besaran_insentif || 0);
    const durasiSatuan = Number(app.project?.tmst_kategori_magang?.tran_insentif?.durasi_satuan || 50);
    const idSatuan = Number(app.project?.tmst_kategori_magang?.tran_insentif?.id_satuan || 1);

    const estimasiFinal = computeEstimasi(totalPlan, rate, durasiSatuan, idSatuan);

    // Update status to Accepted
    const updated = await tx.job_application.update({
      where: { id: idNum },
      data: { status: "Accepted" },
    });

    // Check if this project is part of a split group
    const projectGroupId = app.project?.project_group_id;

    if (projectGroupId) {
      // Get ALL projects in this group (both split projects)
      const groupProjects = await tx.tmst_project.findMany({
        where: {
          project_group_id: projectGroupId,
          is_deleted: false,
        },
        select: {
          id: true,
          durasi_default: true,
        },
        orderBy: { tanggal_mulai: 'asc' },
      });

      // Create tran_project AND auto-accept job_application for EACH project in the group
      for (const proj of groupProjects) {
        // Check if tran_project already exists for this project-student combo
        const exists = await tx.tran_project.findFirst({
          where: {
            id_project: proj.id,
            id_peserta: app.mahasiswa_id,
          },
        });

        if (!exists) {
          const projDurasi = Number(proj.durasi_default || 0);
          const projEstimasi = computeEstimasi(projDurasi, rate, durasiSatuan, idSatuan);

          await tx.tran_project.create({
            data: {
              id_project: proj.id,
              id_peserta: app.mahasiswa_id,
              durasi: projDurasi,
              estimasi: projEstimasi,
              id_status: 1,
            },
          });
        }

        // Auto-accept sibling job_application (skip the one we already accepted)
        if (proj.id !== app.master_project_id) {
          const siblingApp = await tx.job_application.findFirst({
            where: {
              master_project_id: proj.id,
              mahasiswa_id: app.mahasiswa_id,
            },
          });

          if (siblingApp && siblingApp.status !== "Accepted") {
            // Update existing sibling application to Accepted
            await tx.job_application.update({
              where: { id: siblingApp.id },
              data: { status: "Accepted" },
            });
          } else if (!siblingApp) {
            // Create a new Accepted application for the sibling project
            await tx.job_application.create({
              data: {
                master_project_id: proj.id,
                mahasiswa_id: app.mahasiswa_id,
                status: "Accepted",
              },
            });
          }
        }
      }
    } else {
      // Normal single project - create single tran_project
      await tx.tran_project.create({
        data: {
          id_project: app.master_project_id,
          id_peserta: app.mahasiswa_id,
          durasi: totalPlan,
          estimasi: estimasiFinal,
          id_status: 1,
        },
      });
    }

    // Handle cleanup for jam-based projects after acceptance
    if (isJam && totalPlan > 0) {
      const keys = listMonthKeysBetween(
        app.project.tanggal_mulai,
        app.project.tanggal_selesai
      );
      const afterMap = await getUsedHoursByMonth(app.mahasiswa_id);
      const fullMonths = keys.filter((k) => (afterMap[k] || 0) >= MONTHLY_CAP);

      if (fullMonths.length) {
        const waiting = await tx.job_application.findMany({
          where: { mahasiswa_id: app.mahasiswa_id, status: "Pending" },
          select: { id: true, project: { select: { tanggal_mulai: true } } },
        });

        const idsToDelete = waiting
          .filter((a) =>
            fullMonths.includes(monthKey(new Date(a.project.tanggal_mulai)))
          )
          .map((a) => a.id);

        if (idsToDelete.length) {
          await tx.job_application.deleteMany({
            where: { id: { in: idsToDelete } },
          });
        }
      }
    }

    // Auto-reject remaining Pending applicants if quota is now full
    const projectForKuota = await tx.tmst_project.findUnique({
      where: { id: app.master_project_id },
      select: { kuota: true },
    });
    const acceptedCount = await tx.job_application.count({
      where: { master_project_id: app.master_project_id, status: "Accepted" },
    });
    if (projectForKuota && acceptedCount >= (projectForKuota.kuota || 0)) {
      // Quota is full - reject all remaining Pending applicants
      let rejectProjectIds = [app.master_project_id];
      if (projectGroupId) {
        const grpIds = await tx.tmst_project.findMany({
          where: { project_group_id: projectGroupId, is_deleted: false },
          select: { id: true },
        });
        rejectProjectIds = grpIds.map((p) => p.id);
      }
      await tx.job_application.updateMany({
        where: {
          master_project_id: { in: rejectProjectIds },
          status: "Pending",
        },
        data: { status: "Rejected" },
      });
    }

    return updated;
  });
};

async function getUsedHoursByMonth(mahasiswaId) {
  const rows = await prismaClient.tran_project.findMany({
    where: { id_peserta: mahasiswaId },
    select: {
      durasi: true,
      tmst_project: {
        select: {
          tanggal_mulai: true,
          tanggal_selesai: true,
          durasi_default: true,
          tmst_kategori_magang: {
            select: {
              tran_insentif: {
                select: {
                  durasi_satuan: true,
                  tmst_satuan_insentif: { select: { satuan: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const map = {};

  for (const r of rows) {
    const satuan =
      r.tmst_project?.tmst_kategori_magang?.tran_insentif?.tmst_satuan_insentif
        ?.satuan || "";
    const durasiSatuan = Number(
      r.tmst_project?.tmst_kategori_magang?.tran_insentif?.durasi_satuan || 50
    );

    let totalJam = 0;
    const satuanLower = String(satuan).toLowerCase();

    if (satuanLower.includes("karya")) {
      continue;
    } else if (satuanLower === "jam") {
      totalJam = Math.floor(
        Number(r.durasi ?? r.tmst_project?.durasi_default ?? 0)
      );
    } else if (satuanLower === "sesi") {
      const totalSesi = Math.floor(
        Number(r.durasi ?? r.tmst_project?.durasi_default ?? 0)
      );
      totalJam = Math.floor((totalSesi * durasiSatuan) / 60);
    } else {
      continue;
    }

    if (!totalJam) continue;

    const start = new Date(r.tmst_project.tanggal_mulai);
    const end = new Date(r.tmst_project.tanggal_selesai);

    const keys = listMonthKeysBetween(start, end);
    const shares = splitEqually(totalJam, keys.length);
    keys.forEach((k, i) => addToMap(map, k, shares[i]));
  }

  return map;
}

export default {
  getAvailableJobs,
  getJobDetail,
  applyJob,
  getMyApplications,
  selectApplicant,
};
