import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const owner = await prisma.user.create({
    data: { name: "Leader" }
  });

  const project = await prisma.project.create({
    data: {
      title: "Fusion Space Demo",
      inviteCode: "FUSION-100",
      deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
      contextSummary: "Build a clear collaborative report with assigned workload points."
    }
  });

  await prisma.projectMember.create({
    data: {
      projectId: project.id,
      userId: owner.id,
      role: "OWNER"
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
