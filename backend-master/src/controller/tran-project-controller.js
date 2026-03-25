import tranProjectService from "../service/tran-project-service.js";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import ejs from "ejs";
import { getBrowser, closePage } from "../helpers/browserPool.js";
import options from "../helpers/optionTimesheet.js";

const create = async (req, res, next) => {
  try {
    const request = req.body;
    // console.log("request: ", request);
    const result = await tranProjectService.create(request);
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

    await tranProjectService.remove(projectId);
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
    const result = await tranProjectService.list();
    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Data berhasil ditampilkan.",
      data: result,
      url: req.protocol + "://" + req.get("host") + req.originalUrl,
    });
  } catch (e) {
    next(e);
  }
};

const update = async (req, res, next) => {
  try {
    const request = req.body;
    const id = req.params.projectId;
    // console.log(request);
    const result = await tranProjectService.update(request, id);
    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Data berhasil diubah.",
      data: result,
      url: req.protocol + "://" + req.get("host") + req.originalUrl,
    });
  } catch (e) {
    next(e);
  }
};

const generatePdf = async (req, res, next) => {
  try {
    const request = {
      project: req.query.project,
      month: req.query.month,
      year: req.query.year,
    };

    const result = await tranProjectService.recapPdf(request);

    // Check for error in result.data (defensive check)
    if (result.data && result.data.error) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: result.data.error,
        url: req.protocol + "://" + req.get("host") + req.originalUrl,
      });
    }

    // Success case - return data
    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Data berhasil dipilih.",
      data: result.data,
      headers: result.headers,
      total: result.total,
      month: result.month,
      url: req.protocol + "://" + req.get("host") + req.originalUrl,
    });
  } catch (e) {
    next(e);
  }
};

