import internCategoryService from "../service/tmst-internCategory-service.js";

const create = async (req, res, next) => {
  try {
    const request = req.body;
    const result = await internCategoryService.create(request);
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
      page: req.query.page,
      size: req.query.size,
    };

    const result = await internCategoryService.list(request);
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
    const categoryId = req.params.categoryId;
    const request = req.body;
    request.id = categoryId;

    const result = await internCategoryService.update(request);
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
    const categoryId = req.params.categoryId;

    await internCategoryService.remove(categoryId);
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
    const categoryId = req.params.categoryId;
    const result = await internCategoryService.select(categoryId);
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
  update,
  remove,
  select,
};
