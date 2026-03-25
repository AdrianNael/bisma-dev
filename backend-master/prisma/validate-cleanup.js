import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function validateCleanup() {
  console.log("=".repeat(80));
  console.log("VALIDASI DATA YANG AKAN DIHAPUS DAN DIPERTAHANKAN");
  console.log("=".repeat(80));

  console.log("\n📋 DATA YANG AKAN DIPERTAHANKAN (TIDAK DIHAPUS):\n");

  // Master Users
  const masterUsers = await prisma.user.count();
  console.log(`✅ Master Users (users): ${masterUsers} records`);

  // Pengguna
  const pengguna = await prisma.tmst_pengguna.count();
  console.log(`✅ Pengguna (tmst_pengguna): ${pengguna} records`);

  // Fakultas
  const faculty = await prisma.tmst_faculty.count();
  console.log(`✅ Fakultas (tmst_faculty): ${faculty} records`);

  // Departemen/Prodi
  const department = await prisma.tmst_department.count();
  console.log(`✅ Departemen (tmst_department): ${department} records`);

  // Kategori Magang
  const kategoriMagang = await prisma.tmst_kategori_magang.count();
  console.log(`✅ Kategori Magang (tmst_kategori_magang): ${kategoriMagang} records`);

  // Kategori Kegiatan
  const kategoriKegiatan = await prisma.tmst_kategori_kegiatan.count();
  console.log(`✅ Kategori Kegiatan (tmst_kategori_kegiatan): ${kategoriKegiatan} records`);

  // Posisi
  const posisi = await prisma.tmst_posisi.count();
  console.log(`✅ Posisi (tmst_posisi): ${posisi} records`);

  // Satuan Insentif
  const satuanInsentif = await prisma.tmst_satuan_insentif.count();
  console.log(`✅ Satuan Insentif (tmst_satuan_insentif): ${satuanInsentif} records`);

  // Insentif
  const insentif = await prisma.tran_insentif.count();
  console.log(`✅ Insentif (tran_insentif): ${insentif} records`);

  // All Status Tables
  const statusTimesheet = await prisma.tmst_status_timesheet.count();
  console.log(`✅ Status Timesheet (tmst_status_timesheet): ${statusTimesheet} records`);

  const statusPembayaran = await prisma.tmst_status_pembayaran.count();
  console.log(`✅ Status Pembayaran (tmst_status_pembayaran): ${statusPembayaran} records`);

  const statusProject = await prisma.tmst_status_project.count();
  console.log(`✅ Status Project (tmst_status_project): ${statusProject} records`);

  const statusMasterProject = await prisma.tmst_status_master_project.count();
  console.log(`✅ Status Master Project (tmst_status_master_project): ${statusMasterProject} records`);

  const statusStudentTimesheet = await prisma.tmst_status_student_timesheet.count();
  console.log(`✅ Status Student Timesheet (tmst_status_student_timesheet): ${statusStudentTimesheet} records`);

  console.log("\n" + "=".repeat(80));
  console.log("\n🗑️  DATA YANG AKAN DIHAPUS:\n");

  // Timesheet
  const timesheets = await prisma.tran_timesheet.count();
  console.log(`❌ Timesheet (tran_timesheet): ${timesheets} records`);

  // Projects (tran_project)
  const tranProjects = await prisma.tran_project.count();
  console.log(`❌ Tran Projects (tran_project): ${tranProjects} records`);

  // Master Projects
  const masterProjects = await prisma.tmst_project.count();
  console.log(`❌ Master Projects (tmst_project): ${masterProjects} records`);

  // Payments
  const payments = await prisma.tran_payment.count();
  console.log(`❌ Payments (tran_payment): ${payments} records`);

  // Job Applications (check if table exists)
  let jobApplications = 0;
  try {
    jobApplications = await prisma.job_application.count();
    console.log(`❌ Job Applications (job_application): ${jobApplications} records`);
  } catch (e) {
    console.log(`❌ Job Applications (job_application): Table not found or 0 records`);
  }

  // Project Department Mapping
  let projectDept = 0;
  try {
    projectDept = await prisma.tmst_project_department.count();
    console.log(`❌ Project Department (tmst_project_department): ${projectDept} records`);
  } catch (e) {
    console.log(`❌ Project Department (tmst_project_department): Table not found or 0 records`);
  }

  // History Tables
  let projectStatusHistory = 0;
  try {
    projectStatusHistory = await prisma.project_status_history.count();
    console.log(`❌ Project Status History (project_status_history): ${projectStatusHistory} records`);
  } catch (e) {
    console.log(`❌ Project Status History (project_status_history): Table not found or 0 records`);
  }

  let paymentStatusHistory = 0;
  try {
    paymentStatusHistory = await prisma.payment_status_history.count();
    console.log(`❌ Payment Status History (payment_status_history): ${paymentStatusHistory} records`);
  } catch (e) {
    console.log(`❌ Payment Status History (payment_status_history): Table not found or 0 records`);
  }

  let timesheetStatusHistory = 0;
  try {
    timesheetStatusHistory = await prisma.timesheet_status_history.count();
    console.log(`❌ Timesheet Status History (timesheet_status_history): ${timesheetStatusHistory} records`);
  } catch (e) {
    console.log(`❌ Timesheet Status History (timesheet_status_history): Table not found or 0 records`);
  }

  // Posisi Pengguna (preserved)
  const posisiPengguna = await prisma.tran_posisi_pengguna.count();
  console.log(`✅ Posisi Pengguna (tran_posisi_pengguna): ${posisiPengguna} records`);

  console.log("\n" + "=".repeat(80));
  console.log("\n⚠️  TOTAL RECORDS YANG AKAN DIHAPUS:");
  const totalToDelete = timesheets + tranProjects + masterProjects + payments + 
                       jobApplications + projectDept + projectStatusHistory + 
                       paymentStatusHistory + timesheetStatusHistory;
  console.log(`   ${totalToDelete} records`);

  console.log("\n✅ TOTAL RECORDS YANG DIPERTAHANKAN:");
  const totalToKeep = masterUsers + pengguna + faculty + department + 
                     kategoriMagang + kategoriKegiatan + posisi + 
                     satuanInsentif + insentif + statusTimesheet + 
                     statusPembayaran + statusProject + statusMasterProject + 
                     statusStudentTimesheet + posisiPengguna;
  console.log(`   ${totalToKeep} records`);

  console.log("\n" + "=".repeat(80));
  console.log("\n💡 Untuk menjalankan cleanup, gunakan: node prisma/cleanup-projects.js\n");
}

validateCleanup()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Error during validation:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
