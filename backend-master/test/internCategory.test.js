import supertest from "supertest";
import { removeAllTestInternCategory } from "./test-util.js";
import { web } from "../src/application/web.js";

describe("POST /api/internCategory", function () {

  it("Should can create new intern category", async () => {
    const result = await supertest(web).post("/api/internCategory").send({
      kategori: "Magang",
    });

    expect(result.status).toBe(200);
    expect(result.body.data.kategori).toBe("Magang");
  });
});
