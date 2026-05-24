'use strict';
const { randInt, pick } = require('./rng');

const START = new Date('2026-01-01');
const TODAY = new Date('2026-05-13');

function toISO(d) {
  return d.toISOString().split('T')[0];
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function addMonths(dateStr, months) {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISO(d);
}

// Returns YYYY-MM-DD string for a random date in [from, to]
function randDate(from = START, to = TODAY) {
  const diff = to.getTime() - from.getTime();
  const offset = Math.floor(Math.random() * diff);
  return toISO(new Date(from.getTime() + offset));
}

// Weighted monthly distribution — mimics real estate seasonality
// Jan:6% Feb:10% Mar:16% Apr:14% May:10% (partial to May-13)
const MONTHLY_WEIGHTS = [
  { month: '2026-01', w: 6,  days: 31 },
  { month: '2026-02', w: 10, days: 28 },
  { month: '2026-03', w: 18, days: 31 },
  { month: '2026-04', w: 14, days: 30 },
  { month: '2026-05', w: 8,  days: 13 },
];

function weightedMonth() {
  const total = MONTHLY_WEIGHTS.reduce((s, m) => s + m.w, 0);
  let r = Math.random() * total;
  for (const m of MONTHLY_WEIGHTS) {
    r -= m.w;
    if (r <= 0) return m;
  }
  return MONTHLY_WEIGHTS[MONTHLY_WEIGHTS.length - 1];
}

function randSaleDate() {
  const m = weightedMonth();
  const day = randInt(1, m.days);
  const hour = randInt(8, 18);
  const min  = randInt(0, 59);
  return `${m.month}-${String(day).padStart(2,'0')}T${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}:00`;
}

function randPayDate(from) {
  const base = new Date(from);
  const offset = randInt(-5, 25);
  const d = addDays(base, offset);
  if (d > TODAY) return toISO(TODAY);
  return toISO(d);
}

function pastDate(daysBack) {
  return toISO(addDays(TODAY, -daysBack));
}

module.exports = { toISO, addDays, addMonths, randDate, randSaleDate, randPayDate, pastDate, TODAY, START };
