import { validate } from "../validation/validation.js";
import {
  showAvailableStudentValidation,
  createAndUpdateValidation,
  tmstProjectId,
  listProjectValidation,
  getEditValidation,
  list2ProjectValidation,
} from "../validation/tmst-project-validation.js";
import {
  recapValidation,
  getDataRecapValidation,
  userRecapValidation,
  myProjectRecapValidation,
  projectRecapValidation,
} from "../validation/tran-project-validation.js";
import { prismaClient } from "../application/database.js";
import { ResponseError } from "../error/response-error.js";
import { format } from "date-fns";
import moments from "moment";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { STATUS, STATUS_MAP } from "../constants/index.js";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Read saved jabatan from file
 */
function getLecturerJabatanFromFile(userId) {
  try {
    const jabatanDir = path.join(process.cwd(), "documents", "signatures", "jabatan");
    const key = `user_${userId}`;
    const encryptedFileName = crypto.createHash('sha256').update(key).digest('hex');
    const filePath = path.join(jabatanDir, `${encryptedFileName}.json`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(content);
      return data.jabatan || null;
    }
  } catch (e) {
    console.warn('Failed to read lecturer jabatan:', e.message);
  }
  return null;
}

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
 * Find signature file with multiple extension support
 */
const findSignatureFile = (directory, baseName) => {
  const exts = ["png", "jpg", "jpeg", "webp"];
  const baseDir = path.join(process.cwd(), "documents", "signatures", directory);

  for (const ext of exts) {
    const filePath = path.join(baseDir, `${baseName}.${ext}`);
    try {
      if (fs.existsSync(filePath)) {
        const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";
        return { path: filePath, mime };
      }
    } catch {
      // File doesn't exist, continue
    }
  }
  return null;
};

/**
 * Load image as base64 data URL
 */
