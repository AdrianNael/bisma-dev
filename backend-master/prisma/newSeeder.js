import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {

  const salt = await bcrypt.genSalt();
  const hashedPassword = await bcrypt.hash("rahasia", salt);

  const masterUsers = [
    {
      username: "l.putri03",
      password: hashedPassword,
      name: "LEONITA MAHARANI PUTRI",
    },
    {
      username: "n.aflaha",
      password: hashedPassword,
      name: "NIZAR AFHAM AFLAHA",
    },
    {
      username: "f.sejani",
      password: hashedPassword,
      name: "FEBRIANA RESKA SEJANI",
    },
    {
      username: "n.caesarina",
      password: hashedPassword,
      name: "NAILA PUTRI CAESARINA",
    },
    {
      username: "meredita",
      password: hashedPassword,
      name: "Meredita Susanty",
    },
    {
      username: "arahman",
      password: hashedPassword,
      name: "Ari Rahman",
    },
    {
      username: "l.luluk",
      password: hashedPassword,
      name: "LULUK",
    },
    {
      username: "dirmawa",
      password: hashedPassword,
      name: "Direktorat Mahasiswa",
    },
  ];

  for (let data of masterUsers) {
    await prisma.user.upsert({
      where: { username: data.username },
      update: data,
      create: data,
    });
  }

  const faculties = [
    { id: 2, faculty: "Fakultas Teknologi Industri" },
    { id: 3, faculty: "Fakultas Sains dan Komputer" },
    { id: 4, faculty: "Fakultas Perencanaan Infrastruktur" },
    { id: 5, faculty: "Fakultas Kedokteran" },
    { id: 6, faculty: "Fakultas Komunikasi dan Diplomasi" },
    { id: 7, faculty: "Fakultas Teknologi Eksplorasi dan Produksi" },
    { id: 8, faculty: "Fakultas Ekonomi dan Bisnis" },
  ];

  for (let data of faculties) {
    await prisma.tmst_faculty.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  const departments = [
    { id: 1, department: "Ilmu Komputer", faculty_id: 3 },
    { id: 2, department: "Ekonomi", faculty_id: null },
    { id: 3, department: "Manajemen", faculty_id: 8 },
    { id: 4, department: "Kimia", faculty_id: null },
    { id: 5, department: "Teknik Kimia", faculty_id: null },
    { id: 6, department: "Teknik Geofisika", faculty_id: null },
    { id: 7, department: "Teknik Geologi", faculty_id: null },
    { id: 8, department: "Teknik Elektro", faculty_id: null },
    { id: 9, department: "Teknik Perminyakan", faculty_id: null },
    { id: 10, department: "Hubungan Internasional", faculty_id: null },
    { id: 11, department: "Komunikasi", faculty_id: null },
    { id: 12, department: "Teknik Mesin", faculty_id: null },
    { id: 13, department: "Teknik Logistik", faculty_id: null },
    { id: 14, department: "Teknik Sipil", faculty_id: null },
    { id: 15, department: "Teknik Lingkungan", faculty_id: null },
    { id: 16, department: "Kedokteran", faculty_id: 5 },
    { id: 17, department: "Magister Sains Keberlanjutan", faculty_id: 4 },
    { id: 18, department: "Magister Manajemen", faculty_id: 8 },
    { id: 19, department: "Sains Aktuaria", faculty_id: 3 },
  ];

  for (let data of departments) {
    await prisma.tmst_department.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  const categories = [
    { id: 1, kategori: "Tutor Sebaya" },
    { id: 2, kategori: "Asisten Praktikum" },
    { id: 3, kategori: "Asisten Pengembangan Materi Dan Video Tutorial" },
    { id: 4, kategori: "Asisten Pengembangan Aplikasi" },
    { id: 5, kategori: "Asisten Dalam Kegiatan Pengabdian Masyarakat" },
    { id: 6, kategori: "Asisten Penelitian" },
    { id: 7, kategori: "Pembuatan Design Media Visual" },
    { id: 8, kategori: "Pembuatan Design Media Audio Visual" },
    { id: 9, kategori: "Asisten Pustakawan" },
    { id: 10, kategori: "Asisten Akademik" },
    { id: 11, kategori: "Asisten Digitalisasi Dan Pengolahan Data" },
    { id: 12, kategori: "Petugas Pelaksana" },
    {
      id: 13,
      kategori:
        "Pekerjaan Administratif, Pengolahan Data Dan Pusat Infromasi, dan Pekerjaan Lain",
    },
  ];

  for (let data of categories) {
    await prisma.tmst_kategori_magang.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  const users = [
    {
      id: "104219006",
      nama: "LEONITA MAHARANI PUTRI",
      username: "l.putri03",
      departemen: "Teknik Lingkungan",
      no_telp: "085990100010",
      no_rekening: "10000001",
      status: "MAHASISWA",
    },
    {
      id: "105222039",
      nama: "NIZAR AFHAM AFLAHA",
      username: "n.aflaha",
      departemen: "ILmu KOmputer",
      no_telp: "085990100011",
      no_rekening: "10000002",
      status: "MAHASISWA",
    },
    {
      id: "104219025",
      nama: "FEBRIANA RESKA SEJANI",
      username: "f.sejani",
      departemen: "Teknik Lingkungan",
      no_telp: "085990100011",
      no_rekening: "10000002",
      status: "MAHASISWA",
    },
    {
      id: "1042200004",
      nama: "NAILA PUTRI CAESARINA",
      username: "n.caesarina",
      departemen: "Teknik Lingkungan",
      no_telp: "085990100012",
      no_rekening: "10000003",
      status: "MAHASISWA",
    },
    {
      id: "116043",
      nama: "Ari Rahman",
      username: "arahman",
      departemen: null,
      no_telp: "085990100013",
      no_rekening: "10000004",
      status: "STAF",
    },
    {
      id: "116042",
      nama: "Meredita Susanty",
      username: "meredita",
      departemen: null,
      no_telp: "085990100014",
      no_rekening: "10000005",
      status: "STAF",
    },
    {
      id: "112341",
      nama: "LULUK",
      username: "l.luluk",
      departemen: null,
      no_telp: "085990100015",
      no_rekening: "10000006",
      status: "MANAGER",
    },
    {
      id: "116040",
      nama: "Direktorat Mahasiswa",
      username: "dirmawa",
      departemen: null,
      no_telp: "081234567890",
      no_rekening: null,
      status: "DIRMAWA",
    },
  ];

  for (let data of users) {
    await prisma.tmst_pengguna.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  const incentiveUnits = [
    { id: 1, satuan: "menit" },
    { id: 2, satuan: "Karya/Hasil Pekerjaan" },
  ];

  for (let data of incentiveUnits) {
    await prisma.tmst_satuan_insentif.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  const incentives = [
    {
      id: 1,
      id_kategori: 1,
      id_satuan: 1,
      besaran_insentif: 30000,
      durasi_satuan: 50,
    },
    {
      id: 2,
      id_kategori: 2,
      id_satuan: 1,
      besaran_insentif: 30000,
      durasi_satuan: 50,
    },
    {
      id: 3,
      id_kategori: 3,
      id_satuan: 1,
      besaran_insentif: 30000,
      durasi_satuan: 50,
    },
    {
      id: 4,
      id_kategori: 4,
      id_satuan: 1,
      besaran_insentif: 30000,
      durasi_satuan: 50,
    },
    {
      id: 5,
      id_kategori: 5,
      id_satuan: 1,
      besaran_insentif: 30000,
      durasi_satuan: 50,
    },
    {
      id: 6,
      id_kategori: 6,
      id_satuan: 1,
      besaran_insentif: 30000,
      durasi_satuan: 50,
    },
    {
      id: 7,
      id_kategori: 7,
      id_satuan: 2, // Karya
      besaran_insentif: 60000,
      durasi_satuan: 1,
    },
    {
      id: 8,
      id_kategori: 8,
      id_satuan: 1, // Menit (based on image: Rp 30.000 / 60 menit)
      besaran_insentif: 30000,
      durasi_satuan: 60,
    },
    {
      id: 9,
      id_kategori: 9,
      id_satuan: 1,
      besaran_insentif: 25000,
      durasi_satuan: 60,
    },
    {
      id: 10,
      id_kategori: 10,
      id_satuan: 1,
      besaran_insentif: 25000,
      durasi_satuan: 60,
    },
    {
      id: 11,
      id_kategori: 11,
      id_satuan: 1,
      besaran_insentif: 25000,
      durasi_satuan: 60,
    },
    {
      id: 12,
      id_kategori: 12,
      id_satuan: 1,
      besaran_insentif: 25000,
      durasi_satuan: 60,
    },
    {
      id: 13,
      id_kategori: 13,
      id_satuan: 1,
      besaran_insentif: 25000,
      durasi_satuan: 60,
    },
  ];

  for (let data of incentives) {
    await prisma.tran_insentif.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  const positions = [
    { id: 1, posisi: "Ketua Program Studi" },
    { id: 2, posisi: "Dosen" },
    { id: 3, posisi: "Kepala Keuangan" },
    { id: 4, posisi: "Mahasiswa" },
  ];

  for (let data of positions) {
    await prisma.tmst_posisi.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  const userPositions = [
    { id: 1, id_pengguna: "104219006", id_posisi: 4 },
    { id: 2, id_pengguna: "116043", id_posisi: 2 },
    { id: 3, id_pengguna: "104219025", id_posisi: 4 },
    { id: 4, id_pengguna: "1042200004", id_posisi: 4 },
    { id: 5, id_pengguna: "116042", id_posisi: 2 },
    { id: 6, id_pengguna: "112341", id_posisi: 3 },
  ];

  for (let data of userPositions) {
    await prisma.tran_posisi_pengguna.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  const activities = [
    { id: 1, kegiatan: "Pelaksanaan" },
    { id: 2, kegiatan: "Persiapan" },
    { id: 3, kegiatan: "Penutupan" },
  ];

  for (let data of activities) {
    await prisma.tmst_kategori_kegiatan.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  // Status Timesheet (tmst_status_timesheet)
  // Digunakan untuk status individual timesheet entry
  const timesheetStatuses = [
    { id: 1, status: "Approved", deskripsi: "Timesheet telah disetujui" },
    { id: 2, status: "Rejected", deskripsi: "Timesheet ditolak" },
    { id: 3, status: "Revision Required", deskripsi: "Perlu revisi" },
    { id: 4, status: "Submitted", deskripsi: "Menunggu persetujuan" },
    { id: 5, status: "Revised", deskripsi: "Sedang diproses" },
    { id: 6, status: "Completed", deskripsi: "Timesheet sudah approve oleh kemahasiswaan" },
  ];

  for (let data of timesheetStatuses) {
    await prisma.tmst_status_timesheet.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  // Status Pembayaran (tmst_status_pembayaran)
  // Digunakan untuk status tran_payment
  const paymentStatuses = [
    { id: 1, status: "Waiting Approval", deskripsi: "Pembayaran diajukan" },
    { id: 2, status: "Complete", deskripsi: "Timesheet selesai" },
    { id: 3, status: "Approved", deskripsi: "Pembayaran disetujui" },
    { id: 4, status: "On Revision", deskripsi: "Sedang dalam revisi" },
    { id: 5, status: "Revised", deskripsi: "Sudah direvisi" },
  ];

  for (let data of paymentStatuses) {
    await prisma.tmst_status_pembayaran.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  // Status Project Peserta (tmst_status_project)
  // CATATAN: Tabel ini untuk tracking status kepesertaan mahasiswa dalam project
  // Berbeda dengan tmst_status_master_project (status project secara keseluruhan)
  // Kolom id_status di tran_project selalu 1 (Draft) karena saat ini belum digunakan
  // untuk tracking lifecycle peserta. Ini adalah "legacy" dan bisa diaktifkan jika 
  // diperlukan untuk tracking status peserta individual (submitted -> paid dsb)
  const projectStatuses = [
    { id: 1, status: "Draft", deskripsi: "Status awal peserta" },
    { id: 2, status: "Submitted", deskripsi: "Peserta telah submit" },
    { id: 3, status: "Need Revision", deskripsi: "Membutuhkan Revisi" },
    { id: 4, status: "Completed", deskripsi: "Project Selesai" },
  ];

  for (let data of projectStatuses) {
    await prisma.tmst_status_project.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  // Student Timesheet Status
  const studentTimesheetStatuses = [
    { id: 1, status: "Approved", deskripsi: "Timesheet sudah disetujui" },
    { id: 2, status: "On Revision", deskripsi: "Timesheet perlu direvisi" },
    { id: 3, status: "Submitted", deskripsi: "Menunggu persetujuan" },
    { id: 4, status: "Revised", deskripsi: "Sudah direvisi" },
    { id: 5, status: "Not Submitted", deskripsi: "Belum submit" },
  ];

  for (let data of studentTimesheetStatuses) {
    await prisma.tmst_status_student_timesheet.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }

  // Master Project Statuses (tmst_status_master_project)
  // Digunakan untuk status tmst_project (project secara keseluruhan)
  const masterProjectStatuses = [
    { id: 1, status: "Draft", deskripsi: "Proyek masih dalam tahap persiapan" },
    { id: 2, status: "Open", deskripsi: "Proyek terbuka untuk pendaftaran" },
    { id: 3, status: "Waiting Timesheet Approval", deskripsi: "Dalam proses seleksi peserta" },
    { id: 4, status: "Waiting Project Approval", deskripsi: "Diajukan untuk persetujuan project ke kemahasiswaan" },
    { id: 5, status: "Project Approved", deskripsi: "Proyek telah disetujui oleh Direktorat Kemahasiswaan" },
    { id: 6, status: "Completed", deskripsi: "Proyek selesai" },
    { id: 7, status: "Need Revision", deskripsi: "Timesheet Membutuhkan perbaikan" },
  ];

  for (let data of masterProjectStatuses) {
    await prisma.tmst_status_master_project.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
  }


  // for (let data of masterProjects) {
  //   await prisma.tmst_project.upsert({
  //     where: { id: data.id },
  //     update: data,
  //     create: data,
  //   });
  // }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Error during seeding:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
