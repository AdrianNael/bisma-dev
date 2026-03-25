import { PrismaClient } from "@prisma/client";
import { users, user_positions, timesheets, timesheets_status, payments, payments_status, incentives, incentives_unit, positions, master_users, master_projects, projects, activities, categories, tmst_status_project, project_history, timesheet_history, payment_history, tmst_department, student_timesheet_status, tmst_status_master_project } from "./datas.js";
const prisma = new PrismaClient();

async function main() {
  for (let data of master_users) {
    await prisma.user.create({
      data: data,
    });
  }

  for (let data of categories) {
    await prisma.tmst_kategori_magang.create({
      data: data,
    });
  }
  
  for (let data of tmst_department) {
    await prisma.tmst_department.create({
      data: data,
    });
  }

  for (let data of users) {
    await prisma.tmst_pengguna.create({
      data: data,
    });
  }


  for (let data of incentives_unit) {
    await prisma.tmst_satuan_insentif.create({
      data: data,
    });
  }

  for (let data of incentives) {
    await prisma.tran_insentif.create({
      data: data,
    });
  }

  for (let data of tmst_status_project) {
    await prisma.tmst_status_project.create({
      data: data,
    });
  }

  for (let data of tmst_status_master_project) {
    await prisma.tmst_status_master_project.create({
      data: data,
    });
  }

  for (let data of master_projects) {
    await prisma.tmst_project.create({
      data: data,
    });
  }

  for (let data of positions) {
    await prisma.tmst_posisi.create({
      data: data,
    });
  }

  for (let data of user_positions) {
    await prisma.tran_posisi_pengguna.create({
      data: data,
    });
  }

  for (let data of timesheets_status) {
    await prisma.tmst_status_timesheet.create({
      data: data,
    });
  }

  for (let data of payments_status) {
    await prisma.tmst_status_pembayaran.create({
      data: data,
    });
  }



  for (let data of student_timesheet_status) {
    await prisma.tmst_status_student_timesheet.create({
      data: data,
    });
  }

  for (let data of projects) {
    await prisma.tran_project.create({
      data: data,
    });
  }

  for (let data of payments) {
    await prisma.tran_payment.create({
      data: data,
    });
  }

  for (let data of activities) {
    await prisma.tmst_kategori_kegiatan.create({
      data: data,
    });
  }

  for (let data of timesheets) {
    await prisma.tran_timesheet.create({
      data: data,
    });
  }

  for (let data of project_history) {
    await prisma.project_status_history.create({
      data: data,
    });
  }

  for (let data of timesheet_history) {
    await prisma.timesheet_status_history.create({
      data: data,
    });
  }

  for (let data of payment_history) {
    await prisma.payment_status_history.create({
      data: data,
    });
  }

  //   const alice = await prisma.user.upsert({
  //     where: { email: "alice@prisma.io" },
  //     update: {},
  //     create: {
  //       email: "alice@prisma.io",
  //       name: "Alice",
  //       posts: {
  //         create: {
  //           title: "Check out Prisma with Next.js",
  //           content: "https://www.prisma.io/nextjs",
  //           published: true,
  //         },
  //       },
  //     },
  //   });

  //   const bob = await prisma.user.upsert({
  //     where: { email: "bob@prisma.io" },
  //     update: {},
  //     create: {
  //       email: "bob@prisma.io",
  //       name: "Bob",
  //       posts: {
  //         create: [
  //           {
  //             title: "Follow Prisma on Twitter",
  //             content: "https://twitter.com/prisma",
  //             published: true,
  //           },
  //           {
  //             title: "Follow Nexus on Twitter",
  //             content: "https://twitter.com/nexusgql",
  //             published: true,
  //           },
  //         ],
  //       },
  //     },
  //   });
  //   console.log({ alice, bob });
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
