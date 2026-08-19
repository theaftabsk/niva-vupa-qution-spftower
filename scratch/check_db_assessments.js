const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const list = await prisma.assessment.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      activeFrom: true,
      activeUntil: true,
      durationMins: true,
    }
  });
  console.log('All Assessments in DB:');
  console.log(JSON.stringify(list, null, 2));
  await prisma.$disconnect();
}
check();
