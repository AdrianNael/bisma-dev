import tmstFacultyService from "../service/tmst-faculty-service.js";

const create = async (req, res, next) => {
    try {
        const request = req.body;
        const result = await tmstFacultyService.create(request);
        res.status(201).json({
            status: res.statusCode,
            success: true,
            message: "Fakultas berhasil ditambahkan.",
            data: result,
            url: req.protocol + "://" + req.get("host") + req.originalUrl,
        });
    } catch (e) {
        next(e);
    }
};

const remove = async (req, res, next) => {
    try {
        const facultyId = req.params.facultyId;
        await tmstFacultyService.remove(facultyId);
        res.status(200).json({
            status: res.statusCode,
            success: true,
            message: "Fakultas berhasil dihapus.",
            data: "OK",
            url: req.protocol + "://" + req.get("host") + req.originalUrl,
        });
    } catch (e) {
        next(e);
    }
};

const list = async (req, res, next) => {
    try {
        const { faculty, size = 50, page = 1 } = req.query;

        const facultyData = await tmstFacultyService.listFaculty(
            { faculty },
            { size: parseInt(size), page: parseInt(page) }
        );

        res.status(200).json({
            message: "Berhasil",
            data: facultyData.facultyList,
            paging: {
                total_item: facultyData.total_item,
                total_page: facultyData.total_page,
                page: facultyData.page,
            },
        });
    } catch (error) {
        next(error);
    }
};

const update = async (req, res, next) => {
    try {
        const facultyId = req.params.facultyId;
        const request = req.body;

        const result = await tmstFacultyService.update(facultyId, request);
        res.status(200).json({
            status: res.statusCode,
            success: true,
            message: "Fakultas berhasil diupdate.",
            data: result,
        });
    } catch (e) {
        next(e);
    }
};

const getOneData = async (req, res, next) => {
    try {
        const id = req.params.id;
        const result = await tmstFacultyService.getOneFaculty(id);
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
    getOneData,
};
