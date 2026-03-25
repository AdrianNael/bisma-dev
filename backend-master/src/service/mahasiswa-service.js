import { prismaClient } from "../application/database.js";
import { ResponseError } from "../error/response-error.js";
import bcrypt from "bcrypt";
import { validate } from "../validation/validation.js";
import {
  createMahasiswaSchema,
  getOneMahasiswaSchema,
  getMahasiswaSchema,
  updateMahasiswaSchema,
} from "../validation/mahasiswa-validation.js";
import { getMonthKey } from "../helpers/date.js";

function listMonthKeysBetweenInclusive(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const cursor = new Date(s.getFullYear(), s.getMonth(), 1);
  const last = new Date(e.getFullYear(), e.getMonth(), 1);
  const keys = [];
  for (let d = new Date(cursor); d <= last; d.setMonth(d.getMonth() + 1)) {
    keys.push(getMonthKey(d)); // ex: "2025-08"
  }
  return keys.length ? keys : [getMonthKey(s)];
}

function splitEquallyInt(total, parts) {
  const T = Math.max(0, Math.floor(Number(total) || 0));
  const N = Math.max(1, Number(parts) || 1);
  const base = Math.floor(T / N);
  let rem = T % N;
  return Array.from({ length: N }, (_, i) => base + (i < rem ? 1 : 0));
}

const getMahasiswaDetails = async (filters, pagination) => {
  filters = validate(getMahasiswaSchema, filters);
  const { nama, nim } = filters;
  const { size, page } = pagination;

  const skip = (page - 1) * size;
  const take = size;
  const mahasiswaUsers = await prismaClient.tmst_pengguna.findMany({
    where: {
      status: "MAHASISWA",
      AND: [
        nama ? { nama: { contains: nama } } : {},
        nim ? { id: { equals: nim } } : {},
      ],
    },
    select: {
      id: true,
      nama: true,
      username: true,
      departemen: true,
    },
    skip,
    take,
  });

  if (!mahasiswaUsers) {
    throw new ResponseError(404, "Data tidak ditemukan");
  }

  const totalItems = await prismaClient.tmst_pengguna.count({
    where: {
      status: "MAHASISWA",
      AND: [
        nama ? { nama: { contains: nama } } : {},
        nim ? { id: { equals: nim } } : {},
      ],
    },
  });

  return {
    mahasiswaUsers: mahasiswaUsers,
    total_item: totalItems,
    total_page: Math.ceil(totalItems / size),
    page: page,
  };
};

const createMahasiswa = async (data) => {
  data = validate(createMahasiswaSchema, data);
  const { username, password, nama, departemen, nim, no_telp, no_rekening } =
    data;

  const existingUser = await prismaClient.user.findUnique({
    where: { username },
  });

  if (existingUser) {
    throw new ResponseError(400, "Username telah tersedia");
  }

  const existingTmstPengguna = await prismaClient.tmst_pengguna.findUnique({
    where: { username },
  });

  if (existingTmstPengguna) {
    throw new ResponseError(400, "Username telah tersedia");
  }

  const salt = await bcrypt.genSalt();
  const hashedPassword = await bcrypt.hash(password, salt);

  const user = await prismaClient.user.create({
    data: {
      username,
      password: hashedPassword,
      name: nama,
    },
  });

  const tmstPengguna = await prismaClient.tmst_pengguna.create({
    data: {
      id: nim,
      nama: nama,
      username: user.username,
      departemen: departemen || "",
      no_telp: no_telp || "",
      no_rekening: no_rekening || "",
      status: "MAHASISWA",
    },
  });

  return {
    user,
    tmstPengguna,
  };
};

