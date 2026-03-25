import { validate } from "../validation/validation.js";
import { createAndUpdateValidation, deletePositionValidation } from "../validation/tmst-position-validation.js";
import { prismaClient } from "../application/database.js";
import { ResponseError } from "../error/response-error.js";

const create = async (request) => {
  const data = validate(createAndUpdateValidation, request);

  const existingData = await prismaClient.tmst_posisi.findUnique({
    where:{
      posisi: data.posisi
    }
  });

  if(existingData){
    throw new ResponseError(400, "Data telah tersedia");
  }

  const createPosition = await prismaClient.tmst_posisi.create({
    data: data,
    select: {
      id: true,
      posisi: true,
    },
  });

  return createPosition;
};

const update = async (request) => {
  const data = validate(createAndUpdateValidation, request);

  const cekAvailable = await prismaClient.tmst_posisi.findFirst({
    where: {
      id: data.id,
    },
  });

  if (!cekAvailable) {
    throw new ResponseError(404, "Id tidak ditemukan!");
  }

  const updateData = prismaClient.tmst_posisi.update({
    where: {
      id: data.id,
    },
    data: {
      posisi: data.posisi,
    },
    select: {
      id: true,
      posisi: true,
    },
  });

  return updateData;
};

const listPosisi = async (filters, pagination) => {
  const { posisi } = filters; 
  const { size, page } = pagination;
  
  const skip = (page - 1) * size;
  const take = size;
  
  const posisiList = await prismaClient.tmst_posisi.findMany({
      where: {
          posisi: posisi ? { contains: posisi } : undefined,
      },
      select: {
          id: true,
          posisi: true,
      },
      skip, 
      take, 
  });

  if (!posisiList || posisiList.length === 0) {
      throw new ResponseError(404, 'Posisi tidak ditemukan');
  }

  const totalItems = await prismaClient.tmst_posisi.count({
      where: {
          posisi: posisi ? { contains: posisi } : undefined,
      },
  });

  return {
      posisiList,
      total_item: totalItems,
      total_page: Math.ceil(totalItems / size),
      page: page,
  };
};


const remove = async (request) => {
  const id = validate(deletePositionValidation, request);
  const cekAvailable = await prismaClient.tmst_posisi.findFirst({
    where: {
      id: id,
    },
  });

  if (!cekAvailable) {
    throw new ResponseError(404, "Id tidak ditemukan!");
  }

  return prismaClient.tmst_posisi.delete({
    where: {
      id: id,
    },
  });
};

const getOnePosition = async (id) =>{
  id = validate(deletePositionValidation, id);

  const getOnePosition = await prismaClient.tmst_posisi.count({
    where: {
      id: id
    }
  });

  if (getOnePosition === 0) {
    throw new ResponseError(404, "Data posisi tidak ditemukan");
  }

  const StafData = await prismaClient.tmst_posisi.findFirst({
    where:{
      id
    },
    select:{
      id: true,
      posisi: true
    }
  });

  return StafData;
}

export default { create, update, listPosisi, remove, getOnePosition };
