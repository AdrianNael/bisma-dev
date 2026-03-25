import { prismaClient } from "../application/database.js";
import { createAndUpdateValidation, deleteActivityCategoryValidation } from "../validation/tmst-category-activity-validation.js";
import { validate } from "../validation/validation.js";
import { ResponseError } from "../error/response-error.js";

const create = async (request) => {
  const activity = validate(createAndUpdateValidation, request);

  const countActivity = await prismaClient.tmst_kategori_kegiatan.count({
    where: {
      kegiatan: activity.kegiatan,
    },
  });

  if (countActivity === 1) {
    throw new ResponseError(400, "Aktifitas telah tersedia");
  }

  return prismaClient.tmst_kategori_kegiatan.create({
    data: activity,
    select: {
      id: true,
      kegiatan: true,
    },
  });
};

const remove = async (activityId) => {
  activityId = validate(deleteActivityCategoryValidation, activityId);

  const totalInDatabase = await prismaClient.tmst_kategori_kegiatan.count({
    where: {
      id: activityId,
    },
  });

  if (totalInDatabase !== 1) {
    throw new ResponseError(404, "Kategori aktifitas tidak ditemukan");
  }

  return prismaClient.tmst_kategori_kegiatan.delete({
    where: {
      id: activityId,
    },
  });
};

const list = async () => {
  const getActivity = await prismaClient.tmst_kategori_kegiatan.findMany({
    select: {
      id: true,
      kegiatan: true,
    },
  });
  return getActivity;
};

const update = async (request) => {
  const activityId = validate(createAndUpdateValidation, request);
  const totalActivityInDatabase = await prismaClient.tmst_kategori_kegiatan.count({
    where: {
      id: activityId.id,
    },
  });

  if (totalActivityInDatabase !== 1) {
    throw new ResponseError(404, "Aktifitas tidak ditemukan");
  }

  return prismaClient.tmst_kategori_kegiatan.update({
    where: {
      id: activityId.id,
    },
    data: {
      kegiatan: activityId.kegiatan,
    },
    select: {
      id: true,
      kegiatan: true,
    },
  });
};

export default {
  create,
  remove,
  list,
  update,
};