const updateMahasiswaAndUserByUsername = async (username, data) => {
  data = validate(updateMahasiswaSchema, data);

  const existingPengguna = await prismaClient.tmst_pengguna.findUnique({
    where: { username },
  });

  if (!existingPengguna) {
    throw new Error("Pengguna tidak ditemukan");
  }

  let existingUser;

  if (data.username) {
    existingUser = await prismaClient.user.findUnique({
      where: { username: data.username },
    });

    if (existingUser && existingUser.username !== username) {
      throw new Error("Username sudah digunakan oleh pengguna lain");
    }
  }

  let hashedPassword = null;
  let userData = null;
  if (data.password) {
    const salt = await bcrypt.genSalt();
    hashedPassword = await bcrypt.hash(data.password, salt);
  }

  if (data.username || data.password) {
    userData = await prismaClient.user.update({
      where: { username },
      data: {
        username: data.username || existingPengguna.username,
        password: hashedPassword ? hashedPassword : existingUser?.password,
      },
    });
  } else if (hashedPassword) {
    await prismaClient.user.update({
      where: { username },
      data: {
        password: hashedPassword,
      },
    });
  }

  const updatedPengguna = await prismaClient.tmst_pengguna.update({
    where: { username: userData.username },
    data: {
      nama: data.nama || existingPengguna.nama,
      username: userData.username || existingPengguna.username,
      departemen: data.departemen || existingPengguna.departemen,
      no_telp: data.no_telp || existingPengguna.no_telp,
      no_rekening: data.no_rekening || existingPengguna.no_rekening,
    },
  });

  return updatedPengguna;
};

const getOneMahasiswa = async (username) => {
  username = validate(getOneMahasiswaSchema, username);

  const getOneUser = await prismaClient.user.count({
    where: {
      username: username,
    },
  });

  if (getOneUser === 0) {
    throw new ResponseError(404, "Data Mahasiswa tidak ditemukan");
  }

  const MahasiswaData = await prismaClient.tmst_pengguna.findFirst({
    where: {
      username,
    },
    select: {
      id: true,
      username: true,
      nama: true,
      departemen: true,
      no_telp: true,
    },
  });

  const response = {
    nim: MahasiswaData.id,
    username: MahasiswaData.username,
    nama: MahasiswaData.nama,
    departemen: MahasiswaData.departemen,
    no_telp: MahasiswaData.no_telp,
  };

  return response;
};

const deleteUserByUsername = async (username) => {
  username = validate(getOneMahasiswaSchema, username);

  const existingPengguna = await prismaClient.tmst_pengguna.findUnique({
    where: { username },
    select: {
      id: true,
    },
  });

  if (!existingPengguna) {
    throw new Error("Pengguna tidak ditemukan");
  }

  await prismaClient.tran_posisi_pengguna.deleteMany({
    where: { id_pengguna: existingPengguna.id },
  });

  await prismaClient.tmst_pengguna.delete({
    where: { username },
  });

  const data = await prismaClient.user.delete({
    where: { username },
  });

  return data;
};

