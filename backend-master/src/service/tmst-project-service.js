import { validate } from "../validation/validation.js";
import {
  showAvailableStudentValidation,
  createAndUpdateValidation,
  tmstProjectId,
  listProjectValidation,
  getEditValidation,
  list2ProjectValidation,
} from "../validation/tmst-project-validation.js";
import { prismaClient } from "../application/database.js";
import { ResponseError } from "../error/response-error.js";
import { format } from "date-fns";
import { STATUS } from "../constants/index.js";

//helper funct
/**
 * Capitalize each word in a string
 */
const capitalizeEachWord = (str) =>
  str.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");

/**
 * Generate project initials from name
 */
const generateInitials = (name, existingInitials) => {
  const takeCharacterFirst = (words, length) =>
    words.map((w) => w.charAt(0)).slice(0, length).join("");

  const words = name.trim().split(" ");
  let initialProject = "";

  if (words.length >= 4) initialProject = takeCharacterFirst(words, 4);
  else if (words.length === 3) initialProject = takeCharacterFirst(words, 3);
  else if (words.length === 2) initialProject = takeCharacterFirst(words, 2);
  else initialProject = takeCharacterFirst(words, 1);

  let counter = 1;
  let finalInitial = initialProject;
  while (existingInitials.includes(finalInitial)) {
    finalInitial = initialProject + counter;
    counter++;
  }
  return finalInitial;
};

/**
 * Validate project dates (start/end, registration period)
 */
const validateProjectDates = (project) => {
  if (project.tanggal_mulai && project.tanggal_selesai) {
    if (new Date(project.tanggal_mulai) > new Date(project.tanggal_selesai)) {
      throw new ResponseError(400, "Tanggal mulai proyek tidak boleh lebih besar dari tanggal selesai.");
    }
  }

  if (project.pendaftaran_mulai && project.pendaftaran_selesai) {
    if (new Date(project.pendaftaran_mulai) > new Date(project.pendaftaran_selesai)) {
      throw new ResponseError(400, "Periode pendaftaran tidak valid.");
    }
  }

  if (project.pendaftaran_selesai && project.tanggal_mulai) {
    if (new Date(project.pendaftaran_selesai) >= new Date(project.tanggal_mulai)) {
      throw new ResponseError(400, "Pendaftaran harus ditutup sebelum proyek dimulai.");
    }
  }
};

/**
 * Check if satuan is "karya" type (piece-based vs time-based)
 */
const isKaryaType = (satuanInsentif, idSatuan) => {
  if (idSatuan === 2) return true;
  if (typeof satuanInsentif === "string") {
    return satuanInsentif.toLowerCase().includes("karya");
  }
  return false;
};

/**
 * Calculate total sessions based on type (karya vs waktu)
 */
const calculateTotalSesi = (totalDurasi, durasiSatuan, isKarya) => {
  if (isKarya) return totalDurasi;
  return (totalDurasi * 60) / Math.max(1, durasiSatuan);
};

/**
 * Calculate insentif from rate and sessions
 */
const calculateInsentif = (totalSesi, rate) => Math.round(totalSesi * rate);

/**
 * Extract insentif config from kategori relation
 */
const getInsentifConfig = (kategoriMagang) => {
  const insentif = kategoriMagang?.tran_insentif;
  return {
    rate: Number(insentif?.besaran_insentif) || 0,
    durasiSatuan: Number(insentif?.durasi_satuan || 50),
    idSatuan: insentif?.id_satuan || null,
    satuan: insentif?.tmst_satuan_insentif?.satuan || "",
  };
};

/**
 * Map project members from tran_project or job_applications
 */
const mapProjectMembers = (tranProject = [], jobApplications = []) => {
  let members = tranProject.map((tp) => ({
    id: tp.tmst_pengguna?.id,
    nama: tp.tmst_pengguna?.nama,
    status: tp.tmst_status_project?.status || null,
  }));

  if (members.length === 0 && Array.isArray(jobApplications)) {
    members = jobApplications
      .filter((ja) => ja.mahasiswa?.id || ja.mahasiswa?.nama)
      .map((ja) => ({
        id: ja.mahasiswa?.id,
        nama: ja.mahasiswa?.nama,
        status: "Accepted",
      }));
  }

  return members;
};

/**
 * Aggregate timesheet data for multiple tran_project IDs
 */
const aggregateTimesheetData = async (tranProjectIds) => {
  if (!tranProjectIds?.length) return { timesheets: [], dateRange: null };

  const timesheets = await prismaClient.tran_timesheet.findMany({
    where: { id_tran_project: { in: tranProjectIds } },
    select: { id_tran_project: true, total_sesi: true, tanggal: true },
  });

  const allDates = timesheets.map((ts) => ts.tanggal).filter(Boolean);
  const dateRange = allDates.length > 0
    ? {
      min: new Date(Math.min(...allDates.map((d) => d.getTime()))),
      max: new Date(Math.max(...allDates.map((d) => d.getTime()))),
    }
    : null;

  return { timesheets, dateRange };
};

/**
 * Calculate realized values from timesheets
 */
const calculateRealizedFromTimesheets = (timesheets, isKarya, rate) => {
  let totalDurasi = 0;
  let totalInsentif = 0;

  timesheets.forEach((ts) => {
    const sesiValue = isKarya
      ? (ts.total_sesi && ts.total_sesi > 0 ? ts.total_sesi : 1)
      : Number(ts.total_sesi || 0);

    totalDurasi += sesiValue;
    totalInsentif += sesiValue * rate;
  });

  return { totalDurasi, totalInsentif: Math.round(totalInsentif) };
};

/**
 * Build department/faculty association data for create/update
 */
const buildAssociationData = (departmentIds, facultyIds, isUpdate = false) => {
  const data = {};

  if (isUpdate) {
    // For update: handle mutual exclusivity
    if (departmentIds?.length > 0) {
      data.project_departments = {
        deleteMany: {},
        create: departmentIds.map((id) => ({ department_id: id })),
      };
      data.project_faculties = { deleteMany: {} };
    } else if (facultyIds?.length > 0) {
      data.project_faculties = {
        deleteMany: {},
        create: facultyIds.map((id) => ({ faculty_id: id })),
      };
      data.project_departments = { deleteMany: {} };
    } else if (departmentIds !== undefined || facultyIds !== undefined) {
      data.project_departments = { deleteMany: {} };
      data.project_faculties = { deleteMany: {} };
    }
  } else {
    // For create: simple association
    if (departmentIds?.length > 0) {
      data.project_departments = {
        create: departmentIds.map((id) => ({ department_id: id })),
      };
    }
    if (facultyIds?.length > 0) {
      data.project_faculties = {
        create: facultyIds.map((id) => ({ faculty_id: id })),
      };
    }
  }

  return data;
};

/**
 * Common select fields for project queries
 */
const PROJECT_SELECT_FIELDS = {
  basic: {
    id: true,
    id_kategori: true,
    nama: true,
    inisial_project: true,
    pic: true,
    tanggal_mulai: true,
    tanggal_selesai: true,
    project_departments: {
      select: {
        department_id: true,
        department: { select: { id: true, department: true } },
      },
    },
  },
  list: {
    id: true,
    id_kategori: true,
    nama: true,
    inisial_project: true,
    pic: true,
    tanggal_mulai: true,
    tanggal_selesai: true,
    pendaftaran_selesai: true,
    id_status: true,
    project_group_id: true, // For grouping cross-year projects
    tmst_status_master_project: { select: { status: true } },
    kuota: true,
    durasi_default: true,
    tmst_kategori_magang: {
      select: {
        tran_insentif: {
          select: {
            besaran_insentif: true,
            durasi_satuan: true,
            id_satuan: true,
            tmst_satuan_insentif: { select: { satuan: true } },
          },
        },
      },
    },
    _count: { select: { job_applications: true } },
    tran_project: {
      select: {
        id: true,
        estimasi: true,
        durasi: true,
        tmst_pengguna: { select: { id: true, nama: true } },
        tmst_status_project: { select: { status: true } },
      },
    },
    job_applications: {
      where: { status: "Accepted" },
      select: { mahasiswa: { select: { id: true, nama: true } } },
    },
  },
};

/**
 * Transform raw project row to list item format
 */
const transformProjectToListItem = (p) => {
  const members = mapProjectMembers(p.tran_project, p.job_applications);
  const { rate, durasiSatuan, satuan } = getInsentifConfig(p.tmst_kategori_magang);
  const isKarya = isKaryaType(satuan, null);
  const kuota = Number(p.kuota) || 0;

  const durasiFromTran = (p.tran_project || []).reduce(
    (sum, tp) => sum + (Number(tp.durasi) || 0), 0
  );
  const plannedPerStudent = Number(p.durasi_default) || 0;
  const totalDurasi = durasiFromTran > 0 ? durasiFromTran : plannedPerStudent * kuota;

  const totalSesi = calculateTotalSesi(totalDurasi, durasiSatuan, isKarya);
  const totalIntensifDisplay = calculateInsentif(totalSesi, rate);

  // compute totalEstimasi from tran_project. For karya-type projects we cannot rely on
  // stored "estimasi" value because it may reflect a single default entry; instead we
  // base it on the summed durasi (which is treated as karya count) and the configured rate.
  let totalActual;
  if (isKarya) {
    const totalKarya = (p.tran_project || []).reduce(
      (sum, tp) => sum + (Number(tp.durasi) || 0),
      0
    );
    totalActual = calculateInsentif(totalKarya, rate);
  } else {
    totalActual = (p.tran_project || []).reduce(
      (sum, tp) => sum + (Number(tp.estimasi) || 0),
      0
    );
  }

  return {
    id: p.id,
    nama: p.nama,
    tanggal_mulai: p.tanggal_mulai,
    tanggal_selesai: p.tanggal_selesai,
    pendaftaran_selesai: p.pendaftaran_selesai,
    id_satuan: p.tmst_kategori_magang?.tran_insentif?.id_satuan || null,
    status: p.tmst_status_master_project?.status || MASTER_PROJECT_STATUS_MAP[p.id_status] || "Open",
    applyCount: p._count?.job_applications || 0,
    members,
    totalEstimasi: totalActual,
    totalIntensifDisplay,
    countMember: members.length,
  };
};

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

const validateCategoryExists = async (categoryId) => {
  const count = await prismaClient.tmst_kategori_magang.count({
    where: { id: categoryId },
  });
  if (count === 0) throw new ResponseError(400, "Kategori tidak ditemukan!");
};

