import fs from "node:fs/promises";
import path from "node:path";

import { getArgValue, isMainModule } from './cliArgs.mjs';

function isoMondayStart(isoDate) {
  const dt = new Date(isoDate + "T00:00:00Z");
  const day = dt.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = (day + 6) % 7; // Mon=0..Sun=6
  dt.setUTCDate(dt.getUTCDate() - diffToMonday);
  return dt.toISOString().slice(0, 10);
}

function dayNamesRu() {
  return ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
}

export async function renderSchedulePage({ groupNumber = "4319", year = 2026 } = {}) {

  const outDir = path.resolve(process.cwd(), "out");
  const inEventsPath = path.join(
    outDir,
    `schedule-${groupNumber}-autumn-${year}.json`,
  );
  const outHtmlPath = path.join(
    outDir,
    `schedule-${groupNumber}-autumn-${year}.html`,
  );

  const data = JSON.parse(await fs.readFile(inEventsPath, "utf-8"));
  const events = data.events ?? [];
  const times = data.times ?? [];

  const weekStarts = Array.from(
    new Set(events.map((e) => isoMondayStart(e.isoDate))),
  ).sort((a, b) => a.localeCompare(b));

  const scheduleForHtml = {
    groupNumber: data.groupNumber ?? groupNumber,
    semester: data.semester ?? "autumn",
    yearAssumption: data.yearAssumption ?? year,
    generatedAt: data.generatedAt ?? null,
    fetchedFrom: data.fetchedFrom ?? null,
    times,
    weekStarts,
    events,
    reparseChanges: data.reparseChanges ?? {},
  };

  const css = `
    :root{
      --bg:#1e1e1e;
      --panel:#252526;
      --border:rgba(255,255,255,0.12);
      --text:rgba(212,212,212,0.95);
      --muted:rgba(133,133,133,0.95);
      --card:#2a2a2a;
      --accent:#4CAF50;
    }
    body{
      margin:0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      background:var(--bg);
      color:var(--text);
    }
    .wrap{
      max-width: 1200px;
      margin: 0 auto;
      padding: 14px 16px 18px;
    }
    .top{
      position: sticky;
      top: 0;
      z-index: 40;
      display:flex;
      flex-direction: column;
      gap: 8px;
      margin: -14px -16px 14px;
      padding: 10px 16px 10px;
      border: 0;
      border-bottom: 1px solid var(--border);
      border-radius: 0;
      background: rgba(30,30,30,0.96);
      backdrop-filter: blur(14px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    }
    .topPrimary{
      display:flex;
      align-items:center;
      gap: 6px;
      flex-wrap: wrap;
      min-width: 0;
    }
    .brand{
      display:flex;
      flex-direction:column;
      gap:2px;
      min-width: 0;
      flex: 0 1 auto;
    }
    .topKicker{
      color: var(--muted);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      line-height: 1.1;
    }
    h1{
      font-size:15px;
      margin:0;
      line-height: 1.2;
      white-space: nowrap;
    }
    .weekPager{
      display:flex;
      align-items:center;
      gap:6px;
      min-width: 0;
      flex: 0 1 auto;
      padding: 3px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: rgba(255,255,255,0.03);
    }
    .weekBadgeValue{
      font-weight:700;
      font-size: 13px;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      padding: 0 4px;
      min-width: 10.5ch;
      text-align: center;
    }
    .topSearch{
      position: relative;
      display:flex;
      align-items:center;
      min-width: 0;
      flex: 0 1 168px;
      width: 168px;
      max-width: 168px;
      height: 34px;
    }
    .workBar{
      display:flex;
      align-items:center;
      gap:6px;
      flex-wrap: nowrap;
      min-width: 0;
      height: 38px;
      padding: 3px 3px 3px 8px;
      border: 1px solid rgba(76,175,80,0.28);
      border-radius: 12px;
      background: rgba(76,175,80,0.08);
    }
    .topActions{
      display:flex;
      align-items:center;
      gap:6px;
      flex: 0 0 auto;
    }
    .workBarLabel{
      color: var(--muted);
      font-size: 12px;
      white-space: nowrap;
    }
    .workHoursField{
      display:flex;
      align-items:center;
      gap:6px;
      color: var(--muted);
      font-size: 12px;
    }
    .workStatus{
      color:var(--muted);
      font-size:13px;
      min-width:0;
    }
    .workStatus:empty{
      display:none;
    }
    .menu{
      position: relative;
    }
    .menuList{
      display:none;
      position: absolute;
      right: 0;
      top: calc(100% + 6px);
      min-width: 240px;
      padding: 6px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: #2a2a2a;
      box-shadow: 0 16px 40px rgba(0,0,0,0.35);
      z-index: 60;
    }
    .menu.isOpen .menuList{
      display:flex;
      flex-direction: column;
      gap: 2px;
    }
    .menuItem{
      width: 100%;
      text-align: left;
      background: transparent;
      color: var(--text);
      border: 0;
      border-radius: 8px;
      padding: 9px 10px;
      cursor: pointer;
      font-size: 14px;
    }
    .menuItem:hover,
    .menuItem:focus-visible{
      background: rgba(255,255,255,0.06);
      outline: none;
    }
    label{
      color:var(--muted);
      font-size:13px;
    }
    select{
      background:var(--panel);
      color:var(--text);
      border:1px solid var(--border);
      border-radius:10px;
      padding:8px 10px;
      outline:none;
    }
    table{
      width:100%;
      border-collapse:collapse;
      table-layout:fixed;
      border:1px solid var(--border);
      background: var(--panel);
      border-radius: 12px;
      overflow:hidden;
    }
    th, td{
      border:1px solid var(--border);
      padding:8px 6px;
      vertical-align:top;
    }
    th{
      font-weight:600;
      color:var(--muted);
      font-size:13px;
    }
    td.timeCell{
      width: 88px;
      color: var(--muted);
      font-weight:600;
      font-size:13px;
      vertical-align: top;
    }
    td.dayCell{
      height: 72px;
      padding: 0;
      position: relative;
      overflow: visible;
    }
    .cards{
      position: relative;
      min-height: 72px;
    }
    .card{
      background: var(--card);
      border:1px solid var(--border);
      border-radius: 10px;
      padding: 6px 8px;
      font-size: 13px;
      line-height: 1.25;
      overflow:hidden;
      box-sizing: border-box;
    }
    .cardWork{
      background: rgba(76,175,80,0.14);
      border-color: rgba(76,175,80,0.55);
    }
    .cardItSchool{
      background: rgba(33,150,243,0.14);
      border-color: rgba(33,150,243,0.55);
    }
    .cardPair{
      background: rgba(76,175,80,0.10);
      border-color: rgba(76,175,80,0.55);
    }
    .cardNonPair{
      background: rgba(255,193,7,0.10);
      border-color: rgba(255,193,7,0.55);
    }
    .cardChanged{
      background: rgba(56,189,248,0.18);
      border-color: rgba(56,189,248,0.75);
      border-left: 3px solid rgba(56,189,248,0.95);
    }
    .cardTime{
      color: var(--muted);
      font-size: 11px;
      margin-bottom: 3px;
      font-variant-numeric: tabular-nums;
    }
    .card .disc{
      font-weight:700;
      margin-bottom: 2px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .card .meta{
      color:var(--muted);
      font-size: 12px;
      white-space: nowrap;
      overflow:hidden;
      text-overflow: ellipsis;
    }
    .hint{
      margin-top: 10px;
      color:var(--muted);
      font-size: 12px;
    }

    /* Modal editor */
    .modalOverlay{
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 18px;
      z-index: 9999;
    }
    .modal{
      width: 100%;
      max-width: 720px;
      background: #0f172a;
      border: 1px solid var(--border);
      border-radius: 14px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.4);
      overflow: hidden;
    }
    .modalHeader{
      display:flex;
      align-items:center;
      justify-content: space-between;
      padding: 12px 14px;
      border-bottom: 1px solid var(--border);
    }
    .modalHeader strong{
      font-size: 14px;
    }
    .modalHeader button{
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text);
      border-radius: 10px;
      padding: 6px 10px;
      cursor: pointer;
      font-size: 14px;
    }
    .previousPair{
      margin: 0;
      padding: 12px 14px;
      border-bottom: 1px solid var(--border);
      background: rgba(56,189,248,0.08);
    }
    .previousPairLabel{
      color: rgba(125,211,252,0.95);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 8px;
    }
    .previousPairCard{
      background: rgba(56,189,248,0.12);
      border: 1px solid rgba(56,189,248,0.45);
      border-radius: 10px;
      padding: 8px 10px;
      font-size: 13px;
      line-height: 1.25;
    }
    .previousPairCard .disc{
      font-weight: 700;
      margin-bottom: 2px;
    }
    .previousPairNote{
      color: var(--text);
      font-size: 13px;
    }
    .modalBody{
      padding: 14px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 14px;
    }
    .field{
      display:flex;
      flex-direction: column;
      gap: 6px;
    }
    .field label{
      color: var(--muted);
      font-size: 12px;
    }
    .field input, .field select{
      background: var(--panel);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 9px 10px;
      outline: none;
      font-size: 14px;
    }
    .modalFooter{
      padding: 12px 14px;
      border-top: 1px solid var(--border);
      display:flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .btn{
      background: var(--panel);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 7px 11px;
      cursor: pointer;
      font-size: 13px;
      min-height: 34px;
      white-space: nowrap;
      transition: background 140ms ease, border-color 140ms ease, transform 140ms ease, box-shadow 140ms ease;
    }
    .btn:hover{
      background: rgba(255,255,255,0.06);
      border-color: rgba(255,255,255,0.2);
    }
    .btn:focus-visible{
      outline: none;
      border-color: rgba(76,175,80,0.72);
      box-shadow: 0 0 0 3px rgba(76,175,80,0.18);
    }
    .btn:active{
      transform: translateY(1px);
    }
    .btn:disabled{
      cursor: not-allowed;
      opacity: 0.6;
    }
    .btnPrimary{
      background: rgba(76,175,80,0.18);
      border-color: rgba(76,175,80,0.55);
    }
    .btnPrimary:hover{
      background: rgba(76,175,80,0.24);
      border-color: rgba(76,175,80,0.7);
    }
    .btnSubtle{
      background: rgba(255,255,255,0.02);
    }
    .btnNav{
      min-width: 32px;
      min-height: 32px;
      padding: 0;
      font-size: 18px;
      line-height: 1;
      background: transparent;
      border-color: transparent;
    }
    .btnCompact{
      min-height: 32px;
      padding: 6px 10px;
    }

    /* Top search */
    input.searchInput{
      background: var(--panel);
      color: var(--text);
      border:1px solid var(--border);
      border-radius:10px;
      padding:7px 34px 7px 10px;
      outline:none;
      font-size:13px;
      width: 100%;
      min-width: 0;
      max-width: none;
      min-height: 34px;
    }
    .btnIcon{
      position: absolute;
      right: 4px;
      top: 50%;
      transform: translateY(-50%);
      display:inline-flex;
      align-items:center;
      justify-content:center;
      width: 26px;
      height: 26px;
      min-height: 26px;
      padding: 0;
      line-height: 1;
      border: 0;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      border-radius: 8px;
    }
    .btnIcon:hover{
      background: rgba(255,255,255,0.08);
      color: var(--text);
    }
    input.searchInput:placeholder-shown + .btnIcon{
      visibility: hidden;
    }
    .highlight{
      background: rgba(76,175,80,0.18);
      border: 1px solid rgba(76,175,80,0.45);
      color: var(--text);
      border-radius: 6px;
      padding: 0 3px;
    }
    th.todayTh, td.todayCell{
      background: rgba(76,175,80,0.10);
    }

    input.workInput{
      background: var(--panel);
      color: var(--text);
      border:1px solid var(--border);
      border-radius:8px;
      padding:6px 8px;
      outline:none;
      font-size:13px;
      width: 56px;
      min-height: 32px;
    }
    input.searchInput:focus-visible,
    input.workInput:focus-visible,
    select:focus-visible{
      border-color: rgba(76,175,80,0.72);
      box-shadow: 0 0 0 3px rgba(76,175,80,0.18);
    }
    @media (min-width: 900px){
      .topPrimary{
        flex-wrap: nowrap;
      }
    }
    @media (max-width: 899px){
      .topSearch{
        flex: 1 1 140px;
        width: auto;
        max-width: none;
      }
      .workBar{
        flex-wrap: wrap;
      }
    }
    @media (max-width: 720px){
      .top{
        padding: 10px 12px;
        margin: -14px -16px 12px;
      }
      h1{
        white-space: normal;
      }
      .weekPager,
      .topSearch,
      .workBar,
      .topActions{
        flex: 1 1 100%;
        max-width: none;
      }
      .weekPager{
        justify-content: space-between;
      }
      .topActions .btnPrimary,
      .workBar .btn{
        flex: 1 1 auto;
      }
    }
  `;

  const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>расписание · группа ${groupNumber}</title>
  <style>${css}</style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div class="topPrimary">
        <div class="brand">
          <div class="topKicker">Планировщик</div>
          <h1>Группа ${groupNumber}</h1>
        </div>
        <div class="weekPager" role="group" aria-label="Неделя">
          <button class="btn btnNav" id="prevWeekBtn" type="button" aria-label="Предыдущая неделя">‹</button>
          <div class="weekBadgeValue" id="weekTitle"></div>
          <button class="btn btnNav" id="nextWeekBtn" type="button" aria-label="Следующая неделя">›</button>
        </div>
        <div class="topSearch">
          <input id="searchInput" class="searchInput" type="text" placeholder="Поиск..." autocomplete="off"/>
          <button class="btnIcon" id="clearSearchBtn" type="button" aria-label="Очистить поиск">×</button>
        </div>
        <div class="workBar">
          <label class="workHoursField" for="workTargetHours">
            <input id="workTargetHours" class="workInput" type="number" min="0" step="0.5" value="30"/>
            <span>ч/нед</span>
          </label>
          <button class="btn btnPrimary btnCompact" id="calcWorkBtn" type="button">Рассчитать</button>
          <button class="btn btnSubtle btnCompact" id="clearWorkBtn" type="button">Очистить</button>
        </div>
        <div class="topActions">
          <button class="btn btnPrimary" id="addEventBtn" type="button">+ Добавить</button>
          <div class="menu" id="moreMenu">
            <button class="btn btnSubtle" id="moreMenuBtn" type="button" aria-haspopup="menu" aria-expanded="false">Ещё</button>
            <div class="menuList" role="menu">
              <button class="menuItem" id="googleCalendarBtn" type="button" role="menuitem">Экспорт в Google Calendar</button>
              <button class="menuItem" id="exportBtn" type="button" role="menuitem">Скачать JSON</button>
              <button class="menuItem" id="reparseBtn" type="button" role="menuitem">Перепарсить расписание</button>
            </div>
          </div>
        </div>
      </div>
      <div id="workCalcStatus" class="workStatus"></div>
    </div>

    <div id="grid"></div>

    <div class="modalOverlay" id="editOverlay" style="display:none;">
      <div class="modal" role="dialog" aria-modal="true" aria-label="Редактирование события">
        <div class="modalHeader">
          <strong>Редактирование события</strong>
          <button type="button" id="editCloseBtn" aria-label="Закрыть">×</button>
        </div>
        <div id="editPrevious" class="previousPair" style="display:none;">
          <div class="previousPairLabel" id="editPreviousLabel">Старый формат</div>
          <div class="previousPairCard" id="editPreviousCard">
            <div class="cardTime" id="editPreviousTime"></div>
            <div class="disc" id="editPreviousDisc"></div>
            <div class="meta" id="editPreviousMeta"></div>
          </div>
          <div class="previousPairNote" id="editPreviousNote" style="display:none;"></div>
        </div>

        <div class="modalBody">
          <div class="field">
            <label for="editDate">Дата</label>
            <select id="editDate"></select>
          </div>
          <div class="field" id="editTimeSelectField">
            <label for="editTimeSelect">Время</label>
            <select id="editTimeSelect"></select>
          </div>
          <div class="field" id="editTimeInputField" style="display:none;">
            <label for="editTimeInput">Время</label>
            <input id="editTimeInput" type="time"/>
          </div>

          <div class="field">
            <label for="editEndTime">До</label>
            <input id="editEndTime" type="time"/>
          </div>

          <div class="field" style="grid-column: 1 / span 2;">
            <label for="editDiscipline">Дисциплина</label>
            <input id="editDiscipline" type="text"/>
          </div>

          <div class="field">
            <label>Тип занятия</label>
            <div style="display:flex;gap:12px;flex-wrap:wrap;">
              <label style="display:flex;align-items:center;gap:6px;color:var(--text);font-size:14px;">
                <input type="radio" name="editKind" value="pair" checked/>
                ПАРА
              </label>
              <label style="display:flex;align-items:center;gap:6px;color:var(--text);font-size:14px;">
                <input type="radio" name="editKind" value="nonpair"/>
                НЕ ПАРА
              </label>
            </div>
          </div>

          <div class="field" id="editLessonTypeField">
            <label for="editLessonType">Формат</label>
            <input id="editLessonType" type="text" placeholder="лек / пр / л.р."/>
          </div>

          <div class="field" id="editRoomField">
            <label for="editRoom">Аудитория</label>
            <input id="editRoom" type="text"/>
          </div>

          <div class="field" id="editTeacherField">
            <label for="editTeacher">Преподаватель</label>
            <input id="editTeacher" type="text"/>
          </div>

          <div class="field" style="grid-column: 1 / span 2;">
            <label for="editDepartment">Кафедра</label>
            <input id="editDepartment" type="text"/>
          </div>
        </div>

        <div class="modalFooter modalFooterActions">
          <button class="btn" type="button" id="editCancelBtn">Отмена</button>
          <button
            class="btn"
            type="button"
            id="editDeleteBtn"
            style="border-color:rgba(255,90,90,0.55);background:rgba(255,90,90,0.12);"
          >
            Удалить
          </button>
          <button class="btn btnPrimary" type="button" id="editSaveBtn">Сохранить</button>
        </div>
      </div>
    </div>

    <div class="modalOverlay" id="addOverlay" style="display:none;">
      <div class="modal" role="dialog" aria-modal="true" aria-label="Добавление мероприятия">
        <div class="modalHeader">
          <strong>Добавление мероприятия</strong>
          <button type="button" id="addCloseBtn" aria-label="Закрыть">×</button>
        </div>

        <div class="modalBody">
          <div class="field">
            <label for="addDate">Дата</label>
            <select id="addDate"></select>
          </div>
          <div class="field" id="addTimeSelectField">
            <label for="addTimeSelect">Время</label>
            <select id="addTimeSelect"></select>
          </div>
          <div class="field" id="addTimeInputField" style="display:none;">
            <label for="addTimeInput">Время</label>
            <input id="addTimeInput" type="time"/>
          </div>

          <div class="field" style="grid-column: 1 / span 2;">
            <label for="addEndTime">До</label>
            <input id="addEndTime" type="time"/>
          </div>

          <div class="field" style="grid-column: 1 / span 2;">
            <label for="addTitle">Название</label>
            <input id="addTitle" type="text"/>
          </div>

          <div class="field" style="grid-column: 1 / span 2; display:none;" id="addRoomField">
            <label for="addRoom">Аудитория</label>
            <input id="addRoom" type="text"/>
          </div>

          <div class="field" style="grid-column: 1 / span 2; display:none;" id="addTeacherField">
            <label for="addTeacher">Преподаватель</label>
            <input id="addTeacher" type="text"/>
          </div>

          <div class="field" style="grid-column: 1 / span 2;">
            <label>Тип</label>
            <div style="display:flex;gap:12px;flex-wrap:wrap;">
              <label style="display:flex;align-items:center;gap:6px;color:var(--text);font-size:14px;">
                <input type="radio" name="addKind" value="pair" checked/>
                ПАРА
              </label>
              <label style="display:flex;align-items:center;gap:6px;color:var(--text);font-size:14px;">
                <input type="radio" name="addKind" value="nonpair"/>
                НЕ ПАРА
              </label>
            </div>
          </div>
        </div>

        <div class="modalFooter modalFooterActions">
          <button class="btn" type="button" id="addCancelBtn">Отмена</button>
          <button class="btn btnPrimary" type="button" id="addSaveBtn">Сохранить</button>
        </div>
      </div>
    </div>

    <div class="modalOverlay" id="googleExportOverlay" style="display:none;">
      <div class="modal" role="dialog" aria-modal="true" aria-label="Экспорт в Google Calendar">
        <div class="modalHeader">
          <strong>Экспорт в Google Calendar</strong>
          <button type="button" id="googleExportCloseBtn" aria-label="Закрыть">×</button>
        </div>

        <div class="modalBody" style="grid-template-columns: 1fr;">
          <div class="field">
            <label style="color:var(--text);font-size:14px;">
              Выберите, какие события скачать в формате .ics для импорта в Google Calendar.
            </label>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="btn btnPrimary" type="button" id="googleExportWeekBtn">Текущая неделя</button>
            <button class="btn" type="button" id="googleExportSemesterBtn">Весь семестр</button>
          </div>
        </div>

        <div class="modalFooter modalFooterActions">
          <button class="btn" type="button" id="googleExportCancelBtn">Отмена</button>
        </div>
      </div>
    </div>
  </div>

  <script>
    const RAW_SCHEDULE = ${JSON.stringify(scheduleForHtml)};
    const DAY_NAMES = ${JSON.stringify(dayNamesRu())};

    const reparseChanges = RAW_SCHEDULE.reparseChanges && typeof RAW_SCHEDULE.reparseChanges === 'object'
      ? RAW_SCHEDULE.reparseChanges
      : {};

    const STORAGE_KEY =
      'kai-schedule-edits:' + RAW_SCHEDULE.groupNumber + ':' + RAW_SCHEDULE.yearAssumption + ':' + RAW_SCHEDULE.semester + ':' + (RAW_SCHEDULE.generatedAt || '');

    const times = RAW_SCHEDULE.times ?? [];
    const weekStarts = RAW_SCHEDULE.weekStarts ?? [];

    const DEPARTMENT = {
      GENERATED_WORK: 'generated-work',
      FIXED_IT_SCHOOL: 'fixed-it-school',
    };

    const LESSON_TYPE = {
      PAIR: 'ПАРА',
      NONPAIR: 'НЕ ПАРА',
      WORK: 'РАБОТА',
    };

    function isPairLike(ev) {
      const t = String(ev?.lessonType || '').trim();
      if (t === LESSON_TYPE.NONPAIR || t === LESSON_TYPE.WORK) return false;
      return true;
    }

    const WORK_DISCIPLINE = 'Работа';

    function isPhysicalEducationEvent(ev) {
      const title = String(ev?.discipline || '').toLowerCase();
      return title.includes('физическая культура');
    }

    function getReparseChange(ev) {
      if (!ev) return null;
      const direct = ev.reparseChange;
      if (direct && typeof direct === 'object') return direct;
      return reparseChanges[ev.eventId] || reparseChanges[String(ev.eventId)] || null;
    }

    function pairMetaText(ev) {
      const metaParts = [];
      if (ev?.lessonType && ev.department !== DEPARTMENT.GENERATED_WORK) metaParts.push(ev.lessonType);
      if (ev?.room) metaParts.push(ev.room);
      if (ev?.teacher) metaParts.push(ev.teacher);
      return metaParts.join(' · ');
    }

    let events = Array.isArray(RAW_SCHEDULE.events)
      ? RAW_SCHEDULE.events.map((e) => ({ ...e }))
      : [];
    events = events.filter((e) => !isPhysicalEducationEvent(e));

    // UI state: discipline search (used later for filtering/highlighting).
    let searchQuery = '';
    let searchQueryNorm = '';

    function normalizeSearchQuery(q) {
      return String(q || '').trim().toLowerCase();
    }

    function matchesDisciplineNorm(event, queryNorm) {
      if (!queryNorm) return true;
      const d = String(event?.discipline || '');
      return d.toLowerCase().includes(queryNorm);
    }

    function renderHighlightedText(container, text, queryNorm) {
      const t = String(text || '');
      if (!queryNorm) {
        container.textContent = t;
        return;
      }

      const lower = t.toLowerCase();
      if (!lower.includes(queryNorm)) {
        container.textContent = t;
        return;
      }

      container.textContent = '';

      let start = 0;
      while (true) {
        const idx = lower.indexOf(queryNorm, start);
        if (idx === -1) break;

        if (idx > start) container.appendChild(document.createTextNode(t.slice(start, idx)));

        const mark = document.createElement('span');
        mark.className = 'highlight';
        mark.textContent = t.slice(idx, idx + queryNorm.length);
        container.appendChild(mark);

        start = idx + queryNorm.length;
      }

      if (start < t.length) container.appendChild(document.createTextNode(t.slice(start)));
    }

    // For user-events we allow selecting ANY date within autumn semester.
    // (КАИ events are still shown by week grid, but additions can be on any day.)
    const addDateOptions = (() => {
      const y = Number(RAW_SCHEDULE.yearAssumption);
      if (!Number.isFinite(y)) return [];
      const startIso = y + '-09-01';
      const endIso = y + '-12-31';
      const start = new Date(startIso + 'T00:00:00Z');
      const end = new Date(endIso + 'T00:00:00Z');
      const res = [];
      for (let dt = new Date(start); dt <= end; dt.setUTCDate(dt.getUTCDate() + 1)) {
        res.push(dt.toISOString().slice(0, 10));
      }
      return res;
    })();

    // Baseline (original) schedule for computing "added/changed" diff exports.
    // We intentionally keep it unchanged even after loading edits from localStorage.
    const baselineEvents = events.map((e) => ({ ...e }));
    const baselineEventIdSet = new Set(baselineEvents.map((e) => e.eventId));

    function pad2(n) { return String(n).padStart(2, '0'); }
    function formatDDMM(iso){
      const d = new Date(iso + 'T00:00:00Z');
      return pad2(d.getUTCDate()) + '.' + pad2(d.getUTCMonth()+1);
    }
    function parseTimeToHour(time){
      const m = /^(\\d{1,2}):/.exec(String(time||''));
      return m ? Number(m[1]) : null;
    }

    function parseTimeToMinutes(time){
      const m = /^(\\d{1,2}):(\\d{2})$/.exec(String(time||''));
      if (!m) return null;
      return Number(m[1]) * 60 + Number(m[2]);
    }

    function minutesToTime(totalMinutes){
      const safe = Math.max(0, Number(totalMinutes) || 0);
      const h = Math.floor(safe / 60);
      const m = safe % 60;
      return pad2(h) + ':' + pad2(m);
    }

    function addMinutesToTime(time, deltaMinutes) {
      const start = parseTimeToMinutes(time);
      if (start === null) return String(time || '');
      return minutesToTime(start + (Number(deltaMinutes) || 0));
    }

    function floorHourTime(time){
      const mins = parseTimeToMinutes(time);
      if (mins === null) return String(time || '');
      return pad2(Math.floor(mins / 60)) + ':00';
    }

    function eventDurationMinutes(ev){
      const own = Number(ev?.durationMin);
      if (Number.isFinite(own) && own > 0) return own;
      return 90;
    }

    function eventEndTime(ev){
      const start = parseTimeToMinutes(ev?.time);
      if (start === null) return '';
      return minutesToTime(start + eventDurationMinutes(ev));
    }

    function hourOnly(time){
      const h = parseTimeToHour(time);
      return h === null ? String(time) : String(h);
    }

    function timeAxisLabel(time){
      const m = /^(\\d{1,2}):(\\d{2})$/.exec(String(time||''));
      if (!m) return String(time);
      const h = Number(m[1]);
      return h + ':00';
    }

    function isoMondayStart(isoDate) {
      const dt = new Date(isoDate + 'T00:00:00Z');
      const day = dt.getUTCDay(); // 0=Sun..6=Sat
      const diffToMonday = (day + 6) % 7; // Mon=0..Sun=6
      dt.setUTCDate(dt.getUTCDate() - diffToMonday);
      return dt.toISOString().slice(0, 10);
    }

    function weekLabel(weekStartIso) {
      const dtStart = new Date(weekStartIso + 'T00:00:00Z');
      const dtEnd = new Date(dtStart.getTime() + 6 * 24 * 60 * 60 * 1000);
      const fmt = (d) => pad2(d.getUTCDate()) + '.' + pad2(d.getUTCMonth()+1);
      return fmt(dtStart) + ' – ' + fmt(dtEnd);
    }

    function loadEdits() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return;
        const savedEvents = JSON.parse(saved);
        if (!Array.isArray(savedEvents)) return;
        const map = new Map(savedEvents.map((e) => [e.eventId, e]));
        events = events.map((e) => (map.has(e.eventId) ? { ...e, ...map.get(e.eventId) } : e));
      } catch {
        // ignore
      }
    }

    function persistEdits() {
      try {
        // Persist only KAИ-baseline events; user-added events are stored on disk via API.
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(events.filter((e) => baselineEventIdSet.has(e.eventId))),
        );
      } catch {
        // ignore
      }
    }

    loadEdits();

    // ---- KAИ deletions (separate from edits) ----
    // KAИ-bазовые события изменяются через localStorage, но для "удалить" нам нужно
    // помнить, какие baseline eventId выкинуть из рендера/экспорта.
    const DELETIONS_STORAGE_KEY =
      'kai-schedule-deletions:' +
      RAW_SCHEDULE.groupNumber +
      ':' +
      RAW_SCHEDULE.yearAssumption +
      ':' +
      RAW_SCHEDULE.semester +
      ':' +
      (RAW_SCHEDULE.generatedAt || '');

    let deletedKaiEventIds = new Set();

    function loadKaiDeletions() {
      try {
        const saved = localStorage.getItem(DELETIONS_STORAGE_KEY);
        if (!saved) return;
        const arr = JSON.parse(saved);
        if (!Array.isArray(arr)) return;
        const normalized = arr
          .map((x) => Number(x))
          .filter((x) => Number.isFinite(x));
        deletedKaiEventIds = new Set(normalized);
      } catch {
        // ignore
      }
    }

    function persistKaiDeletions() {
      try {
        localStorage.setItem(DELETIONS_STORAGE_KEY, JSON.stringify(Array.from(deletedKaiEventIds)));
      } catch {
        // ignore
      }
    }

    loadKaiDeletions();
    if (deletedKaiEventIds.size) {
      // Удаляем только KAИ-базовые события (user-события не трогаем).
      events = events.filter((e) => e?.source === 'user' || !deletedKaiEventIds.has(e.eventId));
    }

    // ---- User events (outside KAИ) via local API ----
    const userEventsFileName =
      'schedule-' +
      RAW_SCHEDULE.groupNumber +
      '-' +
      RAW_SCHEDULE.semester +
      '-' +
      RAW_SCHEDULE.yearAssumption +
      '-user-events.json';

    let userEvents = [];

    function normalizeUserEvent(ev) {
      const isoDate = ev?.isoDate;
      const time = ev?.time;
      if (!isoDate || !time) return null;

      const eventId = typeof ev?.eventId === 'number' ? ev.eventId : Number(ev?.eventId);
      const safeEventId = Number.isFinite(eventId) ? eventId : Date.now();

      return {
        eventId: safeEventId,
        source: 'user',
        isoDate,
        dateLabel: ev?.dateLabel || formatDDMM(isoDate),
        time,
        timeHour: parseTimeToHour(time),
        durationMin: Number(ev?.durationMin) > 0 ? Number(ev.durationMin) : 90,
        discipline: ev?.discipline || ev?.title || '',
        lessonType: ev?.lessonType || '',
        room: ev?.room || '',
        teacher: ev?.teacher || '',
        department: ev?.department || '',
      };
    }

    async function loadUserEvents() {
      try {
        const url = '/api/user-events?file=' + encodeURIComponent(userEventsFileName);
        const resp = await fetch(url, { method: 'GET' });
        if (!resp.ok) return;

        const saved = await resp.json();
        if (!Array.isArray(saved)) return;

        const normalized = saved.map(normalizeUserEvent).filter(Boolean);
        userEvents = normalized.filter((e) => !isPhysicalEducationEvent(e));

        // User events are additive; baseline events are untouched.
        events = events.concat(userEvents);
      } catch {
        // ignore (offline / server not running)
      }
    }

    async function persistUserEvents() {
      try {
        const resp = await fetch('/api/user-events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: userEventsFileName, events: userEvents }),
        });
        if (!resp.ok) return;
      } catch {
        // ignore
      }
    }

    // ---- Work events (generated) via separate local json ----
    // Stored in out/schedule-<group>-autumn-<year>-work-events.json
    const workEventsFileName =
      'schedule-' +
      RAW_SCHEDULE.groupNumber +
      '-' +
      RAW_SCHEDULE.semester +
      '-' +
      RAW_SCHEDULE.yearAssumption +
      '-work-events.json';

    let workEvents = [];

    async function loadWorkEvents() {
      try {
        const url = '/api/user-events?file=' + encodeURIComponent(workEventsFileName);
        const resp = await fetch(url, { method: 'GET' });
        if (!resp.ok) return;

        const saved = await resp.json();
        if (!Array.isArray(saved)) return;

        const normalized = saved.map(normalizeUserEvent).filter(Boolean);

        // Safety: keep only our generated work blocks.
        workEvents = normalized.filter((e) => e.department === DEPARTMENT.GENERATED_WORK);

        events = events.concat(workEvents);
      } catch {
        // ignore (offline / server not running)
      }
    }

    async function persistWorkEvents() {
      try {
        const resp = await fetch('/api/user-events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: workEventsFileName, events: workEvents }),
        });
        if (!resp.ok) return;
      } catch {
        // ignore
      }
    }

    function makeItSchoolEventForWeek(weekStartIso) {
      // Fixed “IT школа” for Monday: 18:30–20:00.
      // This event is ephemeral (not persisted) and used for display + work-slot validation.
      const isoDate = weekStartIso;
      const time = '18:30';
      const durationMin = 90;
      const eventId = -Number(String(isoDate).replace(/-/g, ''));

      return {
        eventId,
        source: 'user',
        isoDate,
        dateLabel: formatDDMM(isoDate),
        time,
        timeHour: parseTimeToHour(time),
        durationMin,
        discipline: 'IT школа',
        // Display as "НЕ ПАРА" (requested instead of "ПАРА"/"праа").
        lessonType: LESSON_TYPE.NONPAIR,
        room: '',
        teacher: '',
        department: DEPARTMENT.FIXED_IT_SCHOOL,
      };
    }

    function isProtectedUserEvent(ev) {
      return (
        ev?.department === DEPARTMENT.GENERATED_WORK ||
        ev?.department === DEPARTMENT.FIXED_IT_SCHOOL
      );
    }

    // ---- Modal editing ----
    const editOverlay = document.getElementById('editOverlay');
    const editCloseBtn = document.getElementById('editCloseBtn');
    const editCancelBtn = document.getElementById('editCancelBtn');
    const editSaveBtn = document.getElementById('editSaveBtn');
    const editDeleteBtn = document.getElementById('editDeleteBtn');

    let editingEventId = null;
    let editingDays = null;

    function showEditOverlay(show) {
      if (!editOverlay) return;
      editOverlay.style.display = show ? 'flex' : 'none';
    }

    function syncEditKindFields() {
      if (!editOverlay) return;

      const kind = editOverlay.querySelector('input[name="editKind"]:checked')?.value || 'pair';
      const isPair = kind === 'pair';

      const roomField = document.getElementById('editRoomField');
      const teacherField = document.getElementById('editTeacherField');
      const lessonTypeField = document.getElementById('editLessonTypeField');
      const timeSelectField = document.getElementById('editTimeSelectField');
      const timeInputField = document.getElementById('editTimeInputField');

      if (roomField) roomField.style.display = isPair ? 'flex' : 'none';
      if (teacherField) teacherField.style.display = isPair ? 'flex' : 'none';
      if (lessonTypeField) lessonTypeField.style.display = isPair ? 'flex' : 'none';
      if (timeSelectField) timeSelectField.style.display = isPair ? 'flex' : 'none';
      if (timeInputField) timeInputField.style.display = isPair ? 'none' : 'flex';

      const timeSel = document.getElementById('editTimeSelect');
      const timeInput = document.getElementById('editTimeInput');
      if (isPair && timeSel && timeInput?.value) {
        if (![...timeSel.options].some((opt) => opt.value === timeInput.value)) {
          const opt = document.createElement('option');
          opt.value = timeInput.value;
          opt.textContent = timeInput.value;
          timeSel.appendChild(opt);
        }
        timeSel.value = timeInput.value;
      }
      if (!isPair && timeInput && timeSel?.value) {
        timeInput.value = timeSel.value;
      }
    }

    function getEditStartTime() {
      const kind = editOverlay?.querySelector('input[name="editKind"]:checked')?.value || 'pair';
      return kind === 'pair'
        ? document.getElementById('editTimeSelect')?.value
        : document.getElementById('editTimeInput')?.value;
    }

    function fillPreviousPair(change) {
      const wrap = document.getElementById('editPrevious');
      const labelEl = document.getElementById('editPreviousLabel');
      const cardEl = document.getElementById('editPreviousCard');
      const noteEl = document.getElementById('editPreviousNote');
      const timeEl = document.getElementById('editPreviousTime');
      const discEl = document.getElementById('editPreviousDisc');
      const metaEl = document.getElementById('editPreviousMeta');
      if (!wrap) return;

      if (!change) {
        wrap.style.display = 'none';
        return;
      }

      wrap.style.display = 'block';

      if (change.kind === 'added' || !change.previous) {
        if (labelEl) labelEl.textContent = 'После перепарса';
        if (cardEl) cardEl.style.display = 'none';
        if (noteEl) {
          noteEl.style.display = 'block';
          noteEl.textContent = 'Новая пара — раньше в этом слоте её не было.';
        }
        return;
      }

      const prev = change.previous;
      if (labelEl) labelEl.textContent = 'Старый формат';
      if (cardEl) cardEl.style.display = 'block';
      if (noteEl) {
        noteEl.style.display = 'none';
        noteEl.textContent = '';
      }
      if (timeEl) {
        const datePart = prev.dateLabel || (prev.isoDate ? formatDDMM(prev.isoDate) : '');
        const timeRange = (prev.time || '') + (eventEndTime(prev) ? ' - ' + eventEndTime(prev) : '');
        timeEl.textContent = [datePart, timeRange].filter(Boolean).join(' · ');
      }
      if (discEl) discEl.textContent = prev.discipline || '';
      if (metaEl) metaEl.textContent = pairMetaText(prev);
    }

    function openEditor(eventId, days) {
      const ev = events.find((x) => x.eventId === eventId);
      if (!ev) return;
      editingEventId = eventId;
      editingDays = days;
      fillPreviousPair(getReparseChange(ev));

      const dateSel = document.getElementById('editDate');
      const timeSel = document.getElementById('editTimeSelect');
      const timeInput = document.getElementById('editTimeInput');
      const endInput = document.getElementById('editEndTime');

      dateSel.innerHTML = '';
      const dateOptions = addDateOptions.length ? addDateOptions : (days || []);
      for (const iso of dateOptions) {
        const opt = document.createElement('option');
        opt.value = iso;
        opt.textContent = formatDDMM(iso);
        dateSel.appendChild(opt);
      }
      if (ev.isoDate && !dateOptions.includes(ev.isoDate)) {
        const opt = document.createElement('option');
        opt.value = ev.isoDate;
        opt.textContent = ev.dateLabel || formatDDMM(ev.isoDate);
        dateSel.appendChild(opt);
      }
      dateSel.value = ev.isoDate;

      const evTime = ev.time ? String(ev.time) : '';
      if (timeSel) {
        timeSel.innerHTML = '';
        for (const t of times) {
          const opt = document.createElement('option');
          opt.value = t;
          opt.textContent = t;
          timeSel.appendChild(opt);
        }
        if (evTime && !times.includes(evTime)) {
          const opt = document.createElement('option');
          opt.value = evTime;
          opt.textContent = evTime;
          timeSel.appendChild(opt);
        }
        timeSel.value = evTime || times[0] || '';
      }
      if (timeInput) timeInput.value = evTime || times[0] || '08:00';
      if (endInput) endInput.value = eventEndTime(ev) || addMinutesToTime(evTime || times[0] || '08:00', 90);

      document.getElementById('editDiscipline').value = ev.discipline || '';
      document.getElementById('editRoom').value = ev.room || '';
      document.getElementById('editTeacher').value = ev.teacher || '';
      document.getElementById('editDepartment').value = ev.department || '';

      const evKind = isPairLike(ev) ? 'pair' : 'nonpair';
      const pairRadio = editOverlay.querySelector('input[name="editKind"][value="pair"]');
      const nonpairRadio = editOverlay.querySelector('input[name="editKind"][value="nonpair"]');
      if (pairRadio) pairRadio.checked = evKind === 'pair';
      if (nonpairRadio) nonpairRadio.checked = evKind === 'nonpair';

      const lessonTypeInput = document.getElementById('editLessonType');
      if (lessonTypeInput) {
        lessonTypeInput.value = evKind === 'pair' && ev.lessonType && ev.lessonType !== LESSON_TYPE.PAIR
          ? ev.lessonType
          : '';
      }

      syncEditKindFields();

      if (editDeleteBtn) editDeleteBtn.disabled = !!isProtectedUserEvent(ev);
      showEditOverlay(true);
    }

    async function saveEditor() {
      const ev = events.find((x) => x.eventId === editingEventId);
      if (!ev) return;

      const newIsoDate = document.getElementById('editDate').value;
      const newTime = getEditStartTime();
      const newEndTime = document.getElementById('editEndTime')?.value;

      ev.isoDate = newIsoDate;
      ev.dateLabel = formatDDMM(newIsoDate);
      ev.time = newTime;
      ev.timeHour = parseTimeToHour(newTime);
      ev.discipline = document.getElementById('editDiscipline').value;

      const startM = parseTimeToMinutes(newTime);
      const endM = parseTimeToMinutes(newEndTime);
      const duration = startM !== null && endM !== null ? endM - startM : eventDurationMinutes(ev);
      ev.durationMin = duration > 0 ? duration : 90;

      const kind = editOverlay.querySelector('input[name="editKind"]:checked')?.value || 'pair';
      const isPair = kind === 'pair';
      const typedLesson = (document.getElementById('editLessonType')?.value || '').trim();
      if (isPair) {
        ev.lessonType = typedLesson || LESSON_TYPE.PAIR;
      } else {
        ev.lessonType = LESSON_TYPE.NONPAIR;
      }

      ev.room = isPair ? document.getElementById('editRoom').value : '';
      ev.teacher = isPair ? document.getElementById('editTeacher').value : '';
      ev.department = document.getElementById('editDepartment').value;

      if (ev?.source === 'user') await persistUserEvents();
      else persistEdits();

      showEditOverlay(false);

      renderWeek(currentWeekStartIso);
    }

    async function deleteEditingEvent() {
      const ev = events.find((x) => x.eventId === editingEventId);
      if (!ev) return;
      if (isProtectedUserEvent(ev)) return;

      const ok = confirm('Удалить событие?');
      if (!ok) return;

      if (ev?.source === 'user') {
        userEvents = userEvents.filter((x) => x.eventId !== ev.eventId);
        events = events.filter((x) => x.eventId !== ev.eventId);
        await persistUserEvents();
      } else {
        deletedKaiEventIds.add(ev.eventId);
        persistKaiDeletions();
        events = events.filter((x) => x.eventId !== ev.eventId);
      }

      showEditOverlay(false);
      renderWeek(currentWeekStartIso);
    }

    if (editCloseBtn) editCloseBtn.addEventListener('click', () => showEditOverlay(false));
    if (editCancelBtn) editCancelBtn.addEventListener('click', () => showEditOverlay(false));
    if (editSaveBtn) editSaveBtn.addEventListener('click', saveEditor);
    if (editDeleteBtn) editDeleteBtn.addEventListener('click', deleteEditingEvent);
    if (editOverlay) {
      const radios = editOverlay.querySelectorAll('input[name="editKind"]');
      radios.forEach((r) => r.addEventListener('change', syncEditKindFields));

      const editTimeSelectEl = document.getElementById('editTimeSelect');
      const editTimeInputEl = document.getElementById('editTimeInput');
      const editEndTimeEl = document.getElementById('editEndTime');
      const syncEditEndTimeFromStart = () => {
        if (!editEndTimeEl) return;
        const startVal = getEditStartTime();
        if (!startVal) return;
        editEndTimeEl.value = addMinutesToTime(startVal, 90);
      };
      if (editTimeSelectEl) editTimeSelectEl.addEventListener('change', syncEditEndTimeFromStart);
      if (editTimeInputEl) editTimeInputEl.addEventListener('change', syncEditEndTimeFromStart);
    }
    if (editOverlay) {
      editOverlay.addEventListener('click', (e) => {
        if (e.target === editOverlay) showEditOverlay(false);
      });
    }

    // ---- Add user event modal ----
    const addOverlay = document.getElementById('addOverlay');
    const addCloseBtn = document.getElementById('addCloseBtn');
    const addCancelBtn = document.getElementById('addCancelBtn');
    const addSaveBtn = document.getElementById('addSaveBtn');
    const addEventBtn = document.getElementById('addEventBtn');

    let currentRenderedDays = null;

    function showAddOverlay(show) {
      if (!addOverlay) return;
      addOverlay.style.display = show ? 'flex' : 'none';
    }

    function syncAddKindFields() {
      if (!addOverlay) return;
      const kind = addOverlay.querySelector('input[name="addKind"]:checked')?.value;
      const isPair = kind === 'pair';

      const addRoomField = document.getElementById('addRoomField');
      const addTeacherField = document.getElementById('addTeacherField');
      const addTimeSelectField = document.getElementById('addTimeSelectField');
      const addTimeInputField = document.getElementById('addTimeInputField');

      if (addRoomField) addRoomField.style.display = isPair ? 'flex' : 'none';
      if (addTeacherField) addTeacherField.style.display = isPair ? 'flex' : 'none';
      if (addTimeSelectField) addTimeSelectField.style.display = isPair ? 'flex' : 'none';
      if (addTimeInputField) addTimeInputField.style.display = isPair ? 'none' : 'flex';
    }

    function openAddModal(days, initialIsoDate = null, initialTime = null) {
      if (!addOverlay) return;
      if (!Array.isArray(days) || !days.length) return;

      currentRenderedDays = days;

      const dateSel = document.getElementById('addDate');
      const timeSelect = document.getElementById('addTimeSelect');
      const timeInput = document.getElementById('addTimeInput');
      const titleInput = document.getElementById('addTitle');

      dateSel.innerHTML = '';
      for (const iso of addDateOptions) {
        const opt = document.createElement('option');
        opt.value = iso;
        opt.textContent = formatDDMM(iso);
        dateSel.appendChild(opt);
      }
      const defaultIso = initialIsoDate || days[0];
      if (addDateOptions.includes(defaultIso)) dateSel.value = defaultIso;
      else dateSel.value = addDateOptions[0] ?? '';

      if (timeSelect) {
        timeSelect.innerHTML = '';
        for (const t of times) {
          const opt = document.createElement('option');
          opt.value = t;
          opt.textContent = t;
          timeSelect.appendChild(opt);
        }
        const chosenTime = initialTime || times[0] || '08:00';
        if (chosenTime && !times.includes(chosenTime)) {
          const opt = document.createElement('option');
          opt.value = chosenTime;
          opt.textContent = chosenTime;
          timeSelect.appendChild(opt);
        }
        timeSelect.value = chosenTime;
      }

      if (timeInput) {
        timeInput.value = initialTime || times[0] || '08:00';
      }

      if (titleInput) titleInput.value = '';

      const pairRadio = addOverlay.querySelector('input[name="addKind"][value="pair"]');
      if (pairRadio) pairRadio.checked = true;

      // Google-like: "до" авто = "с" + 90 минут (по умолчанию).
      const startValue =
        (document.getElementById('addTimeSelect')?.value || document.getElementById('addTimeInput')?.value) ??
        times[0] ??
        '08:00';
      const endInput = document.getElementById('addEndTime');
      if (endInput && startValue) endInput.value = addMinutesToTime(startValue, 90);

      syncAddKindFields();
      showAddOverlay(true);
    }

    async function saveAddEvent() {
      if (!currentRenderedDays || !currentRenderedDays.length) return;

      const dateIso = document.getElementById('addDate')?.value;
      const title = (document.getElementById('addTitle')?.value || '').trim();
      const kind = addOverlay.querySelector('input[name="addKind"]:checked')?.value;
      const time =
        kind === 'pair'
          ? document.getElementById('addTimeSelect')?.value
          : document.getElementById('addTimeInput')?.value;
      const endTime = document.getElementById('addEndTime')?.value;

      if (!dateIso || !time || !endTime || !title) {
        return;
      }

      const lessonType = kind === 'pair' ? LESSON_TYPE.PAIR : LESSON_TYPE.NONPAIR;

      const roomValue = (document.getElementById('addRoom')?.value || '').trim();
      const teacherValue = (document.getElementById('addTeacher')?.value || '').trim();

      const newEvent = {
        eventId: Date.now() + Math.floor(Math.random() * 1000),
        source: 'user',
        isoDate: dateIso,
        dateLabel: formatDDMM(dateIso),
        time,
        timeHour: parseTimeToHour(time),
        durationMin: (() => {
          const startM = parseTimeToMinutes(time);
          const endM = parseTimeToMinutes(endTime);
          const d = startM !== null && endM !== null ? endM - startM : 90;
          return d > 0 ? d : 90;
        })(),
        discipline: title,
        lessonType,
        room: kind === 'pair' ? roomValue : '',
        teacher: kind === 'pair' ? teacherValue : '',
        department: '',
      };

      userEvents.push(newEvent);
      events.push(newEvent);

      await persistUserEvents();

      showAddOverlay(false);
      renderWeek(currentWeekStartIso);
    }

    if (addEventBtn) {
      addEventBtn.addEventListener('click', () => openAddModal(currentRenderedDays || []));
    }
    if (addCloseBtn) addCloseBtn.addEventListener('click', () => showAddOverlay(false));
    if (addCancelBtn) addCancelBtn.addEventListener('click', () => showAddOverlay(false));
    if (addSaveBtn) addSaveBtn.addEventListener('click', saveAddEvent);
    if (addOverlay) {
      const radios = addOverlay.querySelectorAll('input[name="addKind"]');
      radios.forEach((r) => r.addEventListener('change', syncAddKindFields));

      const addTimeSelectEl = document.getElementById('addTimeSelect');
      const addTimeInputEl = document.getElementById('addTimeInput');
      const addEndTimeEl = document.getElementById('addEndTime');

      const syncEndTimeFromStart = () => {
        if (!addEndTimeEl) return;
        const kind = addOverlay.querySelector('input[name="addKind"]:checked')?.value;
        const startVal = kind === 'pair' ? addTimeSelectEl?.value : addTimeInputEl?.value;
        if (!startVal) return;
        addEndTimeEl.value = addMinutesToTime(startVal, 90);
      };

      if (addTimeSelectEl) addTimeSelectEl.addEventListener('change', syncEndTimeFromStart);
      if (addTimeInputEl) addTimeInputEl.addEventListener('change', syncEndTimeFromStart);

      addOverlay.addEventListener('click', (e) => {
        if (e.target === addOverlay) showAddOverlay(false);
      });
    }

    // ---- Week navigation (current week + arrow keys) ----
    function pickInitialWeekIndex() {
      if (!weekStarts.length) return 0;
      const todayIso = new Date().toISOString().slice(0, 10);
      const thisWeek = isoMondayStart(todayIso);

      let idx = weekStarts.indexOf(thisWeek);
      if (idx !== -1) return idx;

      // pick nearest week by absolute date distance
      const target = new Date(thisWeek + 'T00:00:00Z').getTime();
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < weekStarts.length; i++) {
        const d = Math.abs(new Date(weekStarts[i] + 'T00:00:00Z').getTime() - target);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      return bestIdx;
    }

    let weekIndex = pickInitialWeekIndex();
    let currentWeekStartIso = weekStarts[weekIndex];

    const prevWeekBtn = document.getElementById('prevWeekBtn');
    const nextWeekBtn = document.getElementById('nextWeekBtn');
    if (prevWeekBtn) {
      prevWeekBtn.addEventListener('click', () => {
        if (weekIndex > 0) {
          weekIndex -= 1;
          renderWeek(weekStarts[weekIndex]);
        }
      });
    }
    if (nextWeekBtn) {
      nextWeekBtn.addEventListener('click', () => {
        if (weekIndex < weekStarts.length - 1) {
          weekIndex += 1;
          renderWeek(weekStarts[weekIndex]);
        }
      });
    }

    function renderWeek(weekStartIso) {
      currentWeekStartIso = weekStartIso;
      const HOUR_HEIGHT = 72;

      const weekStart = new Date(weekStartIso + 'T00:00:00Z');
      const days = Array.from({length: 7}, (_,i) => {
        const d = new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000);
        return d.toISOString().slice(0, 10);
      });
      const todayIso = new Date().toISOString().slice(0, 10);

      currentRenderedDays = days;

      const eventsInWeek = events.filter(e => e.isoDate >= days[0] && e.isoDate <= days[6]);
      const itSchoolEvent = makeItSchoolEventForWeek(weekStartIso);
      eventsInWeek.push(itSchoolEvent);
      const startMinutesList = eventsInWeek
        .map((e) => parseTimeToMinutes(e.time))
        .filter((x) => x !== null);

      const endMinutesList = eventsInWeek
        .map((e) => {
          const start = parseTimeToMinutes(e.time);
          if (start === null) return null;
          return start + eventDurationMinutes(e);
        })
        .filter((x) => x !== null);

      const fallbackStarts = (times ?? [])
        .map((t) => parseTimeToMinutes(t))
        .filter((x) => x !== null);

      const allStarts = startMinutesList.length ? startMinutesList : fallbackStarts;
      const minStart = allStarts.length ? Math.min(...allStarts) : 8 * 60;
      const maxEnd = endMinutesList.length ? Math.max(...endMinutesList) : 18 * 60;
      const gridStartHour = Math.floor(minStart / 60);
      const gridEndHour = Math.max(gridStartHour + 1, Math.ceil(maxEnd / 60));
      const hourRows = [];
      for (let h = gridStartHour; h <= gridEndHour; h++) {
        hourRows.push(pad2(h) + ':00');
      }

      const eventsByKey = new Map();
      for (const e of eventsInWeek) {
        const key = e.isoDate + '|' + floorHourTime(e.time);
        if (!eventsByKey.has(key)) eventsByKey.set(key, []);
        eventsByKey.get(key).push(e);
      }

      const grid = document.getElementById('grid');
      grid.innerHTML = '';

      const table = document.createElement('table');

      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      const thTime = document.createElement('th');
      thTime.textContent = 'Время';
      headRow.appendChild(thTime);

      for (let i=0;i<7;i++){
        const th = document.createElement('th');
        if (days[i] === todayIso) th.className = 'todayTh';
        th.innerHTML = DAY_NAMES[i] + '<br/>' + formatDDMM(days[i]);
        headRow.appendChild(th);
      }
      thead.appendChild(headRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      for (const t of hourRows) {
        const tr = document.createElement('tr');

        const tdTime = document.createElement('td');
        tdTime.className = 'timeCell';
        tdTime.textContent = timeAxisLabel(t);
        tr.appendChild(tdTime);

        for (let di=0; di<7; di++){
          const td = document.createElement('td');
          td.className = 'dayCell' + (days[di] === todayIso ? ' todayCell' : '');
          td.title = 'Клик: добавить событие в этот слот';

          const key = days[di] + '|' + t;
          const cellEvents = eventsByKey.get(key) ?? [];
          const cellEventsForRender = searchQueryNorm
            ? cellEvents.filter((ev) => matchesDisciplineNorm(ev, searchQueryNorm))
            : cellEvents;

          const cardsWrap = document.createElement('div');
          cardsWrap.className = 'cards';

          // Stable sort: by lessonType then discipline.
          cellEventsForRender.sort((a,b) => {
            const am = parseTimeToMinutes(a.time) ?? 0;
            const bm = parseTimeToMinutes(b.time) ?? 0;
            if (am !== bm) return am - bm;
            return (a.discipline || '').localeCompare(b.discipline || '');
          });

          for (const e of cellEventsForRender) {
            const card = document.createElement('div');
            card.className = 'card';
            if (e.department === DEPARTMENT.GENERATED_WORK) card.classList.add('cardWork');
            if (e.department === DEPARTMENT.FIXED_IT_SCHOOL) card.classList.add('cardItSchool');
            if (e.lessonType === LESSON_TYPE.PAIR) card.classList.add('cardPair');
            if (e.lessonType === LESSON_TYPE.NONPAIR) card.classList.add('cardNonPair');
            const reparseChange = getReparseChange(e);
            if (reparseChange) card.classList.add('cardChanged');
            const isUser = e.source === 'user';
            const isProtected = isProtectedUserEvent(e);
            const canEdit = !isProtected;
            card.style.cursor = canEdit ? 'pointer' : 'default';
            card.title = isProtected
              ? 'Служебное событие'
              : reparseChange?.kind === 'changed'
                ? 'Изменилась после перепарса. Клик: старый формат'
                : reparseChange?.kind === 'added'
                  ? 'Новая пара после перепарса'
                  : isUser
                    ? 'Клик: редактировать/удалить'
                    : 'Клик: редактировать';
            const startMinutes = parseTimeToMinutes(e.time) ?? parseTimeToMinutes(t) ?? 0;
            const baseMinutes = parseTimeToMinutes(t) ?? 0;
            const offsetMinutes = Math.max(0, startMinutes - baseMinutes);
            const heightPx = Math.max(40, Math.round((eventDurationMinutes(e) / 60) * HOUR_HEIGHT) - 4);
            card.style.position = 'absolute';
            card.style.left = '4px';
            card.style.right = '4px';
            card.style.top = Math.round((offsetMinutes / 60) * HOUR_HEIGHT) + 'px';
            card.style.minHeight = heightPx + 'px';
            card.style.zIndex = isUser ? '3' : '2';

            const timeLine = document.createElement('div');
            timeLine.className = 'cardTime';
            timeLine.textContent = (e.time || '') + ' - ' + eventEndTime(e);

            const disc = document.createElement('div');
            disc.className = 'disc';
            renderHighlightedText(disc, normalizeDisplayText(e.discipline || ''), searchQueryNorm);

            const meta = document.createElement('div');
            meta.className = 'meta';
            meta.textContent = pairMetaText(e);

            card.appendChild(timeLine);
            card.appendChild(disc);
            card.appendChild(meta);
            if (canEdit) {
              card.addEventListener('click', (ev) => {
                ev.stopPropagation();
                openEditor(e.eventId, days);
              });
            }

            cardsWrap.appendChild(card);
          }

          td.addEventListener('click', () => openAddModal(days, days[di], t));
          td.appendChild(cardsWrap);
          tr.appendChild(td);
        }

        tbody.appendChild(tr);
      }

      table.appendChild(tbody);
      grid.appendChild(table);

      const weekTitle = document.getElementById('weekTitle');
      if (weekTitle) weekTitle.textContent = weekLabel(weekStartIso);
    }

    // ---- Search input (discipline) ----
    const searchInputEl = document.getElementById('searchInput');
    const clearSearchBtnEl = document.getElementById('clearSearchBtn');

    if (searchInputEl) {
      const apply = () => {
        searchQuery = searchInputEl.value;
        searchQueryNorm = normalizeSearchQuery(searchQuery);
        if (currentWeekStartIso) renderWeek(currentWeekStartIso);
      };

      searchInputEl.addEventListener('input', apply);

      if (clearSearchBtnEl) {
        clearSearchBtnEl.addEventListener('click', () => {
          searchInputEl.value = '';
          searchQuery = '';
          searchQueryNorm = '';
          if (currentWeekStartIso) renderWeek(currentWeekStartIso);
          searchInputEl.focus();
        });
      }
    }

    const moreMenu = document.getElementById('moreMenu');
    const moreMenuBtn = document.getElementById('moreMenuBtn');
    if (moreMenu && moreMenuBtn) {
      const setOpen = (open) => {
        moreMenu.classList.toggle('isOpen', open);
        moreMenuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      };
      moreMenuBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        setOpen(!moreMenu.classList.contains('isOpen'));
      });
      moreMenu.addEventListener('click', (ev) => ev.stopPropagation());
      moreMenu.querySelectorAll('.menuItem').forEach((item) => {
        item.addEventListener('click', () => setOpen(false));
      });
      document.addEventListener('click', () => setOpen(false));
      document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') setOpen(false);
      });
    }

    // ---- Google Calendar export (.ics) ----
    const googleCalendarBtn = document.getElementById('googleCalendarBtn');
    const googleExportOverlay = document.getElementById('googleExportOverlay');
    const googleExportCloseBtn = document.getElementById('googleExportCloseBtn');
    const googleExportCancelBtn = document.getElementById('googleExportCancelBtn');
    const googleExportWeekBtn = document.getElementById('googleExportWeekBtn');
    const googleExportSemesterBtn = document.getElementById('googleExportSemesterBtn');

    function showGoogleExportOverlay(show) {
      if (!googleExportOverlay) return;
      googleExportOverlay.style.display = show ? 'flex' : 'none';
    }

    function formatIcsDateTime(isoDate, time) {
      const m = /^(\\d{2}):(\\d{2})$/.exec(String(time || ''));
      if (!m) return null;
      return String(isoDate || '').replace(/-/g, '') + 'T' + m[1] + m[2] + '00';
    }

    function escapeIcsText(value) {
      return String(value || '')
        .replace(/\\\\/g, '\\\\\\\\')
        .replace(/;/g, '\\\\;')
        .replace(/,/g, '\\\\,')
        .replace(/\\r?\\n/g, '\\\\n');
    }

    function foldIcsLine(line) {
      const text = String(line || '');
      if (text.length <= 75) return text;
      const parts = [];
      for (let i = 0; i < text.length; i += 75) {
        const chunk = text.slice(i, i + 75);
        parts.push(i === 0 ? chunk : ' ' + chunk);
      }
      return parts.join('\\r\\n');
    }

    function downloadTextFile(filename, content, mimeType) {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 500);
    }

    function uniqueEventsById(list) {
      const seen = new Set();
      const out = [];
      for (const ev of list) {
        const key = String(ev?.eventId ?? '') + '|' + String(ev?.isoDate ?? '') + '|' + String(ev?.time ?? '');
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(ev);
      }
      return out;
    }

    function getCurrentWeekEventsForExport() {
      if (!currentWeekStartIso) return [];
      const days = daysForWeek(currentWeekStartIso);
      const inWeek = events.filter((e) => e.isoDate >= days[0] && e.isoDate <= days[6]);
      inWeek.push(makeItSchoolEventForWeek(currentWeekStartIso));
      return uniqueEventsById(inWeek);
    }

    function getSemesterEventsForExport() {
      const semesterEvents = [...events];
      for (const weekStartIso of weekStarts) {
        semesterEvents.push(makeItSchoolEventForWeek(weekStartIso));
      }
      return uniqueEventsById(semesterEvents);
    }

    function abbreviateDisciplineTitle(value) {
      const original = String(value || '').trim();
      if (!original) return 'Событие';

      const words = original
        .split(/[\\s,/().:-]+/)
        .map((part) => part.trim())
        .filter(Boolean);

      const stopWords = new Set(['и', 'в', 'во', 'на', 'по', 'с', 'со', 'для', 'of', 'the', 'a', 'an']);
      const significant = words.filter((word) => !stopWords.has(word.toLowerCase()));

      if (!significant.length) return original;
      if (significant.length === 1) return original;

      const abbreviation = significant
        .map((word) => {
          const upper = word.toUpperCase();
          return upper[0] || '';
        })
        .join('');

      if (abbreviation.length >= 2 && abbreviation.length <= 12) return abbreviation;
      return original;
    }

    function normalizeDisplayText(value) {
      return String(value || '')
        .replace(/\bЛ\.\s*р\.\b/giu, 'ЛАБА')
        .replace(/\bЛ\.р\.(?=\s|$)/giu, 'ЛАБА')
        .trim();
    }

    function normalizeLessonTypeDisplay(value) {
      const original = String(value || '').trim();
      if (!original) return '';
      if (/^л\.\s*р\.$/iu.test(original) || /^л\.р\.$/iu.test(original)) {
        return 'ЛАБА';
      }
      return normalizeDisplayText(original);
    }

    function buildIcsEvent(ev) {
      const start = formatIcsDateTime(ev?.isoDate, ev?.time);
      const end = formatIcsDateTime(ev?.isoDate, eventEndTime(ev));
      if (!start || !end) return null;

      const fullDiscipline = normalizeDisplayText(ev?.discipline || 'Событие');
      const lessonTypeLabel = normalizeLessonTypeDisplay(ev?.lessonType);
      const isItSchool = ev?.department === DEPARTMENT.FIXED_IT_SCHOOL;
      const lessonTypeLabelForOutput =
        ev?.department === DEPARTMENT.GENERATED_WORK || isItSchool ? '' : lessonTypeLabel;
      const shortDiscipline =
        ev?.department === DEPARTMENT.GENERATED_WORK || isItSchool
          ? fullDiscipline
          : abbreviateDisciplineTitle(fullDiscipline);
      const summary = escapeIcsText(
        lessonTypeLabelForOutput
          ? shortDiscipline + ' · ' + lessonTypeLabelForOutput
          : shortDiscipline,
      );
      const descriptionParts = [];
      if (fullDiscipline) descriptionParts.push('Название: ' + fullDiscipline);
      if (lessonTypeLabelForOutput) descriptionParts.push('Тип: ' + lessonTypeLabelForOutput);
      if (ev?.teacher) descriptionParts.push('Преподаватель: ' + ev.teacher);
      if (Array.isArray(ev?.kaiOtherDates) && ev.kaiOtherDates.length) {
        descriptionParts.push('Другие даты: ' + ev.kaiOtherDates.join(', '));
      }
      const description = escapeIcsText(descriptionParts.join('\\n'));
      const location = escapeIcsText(ev?.room || '');
      const uid = escapeIcsText(
        'kai-schedule-' +
          String(RAW_SCHEDULE.groupNumber) +
          '-' +
          String(ev?.eventId ?? Date.now()) +
          '-' +
          String(ev?.isoDate ?? '') +
          '-' +
          String(ev?.time ?? '') +
          '@local',
      );
      const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\\.\\d{3}Z$/, 'Z');

      return [
        'BEGIN:VEVENT',
        foldIcsLine('UID:' + uid),
        'DTSTAMP:' + stamp,
        'DTSTART;TZID=Europe/Moscow:' + start,
        'DTEND;TZID=Europe/Moscow:' + end,
        foldIcsLine('SUMMARY:' + summary),
        ...(description ? [foldIcsLine('DESCRIPTION:' + description)] : []),
        ...(location ? [foldIcsLine('LOCATION:' + location)] : []),
        'END:VEVENT',
      ].join('\\r\\n');
    }

    function buildIcsCalendar(exportEvents, calendarName = 'Расписание') {
      const sorted = [...exportEvents].sort((a, b) => {
        const aKey = String(a?.isoDate || '') + ' ' + String(a?.time || '');
        const bKey = String(b?.isoDate || '') + ' ' + String(b?.time || '');
        return aKey.localeCompare(bKey);
      });

      const vevents = sorted.map(buildIcsEvent).filter(Boolean);
      return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//kai-schedule-visual//Google Calendar Export//RU',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:' + escapeIcsText(calendarName),
        'X-WR-TIMEZONE:Europe/Moscow',
        ...vevents,
        'END:VCALENDAR',
        '',
      ].join('\\r\\n');
    }

    function exportEventsToGoogleCalendar(scope) {
      const exportEvents = scope === 'week' ? getCurrentWeekEventsForExport() : getSemesterEventsForExport();
      if (!exportEvents.length) {
        alert('Нет событий для экспорта.');
        return;
      }

      const filenameSuffix = scope === 'week' ? 'google-calendar-week' : 'google-calendar-semester';
      const filename =
        'schedule-' +
        RAW_SCHEDULE.groupNumber +
        '-' +
        RAW_SCHEDULE.semester +
        '-' +
        RAW_SCHEDULE.yearAssumption +
        '-' +
        filenameSuffix +
        '.ics';

      downloadTextFile(filename, buildIcsCalendar(exportEvents, 'Расписание'), 'text/calendar;charset=utf-8');
      showGoogleExportOverlay(false);
    }

    if (googleCalendarBtn) {
      googleCalendarBtn.addEventListener('click', () => showGoogleExportOverlay(true));
    }
    if (googleExportCloseBtn) googleExportCloseBtn.addEventListener('click', () => showGoogleExportOverlay(false));
    if (googleExportCancelBtn) googleExportCancelBtn.addEventListener('click', () => showGoogleExportOverlay(false));
    if (googleExportWeekBtn) {
      googleExportWeekBtn.addEventListener('click', () => exportEventsToGoogleCalendar('week'));
    }
    if (googleExportSemesterBtn) {
      googleExportSemesterBtn.addEventListener('click', () => exportEventsToGoogleCalendar('semester'));
    }
    if (googleExportOverlay) {
      googleExportOverlay.addEventListener('click', (e) => {
        if (e.target === googleExportOverlay) showGoogleExportOverlay(false);
      });
    }

    // Initial load: user events + generated work events.
    if (currentWeekStartIso) renderWeek(currentWeekStartIso);
    const initialLoadPromise = (async () => {
      await loadUserEvents();
      await loadWorkEvents();
      if (currentWeekStartIso) renderWeek(currentWeekStartIso);
    })();

    document.addEventListener('keydown', (ev) => {
      if (!weekStarts.length) return;
      // If modal open - do not move weeks.
      const editOpen =
        editOverlay && editOverlay.style.display && editOverlay.style.display !== 'none';
      const addOpen =
        addOverlay && addOverlay.style.display && addOverlay.style.display !== 'none';
      if (editOpen || addOpen) return;

      if (ev.key === 'ArrowLeft') {
        if (weekIndex > 0) {
          weekIndex -= 1;
          renderWeek(weekStarts[weekIndex]);
        }
      } else if (ev.key === 'ArrowRight') {
        if (weekIndex < weekStarts.length - 1) {
          weekIndex += 1;
          renderWeek(weekStarts[weekIndex]);
        }
      }
    });

    // ---- Export edited JSON ----
    function downloadJson(filename, data) {
      downloadTextFile(filename, JSON.stringify(data, null, 2), 'application/json');
    }

    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const filenameEdited =
          'schedule-' + RAW_SCHEDULE.groupNumber + '-' + RAW_SCHEDULE.semester + '-' + RAW_SCHEDULE.yearAssumption + '-edited.json';
        downloadJson(filenameEdited, events);

        // Second file: only events that differ from the original baseline.
        const changedEvents = events.filter((ev) => {
          const base = baselineEvents.find((b) => b.eventId === ev.eventId);
          if (!base) return true;
          return [
            'isoDate',
            'time',
            'discipline',
            'lessonType',
            'room',
            'teacher',
            'department',
          ].some((k) => (base[k] ?? '') !== (ev[k] ?? ''));
        });

        const filenameAdded =
          'schedule-' + RAW_SCHEDULE.groupNumber + '-' + RAW_SCHEDULE.semester + '-' + RAW_SCHEDULE.yearAssumption + '-added.json';
        downloadJson(filenameAdded, changedEvents);

        // Third file: KAИ deletions (for completeness of diff export).
        const deletedEvents = baselineEvents.filter((b) => deletedKaiEventIds.has(b.eventId));
        const filenameDeleted =
          'schedule-' + RAW_SCHEDULE.groupNumber + '-' + RAW_SCHEDULE.semester + '-' + RAW_SCHEDULE.yearAssumption + '-deleted.json';
        downloadJson(filenameDeleted, deletedEvents);
      });
    }

    const reparseBtn = document.getElementById('reparseBtn');
    if (reparseBtn) {
      reparseBtn.addEventListener('click', async () => {
        const originalLabel = reparseBtn.textContent;
        reparseBtn.disabled = true;
        reparseBtn.textContent = 'Обновляю...';
        try {
          const resp = await fetch('/api/reparse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              group: RAW_SCHEDULE.groupNumber,
              year: RAW_SCHEDULE.yearAssumption,
            }),
          });
          const data = await resp.json().catch(() => ({}));
          if (!resp.ok) {
            throw new Error(data.error || 'Не удалось перепарсить расписание');
          }
          location.reload();
        } catch (e) {
          reparseBtn.disabled = false;
          reparseBtn.textContent = originalLabel;
          alert(e?.message || String(e));
        }
      });
    }

    // ---- Work hours (generated) ----
    const calcWorkBtn = document.getElementById('calcWorkBtn');
    const clearWorkBtn = document.getElementById('clearWorkBtn');
    const workCalcStatusEl = document.getElementById('workCalcStatus');

    function setWorkCalcStatus(text) {
      if (!workCalcStatusEl) return;
      workCalcStatusEl.textContent = String(text || '');
    }

    const WORK_SLOT_MINUTES = 30;
    const MIN_WORK_SESSION_MINUTES = 2 * 60;
    const MIN_WORK_SESSION_BLOCKS = MIN_WORK_SESSION_MINUTES / WORK_SLOT_MINUTES;
    const WORK_START_MINUTES = 9 * 60; // 09:00
    const WORK_END_MINUTES = 20 * 60; // finish by 20:00
    const MAX_WORK_PER_DAY_MINUTES = 9 * 60; // hard daily burnout cap
    // Сколько минут “запаса” закладываем на дорогу между занятиями и работой.
    // Уменьшено, чтобы слот 11:30 не пропадал, когда вы реально успеваете.
    const COMMUTE_BUFFER_MINUTES = 10;
    const PREFERRED_START_MINUTES = Math.round(
      (WORK_START_MINUTES + (WORK_END_MINUTES - WORK_SLOT_MINUTES)) / 2,
    ); // ~14:15

    function clearGeneratedWorkEventsFromState() {
      workEvents = [];
      events = events.filter((e) => e.department !== DEPARTMENT.GENERATED_WORK);
    }

    function daysForWeek(weekStartIso) {
      const weekStart = new Date(weekStartIso + 'T00:00:00Z');
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000);
        return d.toISOString().slice(0, 10);
      });
    }

    function eventStartMinutes(ev) {
      return parseTimeToMinutes(ev?.time);
    }

    function eventEndMinutes(ev) {
      const s = eventStartMinutes(ev);
      if (s === null) return null;
      return s + eventDurationMinutes(ev);
    }

    function slotOverlapsForbidden(slotStartMin, slotEndMin, forbiddenIntervals) {
      for (const interval of forbiddenIntervals) {
        const forbidStart = interval[0];
        const forbidEnd = interval[1];
        if (slotStartMin < forbidEnd && slotEndMin > forbidStart) return true;
      }
      return false;
    }

    function buildForbiddenByDay(days, occupiedEvents) {
      const map = new Map();
      for (const dayIso of days) map.set(dayIso, []);

      for (const ev of occupiedEvents) {
        if (!ev?.isoDate) continue;
        if (!map.has(ev.isoDate)) continue;
        const startMin = eventStartMinutes(ev);
        if (startMin === null) continue;
        const endMin = startMin + eventDurationMinutes(ev);
        const forbidStart = startMin - COMMUTE_BUFFER_MINUTES;
        const forbidEnd = endMin + COMMUTE_BUFFER_MINUTES;
        map.get(ev.isoDate).push([forbidStart, forbidEnd]);
      }
      return map;
    }

    function buildCandidateSessionStarts(validStarts) {
      const set = new Set(validStarts);
      return validStarts.filter((start) => {
        for (let i = 1; i < MIN_WORK_SESSION_BLOCKS; i++) {
          if (!set.has(start + i * WORK_SLOT_MINUTES)) return false;
        }
        return true;
      });
    }

    function pickBestSessionStart(validStarts, assignedStarts) {
      const candidates = buildCandidateSessionStarts(validStarts);
      if (!candidates.length) return null;

      // Prefer extending the latest sequence by another full 2h block.
      if (assignedStarts.length) {
        const assignedMax = Math.max(...assignedStarts);
        const extend = assignedMax + WORK_SLOT_MINUTES;
        const neededStart = extend;
        let canExtend = true;
        for (let i = 0; i < MIN_WORK_SESSION_BLOCKS; i++) {
          if (!validStarts.includes(neededStart + i * WORK_SLOT_MINUTES)) {
            canExtend = false;
            break;
          }
        }
        if (canExtend) return neededStart;
      }

      // Otherwise: choose the earliest valid session start.
      // This matches the expectation "если успеваю к 11:30, ставь с 11:30".
      return Math.min(...candidates);
    }

    function removeSessionFromStarts(validStarts, chosenStart) {
      for (let i = 0; i < MIN_WORK_SESSION_BLOCKS; i++) {
        const chosen = chosenStart + i * WORK_SLOT_MINUTES;
        const idx = validStarts.indexOf(chosen);
        if (idx !== -1) validStarts.splice(idx, 1);
      }
      return validStarts;
    }

    function mergeSlotsToEvents(dayIso, slotStarts, nextEventId) {
      const slots = Array.from(slotStarts).sort((a, b) => a - b);
      if (!slots.length) return { events: [], nextEventId };

      const eventsOut = [];
      let seqStart = slots[0];
      let seqEnd = slots[0];

      const pushSeq = () => {
        const durationMin = seqEnd - seqStart + WORK_SLOT_MINUTES;
        const time = minutesToTime(seqStart);
        eventsOut.push({
          eventId: nextEventId++,
          source: 'user',
          isoDate: dayIso,
          dateLabel: formatDDMM(dayIso),
          time,
          timeHour: parseTimeToHour(time),
          durationMin,
          discipline: WORK_DISCIPLINE,
          lessonType: LESSON_TYPE.WORK,
          room: '',
          teacher: '',
          department: DEPARTMENT.GENERATED_WORK,
        });
      };

      for (let i = 1; i < slots.length; i++) {
        const prev = slots[i - 1];
        const cur = slots[i];
        if (cur === prev + WORK_SLOT_MINUTES) {
          seqEnd = cur;
          continue;
        }
        pushSeq();
        seqStart = cur;
        seqEnd = cur;
      }
      pushSeq();

      return { events: eventsOut, nextEventId };
    }

    function generateWorkEventsForWeek(weekStartIso, targetBlocksPerWeek, nextEventIdRef) {
      const days = daysForWeek(weekStartIso);
      const weekOccupied = events.filter(
        (e) =>
          e.isoDate >= days[0] &&
          e.isoDate <= days[6] &&
          e.department !== DEPARTMENT.GENERATED_WORK,
      );
      // Add fixed IT school for slot validation.
      weekOccupied.push(makeItSchoolEventForWeek(weekStartIso));

      const forbiddenByDay = buildForbiddenByDay(days, weekOccupied);

      const validStartsByDayIndex = Array(7)
        .fill(null)
        .map(() => []);

      const candidateStarts = [];
      for (let start = WORK_START_MINUTES; start <= WORK_END_MINUTES - WORK_SLOT_MINUTES; start += WORK_SLOT_MINUTES) {
        candidateStarts.push(start);
      }

      // Mon..Sat only (Sun is always 0).
      for (let dayIndex = 0; dayIndex <= 5; dayIndex++) {
        const dayIso = days[dayIndex];
        const forbids = forbiddenByDay.get(dayIso) ?? [];
        const valid = [];
        for (const s of candidateStarts) {
          const slotStartMin = s;
          const slotEndMin = s + WORK_SLOT_MINUTES;
          if (!slotOverlapsForbidden(slotStartMin, slotEndMin, forbids)) valid.push(s);
        }
        validStartsByDayIndex[dayIndex] = valid;
      }

      // Greedy even distribution across Mon..Fri, remainder into Sat.
      const assignedSlotsByDayIndex = Array(7)
        .fill(null)
        .map(() => []);

      let remaining = targetBlocksPerWeek;
      const monFriIdx = [0, 1, 2, 3, 4];
      while (remaining >= MIN_WORK_SESSION_BLOCKS) {
        let bestDay = null;
        let bestAssigned = Infinity;
        for (const di of monFriIdx) {
          const assigned = assignedSlotsByDayIndex[di].length;
          const hasSession = buildCandidateSessionStarts(validStartsByDayIndex[di]).length > 0;
          if (!hasSession) continue;
          if (assigned * WORK_SLOT_MINUTES >= MAX_WORK_PER_DAY_MINUTES) continue;
          if (assigned < bestAssigned) {
            bestAssigned = assigned;
            bestDay = di;
          }
        }

        if (bestDay === null) break;

        const chosen = pickBestSessionStart(validStartsByDayIndex[bestDay], assignedSlotsByDayIndex[bestDay]);
        if (chosen === null) break;
        removeSessionFromStarts(validStartsByDayIndex[bestDay], chosen);
        for (let i = 0; i < MIN_WORK_SESSION_BLOCKS; i++) {
          assignedSlotsByDayIndex[bestDay].push(chosen + i * WORK_SLOT_MINUTES);
        }
        remaining -= MIN_WORK_SESSION_BLOCKS;
      }

      // Saturday remainder only
      while (remaining >= MIN_WORK_SESSION_BLOCKS && validStartsByDayIndex[5].length) {
        if (assignedSlotsByDayIndex[5].length * WORK_SLOT_MINUTES >= MAX_WORK_PER_DAY_MINUTES) {
          break;
        }
        const chosen = pickBestSessionStart(validStartsByDayIndex[5], assignedSlotsByDayIndex[5]);
        if (chosen === null) break;
        removeSessionFromStarts(validStartsByDayIndex[5], chosen);
        for (let i = 0; i < MIN_WORK_SESSION_BLOCKS; i++) {
          assignedSlotsByDayIndex[5].push(chosen + i * WORK_SLOT_MINUTES);
        }
        remaining -= MIN_WORK_SESSION_BLOCKS;
      }

      // Convert chosen slots to work events.
      const eventsOut = [];
      for (let di = 0; di <= 5; di++) {
        const dayIso = days[di];
        const mergeRes = mergeSlotsToEvents(dayIso, assignedSlotsByDayIndex[di], nextEventIdRef.value);
        nextEventIdRef.value = mergeRes.nextEventId;
        eventsOut.push(...mergeRes.events);
      }

      const assignedBlocks = targetBlocksPerWeek - remaining;
      return { events: eventsOut, assignedBlocks };
    }

    function generateWorkEventsForSemester(targetHoursPerWeek) {
      const rawTargetBlocksPerWeek = Math.floor((Number(targetHoursPerWeek) * 60) / WORK_SLOT_MINUTES);
      const targetBlocksPerWeek =
        Math.floor(rawTargetBlocksPerWeek / MIN_WORK_SESSION_BLOCKS) * MIN_WORK_SESSION_BLOCKS;
      const nextEventIdRef = { value: Date.now() };

      let totalTargetBlocks = 0;
      let totalAssignedBlocks = 0;
      const out = [];

      for (const weekStartIso of weekStarts) {
        totalTargetBlocks += targetBlocksPerWeek;
        const res = generateWorkEventsForWeek(weekStartIso, targetBlocksPerWeek, nextEventIdRef);
        totalAssignedBlocks += res.assignedBlocks;
        out.push(...res.events);
      }

      return { events: out, totalTargetBlocks, totalAssignedBlocks };
    }

    async function runGenerateWork() {
      await initialLoadPromise;

      const targetHoursInput = document.getElementById('workTargetHours');
      const targetHours = Number(targetHoursInput?.value ?? 30);
      if (!Number.isFinite(targetHours) || targetHours <= 0) {
        setWorkCalcStatus('Укажите корректные часы/неделю.');
        return;
      }

      if (calcWorkBtn) calcWorkBtn.disabled = true;
      if (clearWorkBtn) clearWorkBtn.disabled = true;

      try {
        setWorkCalcStatus('Считаю рабочие часы...');

        // Remove previously generated work (if any).
        clearGeneratedWorkEventsFromState();

        const targetBlocksPerWeek = Math.floor((targetHours * 60) / WORK_SLOT_MINUTES);
        if (targetBlocksPerWeek < MIN_WORK_SESSION_BLOCKS) {
          setWorkCalcStatus('Недостаточно часов для генерации: минимум 2 часа за сессию.');
          return;
        }

        const res = generateWorkEventsForSemester(targetHours);

        workEvents = res.events;
        events = events.concat(workEvents);

        await persistWorkEvents();

        if (currentWeekStartIso) renderWeek(currentWeekStartIso);

        const assignedHours = (res.totalAssignedBlocks * WORK_SLOT_MINUTES) / 60;
        const targetHoursTotal = (res.totalTargetBlocks * WORK_SLOT_MINUTES) / 60;
        const diffHours = targetHoursTotal - assignedHours;

        const roundedHoursPerWeek =
          (Math.floor(targetBlocksPerWeek / MIN_WORK_SESSION_BLOCKS) * MIN_WORK_SESSION_BLOCKS * WORK_SLOT_MINUTES) / 60;

        if (diffHours > 0.01) {
          setWorkCalcStatus(
            'Добавлено: ' +
              assignedHours.toFixed(1) +
              'ч (цель: ' +
              targetHoursTotal.toFixed(1) +
              'ч, недобор: ' +
              diffHours.toFixed(1) +
              'ч)',
          );
        } else if (Math.abs(roundedHoursPerWeek - targetHours) > 0.01) {
          setWorkCalcStatus(
            'Добавлено: ' +
              assignedHours.toFixed(1) +
              'ч (округлено до полных 2ч-сессий: ' +
              roundedHoursPerWeek.toFixed(1) +
              'ч/нед)',
          );
        } else {
          setWorkCalcStatus('Добавлено: ' + assignedHours.toFixed(1) + 'ч (всё ок)');
        }
      } finally {
        if (calcWorkBtn) calcWorkBtn.disabled = false;
        if (clearWorkBtn) clearWorkBtn.disabled = false;
      }
    }

    async function runClearWork() {
      await initialLoadPromise;

      if (calcWorkBtn) calcWorkBtn.disabled = true;
      if (clearWorkBtn) clearWorkBtn.disabled = true;

      try {
        clearGeneratedWorkEventsFromState();
        await persistWorkEvents();
        if (currentWeekStartIso) renderWeek(currentWeekStartIso);
        setWorkCalcStatus('Рабочие часы очищены.');
      } finally {
        if (calcWorkBtn) calcWorkBtn.disabled = false;
        if (clearWorkBtn) clearWorkBtn.disabled = false;
      }
    }

    if (calcWorkBtn) calcWorkBtn.addEventListener('click', () => runGenerateWork());
    if (clearWorkBtn) clearWorkBtn.addEventListener('click', () => runClearWork());
  </script>
</body>
</html>`;

  await fs.writeFile(outHtmlPath, html, "utf-8");
  return { outHtmlPath, groupNumber, year };
}

async function main() {
  const groupNumber = getArgValue("--group", "4319");
  const year = Number(getArgValue("--year", "2026"));
  const result = await renderSchedulePage({ groupNumber, year });
  console.log(`Saved HTML: ${result.outHtmlPath}`);
}

if (isMainModule(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
