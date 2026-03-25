import timesheetHistoryService from "../service/timesheet-history-service.js";

const upsert = async (req, res, next) => {
  try {
    const request = req.body;
    const result = await timesheetHistoryService.upsertStatus(request);
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
    await timesheetHistoryService.remove(statusId);
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
    const result = await timesheetHistoryService.list();
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

    const result = await timesheetHistoryService.update(request);
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
