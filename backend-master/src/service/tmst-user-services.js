import { prismaClient } from "../application/database.js";
import { createTmstUserValidation, deleteTmstUserValidation, updateTmstUserValidation } from "../validation/tmst-user-validation.js";
import { validate } from "../validation/validation.js";
import { ResponseError } from "../error/response-error.js";

const create = async (request) => {
  const user = validate(createTmstUserValidation, request);
  const validRole = ["MAHASISWA", "STAF", "MANAGER"];
  const countUser = await prismaClient.tmst_pengguna.count({
    where: {
      username: user.username,
    },
  });

  const countId = await prismaClient.tmst_pengguna.count({
    where: {
      id: user.id,
    },
  });

  if (!validRole.includes(user.status)) {
    throw new ResponseError(400, "Nilai status tidak valid");
  }

  if (countUser === 1) {
    throw new ResponseError(400, "Username telah tersedia");
  }
  if (countId === 1) {
    throw new ResponseError(400, "ID telah tersedia");
  }

  return prismaClient.tmst_pengguna.create({
    data: user,
    select: {
      id: true,
      username: true,
      departemen: true,
      no_telp: true,
      no_rekening: true,
      status: true,
    },
  });
};

const remove = async (userId) => {
  userId = validate(deleteTmstUserValidation, userId);

  const totalInDatabase = await prismaClient.tmst_pengguna.count({
    where: {
      id: userId,
    },
  });

  if (totalInDatabase !== 1) {
    throw new ResponseError(404, "User tidak ditemukan");
  }

  return prismaClient.tmst_pengguna.delete({
    where: {
      id: userId,
    },
  });
};

const list = async () => {
  const getActivity = await prismaClient.tmst_pengguna.findMany({
    select: {
      id: true,
      nama: true,
      username: true,
      departemen: true,
      no_telp: true,
      no_rekening: true,
      status: true,
    },
  });
  return getActivity;
};

const update = async (request) => {
  const user = validate(updateTmstUserValidation, request);
  const totalUserInDatabase = await prismaClient.tmst_pengguna.count({
    where: {
      id: user.id,
    },
  });

  if (totalUserInDatabase !== 1) {
    throw new ResponseError(404, "User tidak ditemukan");
  }

  return prismaClient.tmst_pengguna.update({
    where: {
      id: user.id,
    },
    data: {
      nama: user.nama,
      departemen: user.department,
      no_telp: user.no_telp,
      no_rekening: user.no_rekening,
      status: user.status,
    },
    select: {
      nama: true,
      username: true,
      departemen: true,
      no_telp: true,
      no_rekening: true,
      status: true,
    },
  });
};

const showPic = async () => {
  const getPic = await prismaClient.tmst_pengguna.findMany({
    where: {
      status: "STAF",
    },
    select: {
      id: true,
      nama: true,
    },
  });

  return getPic;
};

const get = async (username) => {
  const user = await prismaClient.tmst_pengguna.findUnique({
    where: {
      username: username,
    },
    select: {
      id: true,
      nama: true,
      username: true,
      departemen: true,
      no_telp: true,
      no_rekening: true,
      status: true,
      tmst_department: {
        select: {
          id: true,
          department: true,
          faculty_id: true,
        }
      }
    },
  });

  if (!user) {
    throw new ResponseError(404, "User tidak ditemukan");
  }

  return user;
};

export default {
  create,
  remove,
  list,
  update,
  showPic,
  get,
};
