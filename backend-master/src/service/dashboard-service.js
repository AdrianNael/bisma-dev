import { prismaClient } from "../application/database.js";

// Master Project Status IDs (tmst_status_master_project)
const MASTER_PROJECT_STATUS = { DRAFT: 1, OPEN: 2, WAITING_TIMESHEET_APPROVAL: 3, WAITING_PROJECT_APPROVAL: 4, PROJECT_APPROVED: 5, COMPLETED: 6, NEED_REVISION: 7 };

// Timesheet Status IDs (tmst_status_timesheet)
const TIMESHEET_STATUS = { APPROVED: 1, REJECTED: 2, REVISION_REQUIRED: 3, WAITING_FOR_APPROVAL: 4, REVISED: 5, COMPLETED: 6 };

const getTotalEstimasiByUser = async (userId, year) => {
  // Calculate actual insentif from COMPLETED timesheets only
  // Formula: total_sesi × besaran_insentif for each timesheet
  // For karya projects: each row = 1 karya, so use total_sesi or 1

  const whereClause = {
    // Only count Completed (6) timesheets for Total Expense
    id_status: TIMESHEET_STATUS.COMPLETED,
    tran_project: {
      tmst_project: {
        is: {
          pic: userId,
        },
      },
    },
    ...(year && {
      tanggal: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      },
    }),
  };

  const timesheets = await prismaClient.tran_timesheet.findMany({
    where: whereClause,
    select: {
      total_sesi: true,
      tran_project: {
        select: {
          tmst_project: {
            select: {
              tmst_kategori_magang: {
                select: {
                  tran_insentif: {
                    select: {
                      besaran_insentif: true,
                      id_satuan: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  let total = 0;
  timesheets.forEach((ts) => {
    const insentif = ts.tran_project?.tmst_project?.tmst_kategori_magang?.tran_insentif;
    const besaranInsentif = Number(insentif?.besaran_insentif || 0);
    const idSatuan = insentif?.id_satuan;
    const isKarya = idSatuan === 2;

    if (isKarya) {
      // Karya: each timesheet row = 1 karya (or use total_sesi if > 0)
      const jumlahKarya = (ts.total_sesi && ts.total_sesi > 0) ? ts.total_sesi : 1;
      total += jumlahKarya * besaranInsentif;
    } else {
      // Waktu: total_sesi × besaran_insentif
      const sesi = Number(ts.total_sesi || 0);
      total += sesi * besaranInsentif;
    }
  });

  return total;
};
const getProjectCountsByUser = async (userId) => {
  const finished = await prismaClient.tmst_project.count({
    where: { pic: userId, id_status: MASTER_PROJECT_STATUS.COMPLETED, is_deleted: false },
  });
  // Approved: all projects except draft, open, waiting project approval, and completed
  const approved = await prismaClient.tmst_project.count({
    where: {
      pic: userId,
      is_deleted: false,
      id_status: {
        notIn: [
          MASTER_PROJECT_STATUS.DRAFT,
          MASTER_PROJECT_STATUS.OPEN,
          MASTER_PROJECT_STATUS.WAITING_PROJECT_APPROVAL,
          MASTER_PROJECT_STATUS.COMPLETED,
        ],
      },
    },
  });

  const waitingPayment = approved;

  return { finished, approved, waitingPayment };
};

/**
 * Get monthly expenses data (cumulative) for a given year
 * Uses tran_timesheet.tanggal to determine month/year
 * Calculates actual insentif: total_sesi × besaran_insentif
 * Returns data for each month with cumulative values (never decreasing)
 */
const getMonthlyExpensesByUser = async (userId, year) => {
  try {
    const currentYear = year || new Date().getFullYear();

    console.log(`getMonthlyExpensesByUser: called with userId=${userId}, year=${currentYear}`);

    // Get all COMPLETED timesheets for this user's projects in the specified year
    const timesheets = await prismaClient.tran_timesheet.findMany({
      where: {
        id_status: TIMESHEET_STATUS.COMPLETED,
        tanggal: {
          gte: new Date(`${currentYear}-01-01`),
          lt: new Date(`${currentYear + 1}-01-01`),
        },
        tran_project: {
          tmst_project: {
            is: {
              pic: userId,
            },
          },
        },
      },
      select: {
        total_sesi: true,
        tanggal: true,
        tran_project: {
          select: {
            tmst_project: {
              select: {
                tmst_kategori_magang: {
                  select: {
                    tran_insentif: {
                      select: {
                        besaran_insentif: true,
                        id_satuan: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    console.log(`getMonthlyExpensesByUser: fetched ${timesheets.length} approved timesheets`);

    // Calculate insentif per timesheet and add to the appropriate month
    const monthlyData = Array(12).fill(0);

    timesheets.forEach((ts) => {
      const tanggal = new Date(ts.tanggal);
      const month = tanggal.getMonth(); // 0-11

      const insentif = ts.tran_project?.tmst_project?.tmst_kategori_magang?.tran_insentif;
      const besaranInsentif = Number(insentif?.besaran_insentif || 0);
      const idSatuan = insentif?.id_satuan;
      const isKarya = idSatuan === 2;

      let timesheetInsentif = 0;
      if (isKarya) {
        // Karya: each timesheet row = 1 karya (or use total_sesi if > 0)
        const jumlahKarya = (ts.total_sesi && ts.total_sesi > 0) ? ts.total_sesi : 1;
        timesheetInsentif = jumlahKarya * besaranInsentif;
      } else {
        // Waktu: total_sesi × besaran_insentif
        const sesi = Number(ts.total_sesi || 0);
        timesheetInsentif = sesi * besaranInsentif;
      }

      monthlyData[month] += timesheetInsentif;
    });

    // Convert to cumulative (each month includes all previous months)
    const cumulativeData = [];
    let runningTotal = 0;
    for (let i = 0; i < 12; i++) {
      runningTotal += monthlyData[i];
      cumulativeData.push(runningTotal);
    }

    const monthLabels = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    return {
      year: currentYear,
      labels: monthLabels,
      data: cumulativeData,
    };
  } catch (e) {
    console.error('getMonthlyExpensesByUser error:', e && e.stack ? e.stack : e);
    throw e;
  }
};

/**
 * Get available years that have expense data for a user
 */
const getAvailableYearsByUser = async (userId) => {
  try {
    // Get distinct years from tran_timesheet for this user's projects
    // Don't filter by status so user can see all available years
    const timesheets = await prismaClient.tran_timesheet.findMany({
      where: {
        tran_project: {
          tmst_project: {
            is: {
              pic: userId,
            },
          },
        },
      },
      select: {
        tanggal: true,
      },
    });

    // Extract unique years
    const yearsSet = new Set();
    timesheets.forEach((ts) => {
      if (ts.tanggal) {
        yearsSet.add(new Date(ts.tanggal).getFullYear());
      }
    });

    // Convert to sorted array (descending)
    const years = Array.from(yearsSet).sort((a, b) => b - a);

    // If no data, return current year
    if (years.length === 0) {
      years.push(new Date().getFullYear());
    }

    return years;
  } catch (e) {
    console.error('getAvailableYearsByUser error:', e && e.stack ? e.stack : e);
    throw e;
  }
};

/**
 * Get total expense globally (all users)
 */
const getTotalEstimasiGlobal = async (year) => {
  const whereClause = {
    // Only count Completed (6) timesheets for Total Expense
    id_status: TIMESHEET_STATUS.COMPLETED,
    ...(year && {
      tanggal: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      },
    }),
  };

  const timesheets = await prismaClient.tran_timesheet.findMany({
    where: whereClause,
    select: {
      total_sesi: true,
      tran_project: {
        select: {
          tmst_project: {
            select: {
              tmst_kategori_magang: {
                select: {
                  tran_insentif: {
                    select: {
                      besaran_insentif: true,
                      id_satuan: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  let total = 0;
  timesheets.forEach((ts) => {
    const insentif = ts.tran_project?.tmst_project?.tmst_kategori_magang?.tran_insentif;
    const besaranInsentif = Number(insentif?.besaran_insentif || 0);
    const idSatuan = insentif?.id_satuan;
    const isKarya = idSatuan === 2;

    if (isKarya) {
      const jumlahKarya = (ts.total_sesi && ts.total_sesi > 0) ? ts.total_sesi : 1;
      total += jumlahKarya * besaranInsentif;
    } else {
      const sesi = Number(ts.total_sesi || 0);
      total += sesi * besaranInsentif;
    }
  });

  return total;
};

/**
 * Get project counts globally (all users)
 */
const getProjectCountsGlobal = async () => {
  const finished = await prismaClient.tmst_project.count({
    where: { id_status: MASTER_PROJECT_STATUS.COMPLETED, is_deleted: false },
  });
  // Approved: all projects except draft, open, waiting project approval, and completed
  const approved = await prismaClient.tmst_project.count({
    where: {
      is_deleted: false,
      id_status: {
        notIn: [
          MASTER_PROJECT_STATUS.DRAFT,
          MASTER_PROJECT_STATUS.OPEN,
          MASTER_PROJECT_STATUS.WAITING_PROJECT_APPROVAL,
          MASTER_PROJECT_STATUS.COMPLETED,
        ],
      },
    },
  });

  return { finished, approved, waitingPayment: approved };
};

/**
 * Get monthly expenses globally (all users)
 */
const getMonthlyExpensesGlobal = async (year) => {
  try {
    const currentYear = year || new Date().getFullYear();

    const timesheets = await prismaClient.tran_timesheet.findMany({
      where: {
        id_status: TIMESHEET_STATUS.COMPLETED,
        tanggal: {
          gte: new Date(`${currentYear}-01-01`),
          lt: new Date(`${currentYear + 1}-01-01`),
        },
      },
      select: {
        total_sesi: true,
        tanggal: true,
        tran_project: {
          select: {
            tmst_project: {
              select: {
                tmst_kategori_magang: {
                  select: {
                    tran_insentif: {
                      select: {
                        besaran_insentif: true,
                        id_satuan: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const monthlyData = Array(12).fill(0);

    timesheets.forEach((ts) => {
      const tanggal = new Date(ts.tanggal);
      const month = tanggal.getMonth();

      const insentif = ts.tran_project?.tmst_project?.tmst_kategori_magang?.tran_insentif;
      const besaranInsentif = Number(insentif?.besaran_insentif || 0);
      const idSatuan = insentif?.id_satuan;
      const isKarya = idSatuan === 2;

      let timesheetInsentif = 0;
      if (isKarya) {
        const jumlahKarya = (ts.total_sesi && ts.total_sesi > 0) ? ts.total_sesi : 1;
        timesheetInsentif = jumlahKarya * besaranInsentif;
      } else {
        const sesi = Number(ts.total_sesi || 0);
        timesheetInsentif = sesi * besaranInsentif;
      }

      monthlyData[month] += timesheetInsentif;
    });

    const cumulativeData = [];
    let runningTotal = 0;
    for (let i = 0; i < 12; i++) {
      runningTotal += monthlyData[i];
      cumulativeData.push(runningTotal);
    }

    const monthLabels = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    return {
      year: currentYear,
      labels: monthLabels,
      data: cumulativeData,
    };
  } catch (e) {
    console.error('getMonthlyExpensesGlobal error:', e && e.stack ? e.stack : e);
    throw e;
  }
};

/**
 * Get available years globally (all users)
 */
const getAvailableYearsGlobal = async () => {
  try {
    const timesheets = await prismaClient.tran_timesheet.findMany({
      select: {
        tanggal: true,
      },
    });

    const yearsSet = new Set();
    timesheets.forEach((ts) => {
      if (ts.tanggal) {
        yearsSet.add(new Date(ts.tanggal).getFullYear());
      }
    });

    const years = Array.from(yearsSet).sort((a, b) => b - a);

    if (years.length === 0) {
      years.push(new Date().getFullYear());
    }

    return years;
  } catch (e) {
    console.error('getAvailableYearsGlobal error:', e && e.stack ? e.stack : e);
    throw e;
  }
};

/**
 * Get kategori magang statistics for a specific year
 * Returns count of projects per kategori magang
 */
const getKategoriMagangStats = async (year) => {
  try {
    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${year + 1}-01-01`);

    // Get all projects in the specified year based on tanggal_mulai
    const projects = await prismaClient.tmst_project.findMany({
      where: {
        tanggal_mulai: {
          gte: startDate,
          lt: endDate,
        },
        is_deleted: false,
      },
      select: {
        id_kategori: true,
        tmst_kategori_magang: {
          select: {
            kategori: true,
          },
        },
      },
    });

    // Group by kategori and count
    const stats = {};
    projects.forEach((project) => {
      const kategori = project.tmst_kategori_magang?.kategori || 'Tidak Berkategori';
      stats[kategori] = (stats[kategori] || 0) + 1;
    });

    // Convert to arrays for chart.js format
    const labels = Object.keys(stats);
    const data = Object.values(stats);

    return {
      labels,
      data,
    };
  } catch (e) {
    console.error('getKategoriMagangStats error:', e && e.stack ? e.stack : e);
    throw e;
  }
};

export default {
  getTotalEstimasiByUser,
  getProjectCountsByUser,
  getMonthlyExpensesByUser,
  getAvailableYearsByUser,
  getTotalEstimasiGlobal,
  getProjectCountsGlobal,
  getMonthlyExpensesGlobal,
  getAvailableYearsGlobal,
  getKategoriMagangStats,
};
