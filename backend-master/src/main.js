import { web } from "./application/web.js";
import { logger } from "./application/logging.js";

const port = process.env.PORT;

web.listen(port, () => {
  logger.info(`App start on Port ${port}`);
});
