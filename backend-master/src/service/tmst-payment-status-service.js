import { validate } from "../validation/validation.js";
import { createAndUpdateValidation, deleteStatusValidation } from "../validation/tmst-payment-status-validation.js";
import { prismaClient } from "../application/database.js";
import { ResponseError } from "../error/response-error.js";

const create = async (request) => {
  const data = validate(createAndUpdateValidation, request);

  const createStatus = prismaClient.tmst_status_pembayaran.create({
    data: data,
    select: {
      id: true,
      status: true,
    },
  });

  return createStatus;
};

const update = async (request) => {
  const data = validate(createAndUpdateValidation, request);

  const cekAvailable = await prismaClient.tmst_status_pembayaran.findFirst({
    where: {
      id: data.id,
    },
  });

  if (!cekAvailable) {
    throw new ResponseError(404, "Id tidak ditemukan!");
  }

  const updateData = prismaClient.tmst_status_pembayaran.update({
    where: {
      id: data.id,
    },
    data: {
      status: data.status,
    },
    select: {
      id: true,
      status: true,
    },
  });

  return updateData;
};

const list = async () => {
  return prismaClient.tmst_status_pembayaran.findMany({
    select: {
      id: true,
      status: true,
    },
  });
};

const remove = async (request) => {
  const id = validate(deleteStatusValidation, request);
  const cekAvailable = await prismaClient.tmst_status_pembayaran.findFirst({
    where: {
      id: id,
    },
  });

  if (!cekAvailable) {
    throw new ResponseError(404, "Id tidak ditemukan!");
  }

  return prismaClient.tmst_status_pembayaran.delete({
    where: {
      id: id,
    },
  });
};

export default { create, update, list, remove };
