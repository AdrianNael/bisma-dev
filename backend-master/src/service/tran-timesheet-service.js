import { validate } from "../validation/validation.js";
import {
  createTranTimesheetValidation,
  getId,
  getNIM,
  showAvailableTranTimesheetValidation,
  updateTranTimesheetValidation,
  generatePdfTimesheetValidation,
  getDataPdfTimesheetValidation,
  generateAllPdfValidation,
  searchTimesheetValidation,
  deleteManyValidation,
  submitPaymentValidation,
  getSubmitPaymentValidation,
} from "../validation/tran-timesheet-validation.js";
import { prismaClient } from "../application/database.js";
import mahasiswaService from "./mahasiswa-service.js";
import { ResponseError } from "../error/response-error.js";
import fs from "fs";
import path from "path";
import {
  eachWeekOfInterval,
  format,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { STATUS, LIMITS, SATUAN } from "../constants/index.js";

// helper functions
/**
 * Capitalize each word in a string
 */
const capitalizeEachWord = (str) =>
  str.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");

/**
 * Format date to YYYY-MM-DD string
 */
const formatDateString = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Format time to HH:MM string
 */
const formatTimeString = (date) => {
  const d = new Date(date);
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

/**
 * Get month key (YYYY-MM) from date
 */
const getMonthKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * Get start and end of month dates
 */
const getMonthRange = (year, month) => ({
  start: new Date(year, month - 1, 1),
  end: new Date(year, month, 1),
});

/**
 * Calculate allowed sessions based on hours and duration unit
 */
const calculateAllowedSesi = (hours, durasiSatuan) => (hours * 60) / Math.max(1, durasiSatuan);

/**
 * Check if project is karya-based
 */
const isKaryaProject = (idSatuan) => idSatuan === SATUAN.KARYA;

/**
 * Extract insentif configuration from project info
 */
const getInsentifConfig = (projectInfo) => {
  const insentif = projectInfo?.tmst_project?.tmst_kategori_magang?.tran_insentif;
  return {
    idSatuan: Number(insentif?.id_satuan || SATUAN.WAKTU),
    durasiSatuan: Number(insentif?.durasi_satuan || 50),
    besaranInsentif: Number(insentif?.besaran_insentif || 0),
  };
};

/**
 * Validate user has access to the timesheet/project
 * CRITICAL: This prevents unauthorized access
 */
const validateUserAccess = async (userId, tranProjectId) => {
  if (!userId) {
    throw new ResponseError(401, "User ID diperlukan");
  }

  const access = await prismaClient.tran_project.findFirst({
    where: {
      id: tranProjectId,
      id_peserta: userId,
    },
  });

  if (!access) {
    throw new ResponseError(403, "Anda tidak memiliki akses ke project ini");
  }

  return access;
};

/**
 * Validate timesheet belongs to user
 */
const validateTimesheetOwnership = async (timesheetId, userId, userRole = null) => {
  const timesheet = await prismaClient.tran_timesheet.findFirst({
    where: { id: timesheetId },
    select: {
      id: true,
      tran_project: {
        select: { id_peserta: true },
      },
    },
  });

  if (!timesheet) {
    throw new ResponseError(404, "Timesheet tidak ditemukan");
  }

  // Skip ownership validation if user is STAF/MANAGER/DIRMAWA
  const isStaffOrAdmin = userRole && ['STAF', 'MANAGER', 'DIRMAWA'].includes(userRole);

  if (!isStaffOrAdmin && timesheet.tran_project.id_peserta !== userId) {
    throw new ResponseError(403, "Anda tidak memiliki akses ke timesheet ini");
  }

  return timesheet;
};

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Batch fetch all required data for timesheet validation
 */
const fetchTimesheetValidationData = async (timesheet) => {
  const uniqueProjectIds = [...new Set(timesheet.map((t) => t.id_tran_project))];
  const uniqueActivityIds = [...new Set(timesheet.map((t) => t.id_kategori_kegiatan))];

  // Batch fetch project info
  const projectsData = await prismaClient.tran_project.findMany({
    where: { id: { in: uniqueProjectIds } },
    select: {
      id: true,
      durasi: true,
      id_peserta: true,
      tmst_project: {
        select: {
          nama: true,
          id_status: true,
          tmst_status_master_project: { select: { status: true } },
          tanggal_mulai: true,
          tanggal_selesai: true,
          durasi_default: true,
          tmst_kategori_magang: {
            select: {
              tran_insentif: { select: { id_satuan: true, durasi_satuan: true } },
            },
          },
        },
      },
    },
  });

  const projectInfoMap = new Map(projectsData.map((p) => [p.id, p]));

  // Batch fetch existing karya counts
  const karyaCountsRaw = await prismaClient.tran_timesheet.groupBy({
    by: ["id_tran_project"],
    where: { id_tran_project: { in: uniqueProjectIds } },
    _count: { id: true },
  });
  const existingKaryaCounts = new Map(karyaCountsRaw.map((r) => [r.id_tran_project, r._count.id]));

  // Batch validate activities
  const existingActivities = await prismaClient.tmst_kategori_kegiatan.findMany({
    where: { id: { in: uniqueActivityIds } },
    select: { id: true },
  });
  const validActivityIds = new Set(existingActivities.map((a) => a.id));

  // Batch fetch existing hours
  const totalHoursRaw = await prismaClient.tran_timesheet.groupBy({
    by: ["id_tran_project"],
    where: { id_tran_project: { in: uniqueProjectIds } },
    _sum: { total_sesi: true },
  });
  const existingHoursPerProject = new Map(
    totalHoursRaw.map((r) => [r.id_tran_project, Number(r._sum?.total_sesi || 0)])
  );

  // Build month ranges for time limit validation
  const monthRanges = new Map();
  timesheet.forEach((data) => {
    const tanggal = new Date(data.tanggal);
    const monthKey = `${data.id_tran_project}_${tanggal.getFullYear()}_${tanggal.getMonth()}`;
    if (!monthRanges.has(monthKey)) {
      const { start, end } = getMonthRange(tanggal.getFullYear(), tanggal.getMonth() + 1);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      monthRanges.set(monthKey, {
        id_tran_project: data.id_tran_project,
        awalBulan: start,
        akhirBulan: end,
      });
    }
  });

  // Batch fetch existing timesheets for month ranges
  const allExistingTimesheets = await prismaClient.tran_timesheet.findMany({
    where: {
      OR: Array.from(monthRanges.values()).map((r) => ({
        id_tran_project: r.id_tran_project,
        tanggal: { gte: r.awalBulan, lte: r.akhirBulan },
      })),
    },
    select: { id_tran_project: true, tanggal: true, total_sesi: true },
  });

  // Group by month
  const existingTimesheetsByMonth = new Map();
  allExistingTimesheets.forEach((ts) => {
    const d = new Date(ts.tanggal);
    const key = `${ts.id_tran_project}_${d.getFullYear()}_${d.getMonth()}`;
    if (!existingTimesheetsByMonth.has(key)) {
      existingTimesheetsByMonth.set(key, []);
    }
    existingTimesheetsByMonth.get(key).push(ts);
  });

  return {
    projectInfoMap,
    existingKaryaCounts,
    validActivityIds,
    existingHoursPerProject,
    existingTimesheetsByMonth,
  };
};

/**
 * Validate karya limits for karya-based projects
 */
const validateKaryaLimits = (timesheet, projectInfoMap, existingKaryaCounts) => {
  const checkedProjects = new Set();

  for (const data of timesheet) {
    if (checkedProjects.has(data.id_tran_project)) continue;
    checkedProjects.add(data.id_tran_project);

    const projectInfo = projectInfoMap.get(data.id_tran_project);
    if (!projectInfo) {
      throw new ResponseError(404, "Project tidak ditemukan!");
    }

    const { idSatuan } = getInsentifConfig(projectInfo);
    const maxKarya = Number(projectInfo.durasi || 0);

    if (isKaryaProject(idSatuan) && maxKarya > 0) {
      const existingCount = existingKaryaCounts.get(data.id_tran_project) || 0;
      const newEntries = timesheet.filter((t) => t.id_tran_project === data.id_tran_project).length;
      const totalKarya = existingCount + newEntries;

      if (totalKarya > maxKarya) {
        throw new ResponseError(
          400,
          `Jumlah karya melebihi batas maksimal. Maksimal: ${maxKarya}, sudah tercatat: ${existingCount}, akan ditambah: ${newEntries}.`
        );
      }
    }
  }
};

/**
 * Validate project duration limits (durasi_default)
 */
const validateDurationLimits = (timesheet, projectInfoMap, existingHoursPerProject) => {
  const checkedProjects = new Set();

  for (const data of timesheet) {
    if (checkedProjects.has(data.id_tran_project)) continue;
    checkedProjects.add(data.id_tran_project);

    const projectInfo = projectInfoMap.get(data.id_tran_project);
    if (!projectInfo) continue;

    const { idSatuan, durasiSatuan } = getInsentifConfig(projectInfo);
    const durasiDefault = Number(projectInfo.tmst_project?.durasi_default || 0);

    if (!isKaryaProject(idSatuan) && durasiDefault > 0) {
      const existingSesi = existingHoursPerProject.get(data.id_tran_project) || 0;
      const newEntries = timesheet.filter((t) => t.id_tran_project === data.id_tran_project);
      const newSesi = newEntries.reduce((sum, t) => sum + Number(t.total_sesi || 0), 0);

      const existingHours = (existingSesi * durasiSatuan) / 60;
      const newHours = (newSesi * durasiSatuan) / 60;
      const totalHours = existingHours + newHours;

      if (totalHours > durasiDefault) {
        throw new ResponseError(
          400,
          `Total jam melebihi batas project. Maksimal: ${durasiDefault} jam, sudah tercatat: ${existingHours.toFixed(1)} jam, akan ditambah: ${newHours.toFixed(1)} jam.`
        );
      }
    }
  }
};

/**
 * Validate time limits (daily/weekly/monthly)
 */
const validateTimeLimits = (timesheet, projectInfoMap, existingTimesheetsByMonth) => {
  for (const data of timesheet) {
    const projectInfo = projectInfoMap.get(data.id_tran_project);
    const tanggal = new Date(data.tanggal);
    tanggal.setHours(0, 0, 0, 0);

    const { idSatuan, durasiSatuan } = getInsentifConfig(projectInfo);
    const isKarya = isKaryaProject(idSatuan);

    const allowedDaily = isKarya ? LIMITS.DAILY_HOURS : calculateAllowedSesi(LIMITS.DAILY_HOURS, durasiSatuan);
    const allowedWeekly = isKarya ? LIMITS.WEEKLY_HOURS : calculateAllowedSesi(LIMITS.WEEKLY_HOURS, durasiSatuan);
    const allowedMonthly = isKarya ? LIMITS.MONTHLY_HOURS : calculateAllowedSesi(LIMITS.MONTHLY_HOURS, durasiSatuan);

    const monthKey = `${data.id_tran_project}_${tanggal.getFullYear()}_${tanggal.getMonth()}`;
    const allThisMonth = existingTimesheetsByMonth.get(monthKey) || [];

    // Daily validation
    const totalDaily =
      allThisMonth
        .filter((t) => {
          const tgl = new Date(t.tanggal);
          tgl.setHours(0, 0, 0, 0);
          return tgl.getTime() === tanggal.getTime();
        })
        .reduce((sum, t) => sum + Number(t.total_sesi || 0), 0) + Number(data.total_sesi || 0);

    if (totalDaily > allowedDaily) {
      throw new ResponseError(400, `Total jam pada tanggal ${tanggal.toDateString()} melebihi ${LIMITS.DAILY_HOURS} jam.`);
    }

    // Weekly validation
    const startOfWeekIdx = tanggal.getDate() - tanggal.getDay();
    const awalMinggu = new Date(tanggal);
    awalMinggu.setDate(startOfWeekIdx);
    awalMinggu.setHours(0, 0, 0, 0);
    const akhirMinggu = new Date(awalMinggu);
    akhirMinggu.setDate(awalMinggu.getDate() + 6);
    akhirMinggu.setHours(23, 59, 59, 999);

    const totalWeekly =
      allThisMonth
        .filter((t) => {
          const tgl = new Date(t.tanggal);
          tgl.setHours(0, 0, 0, 0);
          return tgl >= awalMinggu && tgl <= akhirMinggu;
        })
        .reduce((sum, t) => sum + Number(t.total_sesi || 0), 0) + Number(data.total_sesi || 0);

    if (totalWeekly > allowedWeekly) {
      throw new ResponseError(
        400,
        `Total jam pada minggu ${awalMinggu.toDateString()} - ${akhirMinggu.toDateString()} melebihi ${LIMITS.WEEKLY_HOURS} jam.`
      );
    }

    // Monthly validation
    const totalMonthly =
      allThisMonth.reduce((sum, t) => sum + Number(t.total_sesi || 0), 0) + Number(data.total_sesi || 0);

    if (totalMonthly > allowedMonthly) {
      throw new ResponseError(
        400,
        `Total jam pada bulan ${tanggal.getMonth() + 1}/${tanggal.getFullYear()} melebihi ${LIMITS.MONTHLY_HOURS} jam.`
      );
    }
  }
};

/**
 * Validate project status and date range
 */
const validateProjectConstraints = (timesheet, projectInfoMap, validActivityIds, existingTimesheetsByMonth, allowExistingMonth = false) => {
  for (const data of timesheet) {
    // Activity validation
    if (!validActivityIds.has(data.id_kategori_kegiatan)) {
      throw new ResponseError(404, "Aktifitas tidak ditemukan!");
    }

    const projectInfo = projectInfoMap.get(data.id_tran_project);
    if (!projectInfo) {
      throw new ResponseError(404, "Project tidak ditemukan!");
    }

    // Project sudah pasti approved karena data dimuat dari endpoint yang sudah difilter

    // Date range validation
    const { tanggal_mulai, tanggal_selesai } = projectInfo.tmst_project;
    if (tanggal_mulai && tanggal_selesai) {
      // Compare dates only (YYYY-MM-DD format), ignoring time and timezone
      const getDateString = (date) => {
        const d = new Date(date);
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      };

      const timesheetDateStr = getDateString(data.tanggal);
      const startDateStr = getDateString(tanggal_mulai);
      const endDateStr = getDateString(tanggal_selesai);

      if (timesheetDateStr < startDateStr || timesheetDateStr > endDateStr) {
        throw new ResponseError(400, `Tanggal timesheet harus berada dalam rentang waktu pelaksanaan project! (${startDateStr} s/d ${endDateStr})`);
      }
    }

    // Month constraint validation (only for new creates, not updates)
    if (!allowExistingMonth) {
      const tanggal = new Date(data.tanggal);
      const monthKey = `${data.id_tran_project}_${tanggal.getFullYear()}_${tanggal.getMonth()}`;
      const existingInMonth = existingTimesheetsByMonth.get(monthKey) || [];

      if (existingInMonth.length > 0) {
        throw new ResponseError(409, "Gagal membuat timesheet, memiliki keterkaitan dengan bulan pada data sebelumnya");
      }
    }
  }
};

/**
 * Full validation pipeline for timesheet creation
 */
const validateTimesheetCreation = async (timesheet, userId, allowExistingMonth = false, userRole = null) => {
  const validationData = await fetchTimesheetValidationData(timesheet);
  const { projectInfoMap, existingKaryaCounts, validActivityIds, existingHoursPerProject, existingTimesheetsByMonth } =
    validationData;

  // Validate user has access to all projects
  // Skip validation if user is STAF/MANAGER/DIRMAWA (they can update student timesheets)
  const isStaffOrAdmin = userRole && ['STAF', 'MANAGER', 'DIRMAWA'].includes(userRole);

  if (!isStaffOrAdmin) {
    for (const data of timesheet) {
      const projectInfo = projectInfoMap.get(data.id_tran_project);
      if (projectInfo && projectInfo.id_peserta !== userId) {
        throw new ResponseError(403, "Anda tidak memiliki akses ke project ini");
      }
    }
  }

  validateKaryaLimits(timesheet, projectInfoMap, existingKaryaCounts);
  validateDurationLimits(timesheet, projectInfoMap, existingHoursPerProject);
  validateTimeLimits(timesheet, projectInfoMap, existingTimesheetsByMonth);
  validateProjectConstraints(timesheet, projectInfoMap, validActivityIds, existingTimesheetsByMonth, allowExistingMonth);

  return validationData;
};

// ============================================================================
// PDF GENERATION HELPERS
// ============================================================================

/**
 * Calculate insentif for a timesheet row
 */
const calculateRowInsentif = (row) => {
  const insentifData = row.tran_project?.tmst_project?.tmst_kategori_magang?.tran_insentif;
  if (!insentifData) return 0;

  const besaranInsentif = Number(insentifData.besaran_insentif) || 0;
  const idSatuan = insentifData.id_satuan;
  const durasiSatuan = Number(insentifData.durasi_satuan) || 1;

  if (idSatuan === SATUAN.KARYA) {
    return Math.round(besaranInsentif / durasiSatuan);
  } else if (idSatuan === SATUAN.WAKTU) {
    const jamMulai = new Date(row.jam_mulai);
    const jamSelesai = new Date(row.jam_selesai);
    const durasiMenit = (jamSelesai - jamMulai) / (1000 * 60);
    return Math.round((durasiMenit / durasiSatuan) * besaranInsentif);
  }

  return besaranInsentif;
};

/**
 * Transform timesheet row for PDF output
 */
const transformPdfRow = (data, paymentUrl) => {
  const transformed = { ...data };

  transformed.NIM = data.tran_project.tmst_pengguna.id;
  transformed.nama = capitalizeEachWord(data.tran_project.tmst_pengguna.nama);
  transformed.departemen = data.tran_project.tmst_pengguna.departemen;
  transformed.status = data.tran_project.tmst_pengguna.status || null;
  transformed.nama_project = data.tran_project.tmst_project.nama;
  transformed.inisial_project = data.tran_project.tmst_project.inisial_project;
  transformed.kegiatan = data.tmst_kategori_kegiatan.kegiatan;
  transformed.kategori_magang = data.tran_project.tmst_project.tmst_kategori_magang.kategori;
  transformed.kategoriId = data.tran_project.tmst_project.tmst_kategori_magang.id || null;
  transformed.tempat_magang = data.tran_project.tmst_project.tempat_magang;
  transformed.pic_jabatan = data.tran_project.tmst_project.pic_jabatan || null;

  const insentifData = data.tran_project?.tmst_project?.tmst_kategori_magang?.tran_insentif;
  if (insentifData) {
    transformed.satuan = insentifData.tmst_satuan_insentif?.satuan || "";
    transformed.besaran_insentif = Number(insentifData.besaran_insentif) || 0;
    transformed.id_satuan = insentifData.id_satuan;
    transformed.durasi_satuan = Number(insentifData.durasi_satuan) || 1;
    transformed.jumlah_insentif = calculateRowInsentif(data);

    // Calculate hours from sessions
    // For id_satuan = 1 (time-based): hours = (sessions * durasi_satuan) / 60
    // For id_satuan = 2 (per karya): keep as is (karya count)
    if (transformed.id_satuan === 1) {
      transformed.jam_kerja = (Number(data.total_sesi || 0) * transformed.durasi_satuan) / 60;
    } else {
      transformed.jam_kerja = Number(data.total_sesi || 0); // For karya, show count
    }
  } else {
    transformed.jam_kerja = 0;
  }

  transformed.tanggal = formatDateString(data.tanggal);
  transformed.jam_mulai = formatTimeString(data.jam_mulai);
  transformed.jam_selesai = formatTimeString(data.jam_selesai);
  transformed.url_file_sp3 = paymentUrl ? [paymentUrl] : [];

  delete transformed.tran_project;
  delete transformed.tmst_kategori_kegiatan;

  return transformed;
};

/**
 * Load karya images for PDF (with path sanitization)
 */
const loadKaryaImages = (dataPdf) => {
  const karyaDir = path.join(process.cwd(), "documents", "karya");

  if (!fs.existsSync(karyaDir)) return;

  const allKaryaFiles = fs.readdirSync(karyaDir);
  const allowedExtensions = [".png", ".jpg", ".jpeg", ".gif", ".bmp"];

  // Build prefix -> files map
  const matchedMap = new Map();
  allKaryaFiles.forEach((fn) => {
    const ext = path.extname(fn).toLowerCase();
    if (!allowedExtensions.includes(ext)) return;

    // Sanitize: ensure filename doesn't contain path traversal
    if (fn.includes("..") || fn.includes("/") || fn.includes("\\")) return;

    const parts = fn.split("_");
    if (parts.length < 4) return;

    const prefix = `${parts[0]}_${parts[1]}_${parts[2]}_`;
    if (!matchedMap.has(prefix)) matchedMap.set(prefix, []);
    matchedMap.get(prefix).push(fn);
  });

  // Sort for deterministic ordering
  for (const arr of matchedMap.values()) {
    arr.sort();
  }

  const assignmentIndex = {};
  dataPdf.forEach((data) => {
    const prefix = `${data.inisial_project || data.nama_project || ""}_${data.tanggal}_${data.NIM || ""}_`;
    const matched = matchedMap.get(prefix) || [];

    if (matched.length) {
      const idx = assignmentIndex[prefix] || 0;
      const fn = matched[idx % matched.length];

      // Additional path sanitization
      const filePath = path.join(karyaDir, path.basename(fn));
      if (fs.existsSync(filePath) && filePath.startsWith(karyaDir)) {
        const buffer = fs.readFileSync(filePath);
        const b64 = buffer.toString("base64");
        const extName = path.extname(fn).slice(1).toLowerCase();
        data.url_file_sp3 = [`data:image/${extName};base64,${b64}`];
      }
      assignmentIndex[prefix] = idx + 1;
    }
  });
};

/**
 * Calculate week ranges for a month
 */
const calculateMonthWeeks = async (projectName, targetYear, inputMonth) => {
  const endOfMonthDate = endOfMonth(new Date(targetYear, inputMonth - 1));
  const endOfMonthDay = endOfMonthDate.getDate();

  let anchorDay = 1;
  const proj = await prismaClient.tmst_project.findFirst({
    where: { nama: projectName },
    select: { tanggal_mulai: true },
  });

  if (proj?.tanggal_mulai) {
    const psd = new Date(proj.tanggal_mulai);
    if (psd.getFullYear() === targetYear && psd.getMonth() + 1 === inputMonth) {
      anchorDay = psd.getDate();
    }
  }

  const monthWeeks = [];
  for (let i = 0; i < 4; i++) {
    const startDay = anchorDay + i * 7;
    if (startDay > endOfMonthDay) break;
    const endDay = Math.min(endOfMonthDay, startDay + 6);
    const s = new Date(targetYear, inputMonth - 1, startDay);
    const e = new Date(targetYear, inputMonth - 1, endDay);
    monthWeeks.push({ awal: format(s, "yyyy-MM-dd"), akhir: format(e, "yyyy-MM-dd") });
  }

  return monthWeeks;
};

// ============================================================================
// MAIN SERVICE FUNCTIONS
// ============================================================================

const create = async (request, userId, userRole = null) => {
  if (!userId) {
    throw new ResponseError(401, "User ID diperlukan");
  }

  const timesheet = validate(createTranTimesheetValidation, request);
  await validateTimesheetCreation(timesheet, userId, false, userRole);

  // Batch insert
  const dataToCreate = timesheet.map((data) => ({
    ...data,
    link_output: data.link_output || null,
    id_status: 4, // Set default status to "Waiting For Approval"
  }));

  await prismaClient.tran_timesheet.createMany({ data: dataToCreate });

  // Get created IDs
  const uniqueProjectIds = [...new Set(timesheet.map((t) => t.id_tran_project))];
  const createdTimesheets = await prismaClient.tran_timesheet.findMany({
    where: {
      id_tran_project: { in: uniqueProjectIds },
      tanggal: { in: timesheet.map((t) => new Date(t.tanggal)) },
    },
    select: { id: true },
    orderBy: { id: "desc" },
    take: timesheet.length,
  });

  return { createdIds: createdTimesheets.map((t) => t.id) };
};

const remove = async (timesheetId, userId, userRole = null) => {
  timesheetId = validate(getId, timesheetId);

  // Validate ownership
  await validateTimesheetOwnership(timesheetId, userId, userRole);

  // Delete history first
  await prismaClient.timesheet_status_history.deleteMany({
    where: { id_timesheet: timesheetId },
  });

  return prismaClient.tran_timesheet.delete({
    where: { id: timesheetId },
  });
};

const update = async (request, userId, userRole = null) => {
  const timesheet = validate(updateTranTimesheetValidation, request);

  // Validate ownership
  const existing = await prismaClient.tran_timesheet.findUnique({
    where: { id: timesheet.id },
    select: {
      id_status: true,
      tanggal: true,
      tran_project: {
        select: { id_project: true, id_peserta: true },
      },
    },
  });

  if (!existing) {
    throw new ResponseError(404, "Timesheet tidak ditemukan");
  }

  // Skip ownership validation if user is STAF/MANAGER/DIRMAWA
  const isStaffOrAdmin = userRole && ['STAF', 'MANAGER', 'DIRMAWA'].includes(userRole);

  if (!isStaffOrAdmin && existing.tran_project.id_peserta !== userId) {
    throw new ResponseError(403, "Anda tidak memiliki akses ke timesheet ini");
  }

  const updateData = {
    id_kategori_kegiatan: timesheet.id_kategori_kegiatan,
    id_tran_project: timesheet.id_tran_project,
    jam_mulai: timesheet.jam_mulai,
    jam_selesai: timesheet.jam_selesai,
    deskripsi: timesheet.deskripsi,
    total_sesi: timesheet.total_sesi,
    link_output: timesheet.link_output || null,
  };

  // Auto-update status if revision required
  let shouldUpdatePayment = false;
  if (existing.id_status === STATUS.TIMESHEET.REVISION_REQUIRED) {
    // When student resubmits after revision, change to REVISED
    updateData.id_status = STATUS.TIMESHEET.REVISED;
    shouldUpdatePayment = true;
  }

  const result = await prismaClient.tran_timesheet.update({
    where: { id: timesheet.id },
    data: updateData,
    select: {
      id: true,
      id_kategori_kegiatan: true,
      id_tran_project: true,
      tanggal: true,
      jam_mulai: true,
      jam_selesai: true,
      deskripsi: true,
      total_sesi: true,
      link_output: true,
      id_status: true,
    },
  });

  // Update payment status if needed
  if (shouldUpdatePayment && existing.tran_project) {
    const projectId = existing.tran_project.id_project;
    const periode = getMonthKey(existing.tanggal);

    await prismaClient.tran_payment.updateMany({
      where: {
        id_tmst_project: projectId,
        periode,
        id_status: STATUS.PAYMENT.ON_REVISION,
      },
      data: { id_status: STATUS.PAYMENT.REVISED },
    }).catch(() => { }); // Don't fail if payment update fails
  }

  return result;
};

const updateStatus = async (userId, month, year, newStatus, projectId = null) => {
  const { start, end } = getMonthRange(year, month);

  const whereClause = {
    tran_project: { id_peserta: userId },
    tanggal: { gte: start, lt: end },
  };

  if (projectId) {
    whereClause.tran_project.id_project = projectId;
  }

  const result = await prismaClient.tran_timesheet.updateMany({
    where: whereClause,
    data: { id_status: newStatus },
  });

  if (result.count === 0) {
    throw new ResponseError(404, `Timesheet untuk ${month}/${year} tidak ditemukan`);
  }

  return result;
};

const list = async () => {
  return prismaClient.tran_timesheet.findMany({
    select: {
      id: true,
      id_kategori_kegiatan: true,
      id_tran_project: true,
      tanggal: true,
      jam_mulai: true,
      jam_selesai: true,
      deskripsi: true,
      total_sesi: true,
    },
  });
};

const show = async (userId) => {
  if (!userId) {
    throw new ResponseError(401, "User ID diperlukan");
  }

  const data = await prismaClient.tran_timesheet.findMany({
    select: {
      id: true,
      tanggal: true,
      jam_mulai: true,
      jam_selesai: true,
      deskripsi: true,
      total_sesi: true,
      tran_project: {
        select: {
          tmst_project: {
            select: {
              nama: true,
              tempat_magang: true,
              tmst_pengguna: { select: { nama: true } },
              tmst_kategori_magang: { select: { kategori: true } },
            },
          },
        },
      },
    },
    where: {
      tran_project: { id_peserta: userId },
    },
  });

  return data.map((item) => ({
    id: item.id,
    tanggal: item.tanggal,
    jam_mulai: item.jam_mulai,
    jam_selesai: item.jam_selesai,
    deskripsi: item.deskripsi,
    total_sesi: item.total_sesi,
    nama_project: item.tran_project.tmst_project.nama,
    tempat_magang: item.tran_project.tmst_project.tempat_magang,
    nama: item.tran_project.tmst_project.tmst_pengguna.nama,
    kategori: item.tran_project.tmst_project.tmst_kategori_magang.kategori,
  }));
};

const availableStudent = async (request) => {
  request = validate(showAvailableTranTimesheetValidation, request);

  const { page = 1, size = 10, nama, nim, keyword, prodi, month } = request;
  const skip = (page - 1) * size;
  const effectiveMonth = String(month || request.periode || "").trim();

  const whereClause = {
    status: "MAHASISWA",
    AND: [prodi ? { departemen: { contains: prodi } } : {}],
  };

  if (keyword) {
    whereClause.AND.push({
      OR: [{ nama: { contains: keyword } }, { id: { contains: keyword } }],
    });
  } else {
    if (nama) whereClause.AND.push({ nama: { contains: nama } });
    if (nim) whereClause.AND.push({ id: { startsWith: nim } });
  }

  const [rows, totalItems] = await Promise.all([
    prismaClient.tmst_pengguna.findMany({
      where: whereClause,
      select: { id: true, nama: true, departemen: true, no_telp: true },
      orderBy: { nama: "asc" },
      skip,
      take: size,
    }),
    prismaClient.tmst_pengguna.count({ where: whereClause }),
  ]);

  // Batch fetch quotas
  const mahasiswaIds = rows.map((mhs) => mhs.id);
  const quotaMap = await mahasiswaService.getBatchMonthlyQuota(mahasiswaIds, effectiveMonth || null);

  const data = rows.map((mhs) => {
    const quota = quotaMap.get(mhs.id) || { remaining: LIMITS.MONTHLY_HOURS };
    return {
      departemen: mhs.departemen,
      nama: mhs.nama,
      id: mhs.id,
      sisa_sesi: quota.remaining,
      no_telp: mhs.no_telp,
    };
  });

  return {
    data,
    paging: {
      page,
      total_item: totalItems,
      total_page: Math.ceil(totalItems / size),
    },
  };
};

const showEdit = async (timesheetId, userId) => {
  timesheetId = validate(getId, timesheetId);

  if (!userId) {
    throw new ResponseError(401, "User ID diperlukan");
  }

  const data = await prismaClient.tran_timesheet.findFirst({
    select: {
      id: true,
      id_kategori_kegiatan: true,
      id_tran_project: true,
      tanggal: true,
      jam_mulai: true,
      jam_selesai: true,
      deskripsi: true,
      total_sesi: true,
      tran_project: {
        select: {
          id_peserta: true,
          tmst_project: {
            select: {
              nama: true,
              tmst_pengguna: { select: { nama: true } },
              tmst_kategori_magang: {
                select: {
                  kategori: true,
                  tran_insentif: { select: { durasi_satuan: true } },
                },
              },
            },
          },
        },
      },
    },
    where: { id: timesheetId },
  });

  if (!data) {
    throw new ResponseError(404, "Timesheet tidak ditemukan");
  }

  // Validate ownership
  if (data.tran_project.id_peserta !== userId) {
    throw new ResponseError(403, "Anda tidak memiliki akses ke timesheet ini");
  }

  return {
    id: data.id,
    id_kategori_kegiatan: data.id_kategori_kegiatan,
    id_tran_project: data.id_tran_project,
    tanggal: data.tanggal,
    jam_mulai: data.jam_mulai,
    jam_selesai: data.jam_selesai,
    deskripsi: data.deskripsi,
    total_sesi: data.total_sesi,
    pic: data.tran_project.tmst_project.tmst_pengguna.nama,
    nama_project: data.tran_project.tmst_project.nama,
    durasi_satuan: data.tran_project.tmst_project.tmst_kategori_magang.tran_insentif.durasi_satuan,
    kategori: data.tran_project.tmst_project.tmst_kategori_magang.kategori,
  };
};

const checkAvailable = async (userId) => {
  if (!userId) {
    throw new ResponseError(401, "User ID diperlukan");
  }

  const timesheets = await prismaClient.tran_timesheet.findMany({
    where: {
      tran_project: { id_peserta: userId },
    },
    select: { tanggal: true, total_sesi: true },
  });

  // Group by month
  const monthlyTotals = {};
  timesheets.forEach((ts) => {
    const month = new Date(ts.tanggal).getMonth() + 1;
    monthlyTotals[month] = (monthlyTotals[month] || 0) + Number(ts.total_sesi || 0);
  });

  // Build result for all 12 months
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const used = monthlyTotals[month] || 0;
    return {
      month,
      sisa_sesi: Math.max(0, LIMITS.MONTHLY_HOURS - used),
    };
  });
};

