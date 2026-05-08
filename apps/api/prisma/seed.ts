/**
 * Demo data: two agencies, their teams and clients, projects at different stages, and
 * scope changes with revision histories. Resets every table first.
 *
 * Users are matched to Keycloak accounts by verified email on first sign-in, so the
 * emails here must match infra/keycloak/scopeflow-realm.json.
 *
 *   pnpm db:seed
 */
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '../src/generated/prisma/client.js';

try {
  process.loadEnvFile(resolve(import.meta.dirname, '../../../.env'));
} catch {
  // Environment provided directly.
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_OWNER_URL! }) });

const DAY = 86_400_000;
const now = Date.now();
const daysAgo = (n: number) => new Date(now - n * DAY);
const dateOnly = (offsetDays: number) => new Date(new Date(now + offsetDays * DAY).toISOString().slice(0, 10));

let clock = now - 60 * DAY;
/** Monotonic timestamps so activity reads in a believable order. */
const tick = (hours = 3) => new Date((clock += hours * 3_600_000));

async function main() {
  await db.$executeRawUnsafe(`TRUNCATE users, organizations, processed_stripe_events RESTART IDENTITY CASCADE`);

  const user = (email: string, name: string) => db.user.create({ data: { email, name } });
  const olivia = await user('olivia@northwind.test', 'Olivia Hart');
  const priya = await user('priya@northwind.test', 'Priya Raman');
  const marcus = await user('marcus@northwind.test', 'Marcus Lee');
  const dana = await user('dana@acmehealth.test', 'Dana Whitfield');
  const leo = await user('leo@brightpath.test', 'Leo Okafor');
  const sam = await user('sam@harborpine.test', 'Sam Castillo');

  // --- Northwind Studio -------------------------------------------------------
  const northwind = await db.organization.create({
    data: {
      id: randomUUID(),
      name: 'Northwind Studio',
      slug: 'northwind-studio',
      plan: 'PRO',
      subscriptionStatus: 'active',
      currentPeriodEnd: dateOnly(21),
    },
  });
  const org = northwind.id;
  const events: Prisma.ActivityEventCreateManyInput[] = [];
  const log = (e: Omit<Prisma.ActivityEventCreateManyInput, 'orgId' | 'createdAt'>, at = tick()) =>
    events.push({ ...e, orgId: org, createdAt: at });

  log({
    actorId: olivia.id,
    type: 'org.created',
    entityType: 'organization',
    entityId: org,
    data: { name: northwind.name },
  });
  for (const [u, role] of [
    [priya, 'ADMIN'],
    [marcus, 'MEMBER'],
    [dana, 'CLIENT'],
    [leo, 'CLIENT'],
  ] as const) {
    log({
      actorId: u.id,
      type: 'member.joined',
      entityType: 'membership',
      entityId: u.id,
      data: { userName: u.name, role },
    });
  }
  await db.membership.createMany({
    data: [
      { orgId: org, userId: olivia.id, role: 'OWNER', createdAt: daysAgo(60) },
      { orgId: org, userId: priya.id, role: 'ADMIN', createdAt: daysAgo(59) },
      { orgId: org, userId: marcus.id, role: 'MEMBER', createdAt: daysAgo(58) },
      { orgId: org, userId: dana.id, role: 'CLIENT', createdAt: daysAgo(50) },
      { orgId: org, userId: leo.id, role: 'CLIENT', createdAt: daysAgo(40) },
    ],
  });

  const portal = await db.project.create({
    data: {
      orgId: org,
      name: 'Patient portal redesign',
      clientName: 'Acme Health',
      description:
        'Rebuild the patient-facing portal: appointment booking, test results and secure messaging, ' +
        'with WCAG 2.2 AA compliance and a mobile-first layout.',
      budgetCents: 4_800_000,
      dueDate: dateOnly(45),
      createdAt: daysAgo(55),
    },
  });
  const onboarding = await db.project.create({
    data: {
      orgId: org,
      name: 'Member onboarding app',
      clientName: 'BrightPath Fitness',
      description: 'iOS and Android onboarding flow with plan selection and payment.',
      budgetCents: 3_200_000,
      dueDate: dateOnly(70),
      createdAt: daysAgo(35),
    },
  });
  const brand = await db.project.create({
    data: {
      orgId: org,
      name: 'Brand refresh',
      clientName: 'Acme Health',
      description: 'New visual identity and marketing site.',
      budgetCents: 1_800_000,
      dueDate: dateOnly(-10),
      status: 'COMPLETED',
      createdAt: daysAgo(58),
    },
  });
  await db.project.create({
    data: {
      orgId: org,
      name: 'Internal design system',
      clientName: 'Northwind (internal)',
      description: 'Shared component library across client projects. Not visible to clients.',
      createdAt: daysAgo(30),
    },
  });
  for (const p of [portal, onboarding, brand]) {
    log({
      actorId: olivia.id,
      projectId: p.id,
      type: 'project.created',
      entityType: 'project',
      entityId: p.id,
      data: { name: p.name },
    });
  }

  await db.projectAssignment.createMany({
    data: [
      { orgId: org, projectId: portal.id, userId: dana.id },
      { orgId: org, projectId: brand.id, userId: dana.id },
      { orgId: org, projectId: onboarding.id, userId: leo.id },
    ],
  });

  const milestones = async (
    projectId: string,
    rows: Array<[string, 'PLANNED' | 'IN_PROGRESS' | 'DONE', number, number, string?]>,
  ) => {
    for (const [i, [title, status, due, amount, description]] of rows.entries()) {
      const m = await db.milestone.create({
        data: {
          orgId: org,
          projectId,
          title,
          status,
          dueDate: dateOnly(due),
          amountCents: amount,
          position: i,
          description: description ?? '',
        },
      });
      log({
        actorId: marcus.id,
        projectId,
        type: 'milestone.created',
        entityType: 'milestone',
        entityId: m.id,
        data: { title },
      });
      if (status !== 'PLANNED') {
        log({
          actorId: marcus.id,
          projectId,
          type: 'milestone.updated',
          entityType: 'milestone',
          entityId: m.id,
          data: { title, status, fields: ['status'] },
        });
      }
    }
  };
  await milestones(portal.id, [
    ['Discovery & UX audit', 'DONE', -30, 800_000, 'Stakeholder interviews, analytics review and accessibility audit.'],
    ['Design system & wireframes', 'DONE', -12, 1_000_000],
    ['Appointment booking', 'IN_PROGRESS', 10, 1_200_000, 'Search by provider and location, booking and cancellation.'],
    ['Test results & messaging', 'PLANNED', 28, 1_200_000],
    ['Launch & handover', 'PLANNED', 45, 600_000],
  ]);
  await milestones(onboarding.id, [
    ['Flows & prototypes', 'DONE', -8, 900_000],
    ['Plan selection & payments', 'IN_PROGRESS', 20, 1_400_000],
    ['Store submission', 'PLANNED', 70, 900_000],
  ]);
  await milestones(brand.id, [
    ['Identity', 'DONE', -40, 900_000],
    ['Marketing site', 'DONE', -10, 900_000],
  ]);

  // Scope changes ---------------------------------------------------------------
  type Rev = { title: string; description: string; price: number; days: number; by: typeof olivia };
  const scopeChange = async (
    projectId: string,
    number: number,
    revisions: Rev[],
    outcome?: { decision: 'APPROVED' | 'REJECTED'; by: typeof dana; note?: string; onRevision?: number },
  ) => {
    const sc = await db.scopeChange.create({
      data: { orgId: org, projectId, number, createdById: revisions[0]!.by.id, createdAt: tick(0) },
    });
    const created = [];
    for (const [i, r] of revisions.entries()) {
      const rev = await db.scopeChangeRevision.create({
        data: {
          orgId: org,
          scopeChangeId: sc.id,
          revisionNumber: i + 1,
          title: r.title,
          description: r.description,
          priceDeltaCents: r.price,
          deadlineDeltaDays: r.days,
          createdById: r.by.id,
          // Revision 1 is the proposal itself; later revisions come hours or days after.
          createdAt: i === 0 ? sc.createdAt : tick(20),
        },
      });
      created.push(rev);
      log(
        {
          actorId: r.by.id,
          projectId,
          type: i === 0 ? 'scope_change.created' : 'scope_change.revised',
          entityType: 'scope_change',
          entityId: sc.id,
          data: { number, title: r.title, priceDeltaCents: r.price, revisionNumber: i + 1, revisionId: rev.id },
        },
        rev.createdAt,
      );
    }
    const current = created.at(-1)!;
    let status: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING';
    if (outcome) {
      const target = created[(outcome.onRevision ?? created.length) - 1]!;
      status = outcome.decision;
      await db.scopeChangeDecision.create({
        data: {
          orgId: org,
          scopeChangeId: sc.id,
          revisionId: target.id,
          decision: outcome.decision,
          note: outcome.note ?? '',
          decidedById: outcome.by.id,
          createdAt: tick(26),
        },
      });
      log({
        actorId: outcome.by.id,
        projectId,
        type: outcome.decision === 'APPROVED' ? 'scope_change.approved' : 'scope_change.rejected',
        entityType: 'scope_change',
        entityId: sc.id,
        data: {
          number,
          title: target.title,
          revisionNumber: target.revisionNumber,
          revisionId: target.id,
          priceDeltaCents: target.priceDeltaCents,
          deadlineDeltaDays: target.deadlineDeltaDays,
          note: outcome.note,
        },
      });
    }
    await db.scopeChange.update({
      where: { id: sc.id },
      data: {
        currentRevisionId: current.id,
        approvedRevisionId: status === 'APPROVED' ? current.id : null,
        status,
        version: revisions.length + (outcome ? 1 : 0),
        updatedAt: tick(1),
      },
    });
    return sc;
  };

  await scopeChange(
    portal.id,
    1,
    [
      {
        title: 'Spanish language support',
        description: 'Translate the portal UI and transactional emails into Spanish.',
        price: 650_000,
        days: 8,
        by: olivia,
      },
      {
        title: 'Spanish language support',
        description: 'Translate the portal UI into Spanish. Transactional emails stay English-only for launch.',
        price: 420_000,
        days: 5,
        by: olivia,
      },
    ],
    { decision: 'APPROVED', by: dana, note: 'Thanks for trimming the emails, that works for launch.' },
  );
  await scopeChange(
    portal.id,
    2,
    [
      {
        title: 'Video visits',
        description: 'Embed telehealth video visits in the portal using the clinic’s existing provider.',
        price: 1_800_000,
        days: 25,
        by: priya,
      },
    ],
    { decision: 'REJECTED', by: dana, note: 'Out of budget this year. Let’s revisit in Q2.' },
  );
  const reminders = await scopeChange(portal.id, 3, [
    {
      title: 'Appointment reminders',
      description: 'Send SMS and email reminders 24 hours before each appointment, with a one-tap reschedule link.',
      price: 450_000,
      days: 10,
      by: marcus,
    },
    {
      title: 'Appointment reminders',
      description:
        'Send SMS reminders 24 hours before each appointment, with a one-tap reschedule link. Email reminders reuse the existing template.',
      price: 380_000,
      days: 7,
      by: marcus,
    },
  ]);
  await scopeChange(onboarding.id, 1, [
    {
      title: 'Apple Health sync',
      description: 'Import workouts from Apple Health during onboarding to pre-fill the fitness profile.',
      price: 520_000,
      days: 12,
      by: priya,
    },
  ]);

  // Comments ---------------------------------------------------------------------
  const comment = async (projectId: string, author: typeof olivia, body: string, scopeChangeId?: string) => {
    const c = await db.comment.create({
      data: {
        orgId: org,
        projectId,
        authorId: author.id,
        body,
        scopeChangeId: scopeChangeId ?? null,
        createdAt: tick(2),
      },
    });
    log(
      {
        actorId: author.id,
        projectId,
        type: 'comment.created',
        entityType: 'comment',
        entityId: c.id,
        data: {
          comment: {
            id: c.id,
            body,
            projectId,
            scopeChangeId: c.scopeChangeId,
            createdAt: c.createdAt.toISOString(),
            author: { id: author.id, name: author.name },
          },
          scopeChangeId: c.scopeChangeId,
        },
      },
      c.createdAt,
    );
  };
  await comment(
    portal.id,
    dana,
    'Our compliance team reviewed the wireframes. Looks good, one note on the consent screen copy.',
  );
  await comment(portal.id, olivia, 'Great, Marcus will pick up the consent copy this week.');
  await comment(
    portal.id,
    marcus,
    'Revision 2 drops email reminders since you already send those from the EHR. Saves a week.',
    reminders.id,
  );
  await comment(onboarding.id, leo, 'Can we see the payment step on Android before Friday’s review?');

  // A pending invitation, so the team page shows one. Its link is never printed, so it can't be used.
  await db.invitation.create({
    data: {
      orgId: org,
      email: 'jules@northwind.test',
      role: 'MEMBER',
      tokenHash: createHash('sha256').update(randomUUID()).digest('hex'),
      invitedById: priya.id,
      expiresAt: dateOnly(6),
    },
  });
  log({
    actorId: priya.id,
    type: 'member.invited',
    entityType: 'invitation',
    entityId: org,
    data: { email: 'jules@northwind.test', role: 'MEMBER' },
  });

  // --- Harbor & Pine: a second agency to show tenant isolation ------------------
  const harbor = await db.organization.create({
    data: { id: randomUUID(), name: 'Harbor & Pine', slug: 'harbor-and-pine' },
  });
  await db.membership.create({ data: { orgId: harbor.id, userId: sam.id, role: 'OWNER' } });
  const hp = await db.project.create({
    data: {
      orgId: harbor.id,
      name: 'Wine club storefront',
      clientName: 'Coastal Cellars',
      budgetCents: 2_200_000,
      dueDate: dateOnly(60),
    },
  });
  await db.milestone.create({
    data: {
      orgId: harbor.id,
      projectId: hp.id,
      title: 'Catalog & checkout',
      status: 'IN_PROGRESS',
      dueDate: dateOnly(25),
    },
  });
  events.push({
    orgId: harbor.id,
    actorId: sam.id,
    type: 'org.created',
    entityType: 'organization',
    entityId: harbor.id,
    data: { name: harbor.name },
    createdAt: daysAgo(20),
  });

  events.sort((a, b) => +new Date(a.createdAt!) - +new Date(b.createdAt!));
  await db.activityEvent.createMany({ data: events });

  console.log('Seeded: Northwind Studio (4 projects, 4 scope changes) and Harbor & Pine.');
  console.log('Sign in with any account from the README; password: scopeflow-demo');
}

await main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
