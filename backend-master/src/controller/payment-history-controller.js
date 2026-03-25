import paymentHistoryValidation from "../service/payment-history-service.js";

const upsert = async (req, res, next) => {
  try {
    const request = req.body;
    const result = await paymentHistoryValidation.upsertStatus(request);
    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Data berhasil diupdate dan ditambahkan.",
      data: result,
      url: req.protocol + "://" + req.get("host") + req.originalUrl,
    });
  } catch (e) {
    next(e);
  }
};

const remove = async (req, res, next) => {
  try {
    const statusId = req.params.statusId;
    await paymentHistoryValidation.remove(statusId);
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
    const result = await paymentHistoryValidation.list();
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
    const statusId = req.params.statusId;
    const request = req.body;
    request.id = statusId;

    const result = await paymentHistoryValidation.update(request);
    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Data berhasil diupdate.",
      data: result,
    });
  } catch (e) {
    next(e);
  }
};

export default {
  upsert,
  remove,
  list,
  update,
};