const validatePicUser = async (picId) => {
  const user = await prismaClient.tmst_pengguna.findUnique({
    where: { id: picId },
    select: { nama: true },
  });
  if (!user) throw new ResponseError(400, "Pengguna tidak ditemukan!");
  return user;
};

const validateProjectExists = async (projectId, errorMessage = "Project tidak ditemukan") => {
  const count = await prismaClient.tmst_project.count({
    where: { id: projectId, is_deleted: false },
  });
  if (count !== 1) throw new ResponseError(404, errorMessage);
};

const hasActiveApplications = async (projectId) => {
  const count = await prismaClient.job_application.count({
    where: {
      master_project_id: projectId,
      status: { in: ["Pending", "Accepted"] },
    },
  });
  return count > 0;
};

const hasApprovedStudents = async (projectId) => {
  const count = await prismaClient.tran_project.count({
    where: { id_project: projectId },
  });
  return count > 0;
};

const validateCanModifyProject = async (projectId) => {
  if (await hasActiveApplications(projectId)) {
    throw new ResponseError(
      409,
      "Tidak bisa diubah. Masih ada lamaran dengan status Pending/Accepted. Tolak semua lamaran terlebih dahulu."
    );
  }
  if (await hasApprovedStudents(projectId)) {
    throw new ResponseError(
      409,
      "Tidak bisa diubah. Sudah ada mahasiswa yang disetujui pada project ini."
    );
  }
};

// ============================================================================
// MAIN SERVICE FUNCTIONS
// ============================================================================

/**
 * Check if project date range crosses calendar years
 */
const isCrossYear = (startDate, endDate) => {
  if (!startDate || !endDate) return false;
  const start = new Date(startDate);
  const end = new Date(endDate);
  return start.getFullYear() !== end.getFullYear();
};

/**
 * Calculate proportional durasi based on number of months in each split
 */
const calculateProportionalDurasi = (totalDurasi, startDate, endDate, splitStart, splitEnd) => {
  const totalMonths = getMonthsBetween(startDate, endDate);
  const splitMonths = getMonthsBetween(splitStart, splitEnd);
  return Math.round((splitMonths / totalMonths) * totalDurasi);
};

const getMonthsBetween = (start, end) => {
  const s = new Date(start);
  const e = new Date(end);
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
};

const create = async (request) => {
  const project = validate(createAndUpdateValidation, request);

  await validateCategoryExists(project.id_kategori);
  const picUser = await validatePicUser(project.pic);
  validateProjectDates(project);

  // Build project name with PIC
  const baseName = project.nama.toUpperCase();
  project.nama = `${baseName} - ${picUser.nama}`;

  // Generate unique initials
  const existingInitials = await prismaClient.tmst_project.findMany({
    select: { inisial_project: true },
  });
  project.inisial_project = generateInitials(
    project.nama,
    existingInitials.map((e) => e.inisial_project)
  );

  const durasiDefault = Number(project.durasi_per_mahasiswa ?? project.durasi_default) || 0;
  const associationData = buildAssociationData(project.department_ids, project.faculty_ids);

  // Check if cross-year project - split into 2 records
  if (project.tanggal_mulai && project.tanggal_selesai && isCrossYear(project.tanggal_mulai, project.tanggal_selesai)) {
    const startDate = new Date(project.tanggal_mulai);

    // Year 1: startDate -> Dec 31 of startYear (format as ISO string to avoid timezone issues)
    const year1End = `${startDate.getFullYear()}-12-31`;
    // Year 2: Jan 1 of next year -> endDate
    const year2Start = `${startDate.getFullYear() + 1}-01-01`;

    // Calculate proportional durasi for each split
    const durasi1 = calculateProportionalDurasi(durasiDefault, project.tanggal_mulai, project.tanggal_selesai, project.tanggal_mulai, year1End);
    const durasi2 = calculateProportionalDurasi(durasiDefault, project.tanggal_mulai, project.tanggal_selesai, year2Start, project.tanggal_selesai);

    // Generate second initials
    const secondInitial = generateInitials(
      project.nama,
      [...existingInitials.map((e) => e.inisial_project), project.inisial_project]
    );

    console.log('[CROSS-YEAR PROJECT] Creating split projects:', {
      originalStart: project.tanggal_mulai,
      originalEnd: project.tanggal_selesai,
      year1Start: project.tanggal_mulai,
      year1End,
      year2Start,
      year2End: project.tanggal_selesai,
      durasi1,
      durasi2
    });

    // Use transaction to create both projects atomically
    try {
      const [project1, project2] = await prismaClient.$transaction(async (tx) => {
        // Create first project (Year 1)
        const p1 = await tx.tmst_project.create({
          data: {
            id_kategori: project.id_kategori,
            nama: project.nama,
            pic: project.pic,
            tanggal_mulai: new Date(project.tanggal_mulai),
            tanggal_selesai: new Date(year1End),
            created_by: project.created_by,
            kriteria: project.kriteria || null,
            kuota: project.kuota || 0,
            pendaftaran_mulai: project.pendaftaran_mulai ? new Date(project.pendaftaran_mulai) : null,
            pendaftaran_selesai: project.pendaftaran_selesai ? new Date(project.pendaftaran_selesai) : null,
            id_status: project.id_status || STATUS.MASTER_PROJECT.DRAFT,
            inisial_project: project.inisial_project,
            durasi_default: durasi1,
            tempat_magang: project.tempat_magang || null,
            pic_jabatan: project.pic_jabatan || null,
            ...associationData,
          },
        });

        console.log('[CROSS-YEAR] Created project 1:', p1.id);

        // Create second project (Year 2) with reference to first project as group
        const p2 = await tx.tmst_project.create({
          data: {
            id_kategori: project.id_kategori,
            nama: project.nama,
            pic: project.pic,
            tanggal_mulai: new Date(year2Start),
            tanggal_selesai: new Date(project.tanggal_selesai),
            created_by: project.created_by,
            kriteria: project.kriteria || null,
            kuota: project.kuota || 0,
            pendaftaran_mulai: project.pendaftaran_mulai ? new Date(project.pendaftaran_mulai) : null,
            pendaftaran_selesai: project.pendaftaran_selesai ? new Date(project.pendaftaran_selesai) : null,
            id_status: project.id_status || STATUS.MASTER_PROJECT.DRAFT,
            inisial_project: secondInitial,
            durasi_default: durasi2,
            tempat_magang: project.tempat_magang || null,
            pic_jabatan: project.pic_jabatan || null,
            project_group_id: p1.id, // Link to first project
            ...associationData,
          },
        });

        console.log('[CROSS-YEAR] Created project 2:', p2.id);

        // Update first project to have same group_id (self-reference for easier querying)
        await tx.tmst_project.update({
          where: { id: p1.id },
          data: { project_group_id: p1.id },
        });

        console.log('[CROSS-YEAR] Updated project 1 group_id');

        return [p1, p2];
      });

      // Return first project with info about split
      return {
        ...project1,
        project_group_id: project1.id,
        is_split: true,
        split_projects: [project1.id, project2.id],
        original_dates: {
          tanggal_mulai: project.tanggal_mulai,
          tanggal_selesai: project.tanggal_selesai,
        },
      };
    } catch (txError) {
      console.error('[CROSS-YEAR ERROR] Transaction failed:', txError);
      throw new ResponseError(500, `Gagal membuat project crossing year: ${txError.message}`);
    }
  }

  // Normal single project creation
  return prismaClient.tmst_project.create({
    data: {
      id_kategori: project.id_kategori,
      nama: project.nama,
      pic: project.pic,
      tanggal_mulai: project.tanggal_mulai || null,
      tanggal_selesai: project.tanggal_selesai || null,
      created_by: project.created_by,
      kriteria: project.kriteria,
      kuota: project.kuota,
      pendaftaran_mulai: project.pendaftaran_mulai,
      pendaftaran_selesai: project.pendaftaran_selesai,
      id_status: project.id_status || STATUS.MASTER_PROJECT.DRAFT,
      inisial_project: project.inisial_project,
      durasi_default: durasiDefault,
      tempat_magang: project.tempat_magang,
      pic_jabatan: project.pic_jabatan,
      ...associationData,
    },
    select: PROJECT_SELECT_FIELDS.basic,
  });
};

const update = async (request, projectId) => {
  const id = validate(tmstProjectId, Number(projectId));
  const project = validate(createAndUpdateValidation, request);

  await validateProjectExists(id);
  await validateCanModifyProject(id);

  const picUser = await validatePicUser(project.pic);
  validateProjectDates(project);

  // Build project name with PIC (strip existing PIC suffix to avoid duplication)
  let baseName = project.nama;
  const lastDash = baseName.lastIndexOf(" - ");
  if (lastDash > 0) {
    baseName = baseName.substring(0, lastDash);
  }
  project.nama = `${baseName.toUpperCase()} - ${picUser.nama}`;

  const durasiDefault = Number(project.durasi_per_mahasiswa ?? project.durasi_default) || 0;
  const associationData = buildAssociationData(project.department_ids, project.faculty_ids, true);

  return prismaClient.tmst_project.update({
    where: { id },
    data: {
      id_kategori: project.id_kategori,
      nama: project.nama,
      pic: project.pic,
      tanggal_mulai: project.tanggal_mulai || null,
      tanggal_selesai: project.tanggal_selesai || null,
      kriteria: project.kriteria,
      kuota: project.kuota,
      pendaftaran_mulai: project.pendaftaran_mulai,
      pendaftaran_selesai: project.pendaftaran_selesai,
      id_status: project.id_status || STATUS.MASTER_PROJECT.DRAFT,
      durasi_default: durasiDefault,
      tempat_magang: project.tempat_magang,
      pic_jabatan: project.pic_jabatan,
      ...associationData,
    },
    select: PROJECT_SELECT_FIELDS.basic,
  });
};

const remove = async (projectId) => {
  projectId = validate(tmstProjectId, projectId);

  if (await hasActiveApplications(projectId)) {
    throw new ResponseError(
      409,
      "Terdapat pelamar dengan status 'Pending' atau 'Accepted'."
    );
  }

  if (await hasApprovedStudents(projectId)) {
    throw new ResponseError(
      409,
      "Tidak bisa menghapus. Sudah ada mahasiswa yang disetujui pada project ini."
    );
  }

  await validateProjectExists(projectId, "Project tidak ditemukan");

  return prismaClient.tmst_project.update({
    where: { id: projectId },
    data: { is_deleted: true },
  });
};

