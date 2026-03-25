import { validate } from "../validation/validation.js";
import { createAndUpdateValidation, deleteDepartmentValidation } from "../validation/tmst-department-validation.js";
import { prismaClient } from "../application/database.js";
import { ResponseError } from "../error/response-error.js";

const create = async (request) => {
  const data = validate(createAndUpdateValidation, request);

  const existingData = await prismaClient.tmst_department.findUnique({
    where: {
      department: data.department
    }
  });

  if (existingData) {
    throw new ResponseError(400, "Data telah tersedia");
  }

  const createDepartment = await prismaClient.tmst_department.create({
    data: {
      department: data.department,
      faculty_id: data.faculty_id || null,
    },
    select: {
      id: true,
      department: true,
      faculty_id: true,
    },
  });

  return createDepartment;
};

const update = async (request) => {
  const data = validate(createAndUpdateValidation, request);
  // console.log(data);

  if (!data.id) {
    throw new ResponseError(400, "Data tidak valid: dibutuhkan id.");
  }

  const cekAvailable = await prismaClient.tmst_department.findFirst({
    where: {
      id: data.id,
    },
  });

  if (!cekAvailable) {
    throw new ResponseError(404, "Id tidak ditemukan!");
  }

  // Proceed with the update if the ID exists
  const updateData = await prismaClient.tmst_department.update({
    where: {
      id: data.id,
    },
    data: {
      department: data.department,
      faculty_id: data.faculty_id !== undefined ? data.faculty_id : cekAvailable.faculty_id,
    },
    select: {
      id: true,
      department: true,
      faculty_id: true,
    },
  });

  return updateData;
};


const listDepartment = async (filters, pagination) => {
  const { department } = filters;
  const { size, page } = pagination;

  const skip = (page - 1) * size;
  const take = size;

  const departmentList = await prismaClient.tmst_department.findMany({
    where: {
      department: department ? { contains: department } : undefined,
    },
    select: {
      id: true,
      department: true,
    },
    skip,
    take,
  });

  if (!departmentList || departmentList.length === 0) {
    throw new ResponseError(404, 'Tidak ada Departments yang ditemukan');
  }

  const totalItems = await prismaClient.tmst_department.count({
    where: {
      department: department ? { contains: department } : undefined,
    },
  });

  return {
    departmentList,
    total_item: totalItems,
    total_page: Math.ceil(totalItems / size),
    page: page,
  };
};


const remove = async (request) => {
  const id = validate(deleteDepartmentValidation, request);
  const cekAvailable = await prismaClient.tmst_department.findFirst({
    where: {
      id: id,
    },
  });

  if (!cekAvailable) {
    throw new ResponseError(404, "Id tidak ditemukan!");
  }

  return prismaClient.tmst_department.delete({
    where: {
      id: id,
    },
  });
};

const getOneDepartment = async (id) => {
  id = validate(deleteDepartmentValidation, id);

  const getOneDepartment = await prismaClient.tmst_department.count({
    where: {
      id: id
    }
  });

  if (getOneDepartment === 0) {
    throw new ResponseError(404, "Data Department tidak ditemukan");
  }

  const StafData = await prismaClient.tmst_department.findFirst({
    where: {
      id
    },
    select: {
      id: true,
      department: true,
      faculty_id: true
    }
  });

  return StafData;
}

export default { create, update, listDepartment, remove, getOneDepartment };
