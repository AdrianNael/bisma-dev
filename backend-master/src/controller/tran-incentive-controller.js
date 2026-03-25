import incentiveService from "../service/tran-incentive-service.js";

const create = async (req, res, next) => {
  try {
    const request = req.body;
    const result = await incentiveService.create(request);
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

const list = async (req, res, next) => {
  try {
    const request = {
      kategori: req.query.kategori,
      insentif: req.query.insentif,
      page: req.query.page,
      size: req.query.size,
    };
    const result = await incentiveService.list(request);
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

const read = async (req, res, next) => {
  try {
    const result = await incentiveService.read();
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
    const incentiveId = req.params.incentiveId;
    const request = req.body;
    request.id = incentiveId;

    const result = await incentiveService.update(request);
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

const remove = async (req, res, next) => {
  try {
    const incentiveId = req.params.incentiveId;

    await incentiveService.remove(incentiveId);
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

const select = async (req, res, next) => {
  try {
    const incentiveId = req.params.incentiveId;
    const result = await incentiveService.select(incentiveId);
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

const getProject = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const result = await incentiveService.getProject(projectId);
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

export default {
  create,
  list,
  read,
  update,
  remove,
  select,
  getProject
};
