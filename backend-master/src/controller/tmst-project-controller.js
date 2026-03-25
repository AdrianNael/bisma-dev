import { logger } from "../application/logging.js";
import tmstProjectService from "../service/tmst-project-service.js";
import { prismaClient } from "../application/database.js";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Signature snapshot helpers
// ---------------------------------------------------------------------------
const _sanitize = (s) => (s || "").toString().replace(/[^a-zA-Z0-9_-]/g, "_");
const _exts = ["png", "jpg", "jpeg", "webp"];
const _lecturerDir = () => path.join(process.cwd(), "documents", "signatures", "lecturer");

const _frozenHash = (projectName, nim, monthPadded) =>
  crypto.createHash("sha256")
    .update(`frozen_${_sanitize(projectName)}_${_sanitize(nim)}_${monthPadded}`)
    .digest("hex");

/**
 * Copy the PIC's current "user_<picId>" signature to a frozen file so it is
 * locked even if the user later edits their signature on the profile page.
 */
const snapshotLecturerSignature = async (projectId, nim, period) => {
  const [, month] = period.split("-");
  const monthPadded = String(month).padStart(2, "0");

  const project = await prismaClient.tmst_project.findFirst({
    where: { id: projectId },
    select: { nama: true, pic: true },
  });
  if (!project?.pic) return;

  const sourceHash = crypto.createHash("sha256")
    .update(`user_${project.pic}`)
    .digest("hex");
  const frozenHash = _frozenHash(project.nama, nim, monthPadded);
  const dir = _lecturerDir();

  for (const ext of _exts) {
    const src = path.join(dir, `${sourceHash}.${ext}`);
    if (fs.existsSync(src)) {
      const dest = path.join(dir, `${frozenHash}.${ext}`);
      fs.copyFileSync(src, dest);
      break;
    }
  }
};

/**
 * Delete the frozen snapshot so the next cycle loads the latest signature.
 */
const clearFrozenSignature = async (projectId, nim, period) => {
  const [, month] = period.split("-");
  const monthPadded = String(month).padStart(2, "0");

  const project = await prismaClient.tmst_project.findFirst({
    where: { id: projectId },
    select: { nama: true },
  });
  if (!project) return;

  const frozenHash = _frozenHash(project.nama, nim, monthPadded);
  const dir = _lecturerDir();

  for (const ext of _exts) {
    const frozenPath = path.join(dir, `${frozenHash}.${ext}`);
    if (fs.existsSync(frozenPath)) {
      fs.unlinkSync(frozenPath);
    }
  }
};

const create = async (req, res, next) => {
  try {
    const request = req.body;
    const result = await tmstProjectService.create(request);
    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Data berhasil ditambahkan.",
      data: result,
      url: req.protocol + "://" + req.get("host") + req.originalUrl,
    });
  } catch (e) {
    next(e);
  }
};

const remove = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;

    await tmstProjectService.remove(projectId);
    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Data berhasil dihapus.",
      data: "OK",
      url: req.protocol + "://" + req.get("host") + req.originalUrl,
    });
  } catch (e) {
    next(e);
  }
};

const list = async (req, res, next) => {
  try {
    const request = {
      namaProjek: req.query.namaProjek,
      page: req.query.page,
      status: req.query.status,
      status_ne: req.query.status_ne,
      size: req.query.size,
      id_kategori: req.query.id_kategori,
      filterMonth: req.query.filterMonth,
      merge: req.query.merge !== 'false',
    };
    const result = await tmstProjectService.list(request);
    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Data berhasil ditampilkan.",
      data: result.data,
      paging: result.paging,
      url: req.protocol + "://" + req.get("host") + req.originalUrl,
    });
  } catch (e) {
    next(e);
  }
};

const update = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const request = req.body;

    const result = await tmstProjectService.update(request, projectId);
    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Data berhasil diupdate.",
      data: result,
      url: req.protocol + "://" + req.get("host") + req.originalUrl,
    });
  } catch (e) {
    next(e);
  }
};


const select = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const merge = req.query.merge !== 'false'; // default true
    const result = await tmstProjectService.select(projectId, { merge });
    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Data berhasil dipilih.",
      data: result,
      url: req.protocol + "://" + req.get("host") + req.originalUrl,
    });
  } catch (e) {
    next(e);
  }
};

