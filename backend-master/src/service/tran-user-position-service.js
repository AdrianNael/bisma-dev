import { validate } from "../validation/validation.js";
import { createAndUpdateValidation, deleteUserValidation } from "../validation/tran-user-position-validation.js";
import { prismaClient } from "../application/database.js";
import { ResponseError } from "../error/response-error.js";

const create = async (request) => {
  const data = validate(createAndUpdateValidation, request);

  const createPosition = prismaClient.tran_posisi_pengguna.create({
    data: data,
    select: {
      id: true,
      id_pengguna: true,
      id_posisi: true,
    },
  });

  return createPosition;
};

const update = async (request) => {
  const data = validate(createAndUpdateValidation, request);

  const cekAvailable = await prismaClient.tran_posisi_pengguna.findFirst({
    where: {
      id: data.id,
    },
  });

  if (!cekAvailable) {
    throw new ResponseError(404, "Id tidak ditemukan!");
  }

  const updateData = prismaClient.tran_posisi_pengguna.update({
    where: {
      id: data.id,
    },
    data: {
      id_pengguna: data.id_pengguna,
      id_posisi: data.id_posisi,
    },
    select: {
      id: true,
      id_pengguna: true,
      id_posisi,
    },
  });

  return updateData;
};

const list = async () => {
  const data_user_position = await prismaClient.tran_posisi_pengguna.findMany({
    select: {
      id: true,
      id_pengguna: true,
      tmst_pengguna: {
        select: {
          nama: true,
        },
      },
      id_posisi: true,
      tmst_posisi: {
        select: {
          posisi: true,
        },
      },
    },
  });

  let nama = null;
  let posisi = null;

  data_user_position.forEach((data) => {
    nama = data.tmst_pengguna.nama;
    posisi = data.tmst_posisi.posisi;
    data.nama = nama;
    data.posisi = posisi;
    delete data.tmst_pengguna;
    delete data.tmst_posisi;
    nama = null;
    posisi = null;
  });

  return data_user_position;
};

const remove = async (request) => {
  const id = validate(deleteUserValidation, request);
  const cekAvailable = await prismaClient.tran_posisi_pengguna.findFirst({
    where: {
      id: id,
    },
  });

  if (!cekAvailable) {
    throw new ResponseError(404, "Id tidak ditemukan!");
  }

  return prismaClient.tran_posisi_pengguna.delete({
    where: {
      id: id,
    },
  });
};

export default { create, update, list, remove };
