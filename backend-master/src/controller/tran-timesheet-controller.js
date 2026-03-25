import tranTimesheetService from "../service/tran-timesheet-service.js";
import options from "../helpers/optionTimesheet.js";
import fs from "fs";
import path from "path";
import ejs from "ejs";
import { PDFDocument } from "pdf-lib";
import axios from "axios";
import { prismaClient } from "../application/database.js";
import crypto from "crypto";
import { getBrowser, closePage } from "../helpers/browserPool.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const getAuthenticatedUserId = (req) => {
  const userId = req.user?.id || req.user?.userId || req.userId || req.auth?.id;
  
  if (!userId) {
    return null;
  }
  
  return String(userId);
};

const requireAuth = (req) => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    const error = new Error("Unauthorized: User ID tidak ditemukan");
    error.status = 401;
    throw error;
  }
  return userId;
};

const encryptFileName = (identifier) => {
  return crypto.createHash("sha256").update(identifier).digest("hex");
};

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
 * Sanitize string for filename
 */
const sanitizeForFilename = (str) => (str || "").toString().replace(/[^a-zA-Z0-9_-]/g, "_");

/**
 * Build standard API response
 */
const buildResponse = (res, req, data, message = "Data berhasil ditampilkan.", paging = null) => {
  const response = {
    status: res.statusCode,
    success: true,
    message,
    data,
    url: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
  };

  if (paging) {
    response.paging = paging;
  }

  return response;
};

/**
 * Clamp page size to valid range
 */
