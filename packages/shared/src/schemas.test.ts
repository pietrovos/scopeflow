import { describe, expect, it } from 'vitest';
import { createMilestoneSchema, updateMilestoneSchema, updateProjectSchema } from './schemas.js';

describe('update schemas', () => {
  it('leave omitted fields undefined instead of applying create defaults', () => {
    expect(updateMilestoneSchema.parse({ status: 'DONE', version: 3 })).toEqual({ status: 'DONE', version: 3 });
    expect(updateProjectSchema.parse({ status: 'ON_HOLD' })).toEqual({ status: 'ON_HOLD' });
  });

  it('create schemas still fill defaults', () => {
    expect(createMilestoneSchema.parse({ title: 'x' })).toEqual({
      title: 'x',
      description: '',
      dueDate: null,
      amountCents: 0,
    });
  });
});
