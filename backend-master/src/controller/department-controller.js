import departmentService from "../service/department-service.js";

const getAll = async (req, res, next) => {
  try {
    const result = await departmentService.getAll();
    res.status(200).json({
      data: result,
    });
  } catch (e) {
    next(e);
  }
};

export default { getAll };