const list = async (request) => {
  request = validate(list2ProjectValidation, request);
  const skip = (request.page - 1) * request.size;

  // Build filters
  const filters = [];
  if (request.namaProjek) {
    filters.push({ nama: { contains: request.namaProjek } });
  }
  if (request.id_kategori) {
    filters.push({ id_kategori: Number(request.id_kategori) });
  }
  if (request.tanggalMulai) {
    // Support YYYY-MM format (month picker) – use the 1st day of the month
    const startDate = new Date(request.tanggalMulai);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
    filters.push({ tanggal_mulai: { gte: startDate } });
  }
  if (request.tanggalSelesai) {
    // Support YYYY-MM format – use the last day of the month
    const endDate = new Date(request.tanggalSelesai);
    endDate.setMonth(endDate.getMonth() + 1, 0); // last day of the month
    endDate.setHours(23, 59, 59, 999);
    filters.push({ tanggal_selesai: { lte: endDate } });
  }
  // Single-month overlap filter: show projects that overlap with the selected month
  // e.g. project Feb-Apr should appear when filtering by March
  if (request.filterMonth) {
    const [fYear, fMonth] = request.filterMonth.split("-").map(Number);
    const monthStart = new Date(fYear, fMonth - 1, 1, 0, 0, 0, 0);
    const monthEnd = new Date(fYear, fMonth, 0, 23, 59, 59, 999); // last day of month
    // Overlap condition: project starts before month ends AND project ends after month starts
    filters.push({ tanggal_mulai: { lte: monthEnd } });
    filters.push({ tanggal_selesai: { gte: monthStart } });
  }
  if (request.status != null) {
    const s = Number(request.status) || null;
    if (s) filters.push({ id_status: s });
  }
  if (request.status_ne != null) {
    const sNE = Number(request.status_ne) || null;
    if (sNE) filters.push({ NOT: { id_status: sNE } });
  }

  const whereClause = { AND: [...filters, { is_deleted: false }] };

  const [rows, totalItems] = await Promise.all([
    prismaClient.tmst_project.findMany({
      where: whereClause,
      take: request.size,
      skip,
      orderBy: { id: "desc" },
      select: PROJECT_SELECT_FIELDS.list,
    }),
    prismaClient.tmst_project.count({ where: whereClause }),
  ]);

  // Batch fetch all timesheet data to avoid N+1
  const allTranProjectIds = rows.flatMap((p) => (p.tran_project || []).map((tp) => tp.id));
  const allTimesheets = allTranProjectIds.length > 0
    ? await prismaClient.tran_timesheet.findMany({
      where: { id_tran_project: { in: allTranProjectIds } },
      select: { id_tran_project: true, total_sesi: true, tanggal: true },
    })
    : [];

  // Group timesheets by tran_project_id
  const timesheetMap = {};
  allTimesheets.forEach((ts) => {
    if (!timesheetMap[ts.id_tran_project]) timesheetMap[ts.id_tran_project] = [];
    timesheetMap[ts.id_tran_project].push(ts);
  });

  // Batch fetch approved/complete payments
  const projectIds = rows.map((p) => p.id);
  // Build project date ranges to validate payment periodes
  const projRangeMap = {};
  rows.forEach((p) => {
    projRangeMap[p.id] = {
      start: p.tanggal_mulai ? new Date(p.tanggal_mulai) : null,
      end: p.tanggal_selesai ? new Date(p.tanggal_selesai) : null,
    };
  });

  const paymentRows = projectIds.length > 0
    ? await prismaClient.tran_payment.findMany({
      where: {
        id_tmst_project: { in: projectIds },
        id_status: { in: [STATUS.PAYMENT.APPROVED, STATUS.PAYMENT.COMPLETE] },
      },
      select: { id_tmst_project: true, periode: true, id_status: true },
    })
    : [];
  const approvedPeriodesMap = {};
  const completePeriodesMap = {};
  const isPeriodeInRange = (periode, start, end) => {
    if (!periode) return false;
    const [y, m] = periode.split('-').map((v) => Number(v));
    if (!y || !m) return false;
    const perIndex = y * 12 + (m - 1);
    if (start && end) {
      const startIndex = start.getFullYear() * 12 + start.getMonth();
      const endIndex = end.getFullYear() * 12 + end.getMonth();
      return perIndex >= startIndex && perIndex <= endIndex;
    }
    return true;
  };
  paymentRows.forEach((pr) => {
    const pid = pr.id_tmst_project;
    const range = projRangeMap[pid] || {};
    if (!approvedPeriodesMap[pid]) approvedPeriodesMap[pid] = new Set();
    if (pr.periode && isPeriodeInRange(pr.periode, range.start, range.end)) approvedPeriodesMap[pid].add(pr.periode);
    if (pr.id_status === STATUS.PAYMENT.COMPLETE) {
      if (!completePeriodesMap[pid]) completePeriodesMap[pid] = new Set();
      if (pr.periode && isPeriodeInRange(pr.periode, range.start, range.end)) completePeriodesMap[pid].add(pr.periode);
    }
  });

  // Build project list items with periodes and grouped_projects metadata
  const data = rows.map((p) => {
    const members = mapProjectMembers(p.tran_project, p.job_applications);
    const { rate, durasiSatuan, satuan } = getInsentifConfig(p.tmst_kategori_magang);
    const isKarya = isKaryaType(satuan, null);
    const kuota = Number(p.kuota) || 0;
    const tranProjectIds = (p.tran_project || []).map((tp) => tp.id);

    // Get timesheets for this project from pre-fetched data
    const projectTimesheets = tranProjectIds.flatMap((id) => timesheetMap[id] || []);

    // Calculate dates from timesheets if needed
    const tanggal_mulai_project = p.tanggal_mulai;
    const tanggal_selesai_project = p.tanggal_selesai;
    let tanggal_mulai = p.tanggal_mulai;
    let tanggal_selesai = p.tanggal_selesai;

    if ((!tanggal_mulai || !tanggal_selesai) && projectTimesheets.length > 0) {
      const allDates = projectTimesheets.map((ts) => ts.tanggal).filter(Boolean);
      if (allDates.length > 0) {
        tanggal_mulai = tanggal_mulai || new Date(Math.min(...allDates.map((d) => d.getTime())));
        tanggal_selesai = tanggal_selesai || new Date(Math.max(...allDates.map((d) => d.getTime())));
      }
    }

    // Calculate insentif
    const durasiFromTran = (p.tran_project || []).reduce((sum, tp) => sum + (Number(tp.durasi) || 0), 0);
    const plannedPerStudent = Number(p.durasi_default) || 0;
    const totalDurasi = durasiFromTran > 0 ? durasiFromTran : plannedPerStudent * kuota;

    const totalSesi = calculateTotalSesi(totalDurasi, durasiSatuan, isKarya);
    let totalIntensifDisplay = calculateInsentif(totalSesi, rate);

    // Always use actual timesheet data if available, regardless of status
    let realizedDurasi = null;
    let totalAktualTimesheets = 0; // Pure actual from timesheets only
    if (projectTimesheets.length > 0) {
      const { totalDurasi: realized, totalInsentif } = calculateRealizedFromTimesheets(projectTimesheets, isKarya, rate);
      realizedDurasi = realized;
      totalIntensifDisplay = totalInsentif;
      totalAktualTimesheets = totalInsentif; // Store pure timesheet actual

      // Use timesheet dates when timesheets exist
      const allDates = projectTimesheets.map((ts) => ts.tanggal).filter(Boolean);
      if (allDates.length > 0) {
        tanggal_mulai = new Date(Math.min(...allDates.map((d) => d.getTime())));
        tanggal_selesai = new Date(Math.max(...allDates.map((d) => d.getTime())));
      }
    }

    const totalActual = (p.tran_project || []).reduce((sum, tp) => sum + (Number(tp.estimasi) || 0), 0);

    const projTotalMonths = monthsBetweenInclusive(tanggal_mulai_project || tanggal_mulai, tanggal_selesai_project || tanggal_selesai);

    return {
      id: p.id,
      nama: p.nama,
      id_kategori: p.id_kategori,
      tanggal_mulai,
      tanggal_selesai,
      tanggal_mulai_project,
      tanggal_selesai_project,
      pendaftaran_mulai: p.pendaftaran_mulai,
      pendaftaran_selesai: p.pendaftaran_selesai,
      status: p.tmst_status_master_project?.status || null,
      applyCount: p._count?.job_applications || 0,
      members,
      totalEstimasi: totalActual,
      totalIntensifDisplay,
      totalAktualTimesheets, // Pure actual from timesheets
      countMember: members.length,
      realizedDurasi,
      isKarya,
      project_group_id: p.project_group_id,
      // Provide metadata for grouping / frontend usage
      grouped_projects: [
        {
          id: p.id,
          periode: (tanggal_mulai_project || tanggal_mulai)
            ? (new Date(tanggal_mulai_project || tanggal_mulai)).toISOString().slice(0, 7)
            : null,
          tanggal_mulai: tanggal_mulai_project || tanggal_mulai,
          tanggal_selesai: tanggal_selesai_project || tanggal_selesai,
          status: p.tmst_status_master_project?.status || null,
        },
      ],
      // months and approved periodes
      totalMonths: projTotalMonths,
      approvedPeriodes: Array.from(approvedPeriodesMap[p.id] || []),
      approvedMonths: (approvedPeriodesMap[p.id] || new Set()).size,
      completePeriodes: Array.from((completePeriodesMap && completePeriodesMap[p.id]) ? Array.from(completePeriodesMap[p.id]) : []),
      completeMonths: (completePeriodesMap && completePeriodesMap[p.id]) ? (completePeriodesMap[p.id] || new Set()).size : 0,
    };
  });
  // If caller requests no merge, return per-split rows (useful for admin view)
  if (request.merge === false) {
    const singleData = data
      .map((item) => {
        const totalMonths = Number(item.totalMonths || 0);
        const completeMonths = Number(item.completeMonths || 0);
        const statusProgress = (item.status === "Project Approved" && totalMonths > 1)
          ? `Project Approved ${completeMonths}/${totalMonths}`
          : item.status;
        return { ...item, statusProgress };
      })
      .sort((a, b) => b.id - a.id);

    return {
      data: singleData,
      paging: {
        page: request.page,
        total_item: totalItems,
        total_page: Math.ceil(totalItems / request.size),
      },
    };
  }

  // Merge grouped projects (cross-year splits) similar to getMyProject
  const groupedData = new Map();
  const ungroupedData = [];

  for (const project of data) {
    if (project.project_group_id) {
      if (!groupedData.has(project.project_group_id)) {
        groupedData.set(project.project_group_id, {
          ...project,
          grouped_project_ids: [project.id],
          grouped_projects: Array.isArray(project.grouped_projects) ? [...project.grouped_projects] : [],
          _approvedPeriodesSet: new Set(project.approvedPeriodes || []),
          _completePeriodesSet: new Set(project.completePeriodes || []),
        });
      } else {
        const existing = groupedData.get(project.project_group_id);
        existing.grouped_project_ids.push(project.id);
        if (!Array.isArray(existing.grouped_projects)) existing.grouped_projects = [];
        if (Array.isArray(project.grouped_projects)) {
          project.grouped_projects.forEach((g) => existing.grouped_projects.push(g));
        }

        // Extend date range
        if (new Date(project.tanggal_mulai) < new Date(existing.tanggal_mulai)) {
          existing.tanggal_mulai = project.tanggal_mulai;
        }
        if (new Date(project.tanggal_selesai) > new Date(existing.tanggal_selesai)) {
          existing.tanggal_selesai = project.tanggal_selesai;
        }

        if (project.tanggal_mulai_project && (!existing.tanggal_mulai_project || new Date(project.tanggal_mulai_project) < new Date(existing.tanggal_mulai_project))) {
          existing.tanggal_mulai_project = project.tanggal_mulai_project;
        }
        if (project.tanggal_selesai_project && (!existing.tanggal_selesai_project || new Date(project.tanggal_selesai_project) > new Date(existing.tanggal_selesai_project))) {
          existing.tanggal_selesai_project = project.tanggal_selesai_project;
        }

        // Aggregate totals
        existing.totalEstimasi = (existing.totalEstimasi || 0) + (project.totalEstimasi || 0);
        existing.totalIntensifDisplay = (existing.totalIntensifDisplay || 0) + (project.totalIntensifDisplay || 0);
        existing.totalAktualTimesheets = (existing.totalAktualTimesheets || 0) + (project.totalAktualTimesheets || 0);
        existing.applyCount = Math.max(existing.applyCount || 0, project.applyCount || 0);

        // Aggregate approved periodes sets
        if (!existing._approvedPeriodesSet) existing._approvedPeriodesSet = new Set();
        (project.approvedPeriodes || []).forEach((pr) => existing._approvedPeriodesSet.add(pr));
        existing.approvedPeriodes = Array.from(existing._approvedPeriodesSet);
        existing.approvedMonths = existing._approvedPeriodesSet.size;

        // Aggregate COMPLETE periodes sets
        if (!existing._completePeriodesSet) existing._completePeriodesSet = new Set();
        (project.completePeriodes || []).forEach((pr) => existing._completePeriodesSet.add(pr));
        existing.completePeriodes = Array.from(existing._completePeriodesSet);
        existing.completeMonths = existing._completePeriodesSet.size;

        // Recompute totalMonths from combined original/project dates
        const startForTotal = existing.tanggal_mulai_project || existing.tanggal_mulai;
        const endForTotal = existing.tanggal_selesai_project || existing.tanggal_selesai;
        existing.totalMonths = monthsBetweenInclusive(startForTotal, endForTotal);

        // Merge members (dedupe by id)
        const existingMemberIds = new Set(existing.members.map((m) => m.id));
        project.members.forEach((m) => {
          if (!existingMemberIds.has(m.id)) {
            existing.members.push(m);
          }
        });
        existing.countMember = existing.members.length;

        // Combined status logic — prioritize active statuses
        const allStatuses = [...(existing._all_statuses || [existing.status]), project.status];
        existing._all_statuses = allStatuses;

        if (allStatuses.includes("Waiting Timesheet Approval")) {
          existing.status = "Waiting Timesheet Approval";
        } else if (allStatuses.includes("Need Revision")) {
          existing.status = "Need Revision";
        } else if (allStatuses.every((s) => s === "Completed")) {
          existing.status = "Completed";
        } else if (allStatuses.some((s) => s === "Completed" || s === "Project Approved")) {
          existing.status = "Project Approved";
        }
      }
    } else {
      ungroupedData.push(project);
    }
  }

  const mergedData = [...groupedData.values(), ...ungroupedData]
    .sort((a, b) => b.id - a.id)
    .map(({ _all_statuses, _approvedPeriodesSet, _completePeriodesSet, ...rest }) => {
      const totalMonths = Number(rest.totalMonths || 0);
      const approvedMonths = Number(rest.approvedMonths || 0);
      const completeMonths = Number(rest.completeMonths || 0);
      // Display progress using completed (COMPLETE) months as numerator — admin approval marks COMPLETE
      const statusProgress = (rest.status === "Project Approved" && totalMonths > 1)
        ? `Project Approved ${completeMonths}/${totalMonths}` + (completeMonths > 0 ? ` (complete: ${completeMonths})` : "")
        : rest.status;
      return { ...rest, statusProgress };
    });

  return {
    data: mergedData,
    paging: {
      page: request.page,
      total_item: totalItems,
      total_page: Math.ceil(totalItems / request.size),
    },
  };
};

