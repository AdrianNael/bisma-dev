import { validate } from "../validation/validation.js";
import { ResponseError } from "../error/response-error.js";
import { prismaClient } from "../application/database.js";
import { createAndUpdateValidation, deleteIncentiveUnitValidation } from "../validation/tmst-incentiveUnit-validation.js";

const create = async (request) => {
  const unit = validate(createAndUpdateValidation, request);

  const countunit = await prismaClient.tmst_satuan_insentif.count({
    where: {
      satuan: unit.satuan,
    },
  });

  if (countunit === 1) {
    throw new ResponseError(400, "unit telah tersedia");
  }

  return prismaClient.tmst_satuan_insentif.create({
    data: unit,
    select: {
      id: true,
      satuan: true,
    },
  });
};

const list = async () => {
  const getUnit = await prismaClient.tmst_satuan_insentif.findMany({
    select: {
      id: true,
      satuan: true,
    },
  });
  return getUnit;
};

const update = async (request) => {
  const unitId = validate(createAndUpdateValidation, request);
  const totalUnitInDatabase = await prismaClient.tmst_satuan_insentif.count({
    where: {
      id: unitId.id,
    },
  });

  if (totalUnitInDatabase !== 1) {
    throw new ResponseError(404, "Unit tidak ditemukan.");
  }

  return prismaClient.tmst_satuan_insentif.update({
    where: {
      id: unitId.id,
    },
    data: {
      satuan: unitId.satuan,
    },
    select: {
      id: true,
      satuan: true,
    },
  });
};

const remove = async (unitId) => {
  unitId = validate(deleteIncentiveUnitValidation, unitId);

  const totalInDatabase = await prismaClient.tmst_satuan_insentif.count({
    where: {
      id: unitId,
    },
  });

  if (totalInDatabase !== 1) {
    throw new ResponseError(404, "Unit tidak ditemukan.");
  }

  return prismaClient.tmst_satuan_insentif.delete({
    where: {
      id: unitId,
    },
  });
};

export default { create, list, remove, update };
