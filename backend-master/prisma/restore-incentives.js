import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

async function main() {
    console.log("Restoring incentives data...");
    for (const data of incentives) {
        await prisma.tran_insentif.upsert({
            where: { id: data.id },
            update: data,
            create: data,
        });
    }
    console.log("Incentives data restored successfully.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