const select = async (request, options = {}) => {
  const { merge = true } = options;
  const projectId = validate(tmstProjectId, request);
  await validateProjectExists(projectId, "ID Project tidak ditemukan!");

  const selectFields = {
    id: true,
    inisial_project: true,
    remark_project: true,
    durasi_default: true,
    id_status: true,
    project_group_id: true,
    tmst_status_master_project: { select: { status: true } },
    kriteria: true,
    kuota: true,
    pendaftaran_mulai: true,
    pendaftaran_selesai: true,
    tempat_magang: true,
    pic_jabatan: true,
    tmst_kategori_magang: {
      select: {
        kategori: true,
        id: true,
        tran_insentif: {
          select: { besaran_insentif: true, durasi_satuan: true, id_satuan: true },
        },
      },
    },
    tmst_pengguna: { select: { nama: true, id: true } },
    nama: true,
    tanggal_mulai: true,
    tanggal_selesai: true,
    tran_project: {
      select: {
        id: true,
        estimasi: true,
        durasi: true,
        tmst_pengguna: { select: { id: true, nama: true } },
      },
      orderBy: { id: "desc" },
    },
    project_departments: {
      select: {
        department_id: true,
        department: { select: { id: true, department: true } },
      },
    },
    project_faculties: {
      select: {
        faculty_id: true,
        faculty: { select: { id: true, faculty: true } },
      },
    },
  };

  const row = await prismaClient.tmst_project.findFirst({
    where: { id: projectId, is_deleted: false },
    select: selectFields,
  });

  if (!row) throw new ResponseError(404, "Id tidak ditemukan!");

  // If this project is part of a cross-year group, find sibling(s) and merge
  let siblings = [];
  if (row.project_group_id && merge) {
    siblings = await prismaClient.tmst_project.findMany({
      where: {
        project_group_id: row.project_group_id,
        id: { not: row.id },
        is_deleted: false,
      },
      select: selectFields,
    });

    for (const sibling of siblings) {
      // Combine durasi_default
      row.durasi_default = (Number(row.durasi_default) || 0) + (Number(sibling.durasi_default) || 0);

      // Extend date range: use earliest start, latest end
      if (sibling.tanggal_mulai && (!row.tanggal_mulai || new Date(sibling.tanggal_mulai) < new Date(row.tanggal_mulai))) {
        row.tanggal_mulai = sibling.tanggal_mulai;
      }
      if (sibling.tanggal_selesai && (!row.tanggal_selesai || new Date(sibling.tanggal_selesai) > new Date(row.tanggal_selesai))) {
        row.tanggal_selesai = sibling.tanggal_selesai;
      }

      // Merge members (deduplicate by student id)
      if (sibling.tran_project && sibling.tran_project.length > 0) {
        // Ensure main project items have related_ids initialized
        row.tran_project.forEach(t => {
          if (!t.related_ids) t.related_ids = [t.id];
        });

        const existingIds = new Set(row.tran_project.map((tp) => tp.tmst_pengguna.id));
        for (const tp of sibling.tran_project) {
          if (!existingIds.has(tp.tmst_pengguna.id)) {
            tp.related_ids = [tp.id]; // Init for new member
            row.tran_project.push(tp);
            existingIds.add(tp.tmst_pengguna.id);
          } else {
            // Same student in both splits: combine durasi
            const existing = row.tran_project.find((t) => t.tmst_pengguna.id === tp.tmst_pengguna.id);
            if (existing) {
              existing.durasi = (Number(existing.durasi) || 0) + (Number(tp.durasi) || 0);
              // Add sibling's tran_project ID to related_ids
              if (!existing.related_ids) existing.related_ids = [existing.id];
              existing.related_ids.push(tp.id);
            }
          }
        }
      }
    }
  }

  // Extract config
  const { rate: ratePerSesi, durasiSatuan: sesiMenit, idSatuan } = getInsentifConfig(row.tmst_kategori_magang);
  const isKarya = isKaryaType(null, idSatuan);
  const totalJam = Number(row.durasi_default || 0);
  const kuota = Number(row.kuota || 0);
  const jumlahMhs = row.tran_project.length;

  // Calculate PLANNED estimation: durasi_default × kuota × besaran_insentif
  // This stays constant regardless of actual timesheet data
  let totalEstimasiPlanned;
  if (isKarya) {
    // For karya: kuota represents total karya expected
    totalEstimasiPlanned = calculateInsentif(kuota, ratePerSesi);
  } else {
    // For time-based: durasi_default (jam) × kuota (mahasiswa) → convert to sesi × rate
    const sesiPerMhs = calculateTotalSesi(totalJam, sesiMenit, false);
    totalEstimasiPlanned = calculateInsentif(sesiPerMhs * kuota, ratePerSesi);
  }

  // Calculate base estimation from actual members (for backward compatibility)
  let totalEstimasiBaru;
  if (isKarya) {
    const totalKarya = row.tran_project.reduce((sum, tp) => sum + Number(tp.durasi || 0), 0);
    totalEstimasiBaru = calculateInsentif(totalKarya, ratePerSesi);
  } else {
    const sesiPerMhs = calculateTotalSesi(totalJam, sesiMenit, false);
    totalEstimasiBaru = calculateInsentif(sesiPerMhs * jumlahMhs, ratePerSesi);
  }

  // Extract member data
  const anggota = [], id_anggota = [], estimasi = [], durasi = [], id_tran_project = [];
  row.tran_project.forEach((tp) => {
    id_tran_project.push(tp.id);
    anggota.push(tp.tmst_pengguna.nama);
    id_anggota.push(tp.tmst_pengguna.id);
    estimasi.push(tp.estimasi);
    durasi.push(tp.durasi);
  });

  // Build result object
  const result = {
    ...row,
    kategori: row.tmst_kategori_magang.kategori,
    kategoriId: row.tmst_kategori_magang.id,
    pic: row.tmst_pengguna.nama,
    picId: row.tmst_pengguna.id,
    isKarya,
    anggota,
    id_anggota,
    estimasi,
    countMember: anggota.length,
    id_tran_project,
    status: row.tmst_status_master_project?.status || null,
    id_satuan: idSatuan,
    insentif: {
      durasi_satuan: sesiMenit,
      besaran_insentif: ratePerSesi,
    },
  };

  // Provide grouped_projects metadata (include this project + any siblings)
  try {
    const groupSources = [row].concat(Array.isArray(siblings) ? siblings : []);
    result.grouped_projects = groupSources.map((p) => ({
      id: p.id,
      periode: p.tanggal_mulai ? (new Date(p.tanggal_mulai)).toISOString().slice(0, 7) : null,
      tanggal_mulai: p.tanggal_mulai || null,
      tanggal_selesai: p.tanggal_selesai || null,
      status: p.tmst_status_master_project?.status || null,
      id_tran_project: Array.isArray(p.tran_project) ? p.tran_project.map(tp => tp.id) : [],
      durasi_default: p.durasi_default || null,
    }));
  } catch (e) {
    // non-fatal: grouping metadata is auxiliary
    console.warn('Failed to build grouped_projects metadata', e && e.stack ? e.stack : e);
    result.grouped_projects = [];
  }

  // Preserve original project dates before timesheet override
  result.tanggal_mulai_project = row.tanggal_mulai
    ? format(row.tanggal_mulai, "dd/MM/yyyy")
    : null;
  result.tanggal_selesai_project = row.tanggal_selesai
    ? format(row.tanggal_selesai, "dd/MM/yyyy")
    : null;

  // Always try to fetch timesheet data if tran_project exists
  // This ensures we use actual data whenever available, regardless of project status
  // Aggregate ALL tran_project IDs including siblings
  const allTranIds = [];
  row.tran_project.forEach(tp => {
    const rIds = tp.related_ids || [tp.id];
    allTranIds.push(...rIds);
  });

  if (allTranIds.length > 0) {
    const { timesheets, dateRange } = await aggregateTimesheetData(allTranIds);

    if (timesheets.length > 0) {
      // Group by tran_project and calculate per-member
      const byTranProject = {};
      timesheets.forEach((ts) => {
        if (!byTranProject[ts.id_tran_project]) byTranProject[ts.id_tran_project] = [];
        byTranProject[ts.id_tran_project].push(ts);
      });

      const realizedDurasi = [];
      const realizedSesi = [];
      const realizedInsentif = [];
      let totalRealizedInsentif = 0;

      row.tran_project.forEach((tp) => {
        // Collect timesheets for this member across all split projects
        const memberIds = tp.related_ids || [tp.id];
        const tpTimesheets = memberIds.flatMap(mid => byTranProject[mid] || []);

        const { totalDurasi, totalInsentif } = calculateRealizedFromTimesheets(tpTimesheets, isKarya, ratePerSesi);

        // totalDurasi is total_sesi. For non-karya, convert sesi to hours for display consistency
        // Formula: jam = (sesi * sesiMenit) / 60
        const displayDurasi = isKarya ? totalDurasi : (totalDurasi * sesiMenit) / 60;
        realizedDurasi.push(parseFloat(displayDurasi.toFixed(2)));
        realizedSesi.push(parseFloat(Number(totalDurasi || 0).toFixed(2)));
        realizedInsentif.push(totalInsentif);
        totalRealizedInsentif += totalInsentif;
      });

      result.durasi = realizedDurasi;
      result.sesi_aktual = realizedSesi;
      result.insentif_aktual = realizedInsentif;

      // ── Monthly Breakdown ──────────────────────────────────────────────
      // Group timesheets by month (YYYY-MM) for multi-month projects
      // Calculate per-student durasi, sesi, and insentif for each month
      const monthlyData = {}; // { "2026-02": { timesheets: [...], students: {...} } }

      timesheets.forEach((ts) => {
        if (!ts.tanggal) return;
        const periode = new Date(ts.tanggal).toISOString().slice(0, 7); // "YYYY-MM"

        if (!monthlyData[periode]) {
          monthlyData[periode] = { timesheets: [], studentMap: {} };
        }
        monthlyData[periode].timesheets.push(ts);
      });

      // Calculate per-student totals for each month
      const monthly_breakdown = [];
      const sortedPeriodes = Object.keys(monthlyData).sort(); // chronological order

      sortedPeriodes.forEach((periode) => {
        const monthTimesheets = monthlyData[periode].timesheets;

        // Group month's timesheets by tran_project
        const byTranProjectMonth = {};
        monthTimesheets.forEach((ts) => {
          if (!byTranProjectMonth[ts.id_tran_project]) byTranProjectMonth[ts.id_tran_project] = [];
          byTranProjectMonth[ts.id_tran_project].push(ts);
        });

        const monthDurasi = [];
        const monthSesi = [];
        const monthInsentif = [];
        let monthTotal = 0;

        // Calculate for each student in the same order as overall results
        row.tran_project.forEach((tp) => {
          const memberIds = tp.related_ids || [tp.id];
          const tpMonthTimesheets = memberIds.flatMap(mid => byTranProjectMonth[mid] || []);

          const { totalDurasi, totalInsentif } = calculateRealizedFromTimesheets(tpMonthTimesheets, isKarya, ratePerSesi);

          const displayDurasi = isKarya ? totalDurasi : (totalDurasi * sesiMenit) / 60;
          monthDurasi.push(parseFloat(displayDurasi.toFixed(2)));
          monthSesi.push(parseFloat(Number(totalDurasi || 0).toFixed(2)));
          monthInsentif.push(totalInsentif);
          monthTotal += totalInsentif;
        });

        monthly_breakdown.push({
          periode, // "2026-02"
          durasi: monthDurasi,
          sesi_aktual: monthSesi,
          insentif_aktual: monthInsentif,
          total: monthTotal,
        });
      });

      result.monthly_breakdown = monthly_breakdown;
      // totalAktual will be resolved below from payment or timesheet

      // Update result date range based on actual timesheets
      if (dateRange) {
        result.tanggal_mulai = format(dateRange.min, "dd/MM/yyyy");
        result.tanggal_selesai = format(dateRange.max, "dd/MM/yyyy");
      }
    }
  }

  // ── Resolve totalAktual ──────────────────────────────────────────────
  // Priority:
  //   1. tran_payment.total_tagihan (if exists and > 0)
  //   2. sum(tran_timesheet.total_sesi) × besaran_insentif
  // Also: when payment status is APPROVED or COMPLETE, set totalEstimasi
  //       to totalIntensifDisplay (same value as project table list).
  try {
    const allPayments = await prismaClient.tran_payment.findMany({
      where: { id_tmst_project: row.id },
      select: { id: true, total_tagihan: true, id_status: true },
    });

    const approvedOrComplete = allPayments.filter(
      (p) => p.id_status === STATUS.PAYMENT.APPROVED || p.id_status === STATUS.PAYMENT.COMPLETE
    );
    const paymentTotal = approvedOrComplete.reduce(
      (sum, p) => sum + (Number(p.total_tagihan) || 0), 0
    );

    if (paymentTotal > 0) {
      // Use payment total_tagihan as totalAktual
      result.totalAktual = paymentTotal;
    } else {
      // Fallback: sum(total_sesi) × besaran_insentif
      const timesheetRows = id_tran_project.length > 0
        ? await prismaClient.tran_timesheet.findMany({
          where: { id_tran_project: { in: id_tran_project } },
          select: { total_sesi: true },
        })
        : [];
      const totalSesiSum = timesheetRows.reduce(
        (sum, ts) => sum + (Number(ts.total_sesi) || 0), 0
      );
      result.totalAktual = Math.round(totalSesiSum * ratePerSesi);
    }

    // When payment is approved/complete, also set totalEstimasi to the
    // same totalIntensifDisplay value used in the project table list.
    if (approvedOrComplete.length > 0) {
      const durasiFromTranForCalc = (row.tran_project || []).reduce(
        (sum, tp) => sum + (Number(tp.durasi) || 0), 0
      );
      const plannedPerStudentForCalc = Number(row.durasi_default) || 0;
      const totalDurasiForCalc = durasiFromTranForCalc > 0
        ? durasiFromTranForCalc
        : plannedPerStudentForCalc * kuota;
      const totalSesiForCalc = calculateTotalSesi(totalDurasiForCalc, sesiMenit, isKarya);
      const totalIntensifDisplayForCalc = calculateInsentif(totalSesiForCalc, ratePerSesi);
      result.totalEstimasi = totalIntensifDisplayForCalc;
    }
  } catch (e) {
    console.error('select(): payment/totalAktual lookup failed', e && e.stack ? e.stack : e);
  }

  // Format dates if not already formatted
  if (result.tanggal_mulai && typeof result.tanggal_mulai !== "string") {
    result.tanggal_mulai = format(result.tanggal_mulai, "dd/MM/yyyy");
  }
  if (result.tanggal_selesai && typeof result.tanggal_selesai !== "string") {
    result.tanggal_selesai = format(result.tanggal_selesai, "dd/MM/yyyy");
  }
  if (result.pendaftaran_mulai) {
    result.pendaftaran_mulai = format(result.pendaftaran_mulai, "dd/MM/yyyy");
  }
  if (result.pendaftaran_selesai) {
    result.pendaftaran_selesai = format(result.pendaftaran_selesai, "dd/MM/yyyy");
  }

  if (!result.durasi) result.durasi = durasi;
  // totalEstimasi stored in the row can be stale (especially with karya
  // projects where only the initial durasi may have been written).  Prefer
  // the recalculated value when we have member data.
  if (isKarya) {
    // use the "baru" value derived from current tran_project entries
    result.totalEstimasi = totalEstimasiBaru;
  } else {
    if (!result.totalEstimasi) result.totalEstimasi = totalEstimasiPlanned; // default to planned
  }
  // Fallback: only set totalAktual if not already resolved from timesheet/payment above
  if (result.totalAktual === undefined || result.totalAktual === null) {
    result.totalAktual = totalEstimasiBaru; // Fallback: based on current members
  }

  // Cleanup
  delete result.tran_project;
  delete result.tmst_kategori_magang;
  delete result.tmst_pengguna;
  delete result.tmst_status_master_project;

  return result;
};