const getApplicationHistory = async (user) => {
  const mahasiswaId = user.id;

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
          kriteria: true,
          pic: true,
          pic_jabatan: true,
          kuota: true,
          pendaftaran_mulai: true,
          pendaftaran_selesai: true,
          tanggal_mulai: true,
          tanggal_selesai: true,
          durasi_default: true,
          tempat_magang: true,
          tmst_pengguna: { 
            select: {
              nama: true,
              email: true
            }
          },
          tmst_kategori_magang: {
            select: {
              kategori: true,
              tran_insentif: {
                select: {
                  besaran_insentif: true,
                  durasi_satuan: true,
                  tmst_satuan_insentif: {
                    select: {
                      satuan: true,
                    },
                  },
                },
              },
            },
          },
        }
      },
    },
    orderBy: { tanggal_lamaran: "desc" },
  });

  // Transform data to match frontend expectations
  return applications.map(app => ({
    id: app.id,
    tanggal_lamaran: app.tanggal_lamaran,
    status: app.status,
    project: {
      id: app.project.id,
      nama: app.project.nama,
      kriteria: app.project.kriteria,
      kategori: app.project.tmst_kategori_magang?.kategori || '-',
      pic: app.project.tmst_pengguna?.nama || app.project.pic, 
      pic_email: app.project.tmst_pengguna?.email,
      pic_jabatan: app.project.pic_jabatan,
      kuota: app.project.kuota,
      pendaftaran_mulai: app.project.pendaftaran_mulai,
      pendaftaran_selesai: app.project.pendaftaran_selesai,
      tanggal_mulai: app.project.tanggal_mulai,
      tanggal_selesai: app.project.tanggal_selesai,
      insentif_per_jam: app.project.tmst_kategori_magang?.tran_insentif?.besaran_insentif || 0,
      durasi_satuan: app.project.tmst_kategori_magang?.tran_insentif?.durasi_satuan || 1,
      satuan_insentif: app.project.tmst_kategori_magang?.tran_insentif?.tmst_satuan_insentif?.satuan || 'unit',
      durasi_default: app.project.durasi_default,
      tempat_magang: app.project.tempat_magang,
    },
  }));
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
          nama: true,
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
      totalJam = Math.max(0, Math.floor(Number(r.durasi ?? r.tmst_project?.durasi_default ?? 0)));
    } else if (satuanLower === "menit") {
      totalJam = Math.max(0, Math.floor(Number(r.durasi ?? r.tmst_project?.durasi_default ?? 0)));
    } else if (satuanLower === "sesi") {
      const totalSesi = Math.max(0, Math.floor(Number(r.durasi ?? r.tmst_project?.durasi_default ?? 0)));
      totalJam = Math.floor((totalSesi * durasiSatuan) / 60);
    } else {
      continue;
    }

    if (!totalJam) {
      continue;
    }

    const start = new Date(r.tmst_project.tanggal_mulai);
    const end = new Date(r.tmst_project.tanggal_selesai);
    const months = listMonthKeysBetweenInclusive(start, end);

    const parts = splitEquallyInt(totalJam, months.length);

    months.forEach((m, i) => {
      const add = parts[i] || 0;
      const current = map[m] || 0;
      map[m] = current + add;
    });
  }

  return map;
}

const getMonthlyQuota = async (mahasiswaId, monthStr) => {
  const baseDate = monthStr ? new Date(`${monthStr}-01`) : new Date();
  const monthKey = getMonthKey(baseDate);

  const usedMapRaw = await getUsedHoursByMonth(mahasiswaId);
  const raw = Math.floor(usedMapRaw[monthKey] || 0);

  const used = Math.min(raw, 40);
  const remaining = Math.max(0, 40 - used);

  return {
    month: monthKey,
    used,
    remaining,
    limit: 40,
    breakdown: usedMapRaw,
    // overflow: Math.max(raw - 40, 0),
  };
};

/**
 * Batch version of getMonthlyQuota for multiple mahasiswa IDs
 * Returns a Map<mahasiswaId, { month, used, remaining, limit }>
 */
