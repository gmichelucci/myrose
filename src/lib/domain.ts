import {
  type Appointment,
  type Expense,
  PLANS,
  type PlanId,
  type PlanSpec,
  type WorkingHour,
} from '../types/domain';

export function getPlan(planId: PlanId): PlanSpec {
  return PLANS.find((p) => p.id === planId) ?? PLANS[0];
}

export function formatCurrencyBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

export function toHHMM(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

export function hasTimeConflict(
  existing: Array<Pick<Appointment, 'id' | 'appointment_date' | 'start_time' | 'end_time' | 'status' | 'collaborator_id'>>,
  candidate: {
    id?: string;
    date: string;
    startTime: string;
    endTime: string;
    collaboratorId?: string | null;
  }
): boolean {
  const cStart = toMinutes(candidate.startTime);
  const cEnd = toMinutes(candidate.endTime);

  return existing.some((a) => {
    if (a.id === candidate.id || a.status === 'cancelado' || a.appointment_date !== candidate.date) {
      return false;
    }
    if (candidate.collaboratorId && a.collaborator_id && candidate.collaboratorId !== a.collaborator_id) {
      return false;
    }
    return cStart < toMinutes(a.end_time) && cEnd > toMinutes(a.start_time);
  });
}

export interface SlotComputationInput {
  date: string;
  durationMinutes: number;
  slotIntervalMinutes: number;
  minAdvanceHours: number;
  workingHours: WorkingHour[];
  blockedDates: string[];
  appointments: Array<Pick<Appointment, 'id' | 'appointment_date' | 'start_time' | 'end_time' | 'status' | 'collaborator_id'>>;
  collaboratorId?: string | null;
  now?: Date;
}

export function computeAvailableSlots(input: SlotComputationInput): Array<{ start: string; end: string }> {
  if (input.durationMinutes <= 0 || input.blockedDates.includes(input.date)) {
    return [];
  }

  const dow = new Date(`${input.date}T12:00:00`).getDay();
  const schedule = input.workingHours.find((w) => w.day_of_week === dow);
  if (!schedule || !schedule.active) {
    return [];
  }

  const step = Math.max(15, input.slotIntervalMinutes || 30);
  const startMin = toMinutes(schedule.start_time);
  const endMin = toMinutes(schedule.end_time);
  const breakStart = schedule.break_start ? toMinutes(schedule.break_start) : null;
  const breakEnd = schedule.break_end ? toMinutes(schedule.break_end) : null;
  const now = input.now ?? new Date();
  const minEpoch = now.getTime() + input.minAdvanceHours * 3600 * 1000;

  const slots: Array<{ start: string; end: string }> = [];
  for (let t = startMin; t + input.durationMinutes <= endMin; t += step) {
    const start = toHHMM(t);
    const end = toHHMM(t + input.durationMinutes);

    const slotDate = new Date(`${input.date}T${start}:00`);
    if (slotDate.getTime() < minEpoch) continue;

    const hitsBreak = breakStart !== null && breakEnd !== null && t < breakEnd && t + input.durationMinutes > breakStart;
    if (hitsBreak) continue;

    if (
      hasTimeConflict(input.appointments, {
        date: input.date,
        startTime: start,
        endTime: end,
        collaboratorId: input.collaboratorId,
      })
    ) {
      continue;
    }

    slots.push({ start, end });
  }

  return slots;
}

export function canAddResource(currentActiveCount: number, limit: number | null): boolean {
  return limit === null || currentActiveCount < limit;
}

export function interpolateTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (full, key) => vars[key] ?? full);
}

export function computeFinanceSummary(appointments: Appointment[], expenses: Expense[]) {
  const completed = appointments.filter((a) => a.status === 'realizado');
  const revenueCents = completed.reduce((acc, a) => acc + a.total_cents, 0);
  const expenseCents = expenses.reduce((acc, e) => acc + e.amount_cents, 0);
  const count = completed.length;

  return {
    revenueCents,
    expenseCents,
    netProfitCents: revenueCents - expenseCents,
    completedCount: count,
    averageTicketCents: count > 0 ? Math.round(revenueCents / count) : 0,
  };
}