const getMyProject = async (request) => {
  request = validate(listProjectValidation, request);
  const skip = (request.page - 1) * request.size;

  const filters = [];
  if (request.namaProjek) {
    filters.push({ nama: { contains: request.namaProjek } });
  }

  const whereClause = { AND: [...filters, { created_by: request.userId }, { is_deleted: false }] };

  const [rows, totalItems] = await Promise.all([
    prismaClient.tmst_project.findMany({
      where: whereClause,
      take: request.size,
      skip,
      orderBy: { id: "desc" },
      select: {
        ...PROJECT_SELECT_FIELDS.list,
        pendaftaran_mulai: true,
      },
    }),
    prismaClient.tmst_project.count({ where: whereClause }),
  ]);

  // Batch fetch all timesheet data to avoid N+1
  const allTranProjectIds = rows.flatMap((p) => (p.tran_project || []).map((tp) => tp.id));
  const allTimesheets = allTranProjectIds.length > 0
    ? await prismaClient.tran_timesheet.findMany({
      where: { id_tran_project: { in: allTranProjectIds } },
      select: { id_tran_project: true, total_sesi: true, tanggal: true },
    })
    : [];

  // Group timesheets by tran_project_id
  const timesheetMap = {};
  allTimesheets.forEach((ts) => {
    if (!timesheetMap[ts.id_tran_project]) timesheetMap[ts.id_tran_project] = [];
    timesheetMap[ts.id_tran_project].push(ts);
  });

  // Batch fetch approved payments
  const projectIds = rows.map((p) => p.id);
  // Build project date ranges to validate payment periodes
  const projRangeMap = {};
  rows.forEach((p) => {
    projRangeMap[p.id] = {
      start: p.tanggal_mulai ? new Date(p.tanggal_mulai) : null,
      end: p.tanggal_selesai ? new Date(p.tanggal_selesai) : null,
    };
  });

  const paymentRows = await prismaClient.tran_payment.findMany({
    where: {
      id_tmst_project: { in: projectIds },
      id_status: { in: [STATUS.PAYMENT.APPROVED, STATUS.PAYMENT.COMPLETE] },
    },
    select: { id_tmst_project: true, periode: true, id_status: true },
  });
  const approvedPeriodesMap = {};
  const completePeriodesMap = {};
  const isPeriodeInRange = (periode, start, end) => {
    if (!periode) return false;
    const [y, m] = periode.split('-').map((v) => Number(v));
    if (!y || !m) return false;
    const perIndex = y * 12 + (m - 1);
    if (start && end) {
      const startIndex = start.getFullYear() * 12 + start.getMonth();
      const endIndex = end.getFullYear() * 12 + end.getMonth();
      return perIndex >= startIndex && perIndex <= endIndex;
    }
    return true;
  };
  paymentRows.forEach((pr) => {
    const pid = pr.id_tmst_project;
    const range = projRangeMap[pid] || {};
    if (!approvedPeriodesMap[pid]) approvedPeriodesMap[pid] = new Set();
    if (pr.periode && isPeriodeInRange(pr.periode, range.start, range.end)) approvedPeriodesMap[pid].add(pr.periode);
    if (pr.id_status === STATUS.PAYMENT.COMPLETE) {
      if (!completePeriodesMap[pid]) completePeriodesMap[pid] = new Set();
      if (pr.periode && isPeriodeInRange(pr.periode, range.start, range.end)) completePeriodesMap[pid].add(pr.periode);
    }
  });

  // Batch fetch projects with all timesheets approved (by checking tran_timesheet status)
  const projectsWithApprovedTimesheets = new Set();
  for (const projectId of projectIds) {
    const tranProjects = rows.find(p => p.id === projectId)?.tran_project || [];
    const tranProjectIds = tranProjects.map(tp => tp.id);

    if (tranProjectIds.length > 0) {
      const timesheets = await prismaClient.tran_timesheet.findMany({
        where: { id_tran_project: { in: tranProjectIds } },
        select: { id_status: true },
      });

      // Check if all timesheets are approved (id_status = 1)
      if (timesheets.length > 0 && timesheets.every(ts => ts.id_status === STATUS.TIMESHEET.APPROVED)) {
        projectsWithApprovedTimesheets.add(projectId);
      }
    }
  }

  const data = rows.map((p) => {
    const members = mapProjectMembers(p.tran_project, p.job_applications);
    const { rate, durasiSatuan, satuan } = getInsentifConfig(p.tmst_kategori_magang);
    const isKarya = isKaryaType(satuan, null);
    const kuota = Number(p.kuota) || 0;
    const tranProjectIds = (p.tran_project || []).map((tp) => tp.id);

    // Get timesheets for this project from pre-fetched data
    const projectTimesheets = tranProjectIds.flatMap((id) => timesheetMap[id] || []);

    // Calculate dates from timesheets if needed
    const tanggal_mulai_project = p.tanggal_mulai;
    const tanggal_selesai_project = p.tanggal_selesai;
    let tanggal_mulai = p.tanggal_mulai;
    let tanggal_selesai = p.tanggal_selesai;

    if ((!tanggal_mulai || !tanggal_selesai) && projectTimesheets.length > 0) {
      const allDates = projectTimesheets.map((ts) => ts.tanggal).filter(Boolean);
      if (allDates.length > 0) {
        tanggal_mulai = tanggal_mulai || new Date(Math.min(...allDates.map((d) => d.getTime())));
        tanggal_selesai = tanggal_selesai || new Date(Math.max(...allDates.map((d) => d.getTime())));
      }
    }

    // Calculate insentif
    const durasiFromTran = (p.tran_project || []).reduce((sum, tp) => sum + (Number(tp.durasi) || 0), 0);
    const plannedPerStudent = Number(p.durasi_default) || 0;
    const totalDurasi = durasiFromTran > 0 ? durasiFromTran : plannedPerStudent * kuota;

    const totalSesi = calculateTotalSesi(totalDurasi, durasiSatuan, isKarya);
    let totalIntensifDisplay = calculateInsentif(totalSesi, rate);

    // Always use actual timesheet data if available, regardless of status
    let realizedDurasi = null;
    let totalAktualTimesheets = 0; // Pure actual from timesheets only
    if (projectTimesheets.length > 0) {
      const { totalDurasi: realized, totalInsentif } = calculateRealizedFromTimesheets(projectTimesheets, isKarya, rate);
      realizedDurasi = realized;
      totalIntensifDisplay = totalInsentif;
      totalAktualTimesheets = totalInsentif; // Store pure timesheet actual

      // Use timesheet dates when timesheets exist
      const allDates = projectTimesheets.map((ts) => ts.tanggal).filter(Boolean);
      if (allDates.length > 0) {
        tanggal_mulai = new Date(Math.min(...allDates.map((d) => d.getTime())));
        tanggal_selesai = new Date(Math.max(...allDates.map((d) => d.getTime())));
      }
    }

    const totalActual = (p.tran_project || []).reduce((sum, tp) => sum + (Number(tp.estimasi) || 0), 0);

    const projTotalMonths = monthsBetweenInclusive(tanggal_mulai_project || tanggal_mulai, tanggal_selesai_project || tanggal_selesai);

    return {
      id: p.id,
      nama: p.nama,
      id_kategori: p.id_kategori,
      tanggal_mulai,
      tanggal_selesai,
      tanggal_mulai_project,
      tanggal_selesai_project,
      pendaftaran_mulai: p.pendaftaran_mulai,
      pendaftaran_selesai: p.pendaftaran_selesai,
      status: p.tmst_status_master_project?.status || null,
      applyCount: p._count?.job_applications || 0,
      members,
      totalEstimasi: totalActual,
      totalIntensifDisplay,
      totalAktualTimesheets, // Pure actual from timesheets
      countMember: members.length,
      realizedDurasi,
      isKarya,
      project_group_id: p.project_group_id,
      // Provide metadata for grouping / frontend usage
      grouped_projects: [
        {
          id: p.id,
          periode: (tanggal_mulai_project || tanggal_mulai)
            ? (new Date(tanggal_mulai_project || tanggal_mulai)).toISOString().slice(0, 7)
            : null,
          tanggal_mulai: tanggal_mulai_project || tanggal_mulai,
          tanggal_selesai: tanggal_selesai_project || tanggal_selesai,
          status: p.tmst_status_master_project?.status || null,
        },
      ],
      // months and approved periodes
      totalMonths: projTotalMonths,
      approvedPeriodes: Array.from(approvedPeriodesMap[p.id] || []),
      approvedMonths: (approvedPeriodesMap[p.id] || new Set()).size,
      completePeriodes: Array.from((completePeriodesMap && completePeriodesMap[p.id]) ? Array.from(completePeriodesMap[p.id]) : []),
      completeMonths: (completePeriodesMap && completePeriodesMap[p.id]) ? (completePeriodesMap[p.id] || new Set()).size : 0,
    };
  });

  // Merge grouped projects (cross-year splits) for user/dosen view
  const groupedData = new Map();
  const ungroupedData = [];

  for (const project of data) {
    if (project.project_group_id) {
      if (!groupedData.has(project.project_group_id)) {
        groupedData.set(project.project_group_id, {
          ...project,
          grouped_project_ids: [project.id],
          grouped_projects: Array.isArray(project.grouped_projects) ? [...project.grouped_projects] : [],
          // internal sets to aggregate approved/complete periodes across splits
          _approvedPeriodesSet: new Set(project.approvedPeriodes || []),
          _completePeriodesSet: new Set(project.completePeriodes || []),
        });
      } else {
        const existing = groupedData.get(project.project_group_id);
        existing.grouped_project_ids.push(project.id);
        // Ensure grouped_projects array exists
        if (!Array.isArray(existing.grouped_projects)) existing.grouped_projects = [];
        if (Array.isArray(project.grouped_projects)) {
          project.grouped_projects.forEach(g => existing.grouped_projects.push(g));
        }

        // Extend date range
        if (new Date(project.tanggal_mulai) < new Date(existing.tanggal_mulai)) {
          existing.tanggal_mulai = project.tanggal_mulai;
        }
        if (new Date(project.tanggal_selesai) > new Date(existing.tanggal_selesai)) {
          existing.tanggal_selesai = project.tanggal_selesai;
        }

        // Extend original project date range (not based on timesheets)
        if (project.tanggal_mulai_project && (!existing.tanggal_mulai_project || new Date(project.tanggal_mulai_project) < new Date(existing.tanggal_mulai_project))) {
          existing.tanggal_mulai_project = project.tanggal_mulai_project;
        }
        if (project.tanggal_selesai_project && (!existing.tanggal_selesai_project || new Date(project.tanggal_selesai_project) > new Date(existing.tanggal_selesai_project))) {
          existing.tanggal_selesai_project = project.tanggal_selesai_project;
        }

        // Aggregate totals
        existing.totalEstimasi = (existing.totalEstimasi || 0) + (project.totalEstimasi || 0);
        existing.totalIntensifDisplay = (existing.totalIntensifDisplay || 0) + (project.totalIntensifDisplay || 0);
        existing.totalAktualTimesheets = (existing.totalAktualTimesheets || 0) + (project.totalAktualTimesheets || 0);
        existing.applyCount = Math.max(existing.applyCount || 0, project.applyCount || 0);

        // Aggregate approved periodes sets
        if (!existing._approvedPeriodesSet) existing._approvedPeriodesSet = new Set();
        (project.approvedPeriodes || []).forEach(pr => existing._approvedPeriodesSet.add(pr));
        existing.approvedPeriodes = Array.from(existing._approvedPeriodesSet);
        existing.approvedMonths = existing._approvedPeriodesSet.size;

        // Aggregate COMPLETE periodes sets
        if (!existing._completePeriodesSet) existing._completePeriodesSet = new Set();
        (project.completePeriodes || []).forEach(pr => existing._completePeriodesSet.add(pr));
        existing.completePeriodes = Array.from(existing._completePeriodesSet);
        existing.completeMonths = existing._completePeriodesSet.size;

        // Recompute totalMonths from combined original/project dates
        const startForTotal = existing.tanggal_mulai_project || existing.tanggal_mulai;
        const endForTotal = existing.tanggal_selesai_project || existing.tanggal_selesai;
        existing.totalMonths = monthsBetweenInclusive(startForTotal, endForTotal);

        // Merge members (dedupe by id)
        const existingMemberIds = new Set(existing.members.map(m => m.id));
        project.members.forEach(m => {
          if (!existingMemberIds.has(m.id)) {
            existing.members.push(m);
          }
        });
        existing.countMember = existing.members.length;

        // Combined status logic — prioritize active statuses
        // Priority: Waiting Timesheet Approval > Need Revision > Project Approved > Completed
        const allStatuses = [...(existing._all_statuses || [existing.status]), project.status];
        existing._all_statuses = allStatuses;

        if (allStatuses.includes('Waiting Timesheet Approval')) {
          existing.status = 'Waiting Timesheet Approval';
        } else if (allStatuses.includes('Need Revision')) {
          existing.status = 'Need Revision';
        } else if (allStatuses.every(s => s === 'Completed')) {
          existing.status = 'Completed';
        } else if (allStatuses.some(s => s === 'Completed' || s === 'Project Approved')) {
          existing.status = 'Project Approved';
        }
      }
    } else {
      ungroupedData.push(project);
    }
  }

  const mergedData = [...groupedData.values(), ...ungroupedData]
    .sort((a, b) => b.id - a.id)
    .map(({ _all_statuses, _approvedPeriodesSet, _completePeriodesSet, ...rest }) => {
      const totalMonths = Number(rest.totalMonths || 0);
      const approvedMonths = Number(rest.approvedMonths || 0);
      const completeMonths = Number(rest.completeMonths || 0);
      // Use completeMonths for displayed progress (admin-approved periods are COMPLETE)
      const statusProgress = (rest.status === 'Project Approved' && totalMonths > 1)
        ? `Project Approved ${completeMonths}/${totalMonths}` + (completeMonths > 0 ? ` (complete: ${completeMonths})` : "")
        : rest.status;
      return { ...rest, statusProgress };
    });

  return {
    data: mergedData,
    paging: {
      page: request.page,
      total_item: totalItems,
      total_page: Math.ceil(totalItems / request.size),
    },
  };
};

