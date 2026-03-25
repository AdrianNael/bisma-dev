import { validate } from "../validation/validation.js";
import { createAndUpdateValidation, deleteStatusValidation } from "../validation/project-history-validation.js";
import { prismaClient } from "../application/database.js";
import { ResponseError } from "../error/response-error.js";

const upsertStatus = async (request) => {
  const data = validate(createAndUpdateValidation, request);

  const upsertStatus = await prismaClient.project_status_history.upsert({
    where: {
      id_project_id_status: {
        id_project: data.id_project,
        id_status: data.id_status,
      },
    },
    update: {
      changed_at: data.changed_at,
    },
    create: {
      id_project: data.id_project,
      id_status: data.id_status,
      changed_at: data.changed_at,
    },
    select: {
      id: true,
      id_project: true,
      id_status: true,
      changed_at: true,
    },
  });

  return upsertStatus;
};


const update = async (request) => {
  const data = validate(createAndUpdateValidation, request);

  const cekAvailable = await prismaClient.project_status_history.findFirst({
    where: {
      id: data.id,
    },
  });

  if (!cekAvailable) {
    throw new ResponseError(404, "Id tidak ditemukan!");
  }

  const updateData = prismaClient.project_status_history.update({
    where: {
      id: data.id,
    },
    data: {
      id_project: data.id_project,
      id_status: data.id_status,
      changed_at: data.changed_at,
    },
    select: {
      id: true,
      id_project: true,
      id_status: true,
      changed_at: true,
    },
  });

  return updateData;
};

const list = async () => {
  return prismaClient.project_status_history.findMany({
    select: {
      id: true,
      id_project: true,
      id_status: true,
      changed_at: true,
    },
  });
};

const remove = async (request) => {
  const id = validate(deleteStatusValidation, request);
  const cekAvailable = await prismaClient.project_status_history.findFirst({
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

export default { upsertStatus, update, list, remove };
