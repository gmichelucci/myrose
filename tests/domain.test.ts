import { describe, expect, it } from 'vitest';
import {
  canAddResource,
  computeAvailableSlots,
  computeFinanceSummary,
  interpolateTemplate,
} from '../src/lib/domain';
import { PLANS, type Appointment, type Expense, type WorkingHour } from '../src/types/domain';

const weekdayHours: WorkingHour[] = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  day_of_week: day,
  active: day >= 1 && day <= 6,
  start_time: '09:00',
  end_time: '18:00',
  break_start: '12:00',
  break_end: '13:00',
}));

describe('MyRose domain rules', () => {
  it('calcula slots livres respeitando intervalo de almoço, bloqueios e agendamentos ativos', () => {
    const slots = computeAvailableSlots({
      date: '2026-11-18', // quarta-feira
      durationMinutes: 90,
      slotIntervalMinutes: 30,
      minAdvanceHours: 2,
      workingHours: weekdayHours,
      blockedDates: [],
      appointments: [
        {
          id: '1',
          appointment_date: '2026-11-18',
          start_time: '09:00',
          end_time: '10:30',
          status: 'confirmado',
          collaborator_id: null,
        },
        {
          id: '2',
          appointment_date: '2026-11-18',
          start_time: '14:00',
          end_time: '15:30',
          status: 'cancelado',
          collaborator_id: null,
        },
      ],
      now: new Date('2026-11-17T10:00:00'),
    });

    const starts = slots.map((s) => s.start);
    expect(starts).not.toContain('09:00'); // ocupado
    expect(starts).not.toContain('11:00'); // invadiria almoço 12:00-13:00
    expect(starts).toContain('10:30'); // cabe exatamente até 12:00
    expect(starts).toContain('14:00'); // agendamento cancelado liberado
    expect(starts).not.toContain('17:00'); // passaria das 18:00
  });

  it('bloqueia todos os horários quando o dia está bloqueado', () => {
    const slots = computeAvailableSlots({
      date: '2026-11-18',
      durationMinutes: 60,
      slotIntervalMinutes: 30,
      minAdvanceHours: 0,
      workingHours: weekdayHours,
      blockedDates: ['2026-11-18'],
      appointments: [],
      now: new Date('2026-11-17T10:00:00'),
    });
    expect(slots).toEqual([]);
  });

  it('mantém limites e coerência entre plano gratuito e planos pagos', () => {
    const free = PLANS.find((p) => p.id === 'gratuito')!;
    const pro = PLANS.find((p) => p.id === 'profissional')!;

    expect(canAddResource(4, free.clientLimit)).toBe(true);
    expect(canAddResource(5, free.clientLimit)).toBe(false);
    expect(canAddResource(999, pro.clientLimit)).toBe(true);
    for (const p of PLANS) {
      expect(p.annualPriceCents).toBeLessThanOrEqual(p.monthlyPriceCents * 12);
    }
    expect(PLANS.map((p) => p.monthlyPriceCents)).toEqual([0, 2990, 3990, 7990]);
  });

  it('consolida financeiro apenas com atendimentos realizados menos despesas', () => {
    const appointments = [
      { status: 'realizado', total_cents: 18000 },
      { status: 'agendado', total_cents: 20000 },
      { status: 'realizado', total_cents: 12000 },
    ] as Appointment[];
    const expenses = [{ amount_cents: 5000 }] as Expense[];

    expect(computeFinanceSummary(appointments, expenses)).toEqual({
      revenueCents: 30000,
      expenseCents: 5000,
      netProfitCents: 25000,
      completedCount: 2,
      averageTicketCents: 15000,
    });
  });

  it('interpola variáveis de template do WhatsApp preservando placeholders ausentes', () => {
    const result = interpolateTemplate('Oi {cliente}, dia {data} às {horario}. {desconhecido}', {
      cliente: 'Maria',
      data: '20/11',
      horario: '15:00',
    });
    expect(result).toBe('Oi Maria, dia 20/11 às 15:00. {desconhecido}');
  });
});
