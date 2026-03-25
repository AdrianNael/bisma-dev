import { prismaClient } from "../application/database.js";
import { ResponseError } from "../error/response-error.js";
import bcrypt from "bcrypt";
import { validate } from "../validation/validation.js";
import { createStafSchema, getOneStafSchema, getStafSchema, updateStafSchema } from "../validation/staf-validation.js";

const getStafDetails = async (filters, pagination) => {
    filters = validate(getStafSchema, filters);
    const { nama, nip } = filters;
    const { size, page } = pagination;

    const skip = (page - 1) * size;
    const take = size;
    const stafUsers = await prismaClient.tmst_pengguna.findMany({
        where: {
        status: 'STAF',
        AND: [
            nama ? { nama: { contains: nama} } : {},
            nip ? { id: { equals: nip } } : {},
        ],
        },
        select: {
        id: true,
        nama: true,
        username: true,
        tran_posisi_pengguna: {
            select: {
            tmst_posisi: {
                select: {
                posisi: true,
                },
            },
            },
        },
        },
        skip,
        take,
    });

    if(!stafUsers){
        throw new ResponseError(404, "Data tidak ditemukan");
    }


    const formattedStafUsers = stafUsers.map((staf) => {
        const posisi = staf.tran_posisi_pengguna.length > 0 
        ? staf.tran_posisi_pengguna[0].tmst_posisi.posisi 
        : null;

        return {
        id: staf.id,
        nama: staf.nama,
        username: staf.username,
        posisi: posisi
        };
    });

    const totalItems = await prismaClient.tmst_pengguna.count({
        where: {
        status: 'STAF',
        AND: [
            nama ? { nama: { contains: nama} } : {},
            nip ? { id: { equals: nip } } : {},
        ],
        },
    });

    return {
        stafUsers: formattedStafUsers,
        total_item: totalItems,
        total_page: Math.ceil(totalItems / size),
        page: page,
    };
};

const createStaf = async(data) =>{
    data = validate(createStafSchema, data);
    const { username, password, nama, departemen, id_posisi, nip, no_telp, no_rekening } = data;

    // Cek apakah username sudah ada di tabel users
    const existingUser = await prismaClient.user.findUnique({
        where: { username },
    });
    
    if (existingUser) {
        throw new ResponseError(400, 'Username telah tersedia');
    }

    // Cek apakah username sudah ada di tabel tmst_pengguna
    const existingTmstPengguna = await prismaClient.tmst_pengguna.findUnique({
        where: { username },
    });

    if (existingTmstPengguna) {
        throw new ResponseError(400,'Username telah tersedia');
    }

    // Hash password
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await prismaClient.user.create({
    data: {
        username,
        password: hashedPassword, // Simpan hashed password
        name: nama,
    },
    });

    // Create tmst_pengguna
    const tmstPengguna = await prismaClient.tmst_pengguna.create({
    data: {
        id: nip,
        nama: nama,
        username: user.username,
        departemen: departemen || '',
        no_telp: no_telp || '',
        no_rekening: no_rekening ||'',
        status: 'STAF',
    },
    });

    // Create tran_posisi_pengguna
    const tranPosisiPengguna = await prismaClient.tran_posisi_pengguna.create({
    data: {
        id_pengguna: tmstPengguna.id,
        id_posisi,
    },
    });

    return {
    user,
    tmstPengguna,
    tranPosisiPengguna,
    };
}

const updateStafAndUserByUsername = async (username, data) => {
  data = validate(updateStafSchema, data);

  const existingPengguna = await prismaClient.tmst_pengguna.findUnique({
    where: { username },
  });

  if (!existingPengguna) {
    throw new Error('Pengguna tidak ditemukan');
  }

  let existingUser;

  if (data.username) {
    existingUser = await prismaClient.user.findUnique({
      where: { username: data.username }, 
    });

    // Check if the new username is already taken
    if (existingUser && existingUser.username !== username) {
      throw new Error('Username sudah digunakan oleh pengguna lain');
    }
  }

  let hashedPassword = null;
  let userData = null;
  if (data.password) {
    const salt = await bcrypt.genSalt();
    hashedPassword = await bcrypt.hash(data.password, salt);
  }

  if (data.username || data.password) {
    userData = await prismaClient.user.update({
      where: { username }, 
      data: {
        username: data.username || existingPengguna.username,
        password: hashedPassword ? hashedPassword : existingUser?.password,
      },
    });
  } else if (hashedPassword) {
    await prismaClient.user.update({
      where: { username }, 
      data: {
        password: hashedPassword,
      },
    });
  }
  
  // Update pengguna with new data
  const updatedPengguna = await prismaClient.tmst_pengguna.update({
    where: { username: userData.username }, // Using username for the update
    data: {
      nama: data.nama || existingPengguna.nama,
      username: userData.username || existingPengguna.username,
      departemen: data.departemen || existingPengguna.departemen,
      no_telp: data.no_telp || existingPengguna.no_telp,
      no_rekening: data.no_rekening || existingPengguna.no_rekening,
    },
  });

  await prismaClient.tran_posisi_pengguna.updateMany({
    where:{
      id_pengguna: updatedPengguna.id
    },
    data:{
      id_pengguna: updatedPengguna.id,
      id_posisi: data.id_posisi
    }
  })


  return updatedPengguna;
};


const getOneStaf = async (username) => {
  username = validate(getOneStafSchema, username);

  const getOneUser = await prismaClient.user.count({
    where: {
      username: username
    }
  });

  if (getOneUser === 0) {
    throw new ResponseError(404, "Data Staf tidak ditemukan");
  }

  const StafData = await prismaClient.tmst_pengguna.findFirst({
    where:{
      username
    },
    select:{
      id: true,
      username: true,
      nama: true,
      no_telp: true,
    }
  });

  const response = {
    nip: StafData.id,
    username: StafData.username,
    nama: StafData.nama,
    no_telp: StafData.no_telp
  };

  return response;
}

const deleteUserByUsername = async (username) => {
  username = validate(getOneStafSchema, username);

  const existingPengguna = await prismaClient.tmst_pengguna.findUnique({
      where: { username },
      select:{
        id: true,
      }
  });

  if (!existingPengguna) {
      throw new Error('Pengguna tidak ditemukan');
  }

  await prismaClient.tran_posisi_pengguna.deleteMany({
    where: { id_pengguna: existingPengguna.id }
  });

  await prismaClient.tmst_pengguna.delete({
      where: { username },
  });

  const data = await prismaClient.user.delete({
      where: { username },
  });

  
  return data;
};



export default{
    createStaf,
    getStafDetails,
    updateStafAndUserByUsername,
    getOneStaf,
    deleteUserByUsername
}