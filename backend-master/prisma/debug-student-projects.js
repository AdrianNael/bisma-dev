
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    try {
        // 1. Get a student (mahasiswa) user
        const student = await prisma.tmst_pengguna.findFirst({
            where: { nama: "FEBRIANA RESKA SEJANI" },
        });

        if (!student) {
            console.log("No student found.");
            return;
        }

        console.log(`Checking projects for student: ${student.nama} (${student.id})`);

        // 2. Check tran_project entries for this student
        const tranProjects = await prisma.tran_project.findMany({
            where: { id_peserta: student.id },
            include: {
                tmst_project: true,
                tmst_status_project: true
            }
        });

        console.log(`\nFound ${tranProjects.length} projects in tran_project:`);
        tranProjects.forEach(tp => {
            console.log(`- Project ID: ${tp.id_project}`);
            console.log(`  Name: ${tp.tmst_project.nama}`);
            console.log(`  Project Status: ${tp.tmst_project.status}`);
            console.log(`  Student Status in Project: ${tp.tmst_status_project?.status}`);
        });

        // 3. Check what the service query would allow
        const serviceResults = await prisma.tmst_project.findMany({
            where: {
                status: { in: ["Approved", "Completed"] },
                tran_project: { some: { id_peserta: student.id } },
                is_deleted: false,
            },
            select: { id: true, nama: true, status: true }
        });

        console.log(`\nService logic would return ${serviceResults.length} projects:`);
        serviceResults.forEach(p => {
            console.log(`- [${p.status}] ${p.nama}`);
        });

        // 4. Check job applications
        const applications = await prisma.job_application.findMany({
            where: { mahasiswa_id: student.id },
            include: { project: true }
        });

        console.log(`\nFound ${applications.length} applications:`);
        applications.forEach(app => {
            console.log(`- Project: ${app.project.nama}, App Status: ${app.status}, Project Status: ${app.project.status}`);
        });

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
