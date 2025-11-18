chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "addShiftsToCalendar") {
    (async () => {
      try {
        const shift = request.shift;
        const token = await getGoogleAuthToken();
        const config = await chrome.storage.sync.get(['calendarTitle', 'calendarColor']);

        const calendarTitle = config.calendarTitle || "Mcdonald's予定日";
        const calendarColor = config.calendarColor || 1;

        const [year, month, day] = shift.date.split('-').map(Number);
        const [sHour, sMin] = shift.start.split(':').map(Number);
        const startDate = new Date(year, month - 1, day, sHour, sMin);

        const [eHour, eMin] = shift.end.split(':').map(Number);
        let endDate = new Date(year, month - 1, day, eHour, eMin);

        // 終了時刻が開始時刻より前の場合は「翌日」とみなす
        if (endDate < startDate) {
          endDate.setDate(endDate.getDate() + 1);
        }

        const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            summary: calendarTitle,
            start: {
              dateTime: toLocalISOString(startDate),
              timeZone: 'Asia/Tokyo'
            },
            end: {
              dateTime: toLocalISOString(endDate),
              timeZone: 'Asia/Tokyo'
            },
            colorId: calendarColor
          })
        });

        if (!response.ok) {
          throw new Error(`API Error: ${response.status} ${await response.text()}`);
        }

        const eventData = await response.json();

        const shiftKey = `${shift.date}-${shift.start}-${shift.end}`;
        const { storedShifts } = await storage.get("storedShifts");
        const newStoredShifts = storedShifts || {};
        newStoredShifts[shiftKey] = eventData.id;
        await storage.set({ storedShifts: newStoredShifts });

        sendResponse({ success: true, data: eventData });

      } catch (error) {
        console.error("Error in addShiftsToCalendar:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true;
  }

  if (request.action === "deleteShiftFromCalendar") {
    (async () => {
      try {
        const { eventId, shiftKey } = request;
        if (!eventId || !shiftKey) {
          throw new Error("eventId or shiftKey is missing");
        }

        const token = await getGoogleAuthToken();

        const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (!response.ok && response.status !== 404 && response.status !== 410) {
          throw new Error(`API Error: ${response.status} ${await response.text()}`);
        }

        const { storedShifts } = await storage.get("storedShifts");
        if (storedShifts && storedShifts[shiftKey]) {
          delete storedShifts[shiftKey];
          await storage.set({ storedShifts: storedShifts });
        }

        sendResponse({ success: true });

      } catch (error) {
        console.error("Error in deleteShiftFromCalendar:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    return true;
  }

  if (request.action === "getStoredShifts") {
    (async () => {
      const { storedShifts } = await storage.get("storedShifts");
      sendResponse(storedShifts || {});
    })();
    
    return true;
  }

  if (request.action === "showPopup") {
    chrome.action.openPopup();
  }
});

async function getGoogleAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(token);
      }
    });
  });
}

const storage = {
  get: (keys) => new Promise((resolve) => chrome.storage.local.get(keys, (result) => resolve(result))),
  set: (items) => new Promise((resolve) => chrome.storage.local.set(items, () => resolve())),
};

function toLocalISOString(date) {
  const pad = (num) => num.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}