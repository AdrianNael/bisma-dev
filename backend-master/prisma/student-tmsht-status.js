import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const studentTimesheetStatusData = [
  { id: 1, status: "approved", deskripsi: "Timesheet sudah disetujui" },
  { id: 2, status: "revision", deskripsi: "Timesheet perlu direvisi" },
  { id: 3, status: "submitted", deskripsi: "Timesheet sudah disubmit" },
  { id: 4, status: "revised", deskripsi: "Timesheet sudah direvisi" },
  { id: 5, status: "not_submitted", deskripsi: "Timesheet belum disubmit" },
];

async function main() {
  console.log("Seeding student timesheet statuses...");

  for (const data of studentTimesheetStatusData) {
    await prisma.tmst_status_student_timesheet.upsert({
      where: { id: data.id },
      update: data,
      create: data,
    });
    console.log(`  ✓ ${data.status}`);
  }

  console.log("Student timesheet statuses seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Error seeding student timesheet statuses:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
