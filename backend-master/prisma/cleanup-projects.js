import { PrismaClient } from "@prisma/client";
import readline from "readline";

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askConfirmation(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.toLowerCase() === "yes" || answer.toLowerCase() === "y");
    });
  });
}

async function cleanupProjects() {
  console.log("=".repeat(80));
  console.log("⚠️  WARNING: CLEANUP PROJECT DATA");
  console.log("=".repeat(80));
  console.log("\nScript ini akan menghapus SEMUA data project, timesheet, dan payment.");
  console.log("Data yang akan DIPERTAHANKAN:");
  console.log("  ✅ Users & Pengguna");
  console.log("  ✅ Fakultas & Departemen");
  console.log("  ✅ Kategori Magang & Kegiatan");
  console.log("  ✅ Posisi");
  console.log("  ✅ Satuan Insentif & Insentif");
  console.log("  ✅ Semua Master Status");
  console.log("\nData yang akan DIHAPUS:");
  console.log("  ❌ Timesheet (tran_timesheet)");
  console.log("  ❌ Tran Projects (tran_project)");
  console.log("  ❌ Master Projects (tmst_project)");
  console.log("  ❌ Payments (tran_payment)");
  console.log("  ❌ Job Applications (job_applications)");
  console.log("  ❌ Project Department (tmst_project_department)");
  console.log("  ❌ Project Status History");
  console.log("  ❌ Payment Status History");
  console.log("  ❌ Timesheet Status History");
  console.log("  ✅ Posisi Pengguna (tran_posisi_pengguna) - preserved (not deleted)");
  console.log("\n" + "=".repeat(80));

  const confirmed = await askConfirmation(
    "\n⚠️  Apakah Anda yakin ingin melanjutkan? (yes/no): "
  );

  if (!confirmed) {
    console.log("\n❌ Cleanup dibatalkan.");
    rl.close();
    return;
  }

  const doubleConfirm = await askConfirmation(
    "\n⚠️  KONFIRMASI TERAKHIR: Data yang dihapus TIDAK DAPAT dikembalikan! (yes/no): "
  );

  if (!doubleConfirm) {
    console.log("\n❌ Cleanup dibatalkan.");
    rl.close();
    return;
  }

  console.log("\n🔄 Memulai cleanup...\n");

  try {
    // Delete in correct order (respecting foreign key constraints)
    let totalDeleted = 0;
    
    // 1. Delete History Tables first (if exist)
    try {
      console.log("🗑️  Menghapus Timesheet Status History...");
      const deletedTimesheetHistory = await prisma.timesheet_status_history.deleteMany({});
      console.log(`   ✅ ${deletedTimesheetHistory.count} records dihapus`);
      totalDeleted += deletedTimesheetHistory.count;
    } catch (e) {
      console.log(`   ⚠️  Table tidak ditemukan atau sudah kosong`);
    }

    try {
      console.log("🗑️  Menghapus Payment Status History...");
      const deletedPaymentHistory = await prisma.payment_status_history.deleteMany({});
      console.log(`   ✅ ${deletedPaymentHistory.count} records dihapus`);
      totalDeleted += deletedPaymentHistory.count;
    } catch (e) {
      console.log(`   ⚠️  Table tidak ditemukan atau sudah kosong`);
    }

    try {
      console.log("🗑️  Menghapus Project Status History...");
      const deletedProjectHistory = await prisma.project_status_history.deleteMany({});
      console.log(`   ✅ ${deletedProjectHistory.count} records dihapus`);
      totalDeleted += deletedProjectHistory.count;
    } catch (e) {
      console.log(`   ⚠️  Table tidak ditemukan atau sudah kosong`);
    }

    // 2. Delete Timesheets (depends on tran_project)
    console.log("🗑️  Menghapus Timesheets...");
    const deletedTimesheets = await prisma.tran_timesheet.deleteMany({});
    console.log(`   ✅ ${deletedTimesheets.count} records dihapus`);
    totalDeleted += deletedTimesheets.count;

    // 3. Delete Payments (depends on tmst_project)
    console.log("🗑️  Menghapus Payments...");
    const deletedPayments = await prisma.tran_payment.deleteMany({});
    console.log(`   ✅ ${deletedPayments.count} records dihapus`);
    totalDeleted += deletedPayments.count;

    // 4. Delete Job Applications (depends on tmst_project, if exists)
    try {
      console.log("🗑️  Menghapus Job Applications...");
      const deletedJobApplications = await prisma.job_application.deleteMany({});
      console.log(`   ✅ ${deletedJobApplications.count} records dihapus`);
      totalDeleted += deletedJobApplications.count;
    } catch (e) {
      console.log(`   ⚠️  Table tidak ditemukan atau sudah kosong`);
    }

    // 5. Delete Tran Projects (depends on tmst_project)
    console.log("🗑️  Menghapus Tran Projects...");
    const deletedTranProjects = await prisma.tran_project.deleteMany({});
    console.log(`   ✅ ${deletedTranProjects.count} records dihapus`);
    totalDeleted += deletedTranProjects.count;

    // 6. Delete Project Department Mapping (if exists)
    try {
      console.log("🗑️  Menghapus Project Department Mapping...");
      const deletedProjectDept = await prisma.tmst_project_department.deleteMany({});
      console.log(`   ✅ ${deletedProjectDept.count} records dihapus`);
      totalDeleted += deletedProjectDept.count;
    } catch (e) {
      console.log(`   ⚠️  Table tidak ditemukan atau sudah kosong`);
    }

    // 7. Delete Master Projects
    console.log("🗑️  Menghapus Master Projects...");
    const deletedMasterProjects = await prisma.tmst_project.deleteMany({});
    console.log(`   ✅ ${deletedMasterProjects.count} records dihapus`);
    totalDeleted += deletedMasterProjects.count;

    // 8. Posisi Pengguna - preserved (do not delete)
    console.log("ℹ️  Posisi Pengguna (tran_posisi_pengguna) dipertahankan (tidak dihapus).");

    console.log("\n" + "=".repeat(80));
    console.log("✅ CLEANUP SELESAI!");
    console.log("=".repeat(80));

    console.log(`\n📊 Total ${totalDeleted} records berhasil dihapus.`);
    console.log("\n✅ Data master (users, status, fakultas, dll) tetap dipertahankan.\n");

  } catch (error) {
    console.error("\n❌ Error during cleanup:", error);
    console.error("\nPastikan tidak ada constraint yang dilanggar.");
  } finally {
    rl.close();
  }
}

cleanupProjects()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
