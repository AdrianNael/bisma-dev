
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    try {
        // Check all unique timesheet statuses in the database
        const statusCounts = await prisma.tran_timesheet.groupBy({
            by: ['id_status'],
            _count: { id_status: true }
        });

        console.log("\n=== TIMESHEET STATUS DISTRIBUTION ===");
        statusCounts.forEach(s => {
            console.log(`  id_status ${s.id_status}: ${s._count.id_status} records`);
        });

        // Check the status master table
        const statuses = await prisma.tmst_status_timesheet.findMany();
        console.log("\n=== MASTER STATUS DEFINITIONS ===");
        statuses.forEach(s => {
            console.log(`  ID ${s.id}: "${s.status}"`);
        });

        // Check a specific project's timesheets (project ID 25 from earlier debug)
        const projectTimesheets = await prisma.tran_timesheet.findMany({
            where: {
                tran_project: { id_project: 25 }
            },
            select: {
                id: true,
                id_status: true,
                tanggal: true,
                tran_project: {
                    select: {
                        tmst_pengguna: { select: { nama: true } }
                    }
                }
            },
            take: 10
        });

        console.log("\n=== SAMPLE TIMESHEETS FOR PROJECT 25 ===");
        projectTimesheets.forEach(ts => {
            console.log(`  TS #${ts.id}: status=${ts.id_status}, student=${ts.tran_project.tmst_pengguna.nama}, date=${ts.tanggal}`);
        });

    } catch (error) {
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