const clampPageSize = (size) => Math.min(parseInt(size) || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

//pdf generation with browser pool
/**
 * Load signature files for PDF.
 *
 * Lecturer signature priority:
 *  1. Frozen snapshot – created when the student's status is set to Approved.
 *     Guarantees the signature cannot change while approved.
 *  2. Latest "user_<picId>" signature – used for any non-approved student so
 *     the newest signature is always reflected.
 *  3. Per-project-month key – legacy fallback for older records.
 */
const loadSignatures = (idPengguna, project, month, lecturerPicId = null) => {
  const signatures = {};

  // Student signature (always latest)
  try {
    const studentHash = encryptFileName(idPengguna);
    const studentSig = findSignatureFile("student", studentHash);
    if (studentSig) {
      const b64 = fs.readFileSync(studentSig.path).toString("base64");
      signatures.student = `data:${studentSig.mime};base64,${b64}`;
    }
  } catch {
    // Student signature not found
  }

  // Lecturer signature
  try {
    const monthPadded = String(month).padStart(2, "0");

    // 1. Try frozen snapshot (exists only when student status = Approved)
    const frozenKey = `frozen_${sanitizeForFilename(project)}_${sanitizeForFilename(idPengguna)}_${monthPadded}`;
    const frozenHash = encryptFileName(frozenKey);
    const frozenSig = findSignatureFile("lecturer", frozenHash);

    if (frozenSig) {
      const b64 = fs.readFileSync(frozenSig.path).toString("base64");
      signatures.lecturer = `data:${frozenSig.mime};base64,${b64}`;
    } else if (lecturerPicId) {
      // 2. Latest signature of the PIC (not yet approved – always freshest)
      const latestHash = encryptFileName(`user_${lecturerPicId}`);
      const latestSig = findSignatureFile("lecturer", latestHash);
      if (latestSig) {
        const b64 = fs.readFileSync(latestSig.path).toString("base64");
        signatures.lecturer = `data:${latestSig.mime};base64,${b64}`;
      }
    } else {
      // 3. Legacy per-project-month key
      const legacyKey = `${sanitizeForFilename(project)}_${sanitizeForFilename(idPengguna)}_${monthPadded}`;
      const legacyHash = encryptFileName(legacyKey);
      const legacySig = findSignatureFile("lecturer", legacyHash);
      if (legacySig) {
        const b64 = fs.readFileSync(legacySig.path).toString("base64");
        signatures.lecturer = `data:${legacySig.mime};base64,${b64}`;
      }
    }
  } catch {
    // Lecturer signature not found
  }

  return signatures;
};

/**
 * Select template based on kategori ID
 */
const selectTemplate = (kategoriId) => {
  if (kategoriId === 7) return "timesheet_design.ejs";
  if (kategoriId === 8) return "timesheet_audio.ejs";
  return "timesheet.ejs";
};

/**
 * Get kategori info from result data
 */
const getKategoriInfo = (result) => {
  const firstRow = result?.data?.[0] || null;

  const kategoriId =
    firstRow?.kategoriId ||
    firstRow?.kategori_id ||
    firstRow?.tmst_project?.tmst_kategori_magang?.id ||
    null;

  const kategoriName =
    firstRow?.kategori ||
    firstRow?.kategori_magang ||
    firstRow?.tmst_project?.tmst_kategori_magang?.kategori ||
    result?.nama_kategori_magang ||
    null;

  return { kategoriId, kategoriName };
};

/**
 * Build PDF header template
 */
const buildHeaderTemplate = (templateFile) => {
  const headerLogoPath = path.join(process.cwd(), "public", "img", "uper.jpg");
  const headerLogoDataUrl = loadImageAsDataUrl(headerLogoPath, "https://i.imgur.com/nI4Ws89.png");

  const headerHtml = `
    <div style="width:200%; text-align:center; font-family: 'Times New Roman', serif; font-size:12px; padding-top:6px;">
      <div><img src="${headerLogoDataUrl}" style="height:70px; display:block; margin:0 auto;" /></div>
      <div style="font-weight:bold; margin-top:4px; font-size:14px;"><i>TIME SHEET</i> ABSENSI PEKERJA PARUH WAKTU</div>
    </div>
  `;

  const marginTop = templateFile === "timesheet.ejs" ? "30mm" : "30mm";

  return { headerHtml, marginTop };
};

/**
 * Build PDF footer template
 */
const buildFooterTemplate = (footerImageBase64) => {
  return `
    <div style="width: 100%; height: 100%; margin: 0; padding: 0; position: relative; font-family: 'Times New Roman', serif; font-size: 12px;">
      <div style="position: absolute; bottom: -2mm; left: 50%; transform: translateX(-50%); line-height: 0;">
        ${footerImageBase64 ? `<img src="${footerImageBase64}" alt="footer" style="max-height: 15mm; width: auto; display: block; margin: 0; padding: 0;" />` : ""}
      </div>
      <div class="page-number" style="position: absolute; bottom: 2mm; right: 10mm; font-size: 13px; font-weight: bold;">
        <span class="pageNumber"></span>
      </div>
    </div>
  `;
};

// ============================================================================
// CONTROLLER FUNCTIONS
// ============================================================================

const create = async (req, res, next) => {
  try {
    const userId = requireAuth(req);
    const userRole = req.user?.role || null;
    const result = await tranTimesheetService.create(req.body, userId, userRole);

    res.status(200).json(buildResponse(res, req, result, "Data berhasil ditambahkan."));
  } catch (e) {
    next(e);
  }
};

const remove = async (req, res, next) => {
  try {
    const userId = requireAuth(req);
    const userRole = req.user?.role || null;
    const timesheetId = parseInt(req.params.timesheetId);

    await tranTimesheetService.remove(timesheetId, userId, userRole);

    res.status(200).json(buildResponse(res, req, "OK", "Data berhasil dihapus."));
  } catch (e) {
    next(e);
  }
};

const update = async (req, res, next) => {
  try {
    const userId = requireAuth(req);
    const userRole = req.user?.role || null;
    const timesheetId = parseInt(req.params.timesheetId);
    const request = { ...req.body, id: timesheetId };

    const result = await tranTimesheetService.update(request, userId, userRole);

    res.status(200).json(buildResponse(res, req, result, "Data berhasil diupdate."));
  } catch (e) {
    next(e);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const { userId, month, year } = req.params;
    const { status, projectId } = req.body;

    if (!userId || !month || !year || !status) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: "userId, month, year, dan status harus disediakan.",
      });
    }

    await tranTimesheetService.updateStatus(
      userId,
      parseInt(month, 10),
      parseInt(year, 10),
      parseInt(status, 10),
      projectId ? parseInt(projectId, 10) : null
    );

    res.status(200).json(buildResponse(res, req, "OK", "Status timesheet berhasil diubah."));
  } catch (e) {
    next(e);
  }
};

const list = async (req, res, next) => {
  try {
    const result = await tranTimesheetService.list();

    res.status(200).json(buildResponse(res, req, result, "Data berhasil ditampilkan."));
  } catch (e) {
    next(e);
  }
};

const show = async (req, res, next) => {
  try {
    const userId = requireAuth(req);
    const result = await tranTimesheetService.show(userId);

    res.status(200).json(buildResponse(res, req, result, "Data berhasil dipilih."));
  } catch (e) {
    next(e);
  }
};

