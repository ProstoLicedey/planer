import fs from 'node:fs/promises';
import path from 'node:path';

import { getArgValue, isMainModule } from './cliArgs.mjs';

function parseTimeToMinutes(time) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  return hh * 60 + mm;
}

function parseTimeToHour(time) {
  const m = /^(\d{1,2}):/.exec(time);
  if (!m) return null;
  return Number(m[1]);
}

function isoDateFromDDMM(day, month, year) {
  // Use UTC to avoid timezone shifting the date.
  const dt = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  return dt.toISOString().slice(0, 10); // YYYY-MM-DD
}

function getWeekdayRuShortFromIso(isoDate) {
  // Monday first order: Пн..Вс
  const dt = new Date(isoDate + 'T00:00:00Z');
  const weekday = dt.getUTCDay(); // 0=Sun..6=Sat
  const mondayIndex = (weekday + 6) % 7; // 0=Mon..6=Sun
  const names = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  return { mondayIndex, name: names[mondayIndex] };
}

function normField(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function identityKey(event) {
  return [event?.isoDate, event?.time, normField(event?.discipline)].join('|');
}

function slotKey(event) {
  return [event?.isoDate, event?.time].join('|');
}

function contentSignature(event) {
  return ['discipline', 'lessonType', 'room', 'teacher', 'department']
    .map((key) => normField(event?.[key]))
    .join('|');
}

function snapshotEvent(event) {
  return {
    isoDate: event?.isoDate || '',
    dateLabel: event?.dateLabel || '',
    time: event?.time || '',
    discipline: event?.discipline || '',
    lessonType: event?.lessonType || '',
    room: event?.room || '',
    teacher: event?.teacher || '',
    department: event?.department || '',
  };
}

function takeUnused(list, used) {
  if (!list) return null;
  const found = list.find((event) => !used.has(event));
  if (!found) return null;
  used.add(found);
  return found;
}

export function diffScheduleEvents(previousEvents, nextEvents) {
  const prev = Array.isArray(previousEvents) ? previousEvents : [];
  const next = Array.isArray(nextEvents) ? nextEvents : [];
  if (!prev.length) return {};

  const used = new Set();
  const byIdentity = new Map();
  const bySlot = new Map();

  for (const event of prev) {
    const ik = identityKey(event);
    if (!byIdentity.has(ik)) byIdentity.set(ik, []);
    byIdentity.get(ik).push(event);

    const sk = slotKey(event);
    if (!bySlot.has(sk)) bySlot.set(sk, []);
    bySlot.get(sk).push(event);
  }

  const changes = {};
  for (const neu of next) {
    const exact = takeUnused(byIdentity.get(identityKey(neu)), used);
    if (exact) {
      if (contentSignature(exact) !== contentSignature(neu)) {
        changes[neu.eventId] = { kind: 'changed', previous: snapshotEvent(exact) };
      }
      continue;
    }

    const slotted = takeUnused(bySlot.get(slotKey(neu)), used);
    if (slotted) {
      changes[neu.eventId] = { kind: 'changed', previous: snapshotEvent(slotted) };
      continue;
    }

    changes[neu.eventId] = { kind: 'added', previous: null };
  }

  return changes;
}

export async function buildEvents({ groupNumber = '4319', year = 2026 } = {}) {
  const outDir = path.resolve(process.cwd(), 'out');
  const rawPath = path.join(outDir, `schedule-${groupNumber}-autumn-${year}.raw.json`);
  const outEventsPath = path.join(outDir, `schedule-${groupNumber}-autumn-${year}.json`);

  const raw = JSON.parse(await fs.readFile(rawPath, 'utf-8'));
  const rows = raw.rows ?? [];

  let previousEvents = [];
  try {
    const previousData = JSON.parse(await fs.readFile(outEventsPath, 'utf-8'));
    previousEvents = Array.isArray(previousData.events) ? previousData.events : [];
  } catch {
    previousEvents = [];
  }

  const events = [];

  for (const row of rows) {
    const { time, dates, discipline, lessonType, room, teacher, department } = row;
    if (!Array.isArray(dates)) continue;

    const semesterDates = dates.filter((ddmm) => {
      const m = /^(\d{2})\.(\d{2})$/.exec(ddmm);
      if (!m) return false;
      const month = Number(m[2]);
      return month >= 9 && month <= 12;
    });

    for (const ddmm of semesterDates) {
      const m = /^(\d{2})\.(\d{2})$/.exec(ddmm);
      if (!m) continue;
      const day = Number(m[1]);
      const month = Number(m[2]);

      const isoDate = isoDateFromDDMM(day, month, year);
      const { mondayIndex } = getWeekdayRuShortFromIso(isoDate);

      events.push({
        isoDate,
        dateLabel: ddmm,
        weekdayIndex: mondayIndex,
        time,
        timeHour: parseTimeToHour(time),
        discipline,
        lessonType,
        room,
        teacher,
        department,
        kaiAllDates: semesterDates,
        kaiOtherDates: semesterDates.filter((date) => date !== ddmm),
      });
    }
  }

  // De-duplication: the same (date+time+discipline+type+room) can appear multiple times.
  const dedup = new Map();
  for (const e of events) {
    const key = [e.isoDate, e.time, e.discipline, e.lessonType, e.room].join('|');
    dedup.set(key, e);
  }

  const eventsDeduped = Array.from(dedup.values());
  eventsDeduped.sort((a, b) => {
    if (a.isoDate !== b.isoDate) return a.isoDate.localeCompare(b.isoDate);
    const ma = parseTimeToMinutes(a.time) ?? 0;
    const mb = parseTimeToMinutes(b.time) ?? 0;
    return ma - mb;
  });

  // Stable local identifier for editing/saving in the browser UI.
  eventsDeduped.forEach((e, idx) => {
    e.eventId = idx + 1;
  });

  const times = Array.from(new Set(eventsDeduped.map((e) => e.time)))
    .filter(Boolean)
    .sort((a, b) => (parseTimeToMinutes(a) ?? 0) - (parseTimeToMinutes(b) ?? 0));

  const reparseChanges = diffScheduleEvents(previousEvents, eventsDeduped);

  const payload = {
    groupNumber,
    semester: 'autumn',
    yearAssumption: year,
    fetchedFrom: raw?.fetchedAt ?? null,
    generatedAt: new Date().toISOString(),
    times,
    events: eventsDeduped,
    reparseChanges,
  };

  await fs.writeFile(outEventsPath, JSON.stringify(payload, null, 2), 'utf-8');
  return { ...payload, outEventsPath };
}

async function main() {
  const groupNumber = getArgValue('--group', '4319');
  const year = Number(getArgValue('--year', '2026'));
  const result = await buildEvents({ groupNumber, year });
  console.log(`Saved events: ${result.outEventsPath}`);
}

if (isMainModule(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

