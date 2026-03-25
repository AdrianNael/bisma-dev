import { prismaClient } from "../application/database.js";
import { ResponseError } from "../error/response-error.js";
import { createPaymentValidation, UpdatePaymentValidation, deletePaymentValidation, listAdminValidation, showSp3Validation } from "../validation/tran-payment-validation.js";
import { validate } from "../validation/validation.js";

// Helper function to calculate realized incentive from timesheet data
const calculateRealizedIncentive = async (id_tmst_project, periode) => {
  try {
    // Parse periode (YYYY-MM format)
    const [year, month] = periode.split("-").map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Get all timesheets for this project in the given period
    const timesheets = await prismaClient.tran_timesheet.findMany({
      where: {
        id_tran_project: {
          in: (await prismaClient.tran_project.findMany({
            where: { id_project: id_tmst_project },
            select: { id: true }
          })).map(tp => tp.id)
        },
        tanggal: {
          gte: startDate,
          lte: endDate
        }
      },
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
                        id_satuan: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    // Calculate total from timesheets
    let totalRealized = 0;
    timesheets.forEach(ts => {
      const besaranInsentif = ts.tran_project?.tmst_project?.tmst_kategori_magang?.tran_insentif?.besaran_insentif || 0;
      const totalSesi = ts.total_sesi || 0;
      totalRealized += besaranInsentif * totalSesi;
    });

    return Math.max(totalRealized, 0); // Return 0 if no timesheets found
  } catch (error) {
    console.error("Error calculating realized incentive:", error);
    return 0;
  }
};

const create = async (request) => {
  const payment = validate(createPaymentValidation, request);

  const checkStatus = await prismaClient.tmst_status_pembayaran.findFirst({
    where: {
      id: payment.id_status,
    },
  });

  if (!checkStatus) {
    throw new ResponseError(404, "Status tidak ditemukan!");
  }
  const projectData = await prismaClient.tmst_project.findFirst({
    where: {
      id: payment.id_tmst_project,
    },
    select: {
      nama: true,
      project_group_id: true,
      tanggal_mulai: true,
      tanggal_selesai: true,
    },
  });

  // Cross-year resolution: if this project is part of a group, find the correct split for the selected period
  if (projectData?.project_group_id) {
    const siblings = await prismaClient.tmst_project.findMany({
      where: {
        project_group_id: projectData.project_group_id,
        is_deleted: false,
      },
      select: { id: true, tanggal_mulai: true, tanggal_selesai: true },
      orderBy: { tanggal_mulai: 'asc' },
    });

    if (siblings.length > 1) {
      const [pYear, pMonth] = payment.periode.split("-").map(Number);
      const periodDate = new Date(pYear, pMonth - 1, 15); // middle of selected month

      const matchingSplit = siblings.find(s => {
        const start = new Date(s.tanggal_mulai);
        const end = new Date(s.tanggal_selesai);
        start.setDate(1); start.setHours(0, 0, 0, 0);
        end.setMonth(end.getMonth() + 1, 0); end.setHours(23, 59, 59, 999);
        return periodDate >= start && periodDate <= end;
      });

      if (matchingSplit && matchingSplit.id !== payment.id_tmst_project) {
        console.log(`[CROSS-YEAR] Resolved split: ${payment.id_tmst_project} → ${matchingSplit.id} for period ${payment.periode}`);
        payment.id_tmst_project = matchingSplit.id;
      }
    }
  }

  const projectName = projectData;

  // VALIDASI: Semua timesheet mahasiswa untuk periode ini harus Approved sebelum submit ke DIRMAWA
  const [valYear, valMonth] = payment.periode.split("-").map(Number);
  const periodStart = new Date(valYear, valMonth - 1, 1);
  const periodEnd = new Date(valYear, valMonth, 0, 23, 59, 59);

  const tranProjects = await prismaClient.tran_project.findMany({
    where: { id_project: payment.id_tmst_project },
    select: { id: true, tmst_pengguna: { select: { nama: true } } },
  });

  if (tranProjects.length > 0) {
    const tranProjectIds = tranProjects.map(tp => tp.id);

    // Cek timesheet yang BELUM Approved (id_status != 1) untuk periode ini
    const unapprovedTimesheets = await prismaClient.tran_timesheet.findMany({
      where: {
        id_tran_project: { in: tranProjectIds },
        tanggal: { gte: periodStart, lte: periodEnd },
        id_status: { not: 1 }, // Bukan Approved
      },
      select: { id: true },
    });

    if (unapprovedTimesheets.length > 0) {
      throw new ResponseError(400,
        "Tidak dapat mengajukan ke DIRMAWA. Semua timesheet mahasiswa untuk periode ini harus disetujui terlebih dahulu."
      );
    }

    // Cek: apakah ada mahasiswa yang belum punya timesheet sama sekali untuk periode ini
    for (const tp of tranProjects) {
      const timesheetCount = await prismaClient.tran_timesheet.count({
        where: {
          id_tran_project: tp.id,
          tanggal: { gte: periodStart, lte: periodEnd },
        },
      });
      if (timesheetCount === 0) {
        throw new ResponseError(400,
          `Mahasiswa ${tp.tmst_pengguna?.nama || tp.id} belum memiliki timesheet untuk periode ${payment.periode}.`
        );
      }
    }
  }

  // Calculate realized incentive from actual timesheet data
  const realizedIncentive = await calculateRealizedIncentive(payment.id_tmst_project, payment.periode);

  // Use realized incentive if it exists, otherwise use the frontend estimation as fallback
  payment.total_tagihan = realizedIncentive > 0 ? realizedIncentive : payment.total_tagihan;

  // Check if payment already exists for this project (regardless of status)
  // One project should only have one payment record per period
  const existingPayment = await prismaClient.tran_payment.findFirst({
    where: {
      id_tmst_project: payment.id_tmst_project,
      periode: payment.periode,
    },
  });

  let dataPayment;
  if (existingPayment) {
    // Update existing payment - only update total_tagihan, preserve id_status
    dataPayment = await prismaClient.tran_payment.update({
      where: { id: existingPayment.id },
      data: {
        total_tagihan: payment.total_tagihan,
        // Preserve existing payment status - don't reset on resubmission
      },
      select: {
        id: true,
        id_status: true,
        periode: true,
        id_tmst_project: true,
        total_tagihan: true,
        url_file_sp3: true,
      },
    });

    // Update Master Project Status to 3 ("Waiting Timesheet Approval") when resubmitting
    await prismaClient.tmst_project.update({
      where: { id: payment.id_tmst_project },
      data: { id_status: 3 }
    });
  } else {
    // Create new payment
    dataPayment = await prismaClient.tran_payment.create({
      data: payment,
      select: {
        id: true,
        id_status: true,
        periode: true,
        id_tmst_project: true,
        total_tagihan: true,
        url_file_sp3: true,
      },
    });

    // Update Master Project Status to 3 ("Waiting Timesheet Approval") when creating new
    await prismaClient.tmst_project.update({
      where: { id: payment.id_tmst_project },
      data: { id_status: 3 }
    });
  }

  dataPayment.nama_project = projectName.nama;
  return dataPayment;
};

const remove = async (request) => {
  const id = validate(deletePaymentValidation, request);

  const validateId = await prismaClient.tran_payment.findFirst({
    where: {
      id: id,
    },
  });

  if (!validateId) {
    throw new ResponseError(404, "Id tidak ditemukan!");
  }

  return prismaClient.tran_payment.delete({
    where: {
      id: id,
    },
  });
};

const list = async () => {
  const result = await prismaClient.tran_payment.findMany({
    select: {
      id: true,
      id_status: true,
      periode: true,
      id_tmst_project: true,
      total_tagihan: true,
      url_file_sp3: true,
      tmst_status_pembayaran: {
        select: {
          status: true,
        }
      }
    },
    orderBy: { id: 'desc' },
  });

  result.forEach((data) => {
    data.status = data.tmst_status_pembayaran.status
    // FIX: Override "Revised" text from DB for ID 4 to "On Revision" to ensure correct UI color (Orange)
    if (data.id_status === 4) {
      data.status = "On Revision";
    }
    delete data.tmst_status_pembayaran
  })

  return result;

};

const update = async (request) => {
  const dataUpdate = validate(UpdatePaymentValidation, request);

  const validateId = await prismaClient.tran_payment.findFirst({
    where: {
      id: dataUpdate.id,
    },
  });

  if (!validateId) {
    throw new ResponseError(404, "Id tidak ditemukan!");
  }

  const data = prismaClient.tran_payment.update({
    where: {
      id: dataUpdate.id,
    },
    data: {
      id_tran_project: dataUpdate.id_tran_project,
      periode: dataUpdate.periode,
      total_tagihan: dataUpdate.total_tagihan,
      url_file_sp3: dataUpdate.url_file_sp3,
      id_status: dataUpdate.id_status,
    },
    select: {
      id: true,
      id_status: true,
      periode: true,
      id_tran_project: true,
      total_tagihan: true,
      url_file_sp3: true,
    },
  });

  return data;
};

const list_admin = async (request) => {
  request = validate(listAdminValidation, request);
  const skip = (request.page - 1) * request.size;

  const filters = [];

  if (request.namaProjek) {
    filters.push({
      nama: {
        contains: request.namaProjek,
      },
    });
  }

  // For "submitted" status, we need to find projects with id_status = 3 (Waiting Timesheet Approval)
  // that have at least one student with submitted timesheets
  if (request.status === "submitted") {
    // Query projects with "Waiting Timesheet Approval" status only (id_status = 3)
    // Status 5 (Project Approved) means waiting for USER to submit next period, not for admin to approve
    const projectFilters = [
      { id_status: 3 }, // Only Waiting Timesheet Approval
      { is_deleted: false },
    ];

    if (filters.length > 0) {
      projectFilters.push(...filters);
    }

    const projects = await prismaClient.tmst_project.findMany({
      select: {
        id: true,
        nama: true,
        tanggal_mulai: true,
        tanggal_selesai: true,
        tmst_pengguna: {
          select: {
            nama: true,
          },
        },
        tran_payment: {
          select: {
            id: true,
            periode: true,
            total_tagihan: true,
          },
          orderBy: { id: 'desc' },
          take: 1,
        },
      },
      where: {
        AND: projectFilters,
      },
      take: request.size,
      skip: skip,
      orderBy: { id: "desc" },
    });

    const transformedData = projects.map((p) => ({
      id: p.tran_payment?.[0]?.id || p.id,
      id_tmst_project: p.id,
      nama: p.nama,
      periode: p.tran_payment?.[0]?.periode || null,
      namaUser: p.tmst_pengguna?.nama || null,
      jumlah: 1,
    }));

    const totalItems = await prismaClient.tmst_project.count({
      where: {
        AND: projectFilters,
      },
    });

    return {
      data: transformedData,
      paging: {
        page: request.page,
        total_item: totalItems,
        total_page: Math.ceil(totalItems / request.size),
      },
    };
  }

  // For other statuses (waiting, paid), query from tran_payment as before
  let statusId;
  if (request.status == "waiting") {
    statusId = 2;
  } else if (request.status == "paid") {
    statusId = 3;
  } else {
    statusId = 1; // default
  }

  const data = await prismaClient.tran_payment.findMany({
    select: {
      id: true,
      id_tmst_project: true,
      periode: true,
      total_tagihan: true,
      tmst_project: {
        select: {
          id: true,
          nama: true,
          tanggal_mulai: true,
          tanggal_selesai: true,
          tmst_pengguna: {
            select: {
              nama: true,
            },
          },
        },
      },
    },
    where: {
      id_status: statusId,
      ...(filters.length > 0 && {
        tmst_project: {
          AND: filters,
        },
      }),
      tmst_project: {
        id_status: {
          notIn: [6, 7]
        }
      }
    },
    take: request.size,
    skip: skip,
  });

  // Transform data
  const transformedData = data.map((dt) => ({
    id: dt.id,
    id_tmst_project: dt.id_tmst_project,
    nama: dt.tmst_project?.nama || null,
    tanggal_mulai: dt.tmst_project?.tanggal_mulai || null,
    tanggal_selesai: dt.tmst_project?.tanggal_selesai || null,
    namaUser: dt.tmst_project?.tmst_pengguna?.nama || null,
    jumlah: 1,
  }));

  // Group by nama
  const objekPenelusur = {};
  transformedData.forEach((item) => {
    const kunci = item.nama;
    if (!objekPenelusur[kunci]) {
      objekPenelusur[kunci] = { ...item };
    } else {
      objekPenelusur[kunci].jumlah++;
    }
  });

  const array_hasil = Object.values(objekPenelusur);

  // Get total count
  const totalItems = await prismaClient.tran_payment.count({
    where: {
      id_status: statusId,
      ...(filters.length > 0 && {
        tmst_project: {
          AND: filters,
        },
      }),
      tmst_project: {
        id_status: {
          notIn: [6, 7]
        }
      }
    },
  });

  return {
    data: array_hasil,
    paging: {
      page: request.page,
      total_item: totalItems,
      total_page: Math.ceil(totalItems / request.size),
    },
  };
};

const detail_payment = async (request) => {
  const id = validate(deletePaymentValidation, request);
  const data = await prismaClient.tran_payment.findMany({
    select: {
      tran_project: {
        select: {
          tran_timesheet: {
            select: {
              tmst_kategori_kegiatan: {
                select: {
                  kegiatan: true,
                },
              },
              tanggal: true,
              jam_mulai: true,
              jam_selesai: true,
            },
          },
          tmst_pengguna: {
            select: {
              nama: true,
            },
          },
        },
      },
    },
    where: {
      id_status: 2,
      AND: {
        tmst_project: {
          is: { id: id },
        },
      },
    },
  });

  let kegiatan = [];
  let tanggal = [];
  let jam_mulai = [];
  let jam_selesai = [];
  let nama_pengguna;

  data.forEach((dt) => {
    dt.tran_project.tran_timesheet.forEach((d) => {
      kegiatan.push(d.tmst_kategori_kegiatan.kegiatan);
      tanggal.push(d.tanggal);
      jam_mulai.push(d.jam_mulai);
      jam_selesai.push(d.jam_selesai);
    });
    nama_pengguna = dt.tran_project.tmst_pengguna.nama;
    dt.kegiatan = kegiatan;
    dt.tanggal = tanggal;
    dt.jam_mulai = jam_mulai;
    dt.jam_selesai = jam_selesai;
    dt.nama = nama_pengguna;
    delete dt.tran_project;
  });

  return data;
};

const showSp3 = async (request) => {
  const sp3 = validate(showSp3Validation, request);

  const data = await prismaClient.tmst_project.findFirst({
    select: {
      inisial_project: true,
    },
    where: {
      id: sp3.idProject,
    },
  });

  return data;
};

/**
 * Update payment status by project ID and period
 * Used for revision flow:
 * - When dosen clicks 'Butuh Revisi': status = 4 (On Revision)
 * - When mahasiswa saves revised timesheet: status = 5 (Revised)
 * If payment doesn't exist, create one with the given status
 */
const updatePaymentStatus = async (projectId, periode, newStatus, totalTagihan = 0) => {
  console.log('updatePaymentStatus called:', { projectId, periode, newStatus, totalTagihan });

  const payment = await prismaClient.tran_payment.findFirst({
    where: {
      id_tmst_project: projectId,
      periode: periode,
    },
  });

  if (!payment) {
    console.log('No payment found, creating new one for project:', projectId, 'period:', periode);
    // Create payment record if it doesn't exist
    const newPayment = await prismaClient.tran_payment.create({
      data: {
        id_tmst_project: projectId,
        periode: periode,
        total_tagihan: totalTagihan,
        url_file_sp3: "",
        id_status: newStatus,
      },
    });
    console.log('New payment created:', newPayment);
    return newPayment;
  }

  const result = await prismaClient.tran_payment.update({
    where: { id: payment.id },
    data: { id_status: newStatus },
  });

  console.log('Payment status updated:', result);
  return result;
};

export default { create, remove, list, update, list_admin, detail_payment, showSp3, updatePaymentStatus };
