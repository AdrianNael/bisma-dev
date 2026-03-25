import tmstUserService from "../service/tmst-user-services.js";

const create = async (req, res, next) => {
  try {
    const request = req.body;
    const result = await tmstUserService.create(request);
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

    await tmstUserService.remove(userId);
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
    const result = await tmstUserService.list();
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

const showPic = async (req, res, next) => {
  try {
    const result = await tmstUserService.showPic();
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

    const result = await tmstUserService.update(request);
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

const getMy = async (req, res, next) => {
  try {
    const { username } = req.user;
    const result = await tmstUserService.get(username);

    res.status(200).json({
      data: result,
    });
  } catch (e) {
    console.log(e);
    next(e);
  }
};

export default {
  create,
  remove,
  list,
  update,
  showPic,
  getMy,
};
