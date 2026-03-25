import { prismaClient } from "../application/database.js";
import { ResponseError } from "../error/response-error.js";

const create = async (request) => {
    const { faculty } = request;

    if (!faculty || faculty.trim() === "") {
        throw new ResponseError(400, "Nama fakultas wajib diisi");
    }

    const existingData = await prismaClient.tmst_faculty.findUnique({
        where: {
            faculty: faculty.trim()
        }
    });

    if (existingData) {
        throw new ResponseError(400, "Fakultas sudah ada");
    }

    const createFaculty = await prismaClient.tmst_faculty.create({
        data: { faculty: faculty.trim() },
        select: {
            id: true,
            faculty: true,
        },
    });

    return createFaculty;
};

const update = async (id, request) => {
    const { faculty } = request;

    if (!id) {
        throw new ResponseError(400, "ID fakultas wajib diisi");
    }

    if (!faculty || faculty.trim() === "") {
        throw new ResponseError(400, "Nama fakultas wajib diisi");
    }

    const cekAvailable = await prismaClient.tmst_faculty.findFirst({
        where: { id: parseInt(id) },
    });

    if (!cekAvailable) {
        throw new ResponseError(404, "Fakultas tidak ditemukan!");
    }

    const updateData = await prismaClient.tmst_faculty.update({
        where: { id: parseInt(id) },
        data: { faculty: faculty.trim() },
        select: {
            id: true,
            faculty: true,
        },
    });

    return updateData;
};

const listFaculty = async (filters, pagination) => {
    const { faculty } = filters;
    const { size, page } = pagination;

    const skip = (page - 1) * size;
    const take = size;

    const facultyList = await prismaClient.tmst_faculty.findMany({
        where: {
            faculty: faculty ? { contains: faculty } : undefined,
        },
        select: {
            id: true,
            faculty: true,
            _count: {
                select: { departments: true }
            }
        },
        skip,
        take,
        orderBy: { faculty: 'asc' }
    });

    const totalItems = await prismaClient.tmst_faculty.count({
        where: {
            faculty: faculty ? { contains: faculty } : undefined,
        },
    });

    return {
        facultyList,
        total_item: totalItems,
        total_page: Math.ceil(totalItems / size),
        page: page,
    };
};

const remove = async (id) => {
    const facultyId = parseInt(id);

    const cekAvailable = await prismaClient.tmst_faculty.findFirst({
        where: { id: facultyId },
    });

    if (!cekAvailable) {
        throw new ResponseError(404, "Fakultas tidak ditemukan!");
    }

    // Check if any department is linked to this faculty
    const linkedDepartments = await prismaClient.tmst_department.count({
        where: { faculty_id: facultyId }
    });

    if (linkedDepartments > 0) {
        throw new ResponseError(400, "Tidak bisa menghapus fakultas yang memiliki departemen terkait");
    }

    return prismaClient.tmst_faculty.delete({
        where: { id: facultyId },
    });
};

const getOneFaculty = async (id) => {
    const facultyId = parseInt(id);

    const facultyData = await prismaClient.tmst_faculty.findFirst({
        where: { id: facultyId },
        select: {
            id: true,
            faculty: true,
            departments: {
                select: {
                    id: true,
                    department: true
                }
            }
        }
    });

    if (!facultyData) {
        throw new ResponseError(404, "Fakultas tidak ditemukan");
    }

    return facultyData;
};

export default { create, update, listFaculty, remove, getOneFaculty };
