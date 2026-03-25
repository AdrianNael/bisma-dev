import stafService from '../service/staf-service.js';

const getStaf = async (req, res, next) => {
    try {
        const { nama, nip, size = 10, page = 1 } = req.query;

        const stafData = await stafService.getStafDetails(
            { nama, nip },
            { size: parseInt(size), page: parseInt(page) }
        );

        res.status(200).json({
            message: 'Berhasil',
            data: stafData.stafUsers,
            paging: {
                total_item: stafData.total_item,
                total_page: stafData.total_page,
                page: stafData.page,
            }
        });
    } catch (error) {
        next(error);
    }
};

async function createStaf(req, res, next) {
    try {
      const result = await stafService.createStaf(req.body);
      res.status(201).json(result);
    } catch (error) {
        next(error);
    }
}

const updateStafController = async (req, res) => {
    const { username } = req.params; // Mendapatkan username dari parameter URL
    const data = req.body; // Mendapatkan data dari body request
  
    try {
      const updatedStaf = await stafService.updateStafAndUserByUsername(username, data);
      return res.status(200).json({
        success: true,
        message: 'Data staf dan pengguna berhasil diperbarui',
        data: updatedStaf,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

const getOneStaf = async (req, res, next) => {
  try {
    const username = req.params.username;
    const result = await stafService.getOneStaf(username);
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

const deleteOneStaf = async (req, res, next) => {
  try {
    const username = req.params.username;
    const result = await stafService.deleteUserByUsername(username);
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

export default{
    getStaf,
    createStaf,
    updateStafController,
    getOneStaf,
    deleteOneStaf
}

