import { prismaClient } from "../src/application/database.js";

async function checkPaymentStatus() {
  try {
    console.log("Checking payment status table...\n");

    const statuses = await prismaClient.tmst_status_pembayaran.findMany({
      orderBy: { id: 'asc' }
    });

    console.log("📊 Payment Status List (tmst_status_pembayaran):");
    console.log("ID | Status");
    console.log("---|-------");
    statuses.forEach(status => {
      console.log(`${status.id.toString().padEnd(2)} | ${status.status}`);
    });

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prismaClient.$disconnect();
  }
}

checkPaymentStatus();
