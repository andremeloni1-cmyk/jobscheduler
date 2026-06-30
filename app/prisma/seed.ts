import { PrismaClient } from "@prisma/client";
import { DEFAULT_TEMPLATES } from "../src/lib/default-templates";

const prisma = new PrismaClient();

async function main() {
  const ownerEmail = process.env.OWNER_EMAIL || "owner@example.com";

  await prisma.account.upsert({
    where: { email: ownerEmail },
    update: {},
    create: { email: ownerEmail, name: "Workshop Owner" },
  });

  for (const t of DEFAULT_TEMPLATES) {
    await prisma.emailTemplate.upsert({
      where: { key: t.key },
      update: {}, // don't clobber edits on re-seed
      create: t,
    });
  }

  // Demo data — only if the database is empty, so it's safe to run anywhere.
  const jobCount = await prisma.job.count();
  if (jobCount === 0) {
    const now = new Date();
    const at = (dayOffset: number, hour: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() + dayOffset);
      d.setHours(hour, 0, 0, 0);
      return d;
    };

    const demo = [
      {
        reference: "JOB-1001",
        title: "Oak staircase installation",
        status: "scheduled",
        priority: "high",
        clientName: "Sarah Whitfield",
        clientEmail: "sarah@example.com",
        clientPhone: "07700 900123",
        address: "14 Millbrook Lane, Bristol",
        quoteAmount: 4800,
        description: "Supply and fit a bespoke oak staircase with glass balustrade.",
        scheduledStart: at(1, 8),
        scheduledEnd: at(1, 13),
        durationMins: 300,
      },
      {
        reference: "JOB-1002",
        title: "Kitchen worktop replacement",
        status: "accepted",
        priority: "normal",
        clientName: "Tom Rees",
        clientEmail: "tom@example.com",
        address: "3 Harbour View, Bath",
        quoteAmount: 1250,
        description: "Remove laminate worktops, fit solid walnut.",
        scheduledStart: at(2, 9),
        scheduledEnd: at(2, 12),
        durationMins: 180,
      },
      {
        reference: "JOB-1003",
        title: "Fitted wardrobes — master bedroom",
        status: "quoted",
        priority: "normal",
        clientName: "Priya Patel",
        clientEmail: "priya@example.com",
        address: "27 Elmgrove Road, Bristol",
        quoteAmount: 3200,
        description: "Floor-to-ceiling fitted wardrobes, soft-close doors.",
      },
      {
        reference: "JOB-1004",
        title: "Garden decking repair",
        status: "lead",
        priority: "low",
        clientName: "James Holloway",
        clientPhone: "07700 900456",
        address: "Riverside Cottage, Saltford",
        description: "Replace rotten boards and re-level a section of decking.",
      },
      {
        reference: "JOB-1005",
        title: "Internal door hanging x6",
        status: "completed",
        priority: "normal",
        clientName: "Megan Doyle",
        clientEmail: "megan@example.com",
        address: "8 Cotham Hill, Bristol",
        quoteAmount: 540,
        description: "Hang six oak internal doors with new ironmongery.",
        scheduledStart: at(-3, 8),
        scheduledEnd: at(-3, 14),
        durationMins: 360,
      },
    ];

    for (const j of demo) {
      await prisma.job.create({ data: j });
    }
    // eslint-disable-next-line no-console
    console.log(`Seeded ${demo.length} demo jobs.`);
  }

  // eslint-disable-next-line no-console
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