const selectAvailable = async (request) => {
  const id_pengguna = validate(getNIM, request);

  const pengguna = await prismaClient.tmst_pengguna.findFirst({
    where: { id: id_pengguna, status: "MAHASISWA" },
    select: { id: true, nama: true, departemen: true, no_telp: true },
  });

  if (!pengguna) {
    throw new ResponseError(404, "Pengguna tidak ditemukan");
  }

  // Calculate total used sessions
  const timesheets = await prismaClient.tran_timesheet.findMany({
    where: {
      tran_project: { id_peserta: id_pengguna },
    },
    select: { total_sesi: true },
  });

  const totalUsed = timesheets.reduce((sum, ts) => sum + Number(ts.total_sesi || 0), 0);
  const sisaSesi = Math.max(0, LIMITS.MONTHLY_HOURS - totalUsed);

  return {
    id: pengguna.id,
    nama: pengguna.nama,
    departemen: pengguna.departemen,
    sisa_sesi: sisaSesi,
    no_telp: pengguna.no_telp,
  };
};

const generatePdfTimesheet = async (request) => {
  const validatePdf = request.option
    ? validate(generatePdfTimesheetValidation, request)
    : validate(getDataPdfTimesheetValidation, request);

  // Validate user exists
  const userExists = await prismaClient.tmst_pengguna.findFirst({
    where: { id: validatePdf.id_pengguna },
  });

  if (!userExists) {
    return { data: { error: "Pengguna tidak ditemukan!" } };
  }

  const currentYear = new Date().getFullYear();
  const targetYear = validatePdf.year || currentYear;
  const { start: startMonthDate, end: endMonthDate } = getMonthRange(targetYear, validatePdf.month);

  // Fetch timesheet data
  let dataPdf = await prismaClient.tran_timesheet.findMany({
    select: {
      tanggal: true,
      jam_mulai: true,
      jam_selesai: true,
      deskripsi: true,
      total_sesi: true,
      link_output: true,
      tmst_kategori_kegiatan: { select: { kegiatan: true } },
      tran_project: {
        select: {
          id: true,
          estimasi: true,
          tmst_project: {
            select: {
              nama: true,
              inisial_project: true,
              pic: true,
              tempat_magang: true,
              pic_jabatan: true,
              tmst_kategori_magang: {
                select: {
                  id: true,
                  kategori: true,
                  tran_insentif: {
                    select: {
                      besaran_insentif: true,
                      id_satuan: true,
                      durasi_satuan: true,
                      tmst_satuan_insentif: { select: { satuan: true } },
                    },
                  },
                },
              },
            },
          },
          tmst_pengguna: {
            select: { id: true, nama: true, departemen: true, status: true },
          },
        },
      },
    },
    where: {
      tran_project: {
        tmst_project: { nama: validatePdf.project },
        tmst_pengguna: { id: validatePdf.id_pengguna },
      },
      tanggal: { gte: startMonthDate, lt: endMonthDate },
    },
    orderBy: { tanggal: "asc" },
  });

  // If no timesheets found for this month but a payment exists for the period,
  // fetch ALL timesheets for the project/student (dates may differ from payment period)
  if (dataPdf.length === 0) {
    const periodeCheck = `${targetYear}-${String(validatePdf.month).padStart(2, "0")}`;
    const paymentExists = await prismaClient.tran_payment.findFirst({
      where: {
        periode: periodeCheck,
        tmst_project: { nama: validatePdf.project },
      },
      select: { id: true },
    }).catch(() => null);

    if (paymentExists) {
      dataPdf = await prismaClient.tran_timesheet.findMany({
        select: {
          tanggal: true,
          jam_mulai: true,
          jam_selesai: true,
          deskripsi: true,
          total_sesi: true,
          link_output: true,
          tmst_kategori_kegiatan: { select: { kegiatan: true } },
          tran_project: {
            select: {
              id: true,
              estimasi: true,
              tmst_project: {
                select: {
                  nama: true,
                  inisial_project: true,
                  pic: true,
                  tempat_magang: true,
                  pic_jabatan: true,
                  tmst_kategori_magang: {
                    select: {
                      id: true,
                      kategori: true,
                      tran_insentif: {
                        select: {
                          besaran_insentif: true,
                          id_satuan: true,
                          durasi_satuan: true,
                          tmst_satuan_insentif: { select: { satuan: true } },
                        },
                      },
                    },
                  },
                },
              },
              tmst_pengguna: {
                select: { id: true, nama: true, departemen: true, status: true },
              },
            },
          },
        },
        where: {
          tran_project: {
            tmst_project: { nama: validatePdf.project },
            tmst_pengguna: { id: validatePdf.id_pengguna },
          },
        },
        orderBy: { tanggal: "asc" },
      });
    }
  }

  // Fetch payment URL
  const periodeStr = `${targetYear}-${String(validatePdf.month).padStart(2, "0")}`;
  const payment = await prismaClient.tran_payment.findFirst({
    where: {
      periode: periodeStr,
      tmst_project: { nama: validatePdf.project },
    },
    select: { url_file_sp3: true },
  }).catch(() => null);

  const paymentUrl = payment?.url_file_sp3 || null;

  // Transform data
  let lecturerPicId = null;
  let tempat_magang = null;
  let pic_jabatan = null;
  let nama_project = null;
  let totalJam = 0;

  const transformedData = dataPdf.map((data) => {
    lecturerPicId = data.tran_project.tmst_project.pic || lecturerPicId;
    tempat_magang = tempat_magang || data.tran_project.tmst_project.tempat_magang;
    pic_jabatan = pic_jabatan || data.tran_project.tmst_project.pic_jabatan;
    nama_project = nama_project || data.tran_project.tmst_project.nama;

    // Calculate hours from sessions
    const insentifData = data.tran_project?.tmst_project?.tmst_kategori_magang?.tran_insentif;
    if (insentifData) {
      const durasiSatuan = Number(insentifData.durasi_satuan) || 1;
      const idSatuan = insentifData.id_satuan;
      if (idSatuan === 1) {
        // Time-based: convert sessions to hours
        totalJam += (Number(data.total_sesi || 0) * durasiSatuan) / 60;
      } else {
        // Karya-based: count as is
        totalJam += Number(data.total_sesi || 0);
      }
    }

    return transformPdfRow(data, paymentUrl);
  });

  // Load karya images
  loadKaryaImages(transformedData);

  // If no data, try to fetch header info anyway
  let studentInfo = { NIM: null, nama: null, departemen: null };
  if (transformedData.length === 0) {
    const proj = await prismaClient.tmst_project.findFirst({
      where: { nama: validatePdf.project },
      select: { nama: true, tempat_magang: true, inisial_project: true, pic: true, pic_jabatan: true },
    }).catch(() => null);

    if (proj) {
      nama_project = proj.nama;
      tempat_magang = proj.tempat_magang;
      lecturerPicId = proj.pic;
      pic_jabatan = proj.pic_jabatan;
    }

    const student = await prismaClient.tmst_pengguna.findFirst({
      where: { id: validatePdf.id_pengguna },
      select: { id: true, nama: true, departemen: true },
    }).catch(() => null);

    if (student) {
      studentInfo = { NIM: student.id, nama: student.nama, departemen: student.departemen };
    }
  } else {
    studentInfo = {
      NIM: transformedData[0].NIM,
      nama: transformedData[0].nama,
      departemen: transformedData[0].departemen,
    };
  }

  // Calculate weeks - use actual data date range if data spans different months than requested
  let actualStartDate, actualEndDate;
  if (transformedData.length > 0) {
    const allDates = transformedData.map((d) => new Date(d.tanggal)).filter(Boolean);
    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));
    // Use the actual data's month range if different from requested month
    actualStartDate = startOfMonth(minDate);
    actualEndDate = endOfMonth(maxDate);
  } else {
    actualStartDate = startOfMonth(new Date(targetYear, validatePdf.month - 1));
    actualEndDate = endOfMonth(new Date(targetYear, validatePdf.month - 1));
  }
  const weeks = eachWeekOfInterval({ start: actualStartDate, end: actualEndDate });

  const splitWeek = weeks.map((weekStart) => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return {
      awal: format(weekStart, "yyyy-MM-dd"),
      akhir: format(weekEnd, "yyyy-MM-dd"),
    };
  });

  const actualMonth = transformedData.length > 0
    ? new Date(transformedData[0].tanggal).getMonth() + 1
    : validatePdf.month;
  const actualYear = transformedData.length > 0
    ? new Date(transformedData[0].tanggal).getFullYear()
    : targetYear;

  const monthWeeks = await calculateMonthWeeks(validatePdf.project, actualYear, actualMonth);
  const weeklyTotals = monthWeeks.map((range) => {
    return transformedData
      .filter((row) => {
        const d = new Date(row.tanggal);
        return d >= new Date(range.awal) && d <= new Date(range.akhir);
      })
      .reduce((sum, row) => sum + Number(row.total_sesi || 0), 0);
  });

  // Calculate master month
  let masterMonth = null;
  if (transformedData.length > 0) {
    const monthNames = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember",
    ];
    const dataDate = new Date(transformedData[0].tanggal);
    const nextMonth = new Date(dataDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    masterMonth = {
      startMonth: `${monthNames[dataDate.getMonth()]} ${dataDate.getFullYear()}`,
      finishMonth: `${monthNames[nextMonth.getMonth()]} ${nextMonth.getFullYear()}`,
    };
  }

  return {
    data: transformedData,
    headers: [
      "No.", "Tanggal", "Kategori Kegiatan", "Rincian Kegiatan",
      "Waktu Mulai", "Waktu Selesai", "Jumlah Jam Kerja", "Tautan Dokumen Output Pekerjaan",
    ],
    total: { jam: totalJam },
    masterMonth,
    weeks: splitWeek,
    monthWeeks,
    weeklyTotals,
    lecturerPicId,
    tempat_magang,
    pic_jabatan,
    nama_project,
    student: studentInfo,
  };
};

