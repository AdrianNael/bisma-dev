import { prismaClient } from "../application/database.js";
import { getIdValidation, createInternCategoryValidation, searchInternCategoryValidation, updateInternCategoryValidation } from "../validation/tmst-intern-category-validation.js";
import { validate } from "../validation/validation.js";
import { ResponseError } from "../error/response-error.js";

const create = async (request) => {
  const category = validate(createInternCategoryValidation, request);

  const countCategory = await prismaClient.tmst_kategori_magang.count({
    where: {
      kategori: category.kategori,
    },
  });

  if (countCategory === 1) {
    throw new ResponseError(400, "Category telah tersedia");
  }

  return prismaClient.tmst_kategori_magang.create({
    data: category,
    select: {
      id: true,
      kategori: true,
    },
  });
};

const list = async (request) => {
  request = validate(searchInternCategoryValidation, request);

  // 1 ((page - 1) * size) = 0
  // 2 ((page - 1) * size) = 10
  const skip = (request.page - 1) * request.size;

  const filters = [];

  if (request.kategori) {
    filters.push({
      kategori: {
        contains: request.kategori,
      },
    });
  }

  const category = await prismaClient.tmst_kategori_magang.findMany({
    where: {
      AND: filters,
    },
    take: request.size,
    skip: skip,
  });

  const totalItems = await prismaClient.tmst_kategori_magang.count({
    where: {
      AND: filters,
    },
  });

  return {
    data: category,
    paging: {
      page: request.page,
      total_item: totalItems,
      total_page: Math.ceil(totalItems / request.size),
    },
  };
};

const update = async (request) => {
  const categoryId = validate(updateInternCategoryValidation, request);

  const totalCategoryInDatabase = await prismaClient.tmst_kategori_magang.count({
    where: {
      id: categoryId.id,
    },
  });
  const countCategory = await prismaClient.tmst_kategori_magang.count({
    where: {
      kategori: categoryId.kategori,
    },
  });

  if (countCategory === 1) {
    throw new ResponseError(400, "Category telah tersedia");
  }

  if (totalCategoryInDatabase !== 1) {
    throw new ResponseError(404, "Category tidak ditemukan.");
  }

  return prismaClient.tmst_kategori_magang.update({
    where: {
      id: categoryId.id,
    },
    data: {
      kategori: categoryId.kategori,
    },
    select: {
      id: true,
      kategori: true,
    },
  });
};

const remove = async (categoryId) => {
  categoryId = validate(getIdValidation, categoryId);

  const totalInDatabase = await prismaClient.tmst_kategori_magang.count({
    where: {
      id: categoryId,
    },
  });

  if (totalInDatabase !== 1) {
    throw new ResponseError(404, "Kategori magang tidak ditemukan");
  }

  const checkConstrainTmstProject = await prismaClient.tmst_project.findFirst({
    where: {
      id_kategori: categoryId,
    },
  });

  if (checkConstrainTmstProject) {
    throw new ResponseError(404, "Maaf, kategori magang memiliki keterkaitan dengan master project");
  }

  const checkConstrainIncentive = await prismaClient.tran_insentif.findFirst({
    where: {
      id_kategori: categoryId,
    },
  });

  if (checkConstrainIncentive) {
    throw new ResponseError(404, "Maaf, kategori magang memiliki hubungan dengan insentif");
  }

  return prismaClient.tmst_kategori_magang.delete({
    where: {
      id: categoryId,
    },
  });
};

const select = async (request) => {
  request = validate(getIdValidation, request);
  const getCategory = await prismaClient.tmst_kategori_magang.findFirst({
    select: {
      id: true,
      kategori: true,
    },
    where: {
      id: request,
    },
  });

  if (!getCategory) {
    throw new ResponseError(404, "Id tidak ditemukan!");
  }

  return getCategory;
};

export default { create, list, update, remove, select };