const getBatchMonthlyQuota = async (mahasiswaIds, monthStr) => {
  const baseDate = monthStr ? new Date(`${monthStr}-01`) : new Date();
  const monthKey = getMonthKey(baseDate);

  // Batch fetch all projects for all mahasiswa in one query
  const allRows = await prismaClient.tran_project.findMany({
    where: { id_peserta: { in: mahasiswaIds } },
    select: {
      id_peserta: true,
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

  // Group by mahasiswa and calculate used hours per month
  const resultMap = new Map();

  // Initialize result for all requested IDs
  for (const id of mahasiswaIds) {
    resultMap.set(id, {
      month: monthKey,
      used: 0,
      remaining: 40,
      limit: 40,
    });
  }

  // Calculate used hours for each mahasiswa
  for (const row of allRows) {
    const mahasiswaId = row.id_peserta;
    const satuan =
      row.tmst_project?.tmst_kategori_magang?.tran_insentif?.tmst_satuan_insentif
        ?.satuan || "";
    const durasiSatuan = Number(
      row.tmst_project?.tmst_kategori_magang?.tran_insentif?.durasi_satuan || 50
    );

    let totalJam = 0;
    const satuanLower = String(satuan).toLowerCase();

    if (satuanLower.includes("karya")) {
      continue;
    } else if (satuanLower === "jam" || satuanLower === "menit") {
      totalJam = Math.max(0, Math.floor(Number(row.durasi ?? row.tmst_project?.durasi_default ?? 0)));
    } else if (satuanLower === "sesi") {
      const totalSesi = Math.max(0, Math.floor(Number(row.durasi ?? row.tmst_project?.durasi_default ?? 0)));
      totalJam = Math.floor((totalSesi * durasiSatuan) / 60);
    } else {
      continue;
    }

    if (!totalJam) continue;

    // Check if project overlaps with the requested month
    const start = new Date(row.tmst_project.tanggal_mulai);
    const end = new Date(row.tmst_project.tanggal_selesai);
    const months = listMonthKeysBetweenInclusive(start, end);

    if (months.includes(monthKey)) {
      const parts = splitEquallyInt(totalJam, months.length);
      const monthIndex = months.indexOf(monthKey);
      const hoursForMonth = parts[monthIndex] || 0;

      const current = resultMap.get(mahasiswaId);
      if (current) {
        const newUsed = Math.min(current.used + hoursForMonth, 40);
        current.used = newUsed;
        current.remaining = Math.max(0, 40 - newUsed);
      }
    }
  }

  return resultMap;
};
/**
 * Get student project counts with optional date range filter
 * Returns list of students with their project counts
 */
const getStudentProjectCounts = async ({ startDate, endDate, nama, nim, size = 100, page = 1 }) => {
  const skip = (page - 1) * size;
  const take = size;

  // Build where clause for date filter
  let dateFilter = {};
  if (startDate && endDate) {
    dateFilter = {
      OR: [
        {
          tmst_project: {
            tanggal_mulai: {
              lte: new Date(endDate),
            },
            tanggal_selesai: {
              gte: new Date(startDate),
            },
          },
        },
      ],
    };
  }

  // Get all mahasiswa users - search by nama OR nim
  const searchFilter = [];
  if (nama) {
    searchFilter.push({ nama: { contains: nama } });
  }
  if (nim) {
    searchFilter.push({ id: { contains: nim } });
  }

  const mahasiswaUsers = await prismaClient.tmst_pengguna.findMany({
    where: {
      status: "MAHASISWA",
      ...(searchFilter.length > 0 ? { OR: searchFilter } : {}),
    },
    select: {
      id: true,
      nama: true,
      username: true,
      departemen: true,
    },
    skip,
    take,
  });

  // Count total
  const totalItems = await prismaClient.tmst_pengguna.count({
    where: {
      status: "MAHASISWA",
      ...(searchFilter.length > 0 ? { OR: searchFilter } : {}),
    },
  });

  // Get project counts for each student
  const studentsWithCounts = await Promise.all(
    mahasiswaUsers.map(async (student) => {
      let projectWhere = {
        id_peserta: student.id,
      };

      // Apply date filter if provided
      if (startDate && endDate) {
        projectWhere = {
          ...projectWhere,
          tmst_project: {
            tanggal_mulai: {
              lte: new Date(endDate),
            },
            tanggal_selesai: {
              gte: new Date(startDate),
            },
          },
        };
      }

      const projectCount = await prismaClient.tran_project.count({
        where: projectWhere,
      });

      return {
        ...student,
        projectCount,
      };
    })
  );

  return {
    students: studentsWithCounts,
    total_item: totalItems,
    total_page: Math.ceil(totalItems / size),
    page,
  };
};


export default {
  createMahasiswa,
  getMahasiswaDetails,
  updateMahasiswaAndUserByUsername,
  getOneMahasiswa,
  deleteUserByUsername,
  getApplicationHistory,
  getMonthlyQuota,
  getBatchMonthlyQuota,
  getStudentProjectCounts,
};

