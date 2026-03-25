import activityCategoryService from "../service/tmst-category-activity-service.js";

const create = async (req, res, next) => {
  try {
    // console.log(req.status);
    const request = req.body;
    const result = await activityCategoryService.create(request);
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
    const activityId = req.params.activityId;

    await activityCategoryService.remove(activityId);
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
    const result = await activityCategoryService.list();
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
    const activityId = req.params.activityId;
    const request = req.body;
    request.id = activityId;

    const result = await activityCategoryService.update(request);
    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Data berhasil diubah.",
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
