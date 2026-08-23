import { fetchKaiSchedule } from './fetchKaiSchedule.mjs';
import { buildEvents } from './buildEvents.mjs';
import { renderSchedulePage } from './renderSchedulePage.mjs';

export async function refreshSchedule({ groupNumber = '4319', year = 2026 } = {}) {
  const raw = await fetchKaiSchedule({ groupNumber, year });
  const built = await buildEvents({ groupNumber, year });
  const rendered = await renderSchedulePage({ groupNumber, year });
  return {
    groupNumber: String(groupNumber),
    year: Number(year),
    fetchedAt: raw.fetchedAt,
    rowCount: raw.rows?.length ?? 0,
    eventCount: built.events?.length ?? 0,
    htmlPath: rendered.outHtmlPath,
  };
}
