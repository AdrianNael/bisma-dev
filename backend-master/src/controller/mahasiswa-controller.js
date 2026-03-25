import mahasiswaService from "../service/mahasiswa-service.js";

const getMahasiswa = async (req, res, next) => {
  try {
    const { nama, nim, size = 10, page = 1 } = req.query;
    const MahasiswaData = await mahasiswaService.getMahasiswaDetails(
      { nama, nim },
      { size: parseInt(size), page: parseInt(page) }
    );
    res.status(200).json({
      message: "Berhasil",
      data: MahasiswaData.mahasiswaUsers,
      paging: {
        total_item: MahasiswaData.total_item,
        total_page: MahasiswaData.total_page,
        page: MahasiswaData.page,
      },
    });
  } catch (error) {
    next(error);
  }
};

async function createMahasiswa(req, res, next) {
  try {
    const result = await mahasiswaService.createMahasiswa(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

const updateMahasiswaController = async (req, res) => {
  const { username } = req.params;
  const data = req.body;
  try {
    const updatedMahasiswa = await mahasiswaService.updateMahasiswaAndUserByUsername(username, data);
    return res.status(200).json({
      success: true,
      message: "Data Mahasiswa dan pengguna berhasil diperbarui",
      data: updatedMahasiswa,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getOneMahasiswa = async (req, res, next) => {
  try {
    const username = req.params.username;
    const result = await mahasiswaService.getOneMahasiswa(username);
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

const deleteOneMahasiswa = async (req, res, next) => {
  try {
    const username = req.params.username;
    const result = await mahasiswaService.deleteUserByUsername(username);
    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Data berhasil dihapus.",
      data: result,
      url: req.protocol + "://" + req.get("host") + req.originalUrl,
    });
  } catch (e) {
    next(e);
  }
};

const getApplicationHistory = async (req, res, next) => {
  try {
    const user = req.user;
    const result = await mahasiswaService.getApplicationHistory(user);
    res.status(200).json({ data: result });
  } catch (e) {
    next(e);
  }
};

const getMonthlyQuota = async (req, res, next) => {
  try {
    const uid = req.query.id || req?.user?.id;
    if (!uid) {
      return res.status(401).json({
        status: 401,
        success: false,
        message: "Unauthorized: user tidak terdeteksi",
        data: null,
        url: req.protocol + "://" + req.get("host") + req.originalUrl,
      });
    }
    const month = req.query.month || null;
    const result = await mahasiswaService.getMonthlyQuota(uid, month);
    res.status(200).json({
      status: 200,
      success: true,
      message: "Kuota jam berhasil dihitung.",
      data: result,
      url: req.protocol + "://" + req.get("host") + req.originalUrl,
    });
  } catch (e) {
    next(e);
  }
};

const getStudentProjectCounts = async (req, res, next) => {
  try {
    const { startDate, endDate, nama, nim, size = 100, page = 1 } = req.query;
    const result = await mahasiswaService.getStudentProjectCounts({
      startDate,
      endDate,
      nama,
      nim,
      size: parseInt(size),
      page: parseInt(page),
    });
    res.status(200).json({
      success: true,
      message: "Data berhasil ditampilkan.",
      data: result.students,
      paging: {
        total_item: result.total_item,
        total_page: result.total_page,
        page: result.page,
      },
    });
  } catch (e) {
    next(e);
  }
};


export default {
  getMahasiswa,
  createMahasiswa,
  updateMahasiswaController,
  getOneMahasiswa,
  deleteOneMahasiswa,
  getApplicationHistory,
  getMonthlyQuota,
  getStudentProjectCounts,
};
