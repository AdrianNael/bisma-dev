import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function computeEstimasiForTranProject(tp) {
  const projectId = tp.id_project;
  const durasiValue = Number(tp.durasi || 0);

  const p = await prisma.tmst_project.findUnique({
    where: { id: projectId },
    select: {
      tmst_kategori_magang: {
        select: {
          tran_insentif: { select: { besaran_insentif: true, durasi_satuan: true, id_satuan: true } },
        },
      },
    },
  });

  const rate = Number(p?.tmst_kategori_magang?.tran_insentif?.besaran_insentif || 0);
  const durasiSatuan = Number(p?.tmst_kategori_magang?.tran_insentif?.durasi_satuan || 50);
  const idSatuan = Number(p?.tmst_kategori_magang?.tran_insentif?.id_satuan || 1);

  if (idSatuan === 2) {
    return Math.round(rate * durasiValue);
  } else {
    const sesi = (durasiValue * 60) / Math.max(1, durasiSatuan);
    return Math.round(rate * sesi);
  }
}

async function main() {
  console.log('Starting estimasi recalculation...');
  const rows = await prisma.tran_project.findMany({ select: { id: true, id_project: true, durasi: true, estimasi: true } });
  console.log(`Found ${rows.length} tran_project rows`);

  let updated = 0;
  for (const r of rows) {
    try {
      const newEstimasi = await computeEstimasiForTranProject(r);
      if (Number(r.estimasi || 0) !== Number(newEstimasi || 0)) {
        await prisma.tran_project.update({ where: { id: r.id }, data: { estimasi: newEstimasi } });
        updated++;
        console.log(`Updated id=${r.id} from ${r.estimasi} -> ${newEstimasi}`);
      }
    } catch (e) {
      console.error(`Failed to process id=${r.id}:`, e.message || e);
    }
  }

  console.log(`Done. Updated ${updated} rows.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
