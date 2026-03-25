import { validate } from "../validation/validation.js";
import {
  getUserValidation,
  loginUserValidation,
  registerUserValidation,
  updateUserValidation
} from "../validation/user-validation.js";
import { prismaClient } from "../application/database.js";
import { ResponseError } from "../error/response-error.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const register = async (userData) => {
  userData = validate(registerUserValidation, userData);

  const { nip, nama, username, departemen, password, status } = userData;
  const salt = await bcrypt.genSalt()
  const hashedPassword = await bcrypt.hash(password, salt);

  const existingUser = await prismaClient.user.findUnique({
    where: { username },
  });

  const existingPengguna = await prismaClient.tmst_pengguna.findUnique({
    where: { id: nip },
  });

  if (existingUser) {
    throw new ResponseError(400, 'Username telah ditambahkan');
  }

  if (existingPengguna) {
    throw new ResponseError(400, 'ID telah ditambahkan');
  }

  const user = await prismaClient.user.create({
    data: {
      username,
      password: hashedPassword,
      name: nama
    }
  });

  const tmst_pengguna = await prismaClient.tmst_pengguna.create({
    data: {
      id: nip,
      nama,
      username,
      departemen,
      status
    }
  });

  return {
    "username": user.username,
    "name": user.name,
    "departemen": tmst_pengguna.departemen,
    "status": tmst_pengguna.status
  };
}

const login = async (request) => {
  request = validate(loginUserValidation, request);
  const { username, password } = request;

  if (!username || !password) {
    throw new ResponseError(400, 'Username atau password tidak valid');
  }

  const user = await prismaClient.user.findUnique({ where: { username } });

  if (!user) {
    throw new ResponseError(401, 'Username atau password tidak valid');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw new ResponseError(401, 'Username atau password tidak valid');
  }

  const pengguna = await prismaClient.tmst_pengguna.findUnique({ where: { username } });

  const payload = {
    id: pengguna.id,
    username: user.username,
    role: pengguna.status,
    name: pengguna.nama
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_TOKEN, { expiresIn: '3h' });

  await prismaClient.user.update({
    where: {
      username: username
    },
    data: {
      refresh_token: refreshToken
    }
  });

  return {
    "token": token,
    "refresh_token": refreshToken,
  };
};

const refresh = async (refreshToken) => {
  if (!refreshToken) {
    console.error("Tidak ada refresh token yang disediakan");
    throw new ResponseError(401, "Refresh token tidak diketahui");
  }

  const user = await prismaClient.user.findFirst({
    where: {
      refresh_token: refreshToken
    },
    include: {
      tmst_pengguna: true
    }
  });

  if (!user) {
    console.error("Tidak ada pengguna yang ditemukan dengan refresh token yang diberikan");
    throw new ResponseError(403, "Forbidden");
  }

  let accessToken = null;

  try {
    // Verify the existing refresh token
    jwt.verify(refreshToken, process.env.JWT_REFRESH_TOKEN);

    const payload = {
      id: user.tmst_pengguna.id,
      username: user.username,
      name: user.name,
      role: user.tmst_pengguna.status
    };

    // Generate new access token (15 minutes)
    accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });

    // Note: Token rotation removed to prevent race conditions during page navigation
    // Refresh token remains the same until it expires (set during login)

  } catch (err) {
    console.error("Error verifying refresh token:", err);
    throw new ResponseError(401, "Refresh token tidak valid");
  }

  return {
    "token": accessToken
  };
};

const get = async (username) => {
  username = validate(getUserValidation, username);

  const user = await prismaClient.user.findUnique({
    where: {
      username: username
    },
    select: {
      username: true,
      name: true
    }
  });

  if (!user) {
    throw new ResponseError(404, "Pengguna tidak ditemukan");
  }

  return user;
}

const update = async (request) => {
  const user = validate(updateUserValidation, request);

  const totalUserInDatabase = await prismaClient.user.count({
    where: {
      username: user.username
    }
  });

  if (totalUserInDatabase !== 1) {
    throw new ResponseError(404, "Pengguna tidak ditemukan");
  }

  const data = {};
  if (user.name) {
    data.name = user.name;
  }
  if (user.password) {
    data.password = await bcrypt.hash(user.password, 10);
  }

  return prismaClient.user.update({
    where: {
      username: user.username
    },
    data: data,
    select: {
      username: true,
      name: true
    }
  })
}

const logout = async (request) => {
  const refreshToken = request;
  if (!refreshToken) {
    throw new ResponseError(204, "no content")
  }
  const user = await prismaClient.user.findMany({
    where: {
      refresh_token: refreshToken
    },
    select: {
      username: true,
      name: true,
      tmst_pengguna: {
        select: {
          status: true,
        }
      }
    }
  })
  if (!user[0]) {
    throw new ResponseError(204, "Tidak ada konten")
  }

  const username = user[0].username;

  await prismaClient.user.update({
    data: {
      refresh_token: null,
    },
    where: {
      username: username
    }
  });
}

export default {
  register,
  login,
  get,
  update,
  logout,
  refresh
}