const recapPdf = async (req, res, next) => {
  try {
    const request = {
      project: req.query.project,
      month: req.query.month,
      year: req.query.year,
      option: req.query.option,
      firstUserId: req.query.firstUserId,
      reportType: req.query.reportType, // Tambahan untuk mendukung main/secondary
    };

    const result = await tranProjectService.recapPdf(request);

    // Jika tidak ada option, kembalikan JSON dengan files[]
    if (!request.option) {
      return res.status(200).json({
        status: res.statusCode,
        success: true,
        message: "Data files tersedia.",
        files: result.files,
        url: req.protocol + "://" + req.get("host") + req.originalUrl,
      });
    }

    // Load logo and footer images so we can preload footer image in template and set phantom footer
    const logoPath = path.join(process.cwd(), 'public', 'img', 'header-logo.png');
    const headerLogoPath = path.join(process.cwd(), 'public', 'img', 'uper.jpg');
    const footerPath = path.join(process.cwd(), 'public', 'img', 'footerTimesheet.png');
    let logoBase64 = '';
    let headerLogoBase64 = '';
    let footerBase64 = '';
    try {
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
      }
    } catch (err) {
      console.log('Logo not found:', err.message);
    }
    try {
      if (fs.existsSync(headerLogoPath)) {
        const headerLogoBuffer = fs.readFileSync(headerLogoPath);
        headerLogoBase64 = `data:image/jpeg;base64,${headerLogoBuffer.toString('base64')}`;
      }
    } catch (err) {
      console.log('Header logo not found:', err.message);
    }
    try {
      if (fs.existsSync(footerPath)) {
        const footerBuffer = fs.readFileSync(footerPath);
        footerBase64 = `data:image/png;base64,${footerBuffer.toString('base64')}`;
      }
    } catch (err) {
      console.log('Footer not found:', err.message);
    }

    result.logoBase64 = logoBase64;

    // Determine footer img src (prefer data URI, fallback to file URI)
    let footerImgSrc = '';
    if (footerBase64) {
      footerImgSrc = footerBase64;
    } else if (footerPath) {
      const absPath = footerPath.replace(/\\/g, '/');
      footerImgSrc = `file:///${absPath}`;
    }
    result.footerImgSrc = footerImgSrc;

    // Choose template: use karya template when reportType is 'karya' or data indicates karya
    const isKaryaReport = request.reportType === 'karya' || (result && result.data && Array.isArray(result.data) && result.data.some(r => r.isKarya));
    const templateName = isKaryaReport ? 'rekap_karya.ejs' : 'rekap.ejs';
    const templatePath = path.join(process.cwd(), 'src', 'views', templateName);
    const templateHtml = fs.readFileSync(templatePath, "utf-8");
    const safeJabatan = (result && result.lecturer && result.lecturer.jabatan) ? result.lecturer.jabatan : (result && result.pic_jabatan) ? result.pic_jabatan : 'Dosen Pembimbing';
    const ejsRenderedHtml = ejs.render(templateHtml, { result, jabatan: safeJabatan });

    // Build header template with logo and title (Puppeteer format)
    const headerTemplateHtml = headerLogoBase64 ? `
      <div style="width:200%;text-align:center;font-family:'Times New Roman',serif;font-size:12px;padding-top:6px;">
        <div><img src="${headerLogoBase64}" style="height:70px;display:block;margin:0 auto;" /></div>
        <div style="font-weight:bold;margin-top:4px;font-size:14px;">FORMULIR REKAPITULASI PEKERJA PARUH WAKTU</div>
      </div>
    ` : `
      <div style="width:200%;text-align:center;font-family:'Times New Roman',serif;font-size:14px;font-weight:bold;padding-top:10px;">
        FORMULIR REKAPITULASI PEKERJA PARUH WAKTU
      </div>
    `;

    // Build footer template (Puppeteer format)
    const footerTemplateHtml = footerImgSrc ? `
      <div style="width:200%;text-align:center;position:relative;">
        <img src="${footerImgSrc}" style="display:block;margin:0 auto;width:50%;max-width:600px;height:auto;" />
        <div style="position:absolute;right:20mm;bottom:2mm;font-family:'Times New Roman',serif;font-size:10px;font-weight:bold;"><span class="pageNumber"></span></div>
      </div>
    ` : `
      <div style="width:200%;text-align:right;padding:5px 40px;">
        <span style="font-family:'Times New Roman',serif;font-size:10px;font-weight:bold;" class="pageNumber"></span>
      </div>
    `;

    // Use Puppeteer for PDF generation (more reliable header/footer)
    let page = null;
    try {
      const browser = await getBrowser();
      page = await browser.newPage();
      await page.setContent(ejsRenderedHtml, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        margin: {
          top: '35mm',
          right: '10mm',
          bottom: '30mm',
          left: '10mm'
        },
        displayHeaderFooter: true,
        headerTemplate: headerTemplateHtml,
        footerTemplate: footerTemplateHtml
      });

      await closePage(page);

      if (request.option == "lihat") {
        const pdfBufferNode = Buffer.from(pdfBuffer);
        const base64PDF = pdfBufferNode.toString("base64");
        const pdfDataUri = `data:application/pdf;base64,${base64PDF}`;
        res.send(pdfDataUri);
      } else if (request.option == "unduh") {
        const monthLabel = result && result.monthInfo && result.monthInfo.month ? result.monthInfo.month : (request.month || 'All');
        const reportSuffix = request.reportType === 'secondary' ? '_Tambahan' : '';
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=Rekapitulasi_Pekerja_Paruh_Waktu_${monthLabel}${reportSuffix}.pdf`);
        res.end(Buffer.from(pdfBuffer));
      }
    } catch (pdfError) {
      console.log('PDF generation error:', pdfError);
      if (page) await closePage(page);
      throw pdfError;
    }
  } catch (e) {
    console.log(e);
    next(e);
  }
};

const detailAvailableStudent = async (req, res, next) => {
  try {
    const userId = req.params.userId;

    const result = await tranProjectService.detailAvailableStudent(userId);
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

const getOne = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const result = await tranProjectService.getOne(projectId);
    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Data berhasil ditampilkan.",
      data: result,
      url: req.protocol + "://" + req.get("host") + req.originalUrl,
    });
  } catch (e) {
    next(e);
  }
};



const get = async (req, res, next) => {
  try {
    const request = {
      projectId: Number(req.query.projectId),
      userId: String(req.query.userId),
    };
    const result = await tranProjectService.get(request);
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


const removeMany = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;

    await tranProjectService.removeMany(projectId);
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

const userRecapPdf = async (req, res, next) => {
  try {
    const request = {
      userId: req.query.userId,
      month: req.query.month,
      year: req.query.year,
      option: req.query.option,
      reportType: req.query.reportType,
    };

    const result = await tranProjectService.userRecapPdf(request);

    // If frontend sent a lecturer signature in header, persist it under the
    // canonical key so templates can pick it up when rendering the recap PDF.
    try {
      const lecturerDataHeader = req.headers['x-lecturer-dataurl'] || req.headers['x-lecturer-signature'];
      if (lecturerDataHeader) {
        const dataUrl = Array.isArray(lecturerDataHeader) ? lecturerDataHeader[0] : String(lecturerDataHeader);
        const match = dataUrl.match(/^data:(image\/[\-+\w.]+);base64,(.*)$/i);
        if (match) {
          const mime = match[1].toLowerCase();
          const base64 = match[2];
          const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';

          // Determine project name to build the same key used elsewhere
          let projectName = null;
          if (result && result.data && Array.isArray(result.data) && result.data.length > 0 && result.data[0].nama_project) {
            projectName = String(result.data[0].nama_project);
          }
          if (!projectName) {
            // fallback: try to use first project from service if available
            if (result && result.data && Array.isArray(result.data) && result.data.length > 0) {
              projectName = String(result.data[0].nama_project || 'project');
            } else {
              projectName = 'project';
            }
          }

          const sanitize = (s) => (s || '').toString().replace(/[^a-zA-Z0-9_-]/g, '_');
          const key = `${sanitize(projectName)}_${sanitize(request.userId)}_${sanitize(request.month)}`;
          const encryptedFileName = crypto.createHash('sha256').update(key).digest('hex');

          const lecturerDir = path.join(process.cwd(), 'documents', 'signatures', 'lecturer');
          if (!fs.existsSync(lecturerDir)) fs.mkdirSync(lecturerDir, { recursive: true });
          const filePath = path.join(lecturerDir, `${encryptedFileName}.${ext}`);
          fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));

          // Remove other extension variants to keep single canonical file
          try {
            const others = ['png', 'jpg', 'jpeg', 'webp'].filter(e => e !== ext);
            for (const o of others) {
              const p = path.join(lecturerDir, `${encryptedFileName}.${o}`);
              if (fs.existsSync(p)) {
                try { fs.unlinkSync(p); } catch (e) { }
              }
            }
          } catch (e) { }
        }
      }
    } catch (sigSaveErr) {
      console.warn('Failed to persist lecturer signature from header:', sigSaveErr && sigSaveErr.message ? sigSaveErr.message : sigSaveErr);
    }

    // Jika tidak ada option, return files[] yang tersedia
    if (!request.option) {
      if (result.files) {
        return res.status(200).json({
          status: res.statusCode,
          success: true,
          message: "Files tersedia.",
          files: result.files,
          url: req.protocol + "://" + req.get("host") + req.originalUrl,
        });
      }
      // Jika ada error
      if (result.data && result.data.error) {
        return res.status(400).json({
          status: res.statusCode,
          success: false,
          message: result.data.error,
          url: req.protocol + "://" + req.get("host") + req.originalUrl,
        });
      }
    }

    // Jika ada option (lihat/unduh), cek error dulu
    if (result.data && result.data.error) {
      return res.status(400).json({
        status: res.statusCode,
        success: false,
        message: result.data.error,
        url: req.protocol + "://" + req.get("host") + req.originalUrl,
      });
    }

    // Load logo and footer images
    const logoPath = path.join(process.cwd(), 'public', 'img', 'header-logo.png');
    const headerLogoPath = path.join(process.cwd(), 'public', 'img', 'uper.jpg');
    const footerPath = path.join(process.cwd(), 'public', 'img', 'footerTimesheet.png');

    let logoBase64 = '';
    let headerLogoBase64 = '';
    let footerBase64 = '';

    try {
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
      }
    } catch (err) {
      console.log('Logo not found:', err.message);
    }

    try {
      if (fs.existsSync(headerLogoPath)) {
        const headerLogoBuffer = fs.readFileSync(headerLogoPath);
        headerLogoBase64 = `data:image/jpeg;base64,${headerLogoBuffer.toString('base64')}`;
      }
    } catch (err) {
      console.log('Header logo not found:', err.message);
    }

    try {
      if (fs.existsSync(footerPath)) {
        const footerBuffer = fs.readFileSync(footerPath);
        footerBase64 = `data:image/png;base64,${footerBuffer.toString('base64')}`;
      }
    } catch (err) {
      console.log('Footer not found:', err.message);
    }

    // Add logo to result
    result.logoBase64 = logoBase64;

    // Determine footer image source (prefer data URI, fallback to file URI)
    let footerImgSrc = '';
    if (footerBase64) {
      footerImgSrc = footerBase64;
    } else if (footerPath) {
      const absPath = footerPath.replace(/\\/g, '/');
      footerImgSrc = `file:///${absPath}`;
    }

    // expose footerImgSrc to template so we can preload it in the document body
    result.footerImgSrc = footerImgSrc;

    // Try to attach an existing saved lecturer signature for this user so template can render it.
    try {
      result.signatures = result.signatures || {};
      const sanitize = (s) => (s || '').toString().replace(/[^a-zA-Z0-9_-]/g, '_');
      const userKey = `user_${request.userId}`;
      const encryptedUserKey = crypto.createHash('sha256').update(userKey).digest('hex');
      const lecturerDir = path.join(process.cwd(), 'documents', 'signatures', 'lecturer');
      const exts = ['png', 'jpg', 'jpeg', 'webp'];
      for (const ext of exts) {
        const p = path.join(lecturerDir, `${encryptedUserKey}.${ext}`);
        if (fs.existsSync(p)) {
          const b64 = fs.readFileSync(p).toString('base64');
          const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
          result.signatures.lecturer = `data:${mime};base64,${b64}`;
          break;
        }
      }
      // Also try project-based key (older flows save per-project-month)
      if (!result.signatures.lecturer && result && result.data && Array.isArray(result.data) && result.data.length > 0) {
        const projectName = String(result.data[0].nama_project || 'project');
        const projectKey = `${sanitize(projectName)}_${sanitize(request.userId)}_${sanitize(request.month)}`;
        const encryptedProjectKey = crypto.createHash('sha256').update(projectKey).digest('hex');
        for (const ext of exts) {
          const p = path.join(lecturerDir, `${encryptedProjectKey}.${ext}`);
          if (fs.existsSync(p)) {
            const b64 = fs.readFileSync(p).toString('base64');
            const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
            result.signatures.lecturer = `data:${mime};base64,${b64}`;
            break;
          }
        }
      }
    } catch (attachErr) {
      console.warn('Failed to attach lecturer signature for recap:', attachErr && attachErr.message ? attachErr.message : attachErr);
    }

    console.log('Footer image source used for PDF footer:', footerImgSrc ? (footerImgSrc.length > 120 ? footerImgSrc.slice(0, 120) + '...[truncated]' : footerImgSrc) : 'none');

    // Generate PDF
    // Determine if we should use the karya recap template
    const isKarya = request.reportType === 'karya' || (result && result.data && Array.isArray(result.data) && result.data.some(r => r.isKarya));
    const templateNameUser = isKarya ? 'rekap_karya.ejs' : 'rekap.ejs';
    const templatePathUser = path.join(process.cwd(), 'src', 'views', templateNameUser);
    const templateHtmlUser = fs.readFileSync(templatePathUser, "utf-8");
    const safeJabatanUser = (result && result.lecturer && result.lecturer.jabatan) ? result.lecturer.jabatan : (result && result.pic_jabatan) ? result.pic_jabatan : 'Dosen Pembimbing';
    const ejsRenderedHtmlUser = ejs.render(templateHtmlUser, { result, jabatan: safeJabatanUser });

    // Build header template with logo and title (Puppeteer format)
    const headerTemplateHtmlUser = headerLogoBase64 ? `
      <div style="width:200%;text-align:center;font-family:'Times New Roman',serif;font-size:12px;padding-top:6px;">
        <div><img src="${headerLogoBase64}" style="height:70px;display:block;margin:0 auto;" /></div>
        <div style="font-weight:bold;margin-top:4px;font-size:14px;">FORMULIR REKAPITULASI PEKERJA PARUH WAKTU</div>
      </div>
    ` : `
      <div style="width:200%;text-align:center;font-family:'Times New Roman',serif;font-size:14px;font-weight:bold;padding-top:10px;">
        FORMULIR REKAPITULASI PEKERJA PARUH WAKTU
      </div>
    `;

    // Build footer template (Puppeteer format)
    const footerTemplateHtmlUser = footerImgSrc ? `
      <div style="width:200%;text-align:center;position:relative;">
        <img src="${footerImgSrc}" style="display:block;margin:0 auto;width:50%;max-width:600px;height:auto;" />
        <div style="position:absolute;right:20mm;bottom:2mm;font-family:'Times New Roman',serif;font-size:10px;font-weight:bold;"><span class="pageNumber"></span></div>
      </div>
    ` : `
      <div style="width:200%;text-align:right;padding:5px 40px;">
        <span style="font-family:'Times New Roman',serif;font-size:10px;font-weight:bold;" class="pageNumber"></span>
      </div>
    `;

    // Use Puppeteer for PDF generation (more reliable header/footer)
    let page = null;
    try {
      const browser = await getBrowser();
      page = await browser.newPage();
      await page.setContent(ejsRenderedHtmlUser, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        margin: {
          top: '35mm',
          right: '10mm',
          bottom: '30mm',
          left: '10mm'
        },
        displayHeaderFooter: true,
        headerTemplate: headerTemplateHtmlUser,
        footerTemplate: footerTemplateHtmlUser
      });

      await closePage(page);

      if (request.option === "lihat") {
        const pdfBufferNode = Buffer.from(pdfBuffer);
        const base64PDF = pdfBufferNode.toString("base64");
        const pdfDataUri = `data:application/pdf;base64,${base64PDF}`;
        res.send(pdfDataUri);
      } else if (request.option === "unduh") {
        const monthLabel = result && result.monthInfo && result.monthInfo.month ? result.monthInfo.month : (request.month || 'All');
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=Rekapitulasi_Pekerja_Paruh_Waktu_${monthLabel}.pdf`);
        res.end(Buffer.from(pdfBuffer));
      }
    } catch (pdfError) {
      console.log('PDF generation error:', pdfError);
      if (page) await closePage(page);
      throw pdfError;
    }
  } catch (e) {
    console.log(e);
    next(e);
  }
};

const myProjectRecapPdf = async (req, res, next) => {
  try {
    const request = {
      userId: req.query.userId,
      year: parseInt(req.query.year),
      option: req.query.option,
    };

    const result = await tranProjectService.myProjectRecapPdf(request);

    // Check for error
    if (result.error) {
      return res.status(400).json({
        status: res.statusCode,
        success: false,
        message: result.error,
        url: req.protocol + "://" + req.get("host") + req.originalUrl,
      });
    }

    // Check for empty projects
    if (!result.projects || result.projects.length === 0) {
      return res.status(200).json({
        status: res.statusCode,
        success: false,
        message: `Tidak ada data rekapitulasi untuk tahun ${request.year}`,
        data: { user: result.user, projects: [] },
        url: req.protocol + "://" + req.get("host") + req.originalUrl,
      });
    }

    // If no option provided, return JSON data
    if (!request.option) {
      return res.status(200).json({
        status: res.statusCode,
        success: true,
        message: "Data berhasil dipilih.",
        data: result,
        url: req.protocol + "://" + req.get("host") + req.originalUrl,
      });
    }

    // Generate PDF
    const templatePath = path.join(process.cwd(), 'src', 'views', 'myproject_recap.ejs');
    const templateHtml = fs.readFileSync(templatePath, "utf-8");

    const ejsRenderedHtml = ejs.render(templateHtml, {
      data: result,
      year: request.year
    });

    let page = null;
    try {
      const browser = await getBrowser();
      page = await browser.newPage();
      await page.setContent(ejsRenderedHtml, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
      });

      await closePage(page);

      if (request.option === "lihat") {
        const base64PDF = Buffer.from(pdfBuffer).toString("base64");
        const pdfDataUri = `data:application/pdf;base64,${base64PDF}`;
        res.send(pdfDataUri);
      } else if (request.option === "unduh") {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=Rekapitulasi_MyProject_${request.year}.pdf`);
        res.end(Buffer.from(pdfBuffer));
      }
    } catch (pdfError) {
      console.log('PDF generation error:', pdfError);
      if (page) await closePage(page);
      throw pdfError;
    }
  } catch (e) {
    console.log(e);
    next(e);
  }
};

