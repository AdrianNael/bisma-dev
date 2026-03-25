import { prismaClient } from "../application/database.js";

const getAll = async () => {
  return await prismaClient.tmst_department.findMany({
    select: {
      id: true,
      department: true,
    },
    orderBy: {
      department: 'asc',
    },
  });
};

export default { getAll };