const showAvailableStudent = async (request) => {
  const id_peserta = validate(showAvailableStudentValidation, request);

  const [enrolledProjects, allProjects] = await Promise.all([
    prismaClient.tran_project.findMany({
      where: { id_peserta },
      select: { id_project: true },
    }),
    prismaClient.tmst_project.findMany({
      where: { is_deleted: false },
      select: { id: true, nama: true, tanggal_mulai: true, tanggal_selesai: true },
    }),
  ]);

  const enrolledIds = new Set(enrolledProjects.map((p) => p.id_project));

  return allProjects
    .filter((p) => !enrolledIds.has(p.id))
    .map((p) => ({
      id: p.id,
      nama: p.nama,
      tanggal_mulai: p.tanggal_mulai,
      tanggal_selesai: p.tanggal_selesai,
    }));
};

const get = async (request) => {
  const id = validate(showAvailableStudentValidation, request);

  const data = await prismaClient.tmst_project.findMany({
    where: {
      id_status: {
        in: [
          STATUS.MASTER_PROJECT.PROJECT_APPROVED,
          STATUS.MASTER_PROJECT.NEED_REVISION,
        ]
      },
      tran_project: { some: { id_peserta: id } },
      is_deleted: false,
    },
    select: {
      id: true,
      id_kategori: true,
      inisial_project: true,
      id_status: true,
      tmst_status_master_project: { select: { status: true } },
      tanggal_mulai: true,
      tanggal_selesai: true,
      pendaftaran_selesai: true,
      durasi_default: true,
      nama: true,
      pic: true,
      tran_project: {
        where: { id_peserta: id },
        select: { id: true },
      },
      tmst_kategori_magang: {
        select: {
          kategori: true,
          tran_insentif: {
            select: { id_satuan: true, besaran_insentif: true, durasi_satuan: true },
          },
        },
      },
      tmst_pengguna: { select: { nama: true } },
    },
  });

  return data.map((item) => ({
    id: item.id,
    id_kategori: item.id_kategori,
    inisial_project: item.inisial_project,
    status: item.tmst_status_master_project?.status,
    tanggal_mulai: item.tanggal_mulai,
    tanggal_selesai: item.tanggal_selesai,
    nama: item.nama,
    pic: item.pic,
    id_tran_project: item.tran_project[0]?.id,
    kategori: item.tmst_kategori_magang.kategori,
    kategoriId: item.id_kategori,
    id_satuan: item.tmst_kategori_magang.tran_insentif.id_satuan,
    namaPIC: item.tmst_pengguna.nama,
    insentif: {
      durasi_satuan: item.tmst_kategori_magang.tran_insentif.durasi_satuan,
      besaran_insentif: item.tmst_kategori_magang.tran_insentif.besaran_insentif,
    },
    durasi_per_mahasiswa: item.durasi_default,
    pendaftaran_selesai: item.pendaftaran_selesai,
  }));
};