const projectRecapPdf = async (req, res, next) => {
  try {
    const request = {
      projectId: req.query.projectId,
      month: req.query.month,
      year: req.query.year,
    };

    console.log('projectRecapPdf controller called with:', request);

    const result = await tranProjectService.projectRecapPdf(request);

    console.log('Service returned:', { hasData: !!result.data, hasError: !!(result.data && result.data.error) });

    if (result.data && result.data.error) {
      console.log('Returning error:', result.data.error);
      return res.status(404).json({
        success: false,
        message: result.data.error,
      });
    }

    // Load logo and footer images
    const logoPath = path.join(process.cwd(), 'public', 'img', 'header-logo.png');
    const footerPath = path.join(process.cwd(), 'public', 'img', 'footerTimesheet.png');
    let logoBase64 = '';
    let headerLogoBase64 = '';
    let footerBase64 = '';

    try {
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
        headerLogoBase64 = logoBase64;
        console.log('Logo loaded successfully');
      } else {
        console.log('Logo not found at:', logoPath);
      }
    } catch (err) {
      console.log('Header logo error:', err.message);
    }

    try {
      if (fs.existsSync(footerPath)) {
        const footerBuffer = fs.readFileSync(footerPath);
        footerBase64 = `data:image/png;base64,${footerBuffer.toString('base64')}`;
        console.log('Footer loaded successfully');
      } else {
        console.log('Footer not found at:', footerPath);
      }
    } catch (err) {
      console.log('Footer error:', err.message);
    }

    result.logoBase64 = logoBase64;

    // Determine footer image source
    let footerImgSrc = '';
    if (footerBase64) {
      footerImgSrc = footerBase64;
    } else if (footerPath) {
      const absPath = footerPath.replace(/\\/g, '/');
      footerImgSrc = `file:///${absPath}`;
    }

    result.footerImgSrc = footerImgSrc;

    // Try to attach lecturer signature
    try {
      result.signatures = result.signatures || {};
      const sanitize = (s) => (s || '').toString().replace(/[^a-zA-Z0-9_-]/g, '_');
      const lecturerDir = path.join(process.cwd(), 'documents', 'signatures', 'lecturer');
      const exts = ['png', 'jpg', 'jpeg', 'webp'];

      // Try multiple key patterns
      const keysToTry = [];

      // 1. User-based key (most common for lecturer)
      if (result.pic) {
        keysToTry.push(`user_${result.pic}`);
      }

      // 2. Project-PIC-Month key (used by service)
      if (result.projectName && result.pic) {
        keysToTry.push(`${sanitize(result.projectName)}_${result.pic}_${request.month}`);
      }

      // 3. Project-ProjectId-Month key (alternative)
      if (result.projectName) {
        keysToTry.push(`${sanitize(result.projectName)}_${sanitize(request.projectId)}_${sanitize(request.month)}`);
      }

      console.log('Trying signature keys:', keysToTry);

      for (const key of keysToTry) {
        if (result.signatures.lecturer) break;

        const encryptedKey = crypto.createHash('sha256').update(key).digest('hex');
        console.log(`Trying key: ${key} -> hash: ${encryptedKey.substring(0, 16)}...`);

        for (const ext of exts) {
          const p = path.join(lecturerDir, `${encryptedKey}.${ext}`);
          if (fs.existsSync(p)) {
            const b64 = fs.readFileSync(p).toString('base64');
            const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
            result.signatures.lecturer = `data:${mime};base64,${b64}`;
            console.log('✓ Signature found at:', p);
            break;
          }
        }
      }

      if (!result.signatures.lecturer) {
        console.log('✗ No signature found after trying all keys');
      }
    } catch (attachErr) {
      console.warn('Failed to attach lecturer signature:', attachErr && attachErr.message ? attachErr.message : attachErr);
    }

    // Render PDF using appropriate template based on project type
    const templateName = result.isKarya ? 'rekap_karya.ejs' : 'rekap.ejs';
    const templatePath = path.join(process.cwd(), 'src', 'views', templateName);
    const templateHtml = fs.readFileSync(templatePath, 'utf-8');
    const safeJabatan = result.jabatan || 'Dosen Pembimbing';
    const ejsRenderedHtml = ejs.render(templateHtml, { result, jabatan: safeJabatan });

    // Build header template
    const headerTitle = result.isKarya
      ? 'FORMULIR REKAPITULASI PEKERJA PARUH WAKTU DESAIN'
      : 'FORMULIR REKAPITULASI PEKERJA PARUH WAKTU';
    const headerTemplateHtml = headerLogoBase64 ? `
      <div style="width:200%;text-align:center;font-family:'Times New Roman',serif;font-size:12px;padding-top:6px;">
        <div><img src="${headerLogoBase64}" style="height:70px;display:block;margin:0 auto;" /></div>
        <div style="font-weight:bold;margin-top:4px;font-size:14px;">${headerTitle}</div>
      </div>
    ` : `
      <div style="width:200%;text-align:center;font-family:'Times New Roman',serif;font-size:14px;font-weight:bold;padding-top:10px;">
        ${headerTitle}
      </div>
    `;

    // Build footer template
    const footerTemplateHtml = footerImgSrc ? `
      <div style="width:200%;text-align:center;position:relative;">
        <img src="${footerImgSrc}" style="display:block;margin:0 auto;width:50%;max-width:600px;height:auto;" />
        <div style="position:absolute;right:20mm;bottom:2mm;font-family:'Times New Roman',serif;font-size:10px;font-weight:bold;"><span class="pageNumber"></span></div>
      </div>
    ` : `
      <div style="width:200%;text-align:right;padding:5px 40px;">
        <span style="font-family:'Times New Roman',serif;font-size:10px;font-weight:bold;" class="pageNumber"></span>
      </div>
    `;

    // Generate PDF using Puppeteer
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
      await page.setContent(ejsRenderedHtml, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        landscape: true,
        margin: { top: '35mm', right: '10mm', bottom: '25mm', left: '10mm' },
        displayHeaderFooter: true,
        headerTemplate: headerTemplateHtml,
        footerTemplate: footerTemplateHtml,
        printBackground: true,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=rekap_${result.projectName}_${request.month}_${request.year}.pdf`);
      res.send(Buffer.from(pdfBuffer));
    } finally {
      await closePage(page);
    }
  } catch (e) {
    next(e);
  }
};

const markAsReviewed = async (req, res, next) => {
  try {
    const { id_tran_project } = req.body;
    const result = await tranProjectService.markAsReviewed(id_tran_project);
    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Timesheet marked as reviewed.",
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
  generatePdf,
  detailAvailableStudent,
  recapPdf,
  getOne,
  get,
  removeMany,
  userRecapPdf,
  myProjectRecapPdf,
  projectRecapPdf,
  markAsReviewed,
};
