import jwt from "jsonwebtoken";

export const authMiddleware = (req, res, next) => {
  try {
    const token =
      req.cookies["refreshToken"] ||
      req.headers["authorization"]?.split(" ")[1];

    if (!token) {
      return res
        .status(401)
        .json({ error: "Access ditolak, tidak ada token yang tersedia" });
    }

    let decoded;
    let secretUsed;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      secretUsed = "ACCESS";
    } catch (err) {
      try {
        decoded = jwt.verify(token, process.env.JWT_REFRESH_TOKEN);
        secretUsed = "REFRESH";
      } catch (err2) {
        return res.status(400).json({ error: "Token tidak valid" });
      }
    }

    // console.log(`✅ Token terverifikasi (${secretUsed})`, decoded);

    if (!decoded.id) {
      return res.status(400).json({
        error: "Token tidak memuat ID pengguna yang diperlukan",
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error("❌ JWT Error:", error);
    res.status(500).json({ error: "Terjadi kesalahan autentikasi" });
  }
};
