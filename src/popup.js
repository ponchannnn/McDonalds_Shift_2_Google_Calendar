document.getElementById("sync").addEventListener("click", async () => {
    let token = await getGoogleAuthToken();
    chrome.runtime.sendMessage({ action: "addShiftsToCalendar", token });
  });
  
  async function getGoogleAuthToken() {
    return new Promise((resolve) => {
      chrome.identity.getAuthToken({ interactive: true }, token => resolve(token));
    });
  }

  function convertDate(dateStr) {
    const [monthDay, dayOfWeek] = dateStr.split('(');
    const [month, day] = monthDay.split('/').map(Number);
    const currentYear = new Date().getFullYear();
    const currentDate = new Date(Date.UTC(currentYear, month - 1, day));
  const nextYearDate = new Date(Date.UTC(currentYear + 1, month - 1, day));
  const previousYearDate = new Date(Date.UTC(currentYear - 1, month - 1, day));
  
    const closestYearDate = [currentDate, nextYearDate, previousYearDate].reduce((a, b) => {
      return Math.abs(a - new Date()) < Math.abs(b - new Date()) ? a : b;
    });
  
    return closestYearDate.toISOString().split('T')[0];
  }

  function formatTime(timeStr) {
    if (!timeStr || timeStr.length !== 4) {
      console.error("Invalid time format:", timeStr);
      return null;
    }
    const hour = timeStr.slice(0, 2);
    const minute = timeStr.slice(2);
    return `${hour}:${minute}`;
  }

  document.getElementById("fetch").addEventListener("click", async () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      const urlPattern = /^https:\/\/mcdcrew\.jp\/MyPage\/schedule\/setting\/edit\/.*$/;

      if (!urlPattern.test(tab.url)) {
        alert("この拡張機能は、指定されたURLパターンでのみ動作します。");
        return;
      }

      console.log("Sending message to content script");

        chrome.tabs.sendMessage(tabs[0].id, { action: "getHTML" }, (response) => {

          if (!response || !response.html) {
            console.error("No response or HTML content");
            return;
          }

          const html = response.html;
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const shifts = [];
    
          const rows = doc.querySelectorAll('table tbody tr');
          rows.forEach((row, index) => {
            // 最初の行（ヘッダー行）をスキップ
            if (index === 0) return;

            const dateStr = row.cells[0].textContent.trim();
            const date = convertDate(dateStr);
            
            // 時間1の取得
            let start1, end1;
            const time1Cell = row.cells[3];
            const time1InputStart = time1Cell.querySelector('input[name*="start_time_1"]');
            const time1InputEnd = time1Cell.querySelector('input[name*="end_time_1"]');
            if (time1InputStart && time1InputEnd) {
              start1 = time1InputStart.value;
              end1 = time1InputEnd.value;
            } else {
              const time1Text = time1Cell.textContent.trim().split('〜');
              start1 = time1Text[0].trim();
              end1 = time1Text[1].trim();
            }

            // 時間2の取得
            let start2, end2;
            const time2Cell = row.cells[4];
            const time2InputStart = time2Cell.querySelector('input[name*="start_time_2"]');
            const time2InputEnd = time2Cell.querySelector('input[name*="end_time_2"]');
            if (time2InputStart && time2InputEnd) {
              start2 = time2InputStart.value;
              end2 = time2InputEnd.value;
            } else {
              const time2Text = time2Cell.textContent.trim().split('〜');
              start2 = time2Text[0].trim();
              end2 = time2Text[1].trim();
            }
    
            if (start1 && end1 && start1 !== 'OFF' && end1 !== 'OFF') {
              start1 = formatTime(start1);
              end1 = formatTime(end1);
              shifts.push({ date, start: start1, end: end1 });
            }
            if (start2 && end2 && start2 !== 'OFF' && end2 !== 'OFF') {
              start2 = formatTime(start2);
              end2 = formatTime(end2);
              shifts.push({ date, start: start2, end: end2 });
            }
          });
          
          displayShifts(shifts);
        });
      });
  });

function displayShifts(shifts) {
  const container = document.getElementById('shiftsContainer');
  container.innerHTML = ''; // 前の内容をクリア

  shifts.forEach((shift, index) => {
    const shiftDiv = document.createElement('div');
    shiftDiv.className = 'shift';
    shiftDiv.textContent = `${shift.date}: ${shift.start} - ${shift.end}`;

    const syncButton = document.createElement('button');
    syncButton.textContent = '追加';
    syncButton.addEventListener('click', () => syncShift(shift, syncButton));

    shiftDiv.appendChild(syncButton);
    container.appendChild(shiftDiv);
  });

  // 一括入力ボタンを追加
  const syncAllButton = document.createElement('button');
  syncAllButton.id = 'syncAll';
  syncAllButton.textContent = '一括追加';
  syncAllButton.addEventListener('click', async () => {
    let token = await getGoogleAuthToken();
    shifts.forEach(shift => {
      const shiftDiv = Array.from(document.querySelectorAll('.shift')).find(shiftDiv => 
        shiftDiv.textContent.includes(`${shift.date}: ${shift.start} - ${shift.end}`)
      );
      if (shiftDiv) {
        const button = shiftDiv.querySelector('button');
        if (button && button.disabled) {
          // 既に追加済みのシフトはスキップ
          return;
        }
      }
      chrome.runtime.sendMessage({ action: "addShiftsToCalendar", token, shift }, (response) => {
        if (response.success) {
          if (shiftDiv) {
            const button = shiftDiv.querySelector('button');
            if (button) {
              button.textContent = '追加済み';
              button.disabled = true;
            }
          }
        }
        updateSyncAllButtonState();
      });
    });
  });

  container.appendChild(syncAllButton);
  updateSyncAllButtonState();
}

function syncShift(shift, button) {
  getGoogleAuthToken().then(token => {
    chrome.runtime.sendMessage({ action: "addShiftsToCalendar", token, shift }, (response) => {
      if (response.success) {
        button.textContent = '追加済み';
        button.disabled = true;
        updateSyncAllButtonState();
      }
    });
  });
}

function updateSyncAllButtonState() {
  const syncAllButton = document.getElementById('syncAll');
  const allShifts = document.querySelectorAll('.shift');
  const allAdded = Array.from(allShifts).every(shiftDiv => {
    const button = shiftDiv.querySelector('button');
    return button && button.disabled;
  });

  syncAllButton.disabled = allAdded;
}