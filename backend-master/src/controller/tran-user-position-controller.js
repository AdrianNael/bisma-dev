import tranUserPositionService from "../service/tran-user-position-service.js";

const create = async (req, res, next) => {
  try {
    const request = req.body;
    const result = await tranUserPositionService.create(request);
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
    const userId = req.params.userId;
    await tranUserPositionService.remove(userId);
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
    const result = await tranUserPositionService.list();
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
    const userId = req.params.userId;
    const request = req.body;
    request.id = userId;

    const result = await tranUserPositionService.update(request);
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
  create,
  remove,
  list,
  update,
};
