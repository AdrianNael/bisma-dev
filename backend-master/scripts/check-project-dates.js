import { prismaClient } from "../src/application/database.js";

async function checkProjectDates() {
  try {
    console.log("Checking project dates for id_project (tmst_project.id) = 4...\n");

    const tranProject = await prismaClient.tran_project.findFirst({
      where: { id_project: 4 },
      select: {
        id: true,
        id_project: true,
        id_peserta: true,
        tmst_project: {
          select: {
            id: true,
            nama: true,
            tanggal_mulai: true,
            tanggal_selesai: true,
          },
        },
      },
    });

    if (!tranProject) {
      console.log("❌ tran_project dengan id_project=4 tidak ditemukan!");
      return;
    }

    console.log("📊 Data tran_project dengan id_project=4:");
    console.log(JSON.stringify(tranProject, null, 2));
    console.log("\n📅 Tanggal Project (tmst_project):");
    console.log("  - tanggal_mulai:", tranProject.tmst_project.tanggal_mulai);
    console.log("  - tanggal_selesai:", tranProject.tmst_project.tanggal_selesai);

    // Check if dates make sense
    if (tranProject.tmst_project.tanggal_mulai && tranProject.tmst_project.tanggal_selesai) {
      const start = new Date(tranProject.tmst_project.tanggal_mulai);
      const end = new Date(tranProject.tmst_project.tanggal_selesai);

      console.log("\n🔍 Validasi:");
      console.log("  - Start Date (UTC):", start.toISOString());
      console.log("  - End Date (UTC):", end.toISOString());
      
      if (start > end) {
        console.log("  ⚠️  WARNING: tanggal_mulai > tanggal_selesai!");
      } else {
        console.log("  ✅ Dates are valid");
      }

      // Test with the provided timesheet date
      const timesheetDate = new Date("2026-01-25T00:00:00.000Z");
      console.log("\n📝 Test Timesheet Date: 2026-01-25T00:00:00.000Z");
      console.log("  - Timesheet Date (UTC):", timesheetDate.toISOString());
      
      const getDateString = (date) => {
        const d = new Date(date);
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      };

      const timesheetDateStr = getDateString(timesheetDate);
      const startDateStr = getDateString(start);
      const endDateStr = getDateString(end);

      console.log("  - Timesheet Date String:", timesheetDateStr);
      console.log("  - Start Date String:", startDateStr);
      console.log("  - End Date String:", endDateStr);

      const isValid = timesheetDateStr >= startDateStr && timesheetDateStr <= endDateStr;
      console.log(`  - Is Valid: ${isValid ? '✅ YES' : '❌ NO'}`);
      
      if (!isValid) {
        console.log(`  - Reason: ${timesheetDateStr} is not between ${startDateStr} and ${endDateStr}`);
      }
    } else {
      console.log("  ⚠️  One or both dates are null");
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prismaClient.$disconnect();
  }
}

checkProjectDates();
