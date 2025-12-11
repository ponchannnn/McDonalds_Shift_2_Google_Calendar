window.onload = function() {
  let currentYear = parseInt(getYearFromUrl() || new Date().getFullYear().toString(), 10);

  // background から保存済みシフト一覧を取得
  chrome.runtime.sendMessage({ action: "getStoredShifts" }, (storedShiftsMap) => {
    const storedShifts = storedShiftsMap || {};
    const shiftButtons = new Map();

    const rows = document.querySelectorAll('table tbody tr');

    let previousMonth = -1;

    rows.forEach(row => {
      const dateCell = row.cells[0];
      if (!dateCell) return;

      const dateTextRaw = dateCell.textContent.trim();
      const dateMatch = dateTextRaw.match(/(\d{1,2})\/(\d{1,2})/);
      if (!dateMatch) return;

      const month = parseInt(dateMatch[1], 10);
      const day = parseInt(dateMatch[2], 10);

      // 今12月で、前の行の月より小さい場合、年を繰り上げ
      if (previousMonth === 12 && month === 1) {
        currentYear++;
      }
      previousMonth = month;

      // padStart(2, '0') で 11/1 -> 11/01 にする
      const dateText = `${currentYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

      const isInputMode = row.querySelector('input[type="text"]') !== null;

      if (isInputMode) {
        handleOpenScheduleRow(row, dateText, storedShifts, shiftButtons);
      } else {
        handleClosedScheduleRow(row, dateText, storedShifts, shiftButtons);
      }
    });

    // 一括追加ボタンの表示
    addMcdBulkAddButton(shiftButtons);
  });
};

/**
 * URLから年を取得する関数
 * 例: .../edit/2025-12-01 -> 2025
 */
function getYearFromUrl() {
  const url = window.location.href;
  const match = url.match(/edit\/(\d{4})-\d{2}-\d{2}/);
  return match ? match[1] : null;
}

/**
 * マクドナルド形式の時間 (1700) を (17:00) に変換
 * 無効な場合は null を返す
 */
function formatMcTime(rawTime) {
  if (!rawTime) return null;
  const trimmed = rawTime.trim();
  // 4桁の数字かチェック
  if (!/^\d{4}$/.test(trimmed)) return null;

  const hour = trimmed.substring(0, 2);
  const minute = trimmed.substring(2, 4);
  return `${hour}:${minute}`;
}

function updateMcButtonState(buttonElement, state, context = {}) {
  const newButton = buttonElement.cloneNode(true);
  if (buttonElement.parentNode) {
    buttonElement.parentNode.replaceChild(newButton, buttonElement);
  }
  buttonElement = newButton;

  const { eventId, shiftButtons } = context;
  const { date, start, end, key } = buttonElement.dataset;

  buttonElement.style.display = 'block';
  buttonElement.style.width = '100%';
  buttonElement.style.marginTop = '4px';
  buttonElement.style.fontSize = '11px';
  buttonElement.style.padding = '2px 0';
  buttonElement.style.border = 'none';
  buttonElement.style.borderRadius = '3px';
  buttonElement.style.cursor = 'pointer';
  buttonElement.style.color = 'white';
  switch (state) {
    case 'disabled':
      buttonElement.textContent = chrome.i18n.getMessage('addToCalendarButtonText');
      buttonElement.style.backgroundColor = '#ccc';
      buttonElement.style.pointerEvents = 'none';
      buttonElement.disabled = true;
      if (shiftButtons) shiftButtons.delete(key);
      break;

    case 'ready':
      buttonElement.textContent = chrome.i18n.getMessage('addToCalendarButtonText');
      buttonElement.style.backgroundColor = '#007bff';
      buttonElement.style.pointerEvents = 'auto';
      buttonElement.disabled = false;
      buttonElement.addEventListener('click', () => handleMcAddToCalendar(buttonElement, shiftButtons));
      if (shiftButtons) shiftButtons.set(key, buttonElement);
      break;

    case 'adding':
      buttonElement.textContent = chrome.i18n.getMessage('adding');
      buttonElement.style.backgroundColor = '#6c757d';
      buttonElement.style.pointerEvents = 'none';
      break;

    case 'delete':
      buttonElement.textContent = chrome.i18n.getMessage('deleteFromCalendarButtonText');
      buttonElement.style.backgroundColor = '#dc3545';
      buttonElement.style.pointerEvents = 'auto';
      buttonElement.disabled = false;
      buttonElement.dataset.eventId = eventId;
      buttonElement.addEventListener('click', () => handleMcDeleteFromCalendar(buttonElement, shiftButtons));
      if (shiftButtons) shiftButtons.delete(key);
      break;

    case 'deleting':
      buttonElement.textContent = chrome.i18n.getMessage('deleting');
      buttonElement.style.backgroundColor = '#6c757d';
      buttonElement.style.pointerEvents = 'none';
      break;
  }
  return buttonElement;
}

/**
 * 【確定モード】締め切られたシフトの処理
 * テキストから時間を読み取り、ボタンを表示
 */
function handleClosedScheduleRow(row, dateText, storedShifts, shiftButtons) {
  const timeCells = [row.cells[3], row.cells[4]]; // 時間1, 時間2

  timeCells.forEach((cell, index) => {
    if (!cell) return;
    const text = cell.textContent.trim();

    const [startRaw, endRaw] = text.split('〜').map(s => s.trim());
    const startTime = formatMcTime(startRaw);
    const endTime = formatMcTime(endRaw);

    if (startTime && endTime) {
      const shiftKey = `${dateText}`;
      const existingEventId = storedShifts[shiftKey];

      const btn = document.createElement('button');
      cell.appendChild(btn);

      btn.dataset.date = dateText;
      btn.dataset.start = startTime;
      btn.dataset.end = endTime;
      btn.dataset.key = shiftKey;

      if (existingEventId) {
        updateMcButtonState(btn, 'delete', { eventId: existingEventId, shiftButtons });
      } else {
        updateMcButtonState(btn, 'ready', { shiftButtons });
      }
    }
  });
}

/**
 * 【入力モード】入力中のシフトの処理
 */
function handleOpenScheduleRow(row, dateText, storedShifts, shiftButtons) {
  const timeCells = [row.cells[3], row.cells[4]];

  timeCells.forEach((cell, index) => {
    if (!cell) return;
    const inputs = cell.querySelectorAll('input[type="text"]');
    if (inputs.length !== 2) return;

    const startInput = inputs[0];
    const endInput = inputs[1];

    let btn = document.createElement('button');
    cell.appendChild(btn);

    const validateAndToggle = () => {
      const startTime = formatMcTime(startInput.value);
      const endTime = formatMcTime(endInput.value);
      btn.dataset.date = dateText;
      btn.dataset.start = startTime || "";
      btn.dataset.end = endTime || "";
      btn.dataset.key = `${dateText}-${startTime}-${endTime}`;

      const shiftKey = btn.dataset.key;
      const existingEventId = storedShifts[shiftKey];

      if (existingEventId) {
        btn = updateMcButtonState(btn, 'delete', { eventId: existingEventId, shiftButtons });
      } else if (startTime && endTime) {
        btn = updateMcButtonState(btn, 'ready', { shiftButtons });
      } else {
        btn = updateMcButtonState(btn, 'disabled', { shiftButtons });
      }
    };

    startInput.addEventListener('input', validateAndToggle);
    endInput.addEventListener('input', validateAndToggle);
    startInput.addEventListener('blur', validateAndToggle); // ペースト対策
    endInput.addEventListener('blur', validateAndToggle);

    // 初回実行
    validateAndToggle();
  });
}

/** API送信処理 (非同期) */
async function handleMcAddToCalendar(buttonElement, shiftButtons) {
  const { date, start, end } = buttonElement.dataset;
  const shift = { date, start, end }; // dateはYYYY-MM-DD
  
  let currentButton = updateMcButtonState(buttonElement, 'adding');

  try {
    const response = await sendMessageAsync({ action: "addShiftsToCalendar", shift });
    updateMcButtonState(currentButton, 'delete', { eventId: response.data.id, shiftButtons });
  } catch (error) {
    console.error(error);
    alert(chrome.i18n.getMessage('addShiftFailed'));
    updateMcButtonState(currentButton, 'ready', { shiftButtons });
  }
}

/** 削除処理 (非同期) */
async function handleMcDeleteFromCalendar(buttonElement, shiftButtons) {
  const { eventId, key } = buttonElement.dataset;
  let currentButton = updateMcButtonState(buttonElement, 'deleting');

  try {
    await sendMessageAsync({ action: "deleteShiftFromCalendar", eventId, shiftKey: key });
    updateMcButtonState(currentButton, 'ready', { shiftButtons });
  } catch (error) {
    alert(chrome.i18n.getMessage('deleteShiftFailed'));
    updateMcButtonState(currentButton, 'delete', { eventId, shiftButtons });
  }
}

/** ヘルパー: sendMessageをPromise化*/
function sendMessageAsync(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      if (response && response.success) resolve(response);
      else reject(response ? response.error : "Unknown error");
    });
  });
}

/** マクドナルド用一括追加ボタン */
function addMcdBulkAddButton(shiftButtons) {
  const bulkAddDiv = document.createElement('div');
  bulkAddDiv.textContent = chrome.i18n.getMessage('bulkAddButtonText');
  bulkAddDiv.className = 'btn btn-success';

  // bulkAddDiv.style.margin = '10px auto';
  bulkAddDiv.style.cursor = 'pointer';
  bulkAddDiv.style.textAlign = 'center';
  bulkAddDiv.style.borderRadius = '4px';
  bulkAddDiv.style.width = '200px';
  bulkAddDiv.style.padding = '10px';
  bulkAddDiv.style.display = 'block';
  bulkAddDiv.style.backgroundColor = '#28a745';
  bulkAddDiv.style.color = 'white';
  bulkAddDiv.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
  bulkAddDiv.style.fontWeight = 'bold';

  bulkAddDiv.addEventListener('click', async function() {
    const buttonsToProcess = Array.from(shiftButtons.values());
    const total = buttonsToProcess.length;

    if (total === 0) {
      alert(chrome.i18n.getMessage('allShiftsAdded'));
      return;
    }

    bulkAddDiv.style.backgroundColor = '#6c757d';
    let successCount = 0;

    for (let i = 0; i < total; i++) {
      const btn = buttonsToProcess[i];
      bulkAddDiv.textContent = `${chrome.i18n.getMessage('adding')} (${i + 1}/${total})`;

      const { date, start, end } = btn.dataset;
      const shift = { date, start, end };

      try {
        let currentBtn = updateMcButtonState(btn, 'adding');
        const response = await sendMessageAsync({ action: "addShiftsToCalendar", shift });
        updateMcButtonState(currentBtn, 'delete', { eventId: response.data.id, shiftButtons });
        successCount++;
      } catch (e) {
        console.error(e);
        updateMcButtonState(btn, 'ready', { shiftButtons });
      }
    }

    if (successCount === total) {
        bulkAddDiv.textContent = chrome.i18n.getMessage('allShiftsAdded');
    } else {
        bulkAddDiv.textContent = chrome.i18n.getMessage('bulkAddResultFormat', [successCount, total]);
        bulkAddDiv.style.backgroundColor = '#28a745';
    }
  });

  const table = document.querySelector('table');
  if (table) {
    table.parentNode.insertBefore(bulkAddDiv, table);
  }
}