const showEdit = async (req, res, next) => {
  try {
    const userId = requireAuth(req);
    const timesheetId = parseInt(req.params.timesheetId);

    const result = await tranTimesheetService.showEdit(timesheetId, userId);

    res.status(200).json(buildResponse(res, req, result, "Data berhasil ditampilkan."));
  } catch (e) {
    next(e);
  }
};

const availableStudent = async (req, res, next) => {
  try {
    const request = {
      page: parseInt(req.query.page) || 1,
      size: clampPageSize(req.query.size),
      nama: req.query.nama,
      nim: req.query.nim,
      keyword: req.query.keyword,
      prodi: req.query.prodi,
      month: req.query.month,
    };

    const result = await tranTimesheetService.availableStudent(request);

    res.status(200).json(buildResponse(res, req, result.data, "Data berhasil ditampilkan.", result.paging));
  } catch (e) {
    next(e);
  }
};

const checkAvailable = async (req, res, next) => {
  try {
    const userId = requireAuth(req);
    const result = await tranTimesheetService.checkAvailable(userId);

    res.status(200).json(buildResponse(res, req, result, "Data berhasil dipilih."));
  } catch (e) {
    next(e);
  }
};

const selectAvailable = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const result = await tranTimesheetService.selectAvailable(userId);

    res.status(200).json(buildResponse(res, req, result, "Data berhasil dipilih."));
  } catch (e) {
    next(e);
  }
};

const getOneShow = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const request = {
      userId,
      project: req.query.project,
      page: parseInt(req.query.page) || 1,
      size: clampPageSize(req.query.size),
    };

    const result = await tranTimesheetService.getOneShow(request);

    res.status(200).json(buildResponse(res, req, result.data, "Data berhasil dipilih.", result.paging));
  } catch (e) {
    next(e);
  }
};

const generatePdf = async (req, res, next) => {
  try {
    const request = {
      id_pengguna: req.query.id_pengguna,
      month: parseInt(req.query.month),
      project: req.query.project,
    };

    const result = await tranTimesheetService.generatePdfTimesheet(request);

    if (result?.data?.error) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: result.data.error,
        url: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
      });
    }

    res.status(200).json({
      ...buildResponse(res, req, result.data, "Data successfully selected."),
      headers: result.headers,
      total: result.total,
      masterMonth: result.masterMonth,
      weeks: result.weeks,
    });
  } catch (e) {
    next(e);
  }
};

