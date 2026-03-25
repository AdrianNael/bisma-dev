import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.tmst_project.findMany({
    where: { nama: { contains: 'Tutor' } },
    select: {
      id: true,
      nama: true,
      id_status: true,
      is_deleted: true,
      tran_project: {
        select: {
          id_peserta: true,
          tmst_pengguna: { select: { nama: true } }
        }
      }
    }
  });
  console.log('Tutor projects:', JSON.stringify(projects, null, 2));
  
  // Also check Naila's user ID and her projects
  const naila = await prisma.tmst_pengguna.findFirst({
    where: { nama: { contains: 'Naila' } },
    select: { id: true, nama: true }
  });
  console.log('\nNaila user:', naila);
  
  if (naila) {
    const nailaProjects = await prisma.tran_project.findMany({
      where: { id_peserta: naila.id },
      select: {
        id_project: true,
        tmst_project: { select: { nama: true, id_status: true } }
      }
    });
    console.log('\nNaila projects:', JSON.stringify(nailaProjects, null, 2));
  }
  
  // Check job applications for TEST TUTOR SEBAYA (id=8)
  const tutorApps = await prisma.job_application.findMany({
    where: { master_project_id: 8 },
    select: {
      mahasiswa_id: true,
      status: true,
      mahasiswa: { select: { nama: true } }
    }
  });
  console.log('\nTutor Sebaya applications:', JSON.stringify(tutorApps, null, 2));
  
  await prisma.$disconnect();
}

main();