const loadImageAsDataUrl = (filePath, defaultUrl = null) => {
  try {
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(filePath).slice(1).toLowerCase();
      const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png";
      return `data:${mime};base64,${buffer.toString("base64")}`;
    }
  } catch {
    // Failed to load image
  }
  return defaultUrl;
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
      .filter((ja) => ja.tmst_pengguna?.id || ja.tmst_pengguna?.nama)
      .map((ja) => ({
        id: ja.tmst_pengguna?.id,
        nama: ja.tmst_pengguna?.nama,
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
    status: true,
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
      select: { tmst_pengguna: { select: { id: true, nama: true } } },
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

  const totalActual = (p.tran_project || []).reduce(
    (sum, tp) => sum + (Number(tp.estimasi) || 0), 0
  );

  return {
    id: p.id,
    nama: p.nama,
    tanggal_mulai: p.tanggal_mulai,
    tanggal_selesai: p.tanggal_selesai,
    pendaftaran_selesai: p.pendaftaran_selesai,
    id_satuan: p.tmst_kategori_magang?.tran_insentif?.id_satuan || null,
    status: p.status,
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

const create = async (request) => {
  const project = validate(createAndUpdateValidation, request);

  await validateCategoryExists(project.id_kategori);
  const picUser = await validatePicUser(project.pic);
  validateProjectDates(project);

  // Build project name with PIC
  const baseName = capitalizeEachWord(project.nama);
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
      status: project.status || STATUS.PROJECT.DRAFT,
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

  // Build project name with PIC
  const baseName = capitalizeEachWord(project.nama);
  project.nama = `${baseName} - ${picUser.nama}`;

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
      status: project.status || STATUS.PROJECT.DRAFT,
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
      "Cannot delete. There are still applications 'Pending' or 'Accepted'. Reject all applications first."
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

const removeMany = async (projectId) => {
  projectId = validate(tmstProjectId, projectId);
  await validateProjectExists(projectId, "Project tidak ditemukan");

  // First delete related payment status history
  await prismaClient.payment_status_history.deleteMany({
    where: {
      tran_payment: {
        id_tmst_project: projectId,
      },
    },
  });

  // Then delete related tran_payment records
  await prismaClient.tran_payment.deleteMany({
    where: {
      id_tmst_project: projectId,
    },
  });

  // Delete related timesheet status history
  await prismaClient.timesheet_status_history.deleteMany({
    where: {
      tran_timesheet: {
        tran_project: {
          id_project: projectId,
        },
      },
    },
  });

  // Delete related tran_timesheet records
  await prismaClient.tran_timesheet.deleteMany({
    where: {
      tran_project: {
        id_project: projectId,
      },
    },
  });

  // Delete project status history
  await prismaClient.project_status_history.deleteMany({
    where: {
      tran_project: {
        id_project: projectId,
      },
    },
  });

  // Finally delete all tran_project records for this project
  return prismaClient.tran_project.deleteMany({
    where: {
      id_project: projectId,
    },
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
    const startDate = new Date(request.tanggalMulai);
    startDate.setHours(0, 0, 0, 0);
    filters.push({ tanggal_mulai: { gte: startDate } });
  }
  if (request.tanggalSelesai) {
    const endDate = new Date(request.tanggalSelesai);
    endDate.setHours(23, 59, 59, 999);
    filters.push({ tanggal_selesai: { lte: endDate } });
  }
  if (request.status != null) {
    const s = STATUS_MAP[Number(request.status)] ?? request.status;
    filters.push({ status: s });
  }
  if (request.status_ne != null) {
    const sNE = STATUS_MAP[Number(request.status_ne)] ?? request.status_ne;
    filters.push({ NOT: { status: sNE } });
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

  return {
    data: rows.map(transformProjectToListItem),
    paging: {
      page: request.page,
      total_item: totalItems,
      total_page: Math.ceil(totalItems / request.size),
    },
  };
};

const select = async (request) => {
  const projectId = validate(tmstProjectId, request);
  await validateProjectExists(projectId, "ID Project tidak ditemukan!");

  const row = await prismaClient.tmst_project.findFirst({
    where: { id: projectId, is_deleted: false },
    select: {
      id: true,
      inisial_project: true,
      remark_project: true,
      durasi_default: true,
      status: true,
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
    },
  });

  if (!row) throw new ResponseError(404, "Id tidak ditemukan!");

  // Extract config
  const { rate: ratePerSesi, durasiSatuan: sesiMenit, idSatuan } = getInsentifConfig(row.tmst_kategori_magang);
  const isKarya = isKaryaType(null, idSatuan);
  const totalJam = Number(row.durasi_default || 0);
  const jumlahMhs = row.tran_project.length;

  // Calculate base estimation
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
    status: String(row.status || "Open").trim(),
  };

  // Handle Completed projects - calculate from timesheets
  if (row.status === STATUS.PROJECT.COMPLETED && id_tran_project.length > 0) {
    const { timesheets, dateRange } = await aggregateTimesheetData(id_tran_project);

    if (timesheets.length > 0) {
      // Group by tran_project and calculate per-member
      const byTranProject = {};
      timesheets.forEach((ts) => {
        if (!byTranProject[ts.id_tran_project]) byTranProject[ts.id_tran_project] = [];
        byTranProject[ts.id_tran_project].push(ts);
      });

      const realizedDurasi = [];
      let totalRealizedInsentif = 0;

      row.tran_project.forEach((tp) => {
        const tpTimesheets = byTranProject[tp.id] || [];
        const { totalDurasi, totalInsentif } = calculateRealizedFromTimesheets(tpTimesheets, isKarya, ratePerSesi);
        realizedDurasi.push(totalDurasi);
        totalRealizedInsentif += totalInsentif;
      });

      result.durasi = realizedDurasi;
      result.totalEstimasi = totalRealizedInsentif;
      totalEstimasiBaru = totalRealizedInsentif;

      if (dateRange) {
        result.tanggal_mulai = format(dateRange.min, "dd/MM/yyyy");
        result.tanggal_selesai = format(dateRange.max, "dd/MM/yyyy");
      }
    }
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
  if (!result.totalEstimasi) result.totalEstimasi = totalEstimasiBaru;

  // Cleanup
  delete result.tran_project;
  delete result.tmst_kategori_magang;
  delete result.tmst_pengguna;

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

  // Batch fetch approved/complete payments and build periodes maps
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
    const [y, m] = periode.split("-").map((v) => Number(v));
    if (!y || !m) return false;
    const perIndex = y * 12 + (m - 1);
    if (start && end) {
      const startIndex = start.getFullYear() * 12 + start.getMonth();
      const endIndex = end.getFullYear() * 12 + end.getMonth();
      return perIndex >= startIndex && perIndex <= endIndex;
    }
    // If no start/end, accept by default
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

  const data = rows.map((p) => {
    const members = mapProjectMembers(p.tran_project, p.job_applications);
    const { rate, durasiSatuan, satuan } = getInsentifConfig(p.tmst_kategori_magang);
    const isKarya = isKaryaType(satuan, null);
    const kuota = Number(p.kuota) || 0;
    const tranProjectIds = (p.tran_project || []).map((tp) => tp.id);

    // Get timesheets for this project from pre-fetched data
    const projectTimesheets = tranProjectIds.flatMap((id) => timesheetMap[id] || []);

    // Calculate dates from timesheets if needed
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

    // For approved/completed with approved payment, use actual from timesheets
    const approvedSetForProject = approvedPeriodesMap[p.id] || new Set();
    const hasApprovedPayment = approvedSetForProject.size > 0;
    if ((p.status === STATUS.PROJECT.APPROVED || p.status === STATUS.PROJECT.COMPLETED) && hasApprovedPayment) {
      const { totalInsentif } = calculateRealizedFromTimesheets(projectTimesheets, isKarya, rate);
      totalIntensifDisplay = totalInsentif;
    }

    // For completed projects, always use realized values
    let realizedDurasi = null;
    if (p.status === STATUS.PROJECT.COMPLETED && projectTimesheets.length > 0) {
      const { totalDurasi: realized, totalInsentif } = calculateRealizedFromTimesheets(projectTimesheets, isKarya, rate);
      realizedDurasi = realized;
      totalIntensifDisplay = totalInsentif;

      // Use timesheet dates for completed
      const allDates = projectTimesheets.map((ts) => ts.tanggal).filter(Boolean);
      if (allDates.length > 0) {
        tanggal_mulai = new Date(Math.min(...allDates.map((d) => d.getTime())));
        tanggal_selesai = new Date(Math.max(...allDates.map((d) => d.getTime())));
      }
    }

    const totalActual = (p.tran_project || []).reduce((sum, tp) => sum + (Number(tp.estimasi) || 0), 0);

    return {
      id: p.id,
      nama: p.nama,
      id_kategori: p.id_kategori,
      tanggal_mulai,
      tanggal_selesai,
      pendaftaran_mulai: p.pendaftaran_mulai,
      pendaftaran_selesai: p.pendaftaran_selesai,
      status: p.status,
      applyCount: p._count?.job_applications || 0,
      members,
      totalEstimasi: totalActual,
      totalIntensifDisplay,
      countMember: members.length,
      realizedDurasi,
      isKarya,
      // month counts and approved/complete periodes
      totalMonths: monthsBetweenInclusive(tanggal_mulai, tanggal_selesai),
      approvedPeriodes: Array.from(approvedPeriodesMap[p.id] || []),
      approvedMonths: (approvedPeriodesMap[p.id] || new Set()).size,
      completePeriodes: Array.from(completePeriodesMap[p.id] || []),
      completeMonths: (completePeriodesMap[p.id] || new Set()).size,
    };
  });

  return {
    data,
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
  const { userId, projectId } = validate(getEditValidation, request);

  const tranProject = await prismaClient.tran_project.findFirst({
    where: { id_project: projectId, id_peserta: userId },
    select: { id: true },
  });

  if (!tranProject) {
    throw new ResponseError(404, "Transaksi project tidak ditemukan");
  }

  return { id: tranProject.id };
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
      tmst_pengguna: { select: { id: true, nama: true, departemen: true } },
    },
  });
};

const submitForApproval = async (projectId) => {
  projectId = validate(tmstProjectId, projectId);
  await validateProjectExists(projectId);

  return prismaClient.tmst_project.update({
    where: { id: projectId },
    data: { status: STATUS.PROJECT.SUBMITTED },
    select: { id: true, status: true },
  });
};

const complete = async (projectId) => {
  projectId = validate(tmstProjectId, projectId);
  await validateProjectExists(projectId);

  return prismaClient.tmst_project.update({
    where: { id: projectId },
    data: { status: STATUS.PROJECT.COMPLETED },
    select: { id: true, status: true },
  });
};

const approveTimesheets = async (projectId) => {
  projectId = validate(tmstProjectId, projectId);
  await validateProjectExists(projectId);

  const [timesheetResult] = await Promise.all([
    prismaClient.tran_timesheet.updateMany({
      where: { tran_project: { id_project: projectId } },
      data: { id_status: STATUS.TIMESHEET.APPROVED },
    }),
    prismaClient.tran_payment.updateMany({
      where: { id_tmst_project: projectId },
      data: { id_status: STATUS.PAYMENT.APPROVED },
    }),
  ]);

  // Count distinct approved periodes for this project
  const approvedPayments = await prismaClient.tran_payment.findMany({
    where: { id_tmst_project: projectId, id_status: { in: [STATUS.PAYMENT.APPROVED, STATUS.PAYMENT.COMPLETE] } },
    select: { periode: true },
  });
  const approvedSet = new Set(approvedPayments.map((p) => p.periode).filter(Boolean));
  // Count distinct COMPLETE periodes for this project
  const completePayments = await prismaClient.tran_payment.findMany({
    where: { id_tmst_project: projectId, id_status: STATUS.PAYMENT.COMPLETE },
    select: { periode: true },
  });
  const completeSet = new Set(completePayments.map((p) => p.periode).filter(Boolean));

  // Compute total months range from project dates
  const project = await prismaClient.tmst_project.findUnique({
    where: { id: projectId },
    select: { tanggal_mulai: true, tanggal_selesai: true, tanggal_mulai_project: true, tanggal_selesai_project: true },
  });
  const startForTotal = project?.tanggal_mulai_project || project?.tanggal_mulai || null;
  const endForTotal = project?.tanggal_selesai_project || project?.tanggal_selesai || null;
  const totalMonths = monthsBetweenInclusive(startForTotal, endForTotal);

  return {
    updated: timesheetResult.count,
    completedPeriods: approvedSet.size,
    completePeriods: completeSet.size,
    totalPeriods: totalMonths,
    isFullyCompleted: totalMonths > 0 && approvedSet.size >= totalMonths,
  };
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

  // Update payment status based on timesheet statuses
  if (revisionTimesheets > 0) {
    // If any student has revision required, set payment to ON_REVISION
    await prismaClient.tran_payment.updateMany({
      where: { id_tmst_project: projectId, periode: period },
      data: { id_status: STATUS.PAYMENT.ON_REVISION },
    });
  } else if (pendingTimesheets === 0) {
    // If all timesheets are approved, set payment to APPROVED
    await prismaClient.tran_payment.updateMany({
      where: { id_tmst_project: projectId, periode: period },
      data: { id_status: STATUS.PAYMENT.APPROVED },
    });
  }

  return { updated: result.count, allApproved: pendingTimesheets === 0 };
};

const reviseStudentTimesheets = async (projectId, userId, period) => {
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
    data: { id_status: STATUS.TIMESHEET.REVISION_REQUIRED },
  });

  // Upsert payment record
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

// ============================================================================
// PDF RECAP FUNCTIONS
// ============================================================================

const recapPdf = async (request) => {
  let validatePdf = null;

  if (!request.option) {
    validatePdf = validate(getDataRecapValidation, request);
  } else if (request.option) {
    validatePdf = validate(recapValidation, request);
  }

  const checkProject = await prismaClient.tmst_project.findFirst({
    where: { nama: validatePdf.project },
    select: { id: true, nama: true, pic: true },
  });

  if (!checkProject) {
    return { data: { error: "Project tidak ditemukan!" } };
  }

  const targetYear = validatePdf.year ? Number(validatePdf.year) : new Date().getFullYear();
  const mainProjectId = checkProject.id;
  const picUserId = checkProject.pic;

  // Check for any timesheets in the date range
  const checkTimesheet = await prismaClient.tran_timesheet.findFirst({
    where: {
      AND: [
        {
          tanggal: { gte: new Date(targetYear, validatePdf.month - 1, 1) },
        },
        {
          tanggal: {
            lt: new Date(targetYear, validatePdf.month, 1),
          },
        },
      ],
      tran_project: {
        is: {
          tmst_project: { is: { nama: validatePdf.project } },
        },
      },
    },
  });

  if (!checkTimesheet) {
    return { data: { error: "Timesheet kosong" } };
  }

  // Query data mahasiswa di project utama
  const dataPdf = await prismaClient.tran_project.findMany({
    select: {
      id_peserta: true,
      id_project: true,
      tran_timesheet: {
        select: {
          jam_mulai: true,
          jam_selesai: true,
          tanggal: true,
          total_sesi: true,
          link_output: true,
        },
        where: {
          tanggal: {
            gte: new Date(targetYear, validatePdf.month - 1, 1),
            lt: new Date(targetYear, validatePdf.month, 1),
          },
        },
      },
      tmst_project: {
        select: {
          id: true,
          nama: true,
          inisial_project: true,
          tmst_kategori_magang: {
            select: {
              tran_insentif: {
                select: {
                  besaran_insentif: true,
                  id_satuan: true
                }
              }
            },
          },
        },
      },
      tmst_pengguna: { select: { id: true, nama: true } },
    },
    where: {
      tran_timesheet: {
        some: {
          tanggal: {
            gte: new Date(targetYear, validatePdf.month - 1, 1),
            lt: new Date(targetYear, validatePdf.month, 1),
          },
        },
      },
      tmst_project: { is: { nama: validatePdf.project } },
    },
  });

  // Ambil daftar mahasiswa di project utama
  const mainStudentIds = dataPdf.map(d => d.id_peserta);

  // Cek apakah ada mahasiswa yang juga terdaftar di project lain milik PIC yang sama
  const otherProjectsForPIC = await prismaClient.tmst_project.findMany({
    where: {
      pic: picUserId,
      id: { not: mainProjectId },
    },
    select: { id: true, nama: true },
  });

  const otherProjectIds = otherProjectsForPIC.map(p => p.id);

  // Cari mahasiswa ganda (mahasiswa yang ada di project utama DAN project lain milik PIC yang sama)
  const duplicateStudentsData = await prismaClient.tran_project.findMany({
    select: {
      id_peserta: true,
      id_project: true,
      tran_timesheet: {
        select: {
          jam_mulai: true,
          jam_selesai: true,
          tanggal: true,
          total_sesi: true,
          link_output: true,
        },
        where: {
          tanggal: {
            gte: new Date(targetYear, validatePdf.month - 1, 1),
            lt: new Date(targetYear, validatePdf.month, 1),
          },
        },
      },
      tmst_project: {
        select: {
          id: true,
          nama: true,
          inisial_project: true,
          tmst_kategori_magang: {
            select: {
              tran_insentif: {
                select: {
                  besaran_insentif: true,
                  id_satuan: true
                }
              }
            },
          },
        },
      },
      tmst_pengguna: { select: { id: true, nama: true } },
    },
    where: {
      id_peserta: { in: mainStudentIds },
      id_project: { in: otherProjectIds },
      tran_timesheet: {
        some: {
          tanggal: {
            gte: new Date(targetYear, validatePdf.month - 1, 1),
            lt: new Date(targetYear, validatePdf.month, 1),
          },
        },
      },
    },
  });

  // Identifikasi mahasiswa yang benar-benar ganda
  const duplicateStudentIds = [...new Set(duplicateStudentsData.map(d => d.id_peserta))];
  const hasDuplicates = duplicateStudentIds.length > 0;

  // Jika tidak ada parameter option, kembalikan JSON dengan struktur files[]
  if (!request.option) {
    const files = [];
    if (hasDuplicates) {
      files.push({
        displayName: "pdf-recap",
        reportType: "main",
      });
      files.push({
        displayName: "pdf-recap-tambahan-1",
        reportType: "secondary",
      });
    } else {
      files.push({
        displayName: "pdf-recap",
        reportType: "main",
      });
    }
    return { files };
  }

  // Tentukan data mana yang akan diproses berdasarkan reportType
  const reportType = request.reportType || "main";
  let dataToProcess = [];

  if (reportType === "main") {
    // PDF Utama: Semua mahasiswa dari project utama
    dataToProcess = dataPdf;
  } else if (reportType === "secondary") {
    // PDF Tambahan: Hanya mahasiswa ganda dari project lain
    dataToProcess = duplicateStudentsData;
  }

  if (validatePdf.firstUserId) {
    const firstId = validatePdf.firstUserId.toString();
    const idx = dataToProcess.findIndex((d) => d.tmst_pengguna?.id?.toString() === firstId);
    if (idx > 0) {
      const [item] = dataToProcess.splice(idx, 1);
      dataToProcess.unshift(item);
    }
  }

  let jam_mulai = [];
  let jam_selesai = [];
  let tanggal = [];
  let sesi = [];
  let nama_project = null;
  let besaran_insentif = null;
  let total_sesi = 0;
  let total_insentif = null;
  let total_jam = 0;
  let jam = [];
  let nama = null;
  let nim = null;
  let biodata = null;
  let headers = ["Nama Mahasiswa"];
  let master_total_jam = 0;
  let master_total_sesi = 0;
  let master_total_insentif = 0;
  let year = null,
    month = null,
    day = null;
  let formattedDate = null;
  let inisial_project = null;

  dataToProcess.forEach((data) => {
    let countTime = 0;
    let total_karya = 0; // Hitung karya di awal

    // Cek dulu apakah ini project karya
    const id_satuan = data.tmst_project.tmst_kategori_magang.tran_insentif.id_satuan;
    const isKaryaProject = id_satuan === 2;

    data.tran_timesheet.forEach((timesheetData) => {
      if (data.tran_timesheet.length != null) {
        jam_mulai.push(timesheetData.jam_mulai);
        jam_selesai.push(timesheetData.jam_selesai);
        sesi.push(timesheetData.total_sesi);

        // Untuk karya: setiap 1 row timesheet = 1 karya
        if (isKaryaProject) {
          const jumlahKarya = (timesheetData.total_sesi && timesheetData.total_sesi > 0) ? timesheetData.total_sesi : 1;
          total_karya += jumlahKarya;
        }

        year = timesheetData.tanggal.getFullYear();
        month = timesheetData.tanggal.getMonth() + 1;
        day = timesheetData.tanggal.getDate();
        formattedDate = `${year}-${month < 10 ? "0" : ""}${month}-${day < 10 ? "0" : ""
          }${day}`;
        tanggal.push(formattedDate);
      }
      countTime++;
    });
    for (let i = 0; i <= countTime - 1; i++) {
      const startTimeObj = moments(jam_mulai[i], "YYYY-MM-DDTHH:mm:ss");
      const endTimeObj = moments(jam_selesai[i], "YYYY-MM-DDTHH:mm:ss");
      const diffInMilliseconds = endTimeObj.diff(startTimeObj);
      const diffInHours = moments.duration(diffInMilliseconds).asHours();
      jam.push(Math.floor(diffInHours));
    }
    tanggal.forEach((tgl) => {
      let count = 0;
      if (headers.length === 0) headers.push(tgl);
      else {
        headers.forEach((head) => {
          if (tgl === head) count++;
        });
        if (count === 0) headers.push(tgl);
      }
    });
    total_jam += jam.reduce(
      (accumulator, currentValue) => accumulator + currentValue,
      0
    );
    master_total_jam += total_jam;
    total_sesi += sesi.reduce(
      (accumulator, currentValue) => accumulator + currentValue,
      0
    );
    master_total_sesi += total_sesi;
    nama_project = data.tmst_project.nama;
    inisial_project = data.tmst_project.inisial_project;
    besaran_insentif =
      data.tmst_project.tmst_kategori_magang.tran_insentif.besaran_insentif;

    // Cek apakah ini karya (id_satuan = 2) atau waktu (menggunakan isKaryaProject yang sudah didefinisikan)
    if (isKaryaProject) {
      // Karya: hitung jumlah row timesheet sebagai karya
      total_insentif = total_karya * besaran_insentif;
      data.total_karya = total_karya;
      data.isKarya = true;
    } else {
      // Waktu: hitung berdasarkan sesi
      total_insentif = total_sesi * besaran_insentif;
      data.isKarya = false;
    }

    master_total_insentif += total_insentif;
    nama = data.tmst_pengguna.nama;
    nim = data.tmst_pengguna.id;
    biodata = nama + " | " + nim;
    data.total_sesi = Math.floor(total_sesi);
    data.tanggal = tanggal;
    data.nama_project = nama_project;
    data.inisial_project = inisial_project;
    data.besaran_insentif = besaran_insentif;
    data.total_insentif = total_insentif;
    data.jam = jam;
    data.total_jam = Math.floor(total_jam);
    data.biodata = biodata;
    data.month = validatePdf.month;
    delete data.tran_timesheet;
    delete data.tmst_project;
    delete data.tmst_pengguna;
    jam_mulai = [];
    jam_selesai = [];
    tanggal = [];
    total_sesi = 0;
    total_jam = 0;
    jam = [];
    sesi = [];
  });

  headers.push("Total Jam");
  headers.push("Total Sesi");
  headers.push("Total Insentif");
  const total = {
    total_jam: master_total_jam,
    total_sesi: master_total_sesi,
    total_insentif: master_total_insentif,
  };

  let masterMonth = null;
  if (dataToProcess.length !== 0) {
    const dataDate = dataToProcess[0].tanggal[0];
    const date = new Date(dataDate);
    date.setMonth(date.getMonth() + 1);

    year = date.getFullYear();
    month = date.getMonth() + 1;
    day = date.getDate();

    const monthYear1 = new Date(dataDate);
    const monthNames = [
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

    let monthIndex = monthYear1.getMonth();
    let monthName = monthNames[monthIndex];
    let getyear = monthYear1.getFullYear();
    const startMonth = `${monthName} ${getyear}`;

    const newTanggal = `${year}-${month < 10 ? "0" : ""}${month}-${day < 10 ? "0" : ""
      }${day}`;
    const monthYear2 = new Date(newTanggal);
    monthIndex = monthYear2.getMonth();
    monthName = monthNames[monthIndex];
    getyear = monthYear2.getFullYear();
    const finishMonth = `${monthName} ${year}`;
    masterMonth = { startMonth, finishMonth };
  }

  // Fetch lecturer (PIC) data
  let lecturer = null;
  if (picUserId) {
    const lecturerData = await prismaClient.tmst_pengguna.findUnique({
      where: { id: picUserId },
      select: { id: true, nama: true, status: true },
    });
    if (lecturerData) {
      const jabatanFromFile = getLecturerJabatanFromFile(picUserId);
      lecturer = {
        id: lecturerData.id,
        nama: lecturerData.nama,
        status: lecturerData.status,
        jabatan: jabatanFromFile || 'Dosen Pembimbing',
      };
    }
  }

  return { data: dataToProcess, total, headers, month: masterMonth, lecturer };
};

const userRecapPdf = async (request) => {
  const validatePdf = validate(userRecapValidation, request);

  const userId = validatePdf.userId;
  if (!userId) {
    return { data: { error: "User ID tidak ditemukan!" } };
  }

  // Use year from request if provided, otherwise fall back to current year
  const currentYear = validatePdf.year ? parseInt(validatePdf.year) : new Date().getFullYear();
  const month = parseInt(validatePdf.month);
  const option = validatePdf.option;
  const reportType = validatePdf.reportType;

  // Statuses that count as "done" — APPROVED(1), REVISED(5), COMPLETED(6)
  const VALID_TIMESHEET_STATUSES = [1, 5, 6];

  // Ambil semua project yang dimiliki oleh user (sebagai PIC)
  const userProjects = await prismaClient.tmst_project.findMany({
    where: { pic: userId },
    select: { id: true, nama: true, inisial_project: true },
    orderBy: { id: 'asc' },
  });

  if (!userProjects || userProjects.length === 0) {
    return { data: { error: "Tidak ada project untuk user ini!" } };
  }

  const projectIds = userProjects.map(p => p.id);

  // Ambil semua mahasiswa dari semua project user tersebut yang punya timesheet di bulan ini
  // Filter hanya timesheet yang sudah approved (id_status = 1)
  const dataPdf = await prismaClient.tran_project.findMany({
    select: {
      id_project: true,
      tran_timesheet: {
        select: {
          jam_mulai: true,
          jam_selesai: true,
          tanggal: true,
          total_sesi: true,
          link_output: true,
        },
        where: {
          id_status: { in: VALID_TIMESHEET_STATUSES },
          tanggal: {
            gte: new Date(currentYear, month - 1, 1),
            lt: new Date(currentYear, month, 1),
          },
        },
      },
      tmst_project: {
        select: {
          id: true,
          nama: true,
          inisial_project: true,
          durasi_default: true,
          id_kategori: true,
          tmst_kategori_magang: {
            select: {
              kategori: true,
              tran_insentif: {
                select: {
                  besaran_insentif: true,
                  durasi_satuan: true,
                  tmst_satuan_insentif: { select: { satuan: true } }
                }
              }
            },
          },
        },
      },
      tmst_pengguna: { select: { id: true, nama: true } },
    },
    where: {
      id_project: { in: projectIds },
      tran_timesheet: {
        some: {
          id_status: { in: VALID_TIMESHEET_STATUSES },
          tanggal: {
            gte: new Date(currentYear, month - 1, 1),
            lt: new Date(currentYear, month, 1),
          },
        },
      },
    },
  });

  if (!dataPdf || dataPdf.length === 0) {
    return { data: { error: "Timesheet kosong untuk semua project user ini" } };
  }

  // Detect karya projects (satuan = 'Karya/Hasil Pekerjaan' OR id_kategori = 7)
  const karyaData = dataPdf.filter(mhs => {
    const satuan = mhs.tmst_project?.tmst_kategori_magang?.tran_insentif?.tmst_satuan_insentif?.satuan;
    const idKategori = mhs.tmst_project?.id_kategori;
    return satuan === 'Karya/Hasil Pekerjaan' || idKategori === 7;
  });
  const nonKaryaData = dataPdf.filter(mhs => {
    const satuan = mhs.tmst_project?.tmst_kategori_magang?.tran_insentif?.tmst_satuan_insentif?.satuan;
    const idKategori = mhs.tmst_project?.id_kategori;
    return satuan !== 'Karya/Hasil Pekerjaan' && idKategori !== 7;
  });
  const hasKarya = karyaData.length > 0;

  // Build student entries map for non-karya data to determine max entries
  const studentEntriesMap = {};
  nonKaryaData.forEach(mhs => {
    const sid = mhs.tmst_pengguna.id;
    if (!studentEntriesMap[sid]) studentEntriesMap[sid] = [];
    studentEntriesMap[sid].push(mhs);
  });

  const maxEntries = Math.max(...Object.values(studentEntriesMap).map(arr => arr.length), 0);

  // Jika tidak ada parameter option, return info files yang tersedia
  if (!option) {
    const files = [];

    if (maxEntries === 1) {
      files.push({ displayName: "pdf-recap", reportType: "1" });
    } else if (maxEntries > 1) {
      for (let i = 1; i <= maxEntries; i++) {
        const label = i === 1 ? "" : `-tambahan-${i - 1}`;
        files.push({ displayName: `pdf-recap${label}`, reportType: String(i) });
      }
    }

    if (hasKarya) {
      files.push({ displayName: "pdf-recap-karya", reportType: "karya" });
    }

    return { files };
  }

  // Jika ada option (lihat/unduh), filter data berdasarkan reportType
  let filteredData = [];

  if (reportType === "karya") {
    filteredData = karyaData;
  } else if (reportType && /^\d+$/.test(reportType)) {
    const reportIndex = parseInt(reportType, 10);

    const studentEntriesMap2 = {};
    nonKaryaData.forEach(mhs => {
      const sid = mhs.tmst_pengguna.id;
      if (!studentEntriesMap2[sid]) studentEntriesMap2[sid] = [];
      studentEntriesMap2[sid].push(mhs);
    });

    Object.keys(studentEntriesMap2).forEach(sid => {
      studentEntriesMap2[sid].sort((a, b) => a.id_project - b.id_project);
    });

    const selection = {};
    Object.keys(studentEntriesMap2).forEach(sid => {
      const entries = studentEntriesMap2[sid];
      const index = reportIndex - 1;
      if (index >= 0 && index < entries.length) {
        selection[sid] = entries[index];
      }
    });

    filteredData = Object.values(selection);
  } else {
    filteredData = dataPdf;
  }

  if (filteredData.length === 0) {
    return { data: { error: "Tidak ada data untuk reportType ini" } };
  }

  // Build headers (tanggal-tanggal unik)
  const tanggalSet = new Set();
  filteredData.forEach(mhs => {
    mhs.tran_timesheet.forEach(ts => {
      const d = ts.tanggal;
      const day = d.getDate();
      const monthShort = d.toLocaleString('en-US', { month: 'short' });
      const year = String(d.getFullYear()).slice(-2);
      tanggalSet.add(`${day}-${monthShort}-${year}`);
    });
  });

  const sortedDates = Array.from(tanggalSet).sort((a, b) => {
    const parseDate = (str) => {
      const [day, mon, yr] = str.split('-');
      const monthMap = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
      return new Date(2000 + parseInt(yr), monthMap[mon], parseInt(day));
    };
    return parseDate(a) - parseDate(b);
  });

  const isKaryaReport = reportType === "karya" || (filteredData.length > 0 && filteredData[0].tmst_project?.tmst_kategori_magang?.tran_insentif?.tmst_satuan_insentif?.satuan === 'Karya/Hasil Pekerjaan');

  const headers = isKaryaReport
    ? ['NO', 'NAMA MAHASISWA', 'NIM', ...sortedDates, 'TOTAL KARYA', 'TOTAL INSENTIF']
    : ['NO', 'NAMA MAHASISWA', 'NIM', ...sortedDates, 'TOTAL MENIT', 'TOTAL SESI JAM', 'TOTAL INSENTIF'];

  // Process data per mahasiswa
  let master_total_menit = 0;
  let master_total_sesi = 0;
  let master_total_insentif = 0;

  const processedData = filteredData.map((mhs, idx) => {
    const nim = mhs.tmst_pengguna.id;
    const nama = mhs.tmst_pengguna.nama;
    const besaran_insentif = mhs.tmst_project.tmst_kategori_magang.tran_insentif.besaran_insentif;
    const satuan = mhs.tmst_project.tmst_kategori_magang.tran_insentif.tmst_satuan_insentif?.satuan;
    const isKarya = satuan === 'Karya/Hasil Pekerjaan';

    const dateMap = {};
    let total_menit = 0;
    let total_sesi = 0;
    let total_karya = 0;

    mhs.tran_timesheet.forEach(ts => {
      const d = ts.tanggal;
      const day = d.getDate();
      const monthShort = d.toLocaleString('en-US', { month: 'short' });
      const year = String(d.getFullYear()).slice(-2);
      const dateKey = `${day}-${monthShort}-${year}`;

      if (isKarya) {
        const jumlahKarya = (ts.total_sesi && ts.total_sesi > 0) ? ts.total_sesi : 1;
        if (!dateMap[dateKey]) {
          dateMap[dateKey] = 0;
        }
        dateMap[dateKey] += jumlahKarya;
        total_karya += jumlahKarya;
      } else {
        const startTime = moments(ts.jam_mulai, "YYYY-MM-DDTHH:mm:ss");
        const endTime = moments(ts.jam_selesai, "YYYY-MM-DDTHH:mm:ss");
        const diffInMinutes = moments.duration(endTime.diff(startTime)).asMinutes();

        if (!dateMap[dateKey]) {
          dateMap[dateKey] = 0;
        }
        dateMap[dateKey] += Math.floor(diffInMinutes);
        total_menit += Math.floor(diffInMinutes);
        total_sesi += ts.total_sesi || 0;
      }
    });

    let total_sesi_jam, total_insentif;
    let durasi_satuan = 50;

    if (isKarya) {
      total_sesi_jam = `${total_karya} Karya`;
      total_insentif = total_karya * besaran_insentif;
      master_total_sesi += total_karya;
      master_total_insentif += total_insentif;
      durasi_satuan = 1;
    } else {
      const idKategori = mhs.tmst_project?.id_kategori;
      let rate_per_menit = 0;

      if (idKategori === 8) {
        rate_per_menit = 30000 / 60;
        durasi_satuan = 60;
      } else if (idKategori === 3) {
        rate_per_menit = 30000 / 50;
        durasi_satuan = 50;
      } else if (idKategori === 13) {
        rate_per_menit = 25000 / 60;
        durasi_satuan = 60;
      } else {
        const durasiFromDb = mhs.tmst_project?.tmst_kategori_magang?.tran_insentif?.durasi_satuan;
        durasi_satuan = durasiFromDb || 50;
        rate_per_menit = besaran_insentif / durasi_satuan;
      }

      const calculated_sesi = Math.round((total_menit / durasi_satuan) * 100) / 100;
      total_sesi_jam = calculated_sesi;
      total_insentif = Math.round(calculated_sesi * besaran_insentif);
      master_total_menit += total_menit;
      master_total_sesi += calculated_sesi;
      master_total_insentif += total_insentif;
    }

    return {
      no: idx + 1,
      nim,
      nama,
      nama_project: mhs.tmst_project.nama,
      kategori: mhs.tmst_project.tmst_kategori_magang?.kategori,
      id_kategori: mhs.tmst_project.id_kategori,
      durasi_default: mhs.tmst_project.durasi_default || 0,
      durasi_satuan,
      dateMap,
      total_menit: isKarya ? 0 : total_menit,
      total_sesi_jam,
      total_sesi: isKarya ? total_karya : total_sesi,
      total_insentif,
      isKarya,
    };
  });

  const total = {
    total_menit: master_total_menit,
    total_sesi_jam: Math.round((master_total_menit / 60) * 100) / 100,
    total_sesi: master_total_sesi,
    total_insentif: master_total_insentif,
  };

  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const monthName = monthNames[month - 1];
  const monthInfo = { month: monthName, year: currentYear };

  // For karya reports, create the expected summary structure
  if (reportType === 'karya') {
    const desainList = [];
    const videoList = [];
    let total_insentif_desain = 0;
    let total_insentif_video = 0;

    processedData.forEach(student => {
      if (student.isKarya) {
        const kategoriName = student.kategori || '';
        const projectName = student.nama_project || '';

        const lowerKategori = kategoriName.toLowerCase();
        const lowerProject = projectName.toLowerCase();

        const isAudioVisual = lowerProject.includes('audio visual') || lowerProject.includes('media audio visual') || lowerKategori.includes('audio visual') || lowerKategori.includes('media audio visual') || lowerProject.includes('media audio') || lowerKategori.includes('media audio');

        let isDesign = lowerKategori.includes('design') ||
          lowerProject.includes('design') ||
          lowerProject.includes('media visual') ||
          lowerProject.includes('media-visual') ||
          lowerProject.includes('media_visual') ||
          lowerProject.includes('poster') ||
          lowerKategori.includes('poster');

        const isVideo = lowerKategori.includes('video') ||
          lowerProject.includes('video') ||
          lowerKategori.includes('audio') ||
          lowerProject.includes('audio') ||
          isAudioVisual;

        if (!isDesign && !isVideo) {
          isDesign = true;
        }

        const dateEntries = [];
        if (student.dateMap) {
          Object.keys(student.dateMap).forEach(dateKey => {
            const count = student.dateMap[dateKey];
            if (count > 0) {
              dateEntries.push({
                tanggal: dateKey,
                jumlah: count
              });
            }
          });
        }

        const studentData = {
          nama: student.nama,
          nim: student.nim,
          desainCount: isDesign ? student.total_sesi : 0,
          totalDesainKeseluruhan: isDesign ? student.durasi_default : 0,
          videoCount: isVideo ? student.total_sesi : 0,
          videoInsentif: isVideo ? student.total_insentif : 0,
          desainInsentif: isDesign ? student.total_insentif : 0,
          dateEntries: dateEntries,
          dateMap: student.dateMap
        };

        if (isDesign) {
          desainList.push(studentData);
          total_insentif_desain += student.total_insentif;
        } else if (isVideo) {
          videoList.push(studentData);
          total_insentif_video += student.total_insentif;
        }
      }
    });

    const karyaSummary = {
      desainList,
      videoList,
      rekapSummary: {
        total_insentif_desain,
        total_insentif_video
      }
    };

    let lecturer = null;
    if (userId) {
      const lecturerData = await prismaClient.tmst_pengguna.findUnique({
        where: { id: userId },
        select: { id: true, nama: true, status: true },
      });
      if (lecturerData) {
        const jabatanFromFile = getLecturerJabatanFromFile(userId);
        lecturer = {
          id: lecturerData.id,
          nama: lecturerData.nama,
          status: lecturerData.status,
          jabatan: jabatanFromFile || 'Dosen Pembimbing',
        };
      }
    }

    return { data: processedData, total, headers, sortedDates, monthInfo, karyaSummary, lecturer };
  }

  let lecturer = null;
  if (userId) {
    const lecturerData = await prismaClient.tmst_pengguna.findUnique({
      where: { id: userId },
      select: { id: true, nama: true, status: true },
    });
    if (lecturerData) {
      const jabatanFromFile = getLecturerJabatanFromFile(userId);
      lecturer = {
        id: lecturerData.id,
        nama: lecturerData.nama,
        status: lecturerData.status,
        jabatan: jabatanFromFile || 'Dosen Pembimbing',
      };
    }
  }

  return { data: processedData, total, headers, sortedDates, monthInfo, lecturer };
};

const myProjectRecapPdf = async (request) => {
  const validated = validate(myProjectRecapValidation, request);
  const { userId, year } = validated;

  const userData = await prismaClient.tmst_pengguna.findUnique({
    where: { id: userId },
    select: {
      id: true,
      nama: true,
      departemen: true,
      status: true,
    },
  });

  if (!userData) {
    return { error: "User tidak ditemukan!" };
  }

  const user = {
    nama: userData.nama,
    nip: userData.id,
    jurusan: userData.departemen || '-',
  };

  // 1. Fetch Candidate Projects: Completed, owned by user, and active in the requested year.
  // We do NOT filter timesheets by date in the select to ensure we can calculate totals correctly later if needed,
  // but we use the 'where' clause to ensure we only pick projects relevant to this year.
  const candidates = await prismaClient.tmst_project.findMany({
    where: {
      pic: userId,
      id_status: STATUS.MASTER_PROJECT.COMPLETED,
      is_deleted: false,
      tran_project: {
        some: {
          tran_timesheet: {
            some: {
              tanggal: {
                gte: new Date(year, 0, 1),
                lt: new Date(year + 1, 0, 1),
              },
            },
          },
        },
      },
    },
    select: {
      id: true,
      nama: true,
      id_kategori: true,
      tanggal_mulai: true,
      tanggal_selesai: true,
      durasi_default: true,
      project_group_id: true, // Needed for cross-year logic
      tmst_kategori_magang: {
        select: {
          kategori: true,
          tran_insentif: {
            select: {
              besaran_insentif: true,
              durasi_satuan: true,
              id_satuan: true,
              tmst_satuan_insentif: {
                select: { satuan: true },
              },
            },
          },
        },
      },
      tran_project: {
        select: {
          id: true,
          id_peserta: true,
          tmst_pengguna: {
            select: {
              id: true,
              nama: true,
              departemen: true,
            },
          },
          tran_timesheet: {
            // Fetch ALL timesheets for calculations
            select: {
              total_sesi: true,
              tanggal: true,
              jam_mulai: true,
              jam_selesai: true,
            },
          },
        },
      },
    },
  });

  if (candidates.length === 0) {
    return { user, projects: [], error: null };
  }

  // 2. Fetch Siblings for Grouped Projects to check completeness and aggregate data
  const groupIds = candidates
    .map((p) => p.project_group_id)
    .filter((id) => id);

  const requestGroupIdSet = new Set(groupIds);
  let siblingsMap = {}; // project_group_id -> [projects]

  if (requestGroupIdSet.size > 0) {
    const siblings = await prismaClient.tmst_project.findMany({
      where: {
        project_group_id: { in: Array.from(requestGroupIdSet) },
        is_deleted: false,
      },
      select: {
        id: true,
        id_status: true,
        project_group_id: true,
        tran_project: {
          select: {
            id_peserta: true,
            tran_timesheet: {
              select: {
                total_sesi: true,
                tanggal: true,
                jam_mulai: true,
                jam_selesai: true,
              },
            },
          },
        },
      },
    });

    siblings.forEach((sib) => {
      if (!siblingsMap[sib.project_group_id]) {
        siblingsMap[sib.project_group_id] = [];
      }
      siblingsMap[sib.project_group_id].push(sib);
    });
  }

  const formatDate = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const yr = d.getFullYear();
    return `${day}/${month}/${yr}`;
  };

  const projects = [];

  for (const project of candidates) {
    let isValid = true;
    const studentTimesheets = new Map(); // id_peserta -> [timesheets]

    // Normalize student map with current project members
    project.tran_project.forEach((tp) => {
      if (!studentTimesheets.has(tp.id_peserta)) {
        studentTimesheets.set(tp.id_peserta, []);
      }
      // Initially add own timesheets (if not grouped, this is all we need)
      if (!project.project_group_id) {
        studentTimesheets.get(tp.id_peserta).push(...(tp.tran_timesheet || []));
      }
    });

    // Handle Grouping Logic
    if (project.project_group_id) {
      const group = siblingsMap[project.project_group_id] || [];

      // Check if ALL parts are completed
      const allCompleted = group.every((p) => p.id_status === STATUS.MASTER_PROJECT.COMPLETED);
      if (!allCompleted) {
        isValid = false;
      } else {
        // Aggregate timesheets from ALL siblings for the students in OUR project
        group.forEach((sib) => {
          sib.tran_project.forEach((tp) => {
            if (studentTimesheets.has(tp.id_peserta)) {
              studentTimesheets.get(tp.id_peserta).push(...(tp.tran_timesheet || []));
            }
          });
        });
      }
    }

    if (!isValid) continue;

    const insentifInfo = project.tmst_kategori_magang?.tran_insentif;
    const besaranInsentif = Number(insentifInfo?.besaran_insentif || 0);
    const durasiSatuan = Number(insentifInfo?.durasi_satuan || 50);
    const idSatuan = Number(insentifInfo?.id_satuan || 1);
    const isKarya = idSatuan === 2;
    const satuanText = isKarya ? 'karya' : 'jam';
    const isKategori7 = project.id_kategori === 7;

    let totalDurasiProject = 0;
    let totalInsentifProject = 0;

    const mahasiswaList = [];

    // Calculate totals per student using the aggregated timesheets
    project.tran_project.forEach((tp) => {
      const timesheets = studentTimesheets.get(tp.id_peserta) || [];
      let studentDurasi = 0;
      let studentInsentif = 0;

      timesheets.forEach((ts) => {
        if (isKarya) {
          const karyaCount = ts.total_sesi && ts.total_sesi > 0 ? ts.total_sesi : 1;
          studentDurasi += karyaCount;
        } else {
          if (ts.jam_mulai && ts.jam_selesai) {
            const start = moments(ts.jam_mulai, "YYYY-MM-DDTHH:mm:ss");
            const end = moments(ts.jam_selesai, "YYYY-MM-DDTHH:mm:ss");
            const diffMinutes = end.diff(start, 'minutes');
            studentDurasi += diffMinutes / 60;
          } else if (ts.total_sesi) {
            studentDurasi += (ts.total_sesi * durasiSatuan) / 60;
          }
        }
      });

      if (isKarya) {
        studentInsentif = Math.round(studentDurasi * besaranInsentif);
      } else {
        const totalSesi = (studentDurasi * 60) / Math.max(1, durasiSatuan);
        studentInsentif = Math.round(totalSesi * besaranInsentif);
      }

      totalDurasiProject += studentDurasi;
      totalInsentifProject += studentInsentif;

      mahasiswaList.push({
        nama: tp.tmst_pengguna?.nama || '-',
        nim: tp.tmst_pengguna?.id || '-',
        jurusan: tp.tmst_pengguna?.departemen || '-',
        durasi: isKarya ? Math.round(studentDurasi) : (studentDurasi % 1 === 0 ? studentDurasi.toString() : studentDurasi.toFixed(2).replace('.', ',')),
        insentif: studentInsentif,
      });
    });

    // Date range calculation (using aggregated timesheets dates if needed, or project dates)
    // If grouped, usually the project dates in DB (tanggal_mulai/selesai) are for THAT split.
    // The user might want the range for THIS year's part, which is what `project.tanggal_mulai` gives.
    // However, if we show TOTAL duration/incentive, showing the date range of just this part is acceptable
    // as it creates the context for "Recap 2026".
    // We keep `tanggal_mulai` and `tanggal_selesai` from the `project` record.

    let tanggalMulai = project.tanggal_mulai;
    let tanggalSelesai = project.tanggal_selesai;

    // Special logic for Kategori 7 (from original code)
    if (isKategori7) {
      // Collect all dates from aggregated timesheets? Or just this project's?
      // Original code used `allTimesheetDates` from `project.tran_project`.
      // Let's use dates from this specific project part to keep the "Year" context correct.
      const localTimesheets = project.tran_project.flatMap(tp => tp.tran_timesheet || []);
      const dates = localTimesheets.map(ts => new Date(ts.tanggal)).filter(d => !isNaN(d.getTime()));
      if (dates.length > 0) {
        dates.sort((a, b) => a - b);
        tanggalMulai = dates[0];
        tanggalSelesai = dates[dates.length - 1];
      }
    }

    projects.push({
      nama: project.nama,
      jenis: project.tmst_kategori_magang?.kategori || '-',
      durasi: isKarya ? Math.round(totalDurasiProject) : totalDurasiProject.toFixed(1).replace('.', ','),
      satuan: satuanText,
      insentif: totalInsentifProject,
      tanggal_mulai: formatDate(tanggalMulai),
      tanggal_selesai: formatDate(tanggalSelesai),
      mahasiswa: mahasiswaList,
    });
  }

  return { user, projects, error: null };
};

const projectRecapPdf = async (request) => {
  const validatePdf = validate(projectRecapValidation, request);

  const projectId = validatePdf.projectId;
  const month = validatePdf.month;
  const year = validatePdf.year;

  if (!projectId) {
    return { data: { error: "Project ID tidak ditemukan!" } };
  }

  const currentYear = parseInt(year) || new Date().getFullYear();
  const currentMonth = month ? parseInt(month) : null; // null = all months

  // Build optional date filter (only applied when month is provided)
  const timesheetDateFilter = currentMonth
    ? {
      gte: new Date(currentYear, currentMonth - 1, 1),
      lt: new Date(currentYear, currentMonth, 1),
    }
    : undefined;

  // Get project details
  const project = await prismaClient.tmst_project.findUnique({
    where: { id: parseInt(projectId) },
    select: {
      id: true,
      nama: true,
      inisial_project: true,
      durasi_default: true,
      id_kategori: true,
      pic: true,
      tmst_kategori_magang: {
        select: {
          kategori: true,
          tran_insentif: {
            select: {
              besaran_insentif: true,
              durasi_satuan: true,
              tmst_satuan_insentif: { select: { satuan: true } }
            }
          }
        }
      },
      tmst_pengguna: { select: { id: true, nama: true, status: true } }
    }
  });

  if (!project) {
    return { data: { error: "Project tidak ditemukan!" } };
  }

  // Get all students in this project with their timesheets
  // When fetching full project (no date filter), include all timesheets regardless of status
  // (for completed projects, status may be 6/COMPLETED instead of 1/APPROVED)
  // When filtering per-month, include both approved (1) and completed (6) timesheets
  const timesheetStatusFilter = timesheetDateFilter ? { id_status: { in: [1, 6] } } : {};

  const dataPdf = await prismaClient.tran_project.findMany({
    select: {
      id_project: true,
      tran_timesheet: {
        select: {
          jam_mulai: true,
          jam_selesai: true,
          tanggal: true,
          total_sesi: true,
        },
        where: {
          ...timesheetStatusFilter,
          ...(timesheetDateFilter ? { tanggal: timesheetDateFilter } : {}),
        },
      },
      tmst_project: {
        select: {
          id: true,
          nama: true,
        },
      },
      tmst_pengguna: { select: { id: true, nama: true } },
    },
    where: {
      tmst_project: { id: parseInt(projectId) },
      tran_timesheet: {
        some: {
          ...timesheetStatusFilter,
          ...(timesheetDateFilter ? { tanggal: timesheetDateFilter } : {}),
        },
      },
    },
  });

  console.log('Students with timesheets found:', dataPdf.length);

  // Debug: check first timesheet data
  if (dataPdf.length > 0 && dataPdf[0].tran_timesheet.length > 0) {
    console.log('Sample timesheet data:', {
      jam_mulai: dataPdf[0].tran_timesheet[0].jam_mulai,
      jam_selesai: dataPdf[0].tran_timesheet[0].jam_selesai,
      total_sesi: dataPdf[0].tran_timesheet[0].total_sesi,
      tanggal: dataPdf[0].tran_timesheet[0].tanggal
    });
  }

  if (!dataPdf || dataPdf.length === 0) {
    return { data: { error: "Tidak ada timesheet yang disetujui untuk project ini pada periode tersebut" } };
  }

  // Build date headers
  const tanggalSet = new Set();
  dataPdf.forEach(mhs => {
    mhs.tran_timesheet.forEach(ts => {
      const d = new Date(ts.tanggal);
      tanggalSet.add(d.toISOString().split('T')[0]);
    });
  });

  const sortedDates = Array.from(tanggalSet).sort();

  // Get durasi_satuan and besaran_insentif from project category
  const durasiSatuan = project.tmst_kategori_magang?.tran_insentif?.durasi_satuan || 50;
  const besaranInsentif = project.tmst_kategori_magang?.tran_insentif?.besaran_insentif || 0;
  const satuanStr = project.tmst_kategori_magang?.tran_insentif?.tmst_satuan_insentif?.satuan || '';
  const isKarya = satuanStr === 'Karya/Hasil Pekerjaan';

  // Build student data
  const studentsData = dataPdf.map((mhs, index) => {
    const dateMap = {};
    let totalMinutes = 0;
    let totalSesi = 0;
    let totalKarya = 0;

    mhs.tran_timesheet.forEach(ts => {
      const dateKey = new Date(ts.tanggal).toISOString().split('T')[0];

      if (isKarya) {
        const karyaCount = (ts.total_sesi && ts.total_sesi > 0) ? ts.total_sesi : 1;
        if (!dateMap[dateKey]) dateMap[dateKey] = 0;
        dateMap[dateKey] += karyaCount;
        totalKarya += karyaCount;
      } else {
        // Parse time using moments for consistency with userRecapPdf
        const startTime = moments(ts.jam_mulai, "YYYY-MM-DDTHH:mm:ss");
        const endTime = moments(ts.jam_selesai, "YYYY-MM-DDTHH:mm:ss");
        const diffInMinutes = moments.duration(endTime.diff(startTime)).asMinutes();

        const minutes = Math.floor(diffInMinutes);

        if (!dateMap[dateKey]) dateMap[dateKey] = 0;
        dateMap[dateKey] += minutes;
        totalMinutes += minutes;
        totalSesi += ts.total_sesi || 0;
      }
    });

    let totalSesiJam, totalInsentif;
    if (isKarya) {
      totalSesiJam = totalKarya;
      totalInsentif = totalKarya * besaranInsentif;
    } else {
      // Calculate total sesi based on durasi_satuan, rounded to 2 decimal places
      totalSesiJam = Math.round((totalMinutes / durasiSatuan) * 100) / 100;
      totalInsentif = Math.round(totalSesiJam * besaranInsentif);
    }

    return {
      no: index + 1,
      nama: mhs.tmst_pengguna.nama,
      nim: mhs.tmst_pengguna.id,
      dateMap,
      total_menit: isKarya ? 0 : totalMinutes,
      total_sesi_jam: totalSesiJam,
      total_insentif: totalInsentif,
      durasi_satuan: durasiSatuan,
      nama_project: project.nama
    };
  });

  // Calculate totals
  const total = {
    total_menit: studentsData.reduce((sum, s) => sum + s.total_menit, 0),
    total_sesi: Math.round(studentsData.reduce((sum, s) => sum + s.total_sesi_jam, 0) * 100) / 100,
    total_insentif: studentsData.reduce((sum, s) => sum + s.total_insentif, 0),
  };

  // Get lecturer signature
  const signatures = {};
  const lecturerSignatureFile = findSignatureFile('lecturer', crypto.createHash('sha256').update(`${project.nama}_${project.pic}_${currentMonth}`).digest('hex'));
  if (lecturerSignatureFile) {
    signatures.lecturer = loadImageAsDataUrl(lecturerSignatureFile.path);
  }

  // Get lecturer details
  const lecturer = project.tmst_pengguna ? {
    nama: project.tmst_pengguna.nama,
    id: project.tmst_pengguna.id,
    status: project.tmst_pengguna.status === 'STAF' ? 'STAF' : 'DOSEN'
  } : null;

  // Get jabatan name - check saved jabatan file first (from signature page)
  const jabatanFromFile = project.pic ? getLecturerJabatanFromFile(project.pic) : null;
  let jabatan;
  if (jabatanFromFile) {
    jabatan = jabatanFromFile;
  } else if (lecturer && lecturer.status === 'STAF') {
    jabatan = 'Staff';
  } else {
    jabatan = 'Dosen Pembimbing';
  }

  return {
    data: studentsData,
    sortedDates,
    total,
    signatures,
    lecturer,
    jabatan,
    projectName: project.nama,
    pic: project.pic,
    isKarya,
  };
};

const markAsReviewed = async (id_tran_project) => {
  const tranProject = await prismaClient.tran_project.findUnique({
    where: { id: Number(id_tran_project) },
  });

  if (!tranProject) {
    throw new ResponseError(404, "Project tidak ditemukan");
  }

  return await prismaClient.tran_project.update({
    where: { id: Number(id_tran_project) },
    data: { is_reviewed: true },
  });
};

export default {
  create,
  remove,
  removeMany,
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
  recapPdf,
  userRecapPdf,
  myProjectRecapPdf,
  projectRecapPdf,
  markAsReviewed,
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