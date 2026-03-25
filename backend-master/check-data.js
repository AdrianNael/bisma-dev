import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const userId = "1042200004";
  
  // Cek data tran_project untuk NAILA
  console.log("=== TRAN_PROJECT untuk NAILA ===");
  const tranProjects = await prisma.tran_project.findMany({
    where: { id_peserta: userId },
    select: {
      id: true,
      id_project: true,
      id_peserta: true,
      tmst_project: {
        select: {
          id: true,
          nama: true,
          id_status: true
        }
      }
    },
    orderBy: { id: 'asc' }
  });
  
  console.log("\n=== RINGKASAN TRAN_PROJECT ===");
  tranProjects.forEach(tp => {
    console.log(`tran_project.id: ${tp.id} | tmst_project.id: ${tp.id_project} | nama: ${tp.tmst_project.nama} | status: ${tp.tmst_project.id_status}`);
  });

  // Cek timesheet yang ada
  console.log("\n=== TIMESHEET per Project ===");
  const timesheets = await prisma.tran_timesheet.findMany({
    where: {
      tran_project: { id_peserta: userId }
    },
    select: {
      id: true,
      tanggal: true,
      id_tran_project: true,
      id_status: true,
      tran_project: {
        select: {
          id: true,
          id_project: true,
          tmst_project: { select: { nama: true } }
        }
      }
    },
    orderBy: { tanggal: 'asc' }
  });

  // Group by project
  const grouped = {};
  timesheets.forEach(ts => {
    const key = ts.tran_project.id;
    if (!grouped[key]) {
      grouped[key] = {
        tran_project_id: ts.tran_project.id,
        tmst_project_id: ts.tran_project.id_project,
        nama: ts.tran_project.tmst_project.nama,
        timesheets: []
      };
    }
    grouped[key].timesheets.push({
      tanggal: ts.tanggal.toISOString().slice(0, 10),
      status: ts.id_status
    });
  });

  Object.values(grouped).forEach(g => {
    console.log(`\ntran_project.id: ${g.tran_project_id} | tmst_project.id: ${g.tmst_project_id} | nama: ${g.nama}`);
    console.log(`  Timesheets: ${g.timesheets.length} entries`);
    console.log(`  Tanggal: ${g.timesheets.map(t => t.tanggal).join(', ')}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