const showAvailableStudent = async (req, res, next) => {
  try {
    const userId = req.params.userId;

    const result = await tmstProjectService.showAvailableStudent(userId);
    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Data berhasil dipilih.",
      data: result,
      url: req.protocol + "://" + req.get("host") + req.originalUrl,
    });
  } catch (e) {
    next(e);
  }
};


const get = async (req, res, next) => {
  try {
    const id = req.params.userId;
    // console.log(id);
    const result = await tmstProjectService.get(id);
    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Data berhasil dipilih.",
      data: result,
      url: req.protocol + "://" + req.get("host") + req.originalUrl,
    });
  } catch (e) {
    next(e);
  }
}

const getEdit = async (req, res, next) => {
  try {
    const id = req.params.userId;
    const request = {
      projectId: req.query.projectId,
      userId: id
    }
    const result = await tmstProjectService.getEdit(request);
    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Data berhasil dipilih.",
      data: result,
      url: req.protocol + "://" + req.get("host") + req.originalUrl,
    });
  } catch (e) {
    next(e);
  }
}


const getMyProject = async (req, res, next) => {
  try {
    const id = req.params.userId;
    const request = {
      namaProjek: req.query.namaProjek,
      page: req.query.page,
      size: req.query.size,
      userId: id
    };
    // console.log(id);
    const result = await tmstProjectService.getMyProject(request);
    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Data berhasil dipilih.",
      data: result,
      url: req.protocol + "://" + req.get("host") + req.originalUrl,
    });
  } catch (e) {
    next(e);
  }
}

const getApplicants = async (req, res, next) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const result = await tmstProjectService.getApplicants(projectId);
    res.status(200).json({ data: result });
  } catch (e) {
    next(e);
  }
}

const submitForApproval = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const result = await tmstProjectService.submitForApproval(projectId);
    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Project diajukan. Menunggu persetujuan DIRMAWA.",
      data: result,
      url: req.protocol + "://" + req.get("host") + req.originalUrl,
    });
  } catch (e) {
    next(e);
  }
};

const complete = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const result = await tmstProjectService.complete(projectId);
    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Project telah diselesaikan.",
      data: result,
      url: req.protocol + "://" + req.get("host") + req.originalUrl,
    });
  } catch (e) {
    next(e);
  }
};

// Approve all timesheets for a project (set id_status = 1)
// Does NOT change project status
const approveTimesheets = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const result = await tmstProjectService.approveTimesheets(projectId);
    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Timesheet telah disetujui.",
      data: result,
      url: req.protocol + "://" + req.get("host") + req.originalUrl,
    });
  } catch (e) {
    next(e);
  }
};

// Check if project has approved timesheets
const hasApprovedTimesheets = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const hasApproved = await tmstProjectService.hasApprovedTimesheets(projectId);
    res.status(200).json({
      status: res.statusCode,
      success: true,
      data: { hasApprovedTimesheets: hasApproved },
      url: req.protocol + "://" + req.get("host") + req.originalUrl,
    });
  } catch (e) {
    next(e);
  }
};

// Approve timesheets for a specific student in a project
const approveStudentTimesheets = async (req, res, next) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const userId = req.params.userId; // Keep as string - id_peserta is NIM
    const { period } = req.body;
    const result = await tmstProjectService.approveStudentTimesheets(projectId, userId, period);

    // Freeze lecturer signature so it cannot change while status is Approved
    try {
      await snapshotLecturerSignature(projectId, userId, period);
    } catch (e) {
      console.warn("Failed to snapshot lecturer signature on approval:", e?.message || e);
    }

    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: result.allApproved
        ? "Semua mahasiswa telah disetujui. Status project menjadi Approved."
        : "Timesheet mahasiswa telah disetujui.",
      data: result,
      url: req.protocol + "://" + req.get("host") + req.originalUrl,
    });
  } catch (e) {
    next(e);
  }
};

// Request revision for a specific student's timesheets
const reviseStudentTimesheets = async (req, res, next) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const userId = req.params.userId; // Keep as string - id_peserta is NIM
    const { period, revisi } = req.body;
    const result = await tmstProjectService.reviseStudentTimesheets(projectId, userId, period, revisi);

    // Remove frozen snapshot so the next cycle reads the latest signature
    try {
      await clearFrozenSignature(projectId, userId, period);
    } catch (e) {
      console.warn("Failed to clear frozen signature on revision:", e?.message || e);
    }

    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Status diubah menjadi Butuh Revisi.",
      data: result,
      url: req.protocol + "://" + req.get("host") + req.originalUrl,
    });
  } catch (e) {
    next(e);
  }
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