const getEdit = async (request) => {
  request = validate(getEditValidation, request);
  const { userId, projectId } = request;

  const data = await prismaClient.tmst_project.findFirst({
    where: {
      tran_project: { some: { id_peserta: userId, id: projectId } },
      is_deleted: false,
    },
    select: {
      id: true,
      nama: true,
      pic: true,
      durasi_default: true,
      tmst_kategori_magang: { select: { kategori: true } },
      tmst_pengguna: { select: { nama: true } },
    },
  });

  if (!data) throw new ResponseError(404, "Project tidak ditemukan");

  return {
    id: data.id,
    nama: data.nama,
    pic: data.pic,
    kategori: data.tmst_kategori_magang.kategori,
    namaPIC: data.tmst_pengguna.nama,
    durasi_per_mahasiswa: data.durasi_default,
  };
};

const getApplicants = async (projectId) => {
  return prismaClient.job_application.findMany({
    where: { master_project_id: projectId },
    include: {
      mahasiswa: { select: { id: true, nama: true, departemen: true } },
    },
  });
};

const submitForApproval = async (projectId) => {
  projectId = validate(tmstProjectId, projectId);
  await validateProjectExists(projectId);

  // Check if this project is part of a crossing-year group
  const project = await prismaClient.tmst_project.findUnique({
    where: { id: projectId },
    select: { project_group_id: true },
  });

  if (project?.project_group_id) {
    // Update ALL siblings in the group to Waiting Project Approval
    await prismaClient.tmst_project.updateMany({
      where: {
        project_group_id: project.project_group_id,
        is_deleted: false,
      },
      data: { id_status: STATUS.MASTER_PROJECT.WAITING_PROJECT_APPROVAL },
    });

    return prismaClient.tmst_project.findUnique({
      where: { id: projectId },
      select: { id: true, id_status: true },
    });
  }

  return prismaClient.tmst_project.update({
    where: { id: projectId },
    data: { id_status: STATUS.MASTER_PROJECT.WAITING_PROJECT_APPROVAL },
    select: { id: true, id_status: true },
  });
};

const complete = async (projectId) => {
  projectId = validate(tmstProjectId, projectId);
  await validateProjectExists(projectId);

  // Update all timesheets for this project to COMPLETED
  await prismaClient.tran_timesheet.updateMany({
    where: { tran_project: { id_project: projectId } },
    data: { id_status: STATUS.TIMESHEET.COMPLETED },
  });

  // Update master project status to COMPLETED
  return prismaClient.tmst_project.update({
    where: { id: projectId },
    data: { id_status: STATUS.MASTER_PROJECT.COMPLETED },
    select: { id: true, id_status: true },
  });
};

/**
 * Hitung jumlah bulan dari tanggal_mulai ke tanggal_selesai
 * Contoh: 2026-01-15 s/d 2026-03-20 → 3 bulan (Jan, Feb, Mar)
 */
const calculateProjectMonths = (startDate, endDate) => {
  if (!startDate || !endDate) return 1; // fallback 1 bulan
  const start = new Date(startDate);
  const end = new Date(endDate);
  const months = (end.getFullYear() - start.getFullYear()) * 12
    + (end.getMonth() - start.getMonth()) + 1;
  return Math.max(1, months);
};

