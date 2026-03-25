import userService from "../service/user-service.js";
import cookie from 'cookie';

const register = async (req, res, next) => {
  try {
    const request = req.body;
    const result = await userService.register(request);
    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Data berhasil ditambahkan.",
      data: result,
      url: req.protocol + "://" + req.get("host") + req.originalUrl,
    });
  } catch (e) {
    next(e);
  }
}

const login = async (req, res, next) => {
  try {
    const result = await userService.login(req.body);
    // res.cookie('refreshToken', result.refresh_token, {
    //   httpOnly: true,
    //   maxAge: 2 * 60 * 60 * 1000,
    //   domain: '.universitaspertamina.ac.id',
    //   secure: true,
    //   sameSite: 'None',
    // });
    res.cookie('refreshToken', result.refresh_token, {
      httpOnly: true,
      maxAge: 2 * 60 * 60 * 1000,
      secure: true,
      sameSite: 'None',
    });

    delete result.refresh_token;

    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Data terautorisasi.",
      data: result,
      url: req.protocol + "://" + req.get("host") + req.originalUrl,
    });
  } catch (e) {
    console.error("Error in login controller:", e);
    next(e);
  }
};


const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      console.error("No refresh token provided in cookies");
      throw new ResponseError(401, "Tidak ada refresh token yang tersedia");
    }

    const result = await userService.refresh(refreshToken);

    // Note: Token rotation removed - no need to set new refresh token cookie
    // The original refresh token remains valid until it expires

    res.status(200).json({
      status: res.statusCode,
      success: true,
      message: "Token diubah.",
      data: result,
      url: req.protocol + "://" + req.get("host") + req.originalUrl,
    });
  } catch (e) {
    console.error("Error refreshing token:", e);
    next(e);
  }
}

const get = async (req, res, next) => {
  try {
    const username = req.user.username;
    const result = await userService.get(username);
    res.status(200).json({
      data: result
    });
  } catch (e) {
    next(e);
  }
}

const update = async (req, res, next) => {
  try {
    const username = req.user.username;
    const request = req.body;
    request.username = username;

    const result = await userService.update(request);
    res.status(200).json({
      data: result
    });
  } catch (e) {
    next(e);
  }
}

const logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    console.log("controller", refreshToken);
    if (refreshToken) {
      await userService.logout(refreshToken);
    }
  } catch (e) {
    console.error("Error during logout service call:", e);
    // Continue to clear cookie regardless of service error
  } finally {
    res.clearCookie('refreshToken', {
      path: '/',
      secure: true,
      sameSite: 'None',
    });

    res.status(200).json({
      data: "logout berhasil"
    });
  }
}

export default {
  register,
  login,
  get,
  update,
  logout,
  refresh,
}
