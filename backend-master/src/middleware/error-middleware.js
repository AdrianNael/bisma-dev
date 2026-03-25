import { ResponseError } from "../error/response-error.js";

const isDevelopment = process.env.NODE_ENV === 'development';

const errorMiddleware = async (err, req, res, next) => {
  if (!err) {
    next();
    return;
  }

  // Log error server-side for debugging
  if (isDevelopment) {
    console.error('Error:', err);
  }

  if (err instanceof ResponseError) {
    res
      .status(err.status)
      .json({
        status: err.status,
        success: false,
        message: err.message,
      })
      .end();
  } else {
    // Hide internal error details in production
    const message = isDevelopment ? err.message : 'Terjadi kesalahan internal server';

    res
      .status(500)
      .json({
        status: 500,
        success: false,
        message: message,
      })
      .end();
  }
};

export { errorMiddleware };