const getAllMahasiswaTimesheet = async (request) => {
  const validateData = validate(generateAllPdfValidation, request);
  const year = new Date().getFullYear();
  const { start: startDate, end: endDate } = getMonthRange(year, validateData.month);

  const result = await prismaClient.tran_timesheet.findMany({
    select: {
      tanggal: true,
      tran_project: {
        select: {
          tmst_project: { select: { nama: true, inisial_project: true } },
          tmst_pengguna: { select: { id: true } },
        },
      },
    },
    where: {
      tanggal: { gte: startDate, lt: endDate },
      tran_project: {
        tmst_project: { nama: validateData.project },
      },
    },
  });

  if (result.length === 0) {
    return { data: { error: "Project tidak ditemukan!" } };
  }

  const data = result.map((item) => ({
    tanggal: item.tanggal,
    month: item.tanggal.getMonth() + 1,
    project: item.tran_project.tmst_project.nama,
    NIM: item.tran_project.tmst_pengguna.id,
    inisial_project: item.tran_project.tmst_project.inisial_project,
  }));

  return {
    data,
    initialProject: data[0]?.inisial_project || null,
  };
};

const getOneShow = async (request) => {
  request = validate(searchTimesheetValidation, request);
  const { userId, page, size, project } = request;
  const skip = (page - 1) * size;

  const filters = {};
  if (project) {
    filters.tran_project = {
      tmst_project: { nama: { contains: project } },
    };
  }

  const result = await prismaClient.tran_timesheet.findMany({
    where: {
      AND: [{ tran_project: { tmst_pengguna: { id: userId } } }, filters],
    },
    select: {
      tanggal: true,
      jam_mulai: true,
      jam_selesai: true,
      total_sesi: true,
      tmst_status_timesheet: { select: { status: true } },
      tran_project: {
        select: {
          id: true,
          estimasi: true,
          revisi: true,
          tmst_pengguna: { select: { id: true, nama: true } },
          tmst_project: {
            select: {
              id_kategori: true,
              nama: true,
              tmst_kategori_magang: {
                select: {
                  id: true,
                  tran_insentif: { select: { besaran_insentif: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { tanggal: "asc" },
  });

  // Group by project and month
  const groupedData = {};
  result.forEach((data) => {
    const projectName = data.tran_project.tmst_project.nama;
    const yearMonth = data.tanggal.toISOString().slice(0, 7);
    const pesertaId = data.tran_project.tmst_pengguna.id;
    const key = `${projectName}_${yearMonth}_${pesertaId}`;

    if (!groupedData[key]) {
      groupedData[key] = {
        id_project: data.tran_project.id,
        id_kategori: data.tran_project.tmst_project.id_kategori,
        estimasi: data.tran_project.estimasi || 0,
        tanggal_mulai: data.tanggal,
        tanggal_selesai: data.tanggal,
        total_besaran_insentif: 0,
        total_sesi: 0,
        nim: data.tran_project.tmst_pengguna.id,
        nama: data.tran_project.tmst_pengguna.nama,
        nama_project: projectName,
        jam_mulai: data.jam_mulai,
        jam_selesai: data.jam_selesai,
        status: null,
        revisi: data.tran_project.revisi || null,
        statuses: [], // Collect all statuses for aggregate calculation
      };
    }

    const entry = groupedData[key];
    entry.tanggal_mulai = new Date(entry.tanggal_mulai) < new Date(data.tanggal) ? entry.tanggal_mulai : data.tanggal;
    entry.tanggal_selesai = new Date(entry.tanggal_selesai) > new Date(data.tanggal) ? entry.tanggal_selesai : data.tanggal;
    entry.total_besaran_insentif +=
      (data.tran_project.tmst_project.tmst_kategori_magang.tran_insentif.besaran_insentif || 0) * data.total_sesi;
    entry.total_sesi += data.total_sesi;
    entry.statuses.push(data.tmst_status_timesheet.status);
  });

  // Calculate aggregate status for each group
  Object.values(groupedData).forEach((entry) => {
    const statuses = entry.statuses;
    // Priority: Revision Required > Revised > Submitted > Approved > Completed
    if (statuses.some(s => s === "Revision Required")) {
      entry.status = "Revision Required";
    } else if (statuses.some(s => s === "Revised")) {
      entry.status = "Revised";
    } else if (statuses.some(s => s === "Waiting for Approval" || s === "Submitted")) {
      entry.status = "Submitted";
    } else if (statuses.every(s => s === "Approved")) {
      entry.status = "Approved";
    } else if (statuses.every(s => s === "Completed")) {
      entry.status = "Completed";
    } else {
      entry.status = statuses[statuses.length - 1] || "Submitted";
    }
    delete entry.statuses; // Remove temporary array
  });

  const groupedResult = Object.values(groupedData);
  const totalItems = groupedResult.length;
  const paginatedResult = groupedResult.slice(skip, skip + size);

  return {
    data: paginatedResult,
    paging: {
      page,
      total_item: totalItems,
      total_page: Math.ceil(totalItems / size),
    },
  };
};

const deleteMany = async (request) => {
  const { error, value } = deleteManyValidation.validate(request);
  if (error) {
    throw new ResponseError(400, `Kesalahan validasi: ${error.details[0].message}`);
  }

  const { projectId, date, userId } = value;

  // Validate project exists and user has access
  const projectAccess = await prismaClient.tran_project.findFirst({
    where: { id: projectId, id_peserta: userId },
  });

  if (!projectAccess) {
    throw new ResponseError(403, "Project tidak ditemukan atau Anda tidak memiliki akses");
  }

  const [year, month] = date.split("-").map(Number);
  const { start, end } = getMonthRange(year, month);

  // Get timesheet IDs for deletion
  const timesheets = await prismaClient.tran_timesheet.findMany({
    where: {
      id_tran_project: projectId,
      tran_project: { id_peserta: userId },
      tanggal: { gte: start, lt: end },
    },
    select: { id: true },
  });

  // Delete history records
  await prismaClient.timesheet_status_history.deleteMany({
    where: { id_timesheet: { in: timesheets.map((t) => t.id) } },
  });

  // Delete timesheets
  return prismaClient.tran_timesheet.deleteMany({
    where: {
      id_tran_project: projectId,
      tran_project: { id_peserta: userId },
      tanggal: { gte: start, lt: end },
    },
  });
};

const getEdit = async (request) => {
  const { error, value } = deleteManyValidation.validate(request);
  if (error) {
    throw new ResponseError(400, `Kesalahan validasi: ${error.details[0].message}`);
  }

  const { projectId, date, userId } = value;
  const [year, month] = date.split("-").map(Number);
  const { start, end } = getMonthRange(year, month);

  const result = await prismaClient.tran_timesheet.findMany({
    where: {
      id_tran_project: projectId,
      tran_project: { id_peserta: userId },
      tanggal: { gte: start, lt: end },
    },
    select: {
      tran_project: { select: { id_project: true } },
      id: true,
      id_kategori_kegiatan: true,
      id_tran_project: true,
      tanggal: true,
      jam_mulai: true,
      jam_selesai: true,
      deskripsi: true,
      total_sesi: true,
      id_status: true,
      link_output: true,
    },
  });

  return result.map((data) => ({
    ...data,
    id_project: data.tran_project.id_project,
    tran_project: undefined,
  }));
};

const createUpdate = async (request, date, userId, userRole = null) => {
  if (!userId) {
    throw new ResponseError(401, "User ID diperlukan");
  }

  const timesheet = validate(createTranTimesheetValidation, request);
  await validateTimesheetCreation(timesheet, userId, true, userRole);

  // First, update any existing timesheet with REVISION_REQUIRED status to WAITING_FOR_APPROVAL
  // when student resubmits
  const affectedProjects = [...new Set(timesheet.map((t) => t.id_tran_project))];

  const timesheetUpdates = await prismaClient.tran_timesheet.updateMany({
    where: {
      id_tran_project: { in: affectedProjects },
      id_status: STATUS.TIMESHEET.REVISION_REQUIRED,
      tran_project: { id_peserta: userId },
    },
    data: { id_status: STATUS.TIMESHEET.WAITING_FOR_APPROVAL },
  }).catch(() => ({})); // Don't fail if no records match

  // If we updated any REVISION_REQUIRED timesheets, also update payment status to REVISED
  if (timesheetUpdates.count > 0) {
    // Get affected periods and projects to update payment status
    const affectedTimesheets = await prismaClient.tran_timesheet.findMany({
      where: {
        id_tran_project: { in: affectedProjects },
        id_status: STATUS.TIMESHEET.WAITING_FOR_APPROVAL,
        tran_project: { id_peserta: userId },
      },
      select: {
        tanggal: true,
        tran_project: {
          select: { id_project: true },
        },
      },
      distinct: ['tran_project'],
    });

    // Update payment status for each affected project/period
    for (const ts of affectedTimesheets) {
      const periode = getMonthKey(ts.tanggal);
      const projectId = ts.tran_project.id_project;

      await prismaClient.tran_payment.updateMany({
        where: {
          id_tmst_project: projectId,
          periode,
          id_status: STATUS.PAYMENT.ON_REVISION,
        },
        data: { id_status: STATUS.PAYMENT.REVISED },
      }).catch(() => { }); // Don't fail if payment update fails
    }
  }

  const createdIds = [];
  for (const data of timesheet) {
    const created = await prismaClient.tran_timesheet.create({
      data,
      select: { id: true },
    });
    createdIds.push(created.id);
  }

  return { createdIds };
};

const submitPayment = async (request) => {
  request = validate(submitPaymentValidation, request);
  const { page, size, project, pic } = request;
  const skip = (page - 1) * size;

  const filters = {};
  if (project) {
    filters.tran_project = { tmst_project: { nama: { contains: project } } };
  }
  if (pic) {
    if (filters.tran_project) {
      filters.tran_project.tmst_project.pic = pic;
    } else {
      filters.tran_project = { tmst_project: { pic } };
    }
  }

  const result = await prismaClient.tran_timesheet.findMany({
    where: filters,
    select: {
      tanggal: true,
      id_status: true,
      tran_project: {
        select: {
          id: true,
          id_project: true,
          tmst_pengguna: { select: { id: true, nama: true } },
          tmst_project: { select: { id: true, nama: true, pic: true } },
        },
      },
    },
    orderBy: { tanggal: "asc" },
  });

  // Group by project and month
  const groupedData = {};
  result.forEach((data) => {
    const projectName = data.tran_project.tmst_project.nama;
    const projectId = data.tran_project.tmst_project.id;
    const yearMonth = data.tanggal.toISOString().slice(0, 7);
    const key = `${projectName}_${yearMonth}`;

    if (!groupedData[key]) {
      groupedData[key] = {
        id_project: data.tran_project.id,
        id_tmst_project: projectId,
        tanggal_mulai: data.tanggal,
        tanggal_selesai: data.tanggal,
        nim: [],
        nama: [],
        nama_project: projectName,
        _studentsWithTimesheets: new Set(),
        _allStatuses: [],
      };
    }

    const entry = groupedData[key];
    entry.tanggal_mulai = new Date(entry.tanggal_mulai) > new Date(data.tanggal) ? data.tanggal : entry.tanggal_mulai;
    entry.tanggal_selesai = new Date(entry.tanggal_selesai) < new Date(data.tanggal) ? data.tanggal : entry.tanggal_selesai;

    if (!entry.nim.includes(data.tran_project.tmst_pengguna.id)) {
      entry.nim.push(data.tran_project.tmst_pengguna.id);
      entry.nama.push(data.tran_project.tmst_pengguna.nama);
    }

    entry._studentsWithTimesheets.add(data.tran_project.tmst_pengguna.id);
    entry._allStatuses.push(data.id_status);
  });

  // Now fetch ALL students assigned to each project to get accurate count
  const projectIds = [...new Set(Object.values(groupedData).map(g => g.id_tmst_project))];
  const allStudentsInProjects = await prismaClient.tran_project.findMany({
    where: {
      tmst_project: { id: { in: projectIds } },
    },
    select: {
      id: true,
      id_project: true,
      id_peserta: true,
      tmst_pengguna: { select: { id: true, nama: true } },
      tmst_project: { select: { id: true } },
    },
    orderBy: { id: 'asc' }, // Ensure consistent ordering by tran_project.id
  });

  // Group students by tmst_project id
  const studentsByProject = {};
  allStudentsInProjects.forEach((tp) => {
    const tmstProjectId = tp.tmst_project.id;
    if (!studentsByProject[tmstProjectId]) {
      studentsByProject[tmstProjectId] = [];
    }
    studentsByProject[tmstProjectId].push({
      id: tp.tmst_pengguna.id,
      nama: tp.tmst_pengguna.nama,
      tranProjectId: tp.id, // Store tran_project.id for each student
    });
  });

  // Update grouped data with total student count and status
  const groupedResult = Object.values(groupedData).map(entry => {
    const allStudents = studentsByProject[entry.id_tmst_project] || [];
    const totalStudentCount = allStudents.length;
    const studentsWithTimesheets = entry._studentsWithTimesheets.size;

    // Calculate status based on all students and their timesheet statuses:
    // - Status "approved" HANYA jika:
    //   1. Semua mahasiswa sudah submit timesheet
    //   2. Semua timesheet berstatus APPROVED (id_status = 1)
    // - Jika ada yang revision/waiting/in_process -> status "waiting" atau "revision"
    // - Jika belum semua submit -> status "waiting"

    let status = "waiting"; // Default status

    if (totalStudentCount > 0 && studentsWithTimesheets === totalStudentCount) {
      // All students have submitted timesheets - check their statuses
      const hasRevisionRequired = entry._allStatuses.some(
        (s) => s === STATUS.TIMESHEET.REVISION_REQUIRED,
      );
      const hasRevised = entry._allStatuses.some(
        (s) => s === STATUS.TIMESHEET.REVISED,
      );
      const allApproved =
        entry._allStatuses.length > 0 &&
        entry._allStatuses.every((s) => s === STATUS.TIMESHEET.APPROVED);
      const allCompleted =
        entry._allStatuses.length > 0 &&
        entry._allStatuses.every(
          (s) => s === STATUS.TIMESHEET.COMPLETED || s === STATUS.TIMESHEET.APPROVED,
        );

      if (allApproved || allCompleted) {
        status = "approved"; // All students submitted and all approved/completed
      } else if (hasRevisionRequired) {
        status = "revision"; // At least one needs revision
      } else if (hasRevised) {
        status = "revised"; // One or more students have revised their timesheet
      } else {
        status = "waiting"; // Submitted but waiting for approval
      }
    } else {
      // Not all students have submitted
      status = "waiting";
    }

    // Update nim and nama to show ALL assigned students
    // Use the first student's tran_project.id as the representative id_project
    const firstStudentTranProjectId = allStudents.length > 0 ? allStudents[0].tranProjectId : entry.id_project;

    const result = {
      id_project: firstStudentTranProjectId, // Use first student's tran_project.id
      id_tmst_project: entry.id_tmst_project,
      tanggal_mulai: entry.tanggal_mulai,
      tanggal_selesai: entry.tanggal_selesai,
      nim: allStudents.map(s => s.id),
      nama: allStudents.map(s => s.nama),
      nama_project: entry.nama_project,
      status,
    };

    return result;
  });

  const totalItems = groupedResult.length;
  const paginatedResult = groupedResult.slice(skip, skip + size);

  return {
    data: paginatedResult,
    paging: {
      page,
      total_item: totalItems,
      total_page: Math.ceil(totalItems / size),
    },
  };
};

const getSubmitPayment = async (request) => {
  request = validate(getSubmitPaymentValidation, request);
  const { projectId, date } = request;

  const [year, month] = date.split("-").map(Number);
  const { start, end } = getMonthRange(year, month);

  // Fetch student timesheet statuses from database (with fallback)
  let statusMap = {};
  try {
    const studentStatuses = await prismaClient.tmst_status_student_timesheet.findMany();
    studentStatuses.forEach((s) => {
      statusMap[s.status] = s;
    });
  } catch (e) {
    // Table may not exist yet, use default values
    statusMap = {
      "Approved": { status: "Approved" },
      "On Revision": { status: "On Revision" },
      "Submitted": { status: "Submitted" },
      "Revised": { status: "Revised" },
      "Not Submitted": { status: "Not Submitted" },
    };
  }

  // First, fetch ALL students assigned to this project
  const allStudentsInProject = await prismaClient.tran_project.findMany({
    where: {
      tmst_project: { id: projectId },
    },
    select: {
      id: true,
      id_peserta: true,
      is_reviewed: true,
      tmst_pengguna: { select: { id: true, nama: true } },
      tmst_project: {
        select: { id: true, nama: true, pic_jabatan: true, tempat_magang: true },
      },
    },
  });

  // Then fetch timesheets for those students in the given month
  const result = await prismaClient.tran_timesheet.findMany({
    where: {
      tran_project: { tmst_project: { id: projectId } },
      tanggal: { gte: start, lt: end },
    },
    select: {
      tanggal: true,
      id_status: true,
      tran_project: {
        select: {
          id: true,
          id_peserta: true,
          tmst_pengguna: { select: { id: true, nama: true } },
          tmst_project: {
            select: { id: true, nama: true, pic_jabatan: true, tempat_magang: true },
          },
        },
      },
    },
    orderBy: { tanggal: "asc" },
  });

  // Group timesheets by student
  const timesheetsByStudent = new Map();
  result.forEach((data) => {
    const studentId = data.tran_project.tmst_pengguna.id;
    if (!timesheetsByStudent.has(studentId)) {
      timesheetsByStudent.set(studentId, {
        id_project: data.tran_project.id,
        id_tmst_project: data.tran_project.tmst_project.id,
        nim: studentId,
        nama: data.tran_project.tmst_pengguna.nama,
        tanggal: data.tanggal,
        nama_project: data.tran_project.tmst_project.nama,
        pic_jabatan: data.tran_project.tmst_project.pic_jabatan || null,
        tempat_magang: data.tran_project.tmst_project.tempat_magang || null,
        statuses: [],
      });
    }
    timesheetsByStudent.get(studentId).statuses.push(data.id_status);
  });

  // Build final result including ALL students (even those without timesheets)
  const studentsWithStatus = allStudentsInProject.map((tranProject) => {
    const studentId = tranProject.tmst_pengguna.id;
    const studentData = timesheetsByStudent.get(studentId);

    if (studentData) {
      // Student has submitted timesheets - calculate status
      const { statuses } = studentData;
      let status = statusMap["Not Submitted"]?.status || "Not Submitted";

      if (statuses.length > 0) {
        // Check for specific statuses
        const hasRevisionRequired = statuses.some((s) => s === STATUS.TIMESHEET.REVISION_REQUIRED);
        const allApproved = statuses.every((s) => s === STATUS.TIMESHEET.APPROVED);
        const allCompleted = statuses.every((s) => s === STATUS.TIMESHEET.COMPLETED);
        const allApprovedOrCompleted = statuses.every(
          (s) => s === STATUS.TIMESHEET.APPROVED || s === STATUS.TIMESHEET.COMPLETED
        );
        const hasRevised = statuses.some((s) => s === STATUS.TIMESHEET.REVISED);
        const allRevised = statuses.every((s) => s === STATUS.TIMESHEET.REVISED);

        if (allCompleted || allApprovedOrCompleted) status = statusMap["Approved"]?.status || "Approved";
        else if (allApproved) status = statusMap["Approved"]?.status || "Approved";
        else if (hasRevisionRequired) status = statusMap["On Revision"]?.status || "On Revision";
        else if (hasRevised || allRevised) status = statusMap["Revised"]?.status || "Revised";
        else status = statusMap["Submitted"]?.status || "Submitted";
      }

      delete studentData.statuses;
      return { ...studentData, status, isReview: tranProject.is_reviewed };
    } else {
      // Student has NOT submitted any timesheets for this period
      return {
        id_project: tranProject.id,
        id_tmst_project: tranProject.tmst_project.id,
        nim: studentId,
        nama: tranProject.tmst_pengguna.nama,
        tanggal: null,
        nama_project: tranProject.tmst_project.nama,
        pic_jabatan: tranProject.tmst_project.pic_jabatan || null,
        tempat_magang: tranProject.tmst_project.tempat_magang || null,
        status: statusMap["Not Submitted"]?.status || "Not Submitted",
        isReview: tranProject.is_reviewed,
      };
    }
  });

  // Check if there's any timesheet data at all
  const hasAnyTimesheet = result.length > 0;

  return {
    data: studentsWithStatus,
    hasTimesheetData: hasAnyTimesheet,
    canProceed: hasAnyTimesheet // Frontend can use this to enable/disable "SELANJUTNYA" button
  };
};

const getKaryaInfo = async (tranProjectId) => {
  tranProjectId = validate(getId, tranProjectId);

  const projectInfo = await prismaClient.tran_project.findUnique({
    where: { id: tranProjectId },
    select: {
      id: true,
      durasi: true,
      tmst_project: {
        select: {
          nama: true,
          tmst_kategori_magang: {
            select: {
              kategori: true,
              tran_insentif: { select: { id_satuan: true, besaran_insentif: true } },
            },
          },
        },
      },
    },
  });

  if (!projectInfo) {
    throw new ResponseError(404, "Project tidak ditemukan");
  }

  const idSatuan = Number(projectInfo.tmst_project?.tmst_kategori_magang?.tran_insentif?.id_satuan || SATUAN.WAKTU);
  const maxKarya = Number(projectInfo.durasi || 0);

  const existingCount = await prismaClient.tran_timesheet.count({
    where: { id_tran_project: tranProjectId },
  });

  return {
    tranProjectId,
    projectName: projectInfo.tmst_project?.nama || "",
    kategori: projectInfo.tmst_project?.tmst_kategori_magang?.kategori || "",
    idSatuan,
    isKarya: isKaryaProject(idSatuan),
    maxKarya,
    existingCount,
    remainingSlots: Math.max(0, maxKarya - existingCount),
    besaranInsentif: Number(projectInfo.tmst_project?.tmst_kategori_magang?.tran_insentif?.besaran_insentif || 0),
  };
};

export default {
  create,
  remove,
  list,
  update,
  show,
  availableStudent,
  showEdit,
  checkAvailable,
  selectAvailable,
  generatePdfTimesheet,
  getAllMahasiswaTimesheet,
  getOneShow,
  deleteMany,
  getEdit,
  createUpdate,
  submitPayment,
  getSubmitPayment,
  getKaryaInfo,
  updateStatus,
};