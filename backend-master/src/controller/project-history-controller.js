import projectHistoryService from "../service/project-history-service.js";

const upsert = async (req, res, next) => {
  try {
    const request = req.body;
    const result = await projectHistoryService.upsertStatus(request);
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

const remove = async (req, res, next) => {
  try {
    const statusId = req.params.statusId;
    await projectHistoryService.remove(statusId);
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
    const result = await projectHistoryService.list();
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

    const result = await projectHistoryService.update(request);
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
