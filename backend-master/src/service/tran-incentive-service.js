import { validate } from "../validation/validation.js";
import { createIncentiveValidation, getId, searchIncentiveValidation, showIncentiveValidation, updateIncentiveValidation } from "../validation/tran-incentive-validation.js";
import { prismaClient } from "../application/database.js";
import { ResponseError } from "../error/response-error.js";

const create = async (request) => {
  const incentive = validate(createIncentiveValidation, request);

  const countId = await prismaClient.tmst_kategori_magang.count({
    where: {
      id: incentive.id_kategori,
    },
  });

  // console.log(countId);

  if (countId === 0) {
    throw new ResponseError(400, "Kategori tidak ditemukan!");
  }

  const countIncentive = await prismaClient.tran_insentif.count({
    where: {
      id_kategori: incentive.id_kategori,
    },
  });

  if (countIncentive === 1) {
    throw new ResponseError(400, "Insentif kategori magang telah ditambahkan, tolong diupdate!");
  }

  const createIncentive = prismaClient.tran_insentif.create({
    data: incentive,
    select: {
      id: true,
      id_kategori: true,
      id_satuan: true,
      besaran_insentif: true,
      durasi_satuan: true,
    },
  });

  return createIncentive;
};

const list = async (request) => {
  request = validate(searchIncentiveValidation, request);

  const skip = (request.page - 1) * request.size;

  const filters = {};

  if (request.kategori) {
    filters.tmst_kategori_magang = {
      kategori: {
        contains: request.kategori,
      },
    };
  }

  if (request.insentif) {
    filters.besaran_insentif = parseFloat(request.insentif);
  }

  const totalItems = await prismaClient.tran_insentif.count({
    where: filters,
  });

  const data_search = await prismaClient.tran_insentif.findMany({
    where: filters,
    select: {
      id: true,
      durasi_satuan: true,
      besaran_insentif: true,
      tmst_kategori_magang: {
        select: {
          id: true,
          kategori: true,
        },
      },
      tmst_satuan_insentif:{
        select: {
          satuan: true,
          id: true,
        }
      }
    },
    take: request.size,
    skip: skip,
  });

  const formattedData = data_search.map((data) => {
    return {
      id: data.id,
      id_satuan: data.tmst_satuan_insentif.id,
      durasi_satuan: data.durasi_satuan,
      besaran_insentif: data.besaran_insentif,
      kategori: data.tmst_kategori_magang.kategori,
      id_kategori: data.tmst_kategori_magang.id,
    };
  });

  return {
    data: formattedData,
    paging: {
      page: request.page,
      total_item: totalItems,
      total_page: Math.ceil(totalItems / request.size),
    },
  };
};

const read = async () => {
  const getIncentive = await prismaClient.tran_insentif.findMany({
    select: {
      id: true,
      id_kategori: true,
      id_satuan: true,
      besaran_insentif: true,
      durasi_satuan: true,
    },
  });
  return getIncentive;
};

const update = async (request) => {
  const incentive = validate(updateIncentiveValidation, request);
  const totalIncentiveInDatabase = await prismaClient.tran_insentif.count({
    where: {
      id: incentive.id,
    },
  });

  if (totalIncentiveInDatabase !== 1) {
    throw new ResponseError(404, "Insentif tidak ditemukan");
  }
  // console.log(incentive);

  return prismaClient.tran_insentif.update({
    where: {
      id: incentive.id,
    },
    data: {
      id_kategori:incentive.id_kategori,
      id_satuan:incentive.id_satuan,
      besaran_insentif: incentive.besaran_insentif,
      durasi_satuan: incentive.durasi_satuan,
    },
    select: {
      id: true,
      id_kategori: true,
      id_satuan: true,
      besaran_insentif: true,
      durasi_satuan: true,
    },
  });
};

const remove = async (incentiveId) => {
  incentiveId = validate(getId, incentiveId);

  const totalInDatabase = await prismaClient.tran_insentif.count({
    where: {
      id: incentiveId,
    },
  });

  if (totalInDatabase !== 1) {
    throw new ResponseError(404, "Insentif tidak ditemukan");
  }

  return prismaClient.tran_insentif.delete({
    where: {
      id: incentiveId,
    },
  });
};

const select = async (request) => {
  request = validate(getId, request);
  let besaran_insentif = null;
  let durasi_satuan = null;
  let satuan_insentif = null;
  let nama_kategori = null;
  let id_kategori = null;
  const getIncentive = await prismaClient.tran_insentif.findFirst({
    select: {
      id: true,
      id_satuan: true,
      besaran_insentif: true,
      durasi_satuan: true,
      tmst_kategori_magang: {
        select: {
          id: true,
          kategori: true,
        },
      },
      tmst_satuan_insentif: {
        select: {
          satuan: true,
        },
      },
    },
    where: {
      id: request,
    },
  });

  if (!getIncentive) {
    throw new ResponseError(404, "Id tidak ditemukan!");
  }

  durasi_satuan = getIncentive.durasi_satuan;
  besaran_insentif = getIncentive.besaran_insentif;
  satuan_insentif = getIncentive.tmst_satuan_insentif.satuan;
  nama_kategori = getIncentive.tmst_kategori_magang.kategori;
  id_kategori = getIncentive.tmst_kategori_magang.id;
  delete getIncentive.tmst_kategori_magang;
  delete getIncentive.tmst_satuan_insentif;
  getIncentive.durasi_satuan = durasi_satuan;
  getIncentive.besaran_insentif = besaran_insentif;
  getIncentive.satuan_insentif = satuan_insentif;
  getIncentive.nama_kategori = nama_kategori;
  getIncentive.id_kategori = id_kategori;
  id_kategori = null;
  nama_kategori = null;
  durasi_satuan = null;
  besaran_insentif = null;
  satuan_insentif = null;

  return getIncentive;
};


const getProject = async (request) => {
  request = validate(getId, request);
  let besaran_insentif = null;
  let durasi_satuan = null;
  let satuan_insentif = null;
  let nama_kategori = null;
  let id_kategori = null;
  const getIncentive = await prismaClient.tran_insentif.findFirst({
    select: {
      id: true,
      id_satuan: true,
      besaran_insentif: true,
      durasi_satuan: true,
      tmst_kategori_magang: {
        select: {
          id: true,
          kategori: true,
        },
      },
      tmst_satuan_insentif: {
        select: {
          satuan: true,
        },
      },
    },
    where: {
      tmst_kategori_magang:{
        id: request,
      }
    },
  });

  if (!getIncentive) {
    throw new ResponseError(404, "Id tidak ditemukan!");
  }

  durasi_satuan = getIncentive.durasi_satuan;
  besaran_insentif = getIncentive.besaran_insentif;
  satuan_insentif = getIncentive.tmst_satuan_insentif.satuan;
  nama_kategori = getIncentive.tmst_kategori_magang.kategori;
  id_kategori = getIncentive.tmst_kategori_magang.id;
  delete getIncentive.tmst_kategori_magang;
  delete getIncentive.tmst_satuan_insentif;
  getIncentive.durasi_satuan = durasi_satuan;
  getIncentive.besaran_insentif = besaran_insentif;
  getIncentive.satuan_insentif = satuan_insentif;
  getIncentive.nama_kategori = nama_kategori;
  getIncentive.id_kategori = id_kategori;
  id_kategori = null;
  nama_kategori = null;
  durasi_satuan = null;
  besaran_insentif = null;
  satuan_insentif = null;

  return getIncentive;
};

export default {
  create,
  read,
  list,
  update,
  remove,
  select,
  getProject
};
