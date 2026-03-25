import tmstDepartmentService from "../service/tmst-department-service.js";

const create = async (req, res, next) => {
  try {
    const request = req.body;
    const result = await tmstDepartmentService.create(request);
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
    const departmentId = req.params.departmentId;
    await tmstDepartmentService.remove(departmentId);
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
      const { department, size = 20, page = 1 } = req.query;

      const DepartmentData = await tmstDepartmentService.listDepartment(
          { department },
          { size: parseInt(size), page: parseInt(page) }
      );

      res.status(200).json({
          message: 'Berhasil',
          data: DepartmentData.departmentList,
          paging: {
              total_item: DepartmentData.total_item,
              total_page: DepartmentData.total_page,
              page: DepartmentData.page,
          }
      });
  } catch (error) {
      next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const departmentId = req.params.departmentId;
    const request = req.body;
    request.id = departmentId;

    const result = await tmstDepartmentService.update(request);
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

const getOneData = async (req, res, next) => {
  try {
    const id = req.params.id;
    const result = await tmstDepartmentService.getOneDepartment(id);
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