const approveTimesheets = async (projectId) => {
  projectId = validate(tmstProjectId, projectId);

  try {
    // Fetch project with dates for progress calculation
    const project = await prismaClient.tmst_project.findUnique({
      where: { id: projectId },
      select: { id: true, tanggal_mulai: true, tanggal_selesai: true },
    });
    if (!project) throw new ResponseError(404, "Project tidak ditemukan");

    // Calculate total months (n)
    const totalMonths = calculateProjectMonths(project.tanggal_mulai, project.tanggal_selesai);
    console.log(`approveTimesheets: projectId=${projectId} totalMonths=${totalMonths}`);

    // Create Promise array
    const promises = [];

    // 1. Update Timesheets to COMPLETED (status 6) - ONLY for this specific project
    const tranProjects = await prismaClient.tran_project.findMany({
      where: { id_project: projectId },
      select: { id: true }
    });
    const tranProjectIds = tranProjects.map(tp => tp.id);
    console.log(`approveTimesheets: found tranProjectIds=${tranProjectIds.length}`);

    if (tranProjectIds.length > 0) {
      promises.push(
        prismaClient.tran_timesheet.updateMany({
          where: { id_tran_project: { in: tranProjectIds } },
          data: { id_status: STATUS.TIMESHEET.COMPLETED }
        })
      );

      // Reset is_reviewed = false so students can submit the next period
      promises.push(
        prismaClient.tran_project.updateMany({
          where: { id: { in: tranProjectIds } },
          data: { is_reviewed: false }
        })
      );
    }

    // 2. Update Payment Status to COMPLETE (status 2) - Safe Consolidation Logic
    const allPayments = await prismaClient.tran_payment.findMany({
      where: { id_tmst_project: projectId },
      orderBy: { id: 'desc' }
    });
    console.log(`approveTimesheets: found payments=${allPayments.length}`);

    // Group by period
    const paymentsByPeriod = allPayments.reduce((acc, curr) => {
      const key = curr.periode || '__NO_PERIODE__';
      if (!acc[key]) acc[key] = [];
      acc[key].push(curr);
      return acc;
    }, {});

    // For each period, ensure single COMPLETE record
    Object.keys(paymentsByPeriod).forEach(period => {
      const payments = paymentsByPeriod[period];
      if (payments.length > 0) {
        const targetId = payments[0].id;
        promises.push(
          prismaClient.tran_payment.update({
            where: { id: targetId },
            data: { id_status: STATUS.PAYMENT.COMPLETE }
          })
        );

        const toDelete = payments.filter(p => p.id !== targetId).map(p => p.id);
        if (toDelete.length > 0) {
          promises.push(
            prismaClient.tran_payment.deleteMany({
              where: { id: { in: toDelete } }
            })
          );
        }
      }
    });

    // Execute timesheet and payment updates
    await Promise.all(promises);
    console.log(`approveTimesheets: executed ${promises.length} DB operations`);

    // 3. Calculate progress: how many periods are now COMPLETE
    const completedPayments = await prismaClient.tran_payment.count({
      where: { id_tmst_project: projectId, id_status: STATUS.PAYMENT.COMPLETE },
    });
    console.log(`approveTimesheets: completedPayments=${completedPayments}`);

    // 4. Update project status based on progress
    let isFullyCompleted = false;
    if (completedPayments >= totalMonths) {
      // All months approved → Completed
      await prismaClient.tmst_project.update({
        where: { id: projectId },
        data: {
          id_status: STATUS.MASTER_PROJECT.COMPLETED,
          remark_project: "Completed",
        },
      });
      isFullyCompleted = true;
    } else {
      // Partial → Project Approved (m/n)
      await prismaClient.tmst_project.update({
        where: { id: projectId },
        data: {
          id_status: STATUS.MASTER_PROJECT.PROJECT_APPROVED,
          remark_project: `Project Approved (${completedPayments}/${totalMonths})`,
        },
      });
    }

    return {
      updated: true,
      completedPeriods: completedPayments,
      totalPeriods: totalMonths,
      isFullyCompleted,
    };
  } catch (e) {
    console.error('approveTimesheets failed for projectId=', projectId, e && e.stack ? e.stack : e);
    throw e;
  }
};

const approveStudentTimesheets = async (projectId, userId, period) => {
  projectId = validate(tmstProjectId, projectId);
  await validateProjectExists(projectId);

  const [year, month] = period.split("-").map(Number);
  const startMonthDate = new Date(year, month - 1, 1);
  const endMonthDate = new Date(year, month, 1);

  const tranProject = await prismaClient.tran_project.findFirst({
    where: { id_project: projectId, id_peserta: userId },
    select: { id: true },
  });

  if (!tranProject) {
    throw new ResponseError(404, "Student tidak ditemukan dalam project ini");
  }

  const result = await prismaClient.tran_timesheet.updateMany({
    where: {
      id_tran_project: tranProject.id,
      tanggal: { gte: startMonthDate, lt: endMonthDate },
    },
    data: { id_status: STATUS.TIMESHEET.APPROVED },
  });

  // Reset is_reviewed = false so user can submit the next period for review
  await prismaClient.tran_project.update({
    where: { id: tranProject.id },
    data: { is_reviewed: false },
  });

  // Check if all students approved
  const allTranProjects = await prismaClient.tran_project.findMany({
    where: { id_project: projectId },
    select: { id: true },
  });

  // Check for any timesheets with REVISION_REQUIRED status
  const revisionTimesheets = await prismaClient.tran_timesheet.count({
    where: {
      id_tran_project: { in: allTranProjects.map((tp) => tp.id) },
      tanggal: { gte: startMonthDate, lt: endMonthDate },
      id_status: STATUS.TIMESHEET.REVISION_REQUIRED,
    },
  });

  const pendingTimesheets = await prismaClient.tran_timesheet.count({
    where: {
      id_tran_project: { in: allTranProjects.map((tp) => tp.id) },
      tanggal: { gte: startMonthDate, lt: endMonthDate },
      id_status: { not: STATUS.TIMESHEET.APPROVED },
    },
  });


  if (revisionTimesheets > 0) {
    // If any student has revision required, set payment to ON_REVISION
    await prismaClient.tran_payment.updateMany({
      where: { id_tmst_project: projectId, periode: period },
      data: { id_status: STATUS.PAYMENT.ON_REVISION },
    });
  } else if (pendingTimesheets === 0) {
    // START FIX: Consolidate payment records to ensure single Approved status
    const allPayments = await prismaClient.tran_payment.findMany({
      where: { id_tmst_project: projectId, periode: period },
      orderBy: { id: 'desc' } // Process newest first
    });

    let targetPaymentId = null;
    const existingApproved = allPayments.find(p => p.id_status === STATUS.PAYMENT.APPROVED);

    if (existingApproved) {
      targetPaymentId = existingApproved.id;
    } else if (allPayments.length > 0) {
      // Update the first available payment to Approved
      const p = allPayments[0];
      await prismaClient.tran_payment.update({
        where: { id: p.id },
        data: { id_status: STATUS.PAYMENT.APPROVED },
      });
      targetPaymentId = p.id;
    } else {
      // Create new if none exist (unlikely but safe)
      const newP = await prismaClient.tran_payment.create({
        data: {
          id_tmst_project: projectId,
          periode: period,
          id_status: STATUS.PAYMENT.APPROVED,
          total_tagihan: 0,
        },
      });
      targetPaymentId = newP.id;
    }

    // Delete any other duplicate/conflicting records for this period
    if (allPayments.length > 0) {
      const idsToDelete = allPayments
        .filter(p => p.id !== targetPaymentId)
        .map(p => p.id);

      if (idsToDelete.length > 0) {
        await prismaClient.tran_payment.deleteMany({
          where: { id: { in: idsToDelete } }
        });
      }
    }
    // END FIX
  }

  return { updated: result.count, allApproved: pendingTimesheets === 0 };
};

const reviseStudentTimesheets = async (projectId, userId, period, revisiMessage = null) => {
  projectId = validate(tmstProjectId, projectId);
  await validateProjectExists(projectId);

  const [year, month] = period.split("-").map(Number);
  const startMonthDate = new Date(year, month - 1, 1);
  const endMonthDate = new Date(year, month, 1);

  const tranProject = await prismaClient.tran_project.findFirst({
    where: { id_project: projectId, id_peserta: userId },
    select: { id: true },
  });

  if (!tranProject) {
    throw new ResponseError(404, "Student tidak ditemukan dalam project ini");
  }

  // Update tran_project with revision message
  if (revisiMessage) {
    await prismaClient.tran_project.update({
      where: { id: tranProject.id },
      data: { revisi: revisiMessage },
    });
  }

  const result = await prismaClient.tran_timesheet.updateMany({
    where: {
      id_tran_project: tranProject.id,
      tanggal: { gte: startMonthDate, lt: endMonthDate },
    },
    data: { id_status: STATUS.TIMESHEET.REVISION_REQUIRED },
  });

  // Update or create payment with ON_REVISION status when any student needs revision
  const existingPayment = await prismaClient.tran_payment.findFirst({
    where: { id_tmst_project: projectId, periode: period },
  });

  if (existingPayment) {
    await prismaClient.tran_payment.updateMany({
      where: { id_tmst_project: projectId, periode: period },
      data: { id_status: STATUS.PAYMENT.ON_REVISION },
    });
  } else {
    await prismaClient.tran_payment.create({
      data: {
        id_tmst_project: projectId,
        periode: period,
        id_status: STATUS.PAYMENT.ON_REVISION,
        total_tagihan: 0,
      },
    });
  }

  return { updated: result.count };
};

const hasApprovedTimesheets = async (projectId) => {
  projectId = validate(tmstProjectId, projectId);

  const count = await prismaClient.tran_timesheet.count({
    where: {
      id_status: STATUS.TIMESHEET.APPROVED,
      tran_project: { id_project: projectId },
    },
  });

  return count > 0;
};

export default {
  create,
  remove,
  list,
  update,
  select,
  showAvailableStudent,
  get,
  getEdit,
  getMyProject,
  getApplicants,
  submitForApproval,
  complete,
  approveTimesheets,
  approveStudentTimesheets,
  reviseStudentTimesheets,
  hasApprovedTimesheets,
};

/**
 * Months between two dates inclusive (UTC month arithmetic)
 */
const monthsBetweenInclusive = (start, end) => {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  const yearDiff = e.getUTCFullYear() - s.getUTCFullYear();
  const monthDiff = e.getUTCMonth() - s.getUTCMonth();
  return yearDiff * 12 + monthDiff + 1;
};