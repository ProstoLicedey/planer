import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

import { getArgValue } from './cliArgs.mjs';

async function main() {
  const groupNumber = getArgValue('--group', '4319');
  const year = Number(getArgValue('--year', '2026'));

  const outDir = path.resolve(process.cwd(), 'out');
  await fs.mkdir(outDir, { recursive: true });

  const outRawPath = path.join(outDir, `schedule-${groupNumber}-autumn-${year}.raw.json`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0',
    viewport: { width: 1200, height: 900 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(120000);

  // 1) Open the public schedule page.
  await page.goto('https://kai.ru/web/studentu/raspisanie1', { waitUntil: 'networkidle' });
  // Headless-режим иногда показывает попап/баннер. На странице расписания
  // КАИ он обычно закрывается кнопкой с id="impp-close-btn".
  try {
    const closeBtn = page.locator('#impp-close-btn');
    if ((await closeBtn.count()) > 0) {
      await closeBtn.first().click({ timeout: 2000 });
    }
  } catch {
    // ignore
  }
  // На всякий случай пробуем Escape (некоторые модалки закрываются так).
  try {
    await page.keyboard.press('Escape');
  } catch {
    // ignore
  }
  await page.waitForTimeout(500);

  // 2) Ввести номер группы (с учётом autocomplete YUI на странице).
  const groupInputId = '_pubStudentSchedule_WAR_publicStudentSchedule10_group';
  const groupValue = String(groupNumber);

  await page.evaluate(
    ([inputId, val]) => {
      const el = document.getElementById(inputId);
      if (!el) return;
      el.focus();
      el.value = '';
      el.value = val;
      // События, которые обычно используют формы для включения submit-кнопок.
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: val }));
    },
    [groupInputId, groupValue],
  );

  // Выбираем вариант из выпадающего списка (если он появился).
  // Часто именно это включает кнопку.
  await page.waitForTimeout(300);
  try {
    const option = page.locator(`li[role="option"][data-text="${groupNumber}"]`).first();
    if ((await option.count()) > 0) {
      await option.click({ timeout: 2000 });
    } else {
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
    }
  } catch {
    // ignore
  }
  // blur
  await page.keyboard.press('Tab');

  const lessonsBtn = page.getByRole('button', { name: /Расписание занятий/i });

  // Wait until the submit button is enabled, then click it.
  // (On the first attempt it can stay disabled until the input event settles.)
  const lessonsBtnId = '_pubStudentSchedule_WAR_publicStudentSchedule10_schedule';
  try {
    await page.waitForFunction(
      (id) => {
        const el = document.getElementById(id);
        return el && !(el.classList.contains('disabled') || el.hasAttribute('disabled'));
      },
      lessonsBtnId,
      { timeout: 30000 },
    );
    await page.click('#' + lessonsBtnId);
  } catch {
    // Some pages auto-load without needing the click.
  }

  // 3) Wait until schedule tables are present.
  // The exact text/layout can vary a bit, so we wait more defensively:
  // - at least one table containing "Время"
  // - and at least one table containing "Дисциплина"
  try {
    await page.waitForFunction(
      () => {
        const tables = Array.from(document.querySelectorAll('table'));
        const hasTimeTable = tables.some((t) => /Время/i.test(t.innerText || ''));
        const hasDisciplineTable = tables.some((t) => /Дисциплина/i.test(t.innerText || ''));
        return hasTimeTable && hasDisciplineTable;
      },
      { timeout: 60000 },
    );
  } catch (e) {
    const debug = await page.evaluate(() => {
      const tables = Array.from(document.querySelectorAll('table'));
      const timeMatches = tables.filter((t) => /Время/i.test(t.innerText || '')).length;
      const disciplineMatches = tables.filter((t) => /Дисциплина/i.test(t.innerText || '')).length;
      return {
        url: location.href,
        tableCount: tables.length,
        timeMatches,
        disciplineMatches,
        bodyTextSample: (document.body?.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 500),
      };
    });

    const debugScreenshotPath = path.join(outDir, `debug-${groupNumber}-autumn-${year}.png`);
    const debugHtmlPath = path.join(outDir, `debug-${groupNumber}-autumn-${year}.html`);

    await page.screenshot({ path: debugScreenshotPath, fullPage: true });
    await fs.writeFile(debugHtmlPath, await page.content(), 'utf-8');
    console.error('DEBUG_SCHEDULE_NOT_LOADED', debug);
    console.error('Saved debug files:', debugScreenshotPath, debugHtmlPath);

    throw e;
  }

  // 4) Extract rows from DOM tables.
  const rows = await page.evaluate(() => {
    const tables = Array.from(document.querySelectorAll('table'));
    const scheduleTables = tables.filter((t) => /Время/.test(t.innerText) && /Дисциплина/.test(t.innerText) && /Вид занятия/.test(t.innerText));

    const extracted = [];

    for (const table of scheduleTables) {
      const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
      for (const row of bodyRows) {
        const tds = Array.from(row.querySelectorAll('td')).map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim());
        // Expected columns:
        // 0 Время, 1 Дата(list), 2 Дисциплина, 3 Вид занятия, 4 Здание/Аудитория, 5 Преподаватель, 6 Кафедра
        if (tds.length < 6) continue;

        const [time, dateCell, discipline, lessonType, room, teacher, department] = tds;
        const dates = Array.from((dateCell || '').matchAll(/(\d{2}\.\d{2})/g)).map((m) => m[1]);

        // Fallback: sometimes the dates are in a different cell layout; try whole row.
        if (dates.length === 0) {
          const rowTextDates = Array.from((row.innerText || '').matchAll(/(\d{2}\.\d{2})/g)).map((m) => m[1]);
          if (rowTextDates.length > 0) dates.push(...rowTextDates);
        }

        extracted.push({
          time: time ?? '',
          dates,
          discipline: discipline ?? '',
          lessonType: lessonType ?? '',
          room: room ?? '',
          teacher: teacher ?? '',
          department: department ?? '',
        });
      }
    }

    return extracted;
  });

  await browser.close();

  const payload = {
    groupNumber,
    yearAssumption: year,
    fetchedAt: new Date().toISOString(),
    rows,
  };

  await fs.writeFile(outRawPath, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`Saved raw schedule: ${outRawPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