const generatePdfTimesheet = async (req, res, next) => {
  try {
    const request = {
      id_pengguna: req.query.id_pengguna,
      month: parseInt(req.query.month),
      year: parseInt(req.query.year) || new Date().getFullYear(),
      project: req.query.project,
      option: req.query.option,
    };

    // Get timesheet data
    const result = await tranTimesheetService.generatePdfTimesheet(request);

    if (result?.data?.error) {
      return res.status(400).json({ message: result.data.error });
    }

    if (!result?.data || !Array.isArray(result.data) || result.data.length === 0) {
      return res.status(400).json({ message: "Tidak ada data timesheet untuk bulan dan tahun yang dipilih" });
    }

    // Load signatures – pass lecturerPicId so the latest signature is used
    // when the student is not yet approved, and the frozen snapshot is used
    // when the student status is Approved.
    result.signatures = loadSignatures(request.id_pengguna, request.project, request.month, result.lecturerPicId ?? null);

    // Apply payment link if provided
    const paymentLink = req.query.paymentLink;
    if (paymentLink && Array.isArray(result.data)) {
      result.data.forEach((row) => {
        row.url_file_sp3 = [String(paymentLink)];
      });
    }

    // Load lecturer info
    if (result.lecturerPicId) {
      try {
        const lecturer = await prismaClient.tmst_pengguna.findFirst({
          where: { id: result.lecturerPicId },
          select: { id: true, nama: true, departemen: true, status: true },
        });

        if (lecturer) {
          result.lecturer = {
            id: lecturer.id,
            nama: lecturer.nama,
            jabatan: result.pic_jabatan || "Dosen Pembimbing",
            departemen: lecturer.departemen || null,
            status: lecturer.status || null,
          };
        }
      } catch {
        // Failed to load lecturer
      }
    }

    // Select template
    const { kategoriId, kategoriName } = getKategoriInfo(result);
    const templateFile = selectTemplate(kategoriId);
    const templatePath = path.join(process.cwd(), "src", "views", templateFile);

    if (!fs.existsSync(templatePath)) {
      return res.status(500).json({ message: `Template ${templateFile} not found` });
    }

    const templateHtml = fs.readFileSync(templatePath, "utf-8");

    // Load footer image
    const footerPath = path.join(process.cwd(), "public", "img", "footerTimesheet.png");
    result.footerImageBase64 = loadImageAsDataUrl(footerPath);

    // Load header logo
    const headerLogoPath = path.join(process.cwd(), "public", "img", "uper.jpg");
    const headerLogoDataUrl = loadImageAsDataUrl(headerLogoPath, "https://i.imgur.com/nI4Ws89.png");

    // Render EJS template
    const safeJabatan = result?.lecturer?.jabatan || result?.pic_jabatan || "Dosen Pembimbing";

    let rendered;
    try {
      rendered = ejs.render(templateHtml, {
        result,
        pic_jabatan: result?.pic_jabatan || null,
        jabatan: safeJabatan,
        headerLogoDataUrl,
        kategoriId,
        kategoriName,
      });
    } catch (ejsError) {
      return res.status(500).json({ message: `Template rendering error: ${ejsError.message}` });
    }

    // Generate PDF using browser pool
    let browser;
    let page = null;

    try {
      browser = await getBrowser();
    } catch (browserError) {
      // include the underlying error message so callers (and logs) know why it
      // failed; the pool already logs a stack trace.
      const msg = browserError && browserError.message ? browserError.message : String(browserError);
      return res.status(500).json({ message: `PDF generation failed: Could not get browser from pool (${msg})` });
    }

    try {
      page = await browser.newPage();
      await page.setContent(rendered, { waitUntil: "networkidle0" });

      const { headerHtml, marginTop } = buildHeaderTemplate(templateFile);
      const footerHtml = buildFooterTemplate(result.footerImageBase64);

      const pdfBuffer = await page.pdf({
        format: "A4",
        landscape: true,
        printBackground: true,
        displayHeaderFooter: true,
        margin: {
          top: marginTop,
          bottom: "15mm",
          right: "5mm",
          left: "8mm",
        },
        headerTemplate: headerHtml,
        footerTemplate: footerHtml,
      });

      await closePage(page);

      // Send response
      if (request.option === "lihat") {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "inline; filename=timesheet.pdf");
        res.send(Buffer.from(pdfBuffer));
      } else {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "attachment; filename=timesheet.pdf");
        res.send(Buffer.from(pdfBuffer));
      }
    } catch (err) {
      await closePage(page);
      next(err);
    }
  } catch (e) {
    next(e);
  }
};

