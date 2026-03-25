import tranPaymentService from "../service/tran-payment-service.js";
import { PDFDocument } from "pdf-lib";
const fs = (await import("fs")).default;

const create = async (req, res, next) => {
  try {
    const request = req.body;
    const result = await tranPaymentService.create(request);
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
    const paymentId = req.params.paymentId;

    await tranPaymentService.remove(paymentId);
    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Data berhasil ditambahkan.",
      data: "OK",
      url: req.protocol + "://" + req.get("host") + req.originalUrl,
    });
  } catch (e) {
    next(e);
  }
};

const list = async (req, res, next) => {
  try {
    const result = await tranPaymentService.list();
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

const list_admin = async (req, res, next) => {
  try {
    const status = req.params.status;
    const request = {
      namaProjek: req.query.namaProjek,
      page: req.query.page,
      status: status,
    };
    const result = await tranPaymentService.list_admin(request);
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

const detail_payment = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const result = await tranPaymentService.detail_payment(projectId);
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
    const paymentId = req.params.paymentId;
    const request = req.body;
    request.id = paymentId;
    const result = await tranPaymentService.update(request);
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

const showSp3 = async (req, res, next) => {
  try {
    const request = {
      option: req.query.option,
      month: req.query.month,
      idProject: req.query.idProject,
    };
    const doc = await PDFDocument.create();
    const dataPdf = await tranPaymentService.showSp3(request);
    // console.log(dataPdf);
    const now = new Date();
    const year = now.getFullYear();
    // const year = 2023;
    const month = request.month;

    const formattedDate = `${year}${String(month).padStart(2, "0")}`;
    // console.log(dataPdf);
    const sp3Pdf = await PDFDocument.load(fs.readFileSync(`./documents/sp3/${dataPdf.inisial_project}_${formattedDate}_sp3.pdf`));
    const contentSp3 = await doc.copyPages(sp3Pdf, sp3Pdf.getPageIndices());
    for (const page of contentSp3) {
      doc.addPage(page);
    }

    await doc
      .save()
      .then((result) => {
        if (request.option == "lihat") {
          const combinedPdfBuffer = Buffer.from(result);
          const base64PDF = combinedPdfBuffer.toString("base64");
          const pdfDataUri = `data:application/pdf;base64,${base64PDF}`;
          res.send(pdfDataUri);
        } else if (request.option == "unduh") {
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Disposition", `attachment; filename=${dataPdf.inisial_project}_${formattedDate}_sp3.pdf`);
          res.end(result);
        }
      })
      .catch((error) => {
        // console.log(error);
      });

    // console.log("PDF berhasil disimpan");
  } catch (e) {
    next(e);
  }
};

const updatePaymentStatus = async (req, res, next) => {
  try {
    const { projectId, periode, status, totalTagihan } = req.body;

    if (!projectId || !periode || !status) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: "projectId, periode, dan status harus disediakan.",
      });
    }

    const result = await tranPaymentService.updatePaymentStatus(
      parseInt(projectId, 10),
      periode,
      parseInt(status, 10),
      totalTagihan ? parseInt(totalTagihan, 10) : 0
    );

    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Status pembayaran berhasil diubah.",
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
  list_admin,
  detail_payment,
  showSp3,
  updatePaymentStatus,
};
