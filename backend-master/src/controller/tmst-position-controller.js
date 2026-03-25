import tmstPositionService from "../service/tmst-position-service.js";

const create = async (req, res, next) => {
  try {
    const request = req.body;
    const result = await tmstPositionService.create(request);
    res.status(201).json({
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
    const positionId = req.params.positionId;
    await tmstPositionService.remove(positionId);
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
      const { posisi, size = 10, page = 1 } = req.query;

      const positionData = await tmstPositionService.listPosisi(
          { posisi },
          { size: parseInt(size), page: parseInt(page) }
      );

      res.status(200).json({
          message: 'Berhasil',
          data: positionData.posisiList,
          paging: {
              total_item: positionData.total_item,
              total_page: positionData.total_page,
              page: positionData.page,
          }
      });
  } catch (error) {
      next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const positionId = req.params.positionId;
    const request = req.body;
    request.id = positionId;

    const result = await tmstPositionService.update(request);
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

const getOneData = async (req, res, next) => {
  try {
    const id = req.params.id;
    const result = await tmstPositionService.getOnePosition(id);
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

export default {
  create,
  remove,
  list,
  update,
  getOneData
};
