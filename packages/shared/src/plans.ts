export const PLANS = ['FREE', 'PRO', 'AGENCY'] as const;
export type Plan = (typeof PLANS)[number];

export interface PlanInfo {
  id: Plan;
  name: string;
  priceMonthly: number;
  maxActiveProjects: number | null;
  maxSeats: number | null;
  features: string[];
}

export const PLAN_INFO: Record<Plan, PlanInfo> = {
  FREE: {
    id: 'FREE',
    name: 'Starter',
    priceMonthly: 0,
    maxActiveProjects: 3,
    maxSeats: 3,
    features: ['3 active projects', '3 team seats', 'Unlimited clients'],
  },
  PRO: {
    id: 'PRO',
    name: 'Studio',
    priceMonthly: 49,
    maxActiveProjects: 25,
    maxSeats: 10,
    features: ['25 active projects', '10 team seats', 'Unlimited clients'],
  },
  AGENCY: {
    id: 'AGENCY',
    name: 'Agency',
    priceMonthly: 149,
    maxActiveProjects: null,
    maxSeats: null,
    features: ['Unlimited projects', 'Unlimited seats', 'Unlimited clients'],
  },
};
