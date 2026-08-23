import fs from 'node:fs/promises';
import path from 'node:path';

import { getArgValue, isMainModule } from './cliArgs.mjs';

const KAI_SCHEDULE_PAGE = 'https://kai.ru/web/studentu/raspisanie1';
const KAI_PORTLET_ID = 'pubStudentSchedule_WAR_publicStudentSchedule10';
const KAI_GROUP_ID_PARAM = `_${KAI_PORTLET_ID}_groupId`;

function cleanText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDates(dayDate) {
  return Array.from(String(dayDate || '').matchAll(/(\d{2}\.\d{2})/g)).map((m) => m[1]);
}

function kaiResourceUrl(resourceId, extra = {}) {
  const url = new URL(KAI_SCHEDULE_PAGE);
  url.searchParams.set('p_p_id', KAI_PORTLET_ID);
  url.searchParams.set('p_p_lifecycle', '2');
  url.searchParams.set('p_p_state', 'normal');
  url.searchParams.set('p_p_mode', 'view');
  url.searchParams.set('p_p_resource_id', resourceId);
  url.searchParams.set('p_p_cacheability', 'cacheLevelPage');
  for (const [key, value] of Object.entries(extra)) {
    url.searchParams.set(key, String(value));
  }
  return url;
}

async function fetchKaiJson(url) {
  const resp = await fetch(url, {
    headers: {
      Accept: 'application/json, text/javascript, */*; q=0.1',
      'User-Agent': 'Mozilla/5.0',
    },
  });
  if (!resp.ok) {
    throw new Error(`KAI request failed: ${resp.status} ${resp.statusText}`);
  }
  const text = await resp.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('KAI returned a non-JSON response');
  }
}

async function resolveGroupId(groupNumber) {
  const url = kaiResourceUrl('getGroupsURL', { query: String(groupNumber) });
  const data = await fetchKaiJson(url);
  const groups = Array.isArray(data) ? data : [];
  const match = groups.find((g) => String(g?.group) === String(groupNumber));
  if (!match?.id) {
    throw new Error(`Группа ${groupNumber} не найдена на kai.ru`);
  }
  return match.id;
}

function lessonToRow(lesson) {
  const building = cleanText(lesson?.buildNum);
  const audience = cleanText(lesson?.audNum);
  return {
    time: cleanText(lesson?.dayTime),
    dates: parseDates(lesson?.dayDate),
    discipline: cleanText(lesson?.disciplName),
    lessonType: cleanText(lesson?.disciplType),
    room: [building, audience].filter(Boolean).join(' / '),
    teacher: cleanText(lesson?.prepodName),
    department: cleanText(lesson?.orgUnitName),
  };
}

function rowsFromSchedule(schedule) {
  if (!schedule || typeof schedule !== 'object') return [];
  const rows = [];
  for (const lessons of Object.values(schedule)) {
    if (!Array.isArray(lessons)) continue;
    for (const lesson of lessons) {
      const row = lessonToRow(lesson);
      if (!row.time || !row.dates.length) continue;
      rows.push(row);
    }
  }
  return rows;
}

export async function fetchKaiSchedule({ groupNumber = '4319', year = 2026 } = {}) {
  const outDir = path.resolve(process.cwd(), 'out');
  await fs.mkdir(outDir, { recursive: true });

  const groupId = await resolveGroupId(groupNumber);
  const scheduleUrl = kaiResourceUrl('schedule', { [KAI_GROUP_ID_PARAM]: groupId });
  const schedule = await fetchKaiJson(scheduleUrl);
  const rows = rowsFromSchedule(schedule);
  if (!rows.length) {
    throw new Error('KAI вернул пустое расписание');
  }

  const payload = {
    groupNumber: String(groupNumber),
    yearAssumption: Number(year),
    groupId,
    fetchedAt: new Date().toISOString(),
    rows,
  };

  const outRawPath = path.join(outDir, `schedule-${groupNumber}-autumn-${year}.raw.json`);
  await fs.writeFile(outRawPath, JSON.stringify(payload, null, 2), 'utf-8');
  return { ...payload, outRawPath };
}

async function main() {
  const groupNumber = getArgValue('--group', '4319');
  const year = Number(getArgValue('--year', '2026'));
  const result = await fetchKaiSchedule({ groupNumber, year });
  console.log(`Saved raw schedule: ${result.outRawPath}`);
}

if (isMainModule(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