const getAllPdf = async (req, res, next) => {
  try {
    const request = {
      month: parseInt(req.query.month),
      project: req.query.project,
      option: req.query.option,
    };

    const dataPdf = await tranTimesheetService.getAllMahasiswaTimesheet(request);

    if (dataPdf?.data?.error) {
      return res.status(400).json({ message: dataPdf.data.error });
    }

    const fetchPdfFromApi = async (apiUrl) => {
      const response = await axios.get(apiUrl, { responseType: "arraybuffer" });
      return response.data;
    };

    const doc = await PDFDocument.create();
    let checkMhs = null;

    // Add individual timesheets
    for (const data of dataPdf.data) {
      if (checkMhs !== data.NIM) {
        try {
          const timesheetApiUrl = `${process.env.BACKEND_URL}/api/generatePdfTimesheet?id_pengguna=${data.NIM}&month=${data.month}&option=unduh&project=${request.project}`;
          const timesheetPdfBuffer = await fetchPdfFromApi(timesheetApiUrl);
          const timesheetPdf = await PDFDocument.load(timesheetPdfBuffer);
          const timesheetPages = await doc.copyPages(timesheetPdf, timesheetPdf.getPageIndices());
          timesheetPages.forEach((page) => doc.addPage(page));
        } catch (err) {
          console.error(`Error fetching PDF for ${data.NIM}:`, err.message);
        }
      }
      checkMhs = data.NIM;
    }

    // Add recap PDF
    try {
      const rekapApiUrl = `${process.env.BACKEND_URL}/api/generatePdfRecap?project=${request.project}&month=${request.month}&option=unduh`;
      const rekapPdfBuffer = await fetchPdfFromApi(rekapApiUrl);
      const rekapPdf = await PDFDocument.load(rekapPdfBuffer);
      const rekapPages = await doc.copyPages(rekapPdf, rekapPdf.getPageIndices());
      rekapPages.forEach((page) => doc.addPage(page));
    } catch (err) {
      console.error("Error fetching recap PDF:", err.message);
    }

    // Add SP3 PDF
    const year = new Date().getFullYear();
    const formattedDate = `${year}${String(request.month).padStart(2, "0")}`;
    const sp3Path = `./documents/sp3/${dataPdf.initialProject}_${formattedDate}_sp3.pdf`;

    if (fs.existsSync(sp3Path)) {
      try {
        const sp3Pdf = await PDFDocument.load(fs.readFileSync(sp3Path));
        const sp3Pages = await doc.copyPages(sp3Pdf, sp3Pdf.getPageIndices());
        sp3Pages.forEach((page) => doc.addPage(page));
      } catch (err) {
        console.error("Error loading SP3 PDF:", err.message);
      }
    }

    // Save and send
    const pdfBytes = await doc.save();

    if (request.option === "lihat") {
      const base64PDF = Buffer.from(pdfBytes).toString("base64");
      res.send(`data:application/pdf;base64,${base64PDF}`);
    } else {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=${dataPdf.initialProject}_${formattedDate}_all.pdf`);
      res.end(pdfBytes);
    }
  } catch (e) {
    next(e);
  }
};

const deleteMany = async (req, res, next) => {
  try {
    const authUserId = requireAuth(req);
    const projectId = parseInt(req.params.projectId);

    // Allow staff/manager to view a specific student's timesheet via query param,
    // fallback to authenticated user for mahasiswa.
    const userId = req.query.userId ? String(req.query.userId) : authUserId;

    const request = {
      projectId,
      date: req.query.date,
      userId,
    };

    const result = await tranTimesheetService.deleteMany(request);

    res.status(200).json({ data: result });
  } catch (e) {
    next(e);
  }
};

const getEdit = async (req, res, next) => {
  try {
    const authUserId = requireAuth(req);
    const projectId = parseInt(req.params.projectId);

    // Allow staff/manager to view a specific student's timesheet via query param,
    // fallback to authenticated user for mahasiswa.
    // Ensure userId is string for validation (may come as number from frontend)
    const userId = req.query.userId 
      ? String(req.query.userId) 
      : authUserId;

    const request = {
      projectId,
      date: req.query.date,
      userId,
    };

    const result = await tranTimesheetService.getEdit(request);

    res.status(200).json(buildResponse(res, req, result, "Data berhasil dipilih."));
  } catch (e) {
    next(e);
  }
};

const createUpdate = async (req, res, next) => {
  try {
    const userId = requireAuth(req);
    const userRole = req.user?.role || null;
    const result = await tranTimesheetService.createUpdate(req.body, null, userId, userRole);

    res.status(200).json(buildResponse(res, req, result, "Data berhasil ditambahkan."));
  } catch (e) {
    next(e);
  }
};

const submitPayment = async (req, res, next) => {
  try {
    const request = {
      project: req.query.project,
      page: parseInt(req.query.page) || 1,
      size: clampPageSize(req.query.size),
      pic: req.query.pic,
    };

    const result = await tranTimesheetService.submitPayment(request);

    res.status(200).json(buildResponse(res, req, result.data, "Data berhasil ditampilkan.", result.paging));
  } catch (e) {
    next(e);
  }
};

const getSubmitPayment = async (req, res, next) => {
  try {
    const request = {
      projectId: parseInt(req.query.projectId),
      date: req.query.date,
    };

    const result = await tranTimesheetService.getSubmitPayment(request);

    res.status(200).json({
      ...buildResponse(res, req, result.data, "Data berhasil ditampilkan.", result.paging),
      hasTimesheetData: result.hasTimesheetData,
      canProceed: result.canProceed,
    });
  } catch (e) {
    next(e);
  }
};

const getKaryaInfo = async (req, res, next) => {
  try {
    const tranProjectId = parseInt(req.params.tranProjectId);
    const result = await tranTimesheetService.getKaryaInfo(tranProjectId);

    res.status(200).json(buildResponse(res, req, result, "Data karya berhasil ditampilkan."));
  } catch (e) {
    next(e);
  }
};

export default {
  create,
  remove,
  list,
  update,
  show,
  showEdit,
  availableStudent,
  checkAvailable,
  selectAvailable,
  generatePdf,
  generatePdfTimesheet,
  getAllPdf,
  getOneShow,
  deleteMany,
  getEdit,
  createUpdate,
  submitPayment,
  getSubmitPayment,
  getKaryaInfo,
  updateStatus,
};