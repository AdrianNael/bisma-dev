import { logger } from "../src/application/logging.js";
import tmstProjectService from "../src/service/tmst-project-service.js";

const run = async () => {
    try {
        const result = await tmstProjectService.getMyProject({
            page: 1, size: 5, userId: '116042'
        });
        console.log("SUCCESS:", Object.keys(result));
    } catch(e) {
        console.error("ERROR CAUGHT IN SCRIPT!");
        console.error(e.stack);
    }
    process.exit(0);
}
run();
