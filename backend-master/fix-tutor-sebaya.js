import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fixTutorSebayaData() {
  // Find all accepted applications for project 8 (TEST TUTOR SEBAYA)
  const acceptedApps = await prisma.job_application.findMany({
    where: {
      master_project_id: 8,
      status: 'Accepted'
    },
    include: {
      project: true,
      mahasiswa: true
    }
  });

  console.log(`Found ${acceptedApps.length} accepted applications for TEST TUTOR SEBAYA`);

  for (const app of acceptedApps) {
    // Check if tran_project already exists
    const existing = await prisma.tran_project.findFirst({
      where: {
        id_project: app.master_project_id,
        id_peserta: app.mahasiswa_id
      }
    });

    if (existing) {
      console.log(`- tran_project already exists for ${app.mahasiswa.nama}`);
      continue;
    }

    // Create tran_project record
    const created = await prisma.tran_project.create({
      data: {
        id_project: app.master_project_id,
        id_peserta: app.mahasiswa_id,
        estimasi: app.project.durasi_default || 0,
        durasi: app.project.durasi_default || 0,
        id_status: 1 // Active
      }
    });

    console.log(`+ Created tran_project for ${app.mahasiswa.nama} (id: ${created.id})`);
  }

  // Verify the fix
  const project = await prisma.tmst_project.findUnique({
    where: { id: 8 },
    include: {
      tran_project: {
        include: {
          tmst_pengguna: true
        }
      }
    }
  });

  console.log(`\nVerification - TEST TUTOR SEBAYA now has ${project.tran_project.length} members:`);
  project.tran_project.forEach(tp => {
    console.log(`  - ${tp.tmst_pengguna.nama}`);
  });

  await prisma.$disconnect();
}

fixTutorSebayaData();
