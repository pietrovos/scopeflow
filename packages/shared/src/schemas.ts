import { z } from 'zod';
import { ROLES } from './roles.js';

const trimmed = (max: number) => z.string().trim().min(1).max(max);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const cents = z.number().int().min(-100_000_000).max(100_000_000);
const version = z.number().int().positive();

export const createOrganizationSchema = z.object({
  name: trimmed(80),
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const createInvitationSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  role: z.enum(ROLES).exclude(['OWNER']),
  projectIds: z.array(z.uuid()).max(50).default([]),
});
export type CreateInvitationInput = z.input<typeof createInvitationSchema>;

export const updateMembershipSchema = z.object({
  role: z.enum(ROLES).exclude(['OWNER']),
});

export const PROJECT_STATUSES = ['ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

// Update schemas are built from these default-free fields. Zod 4 applies `.default()`
// even inside `.partial()`, so deriving updates from the create schemas would reset
// omitted fields (e.g. a status-only PATCH would blank the description).
const projectFields = {
  name: trimmed(120),
  clientName: trimmed(120),
  description: z.string().trim().max(5000),
  budgetCents: z.number().int().min(0).max(1_000_000_000),
  dueDate: isoDate.nullable(),
};

export const createProjectSchema = z.object({
  ...projectFields,
  description: projectFields.description.default(''),
  budgetCents: projectFields.budgetCents.default(0),
  dueDate: projectFields.dueDate.default(null),
});
export type CreateProjectInput = z.input<typeof createProjectSchema>;

export const updateProjectSchema = z
  .object(projectFields)
  .partial()
  .extend({
    status: z.enum(PROJECT_STATUSES).optional(),
  });

export const assignProjectSchema = z.object({ userId: z.uuid() });

export const MILESTONE_STATUSES = ['PLANNED', 'IN_PROGRESS', 'DONE'] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

const milestoneFields = {
  title: trimmed(160),
  description: z.string().trim().max(5000),
  dueDate: isoDate.nullable(),
  amountCents: z.number().int().min(0).max(1_000_000_000),
};

export const createMilestoneSchema = z.object({
  ...milestoneFields,
  description: milestoneFields.description.default(''),
  dueDate: milestoneFields.dueDate.default(null),
  amountCents: milestoneFields.amountCents.default(0),
});
export type CreateMilestoneInput = z.input<typeof createMilestoneSchema>;

/** Every write to a versioned resource must say which version it was based on. */
export const updateMilestoneSchema = z
  .object(milestoneFields)
  .partial()
  .extend({ status: z.enum(MILESTONE_STATUSES).optional(), version });
export type UpdateMilestoneInput = z.input<typeof updateMilestoneSchema>;

export const scopeChangeContentSchema = z.object({
  title: trimmed(160),
  description: trimmed(10_000),
  priceDeltaCents: cents,
  deadlineDeltaDays: z.number().int().min(-365).max(365),
});
export type ScopeChangeContent = z.infer<typeof scopeChangeContentSchema>;

export const createScopeChangeSchema = scopeChangeContentSchema;

/** Editing a proposal creates a new revision; `version` guards against stale edits. */
export const reviseScopeChangeSchema = scopeChangeContentSchema.extend({ version });
export type ReviseScopeChangeInput = z.infer<typeof reviseScopeChangeSchema>;

/** Clients decide on one specific revision, never on "whatever is current". */
export const decideScopeChangeSchema = z.object({
  revisionId: z.uuid(),
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().trim().max(2000).default(''),
});
export type DecideScopeChangeInput = z.input<typeof decideScopeChangeSchema>;

export const withdrawScopeChangeSchema = z.object({ version });

export const createCommentSchema = z.object({
  body: trimmed(5000),
  scopeChangeId: z.uuid().nullable().default(null),
});
export type CreateCommentInput = z.input<typeof createCommentSchema>;

export const activityQuerySchema = z.object({
  after: z.coerce.bigint().min(0n).optional(),
  before: z.coerce.bigint().min(0n).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
