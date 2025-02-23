chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "addShiftsToCalendar") {
      const shift = request.shift;
console.log(JSON.stringify({
  summary: "マクドナルド予定日",
  start: { 
    dateTime: `${shift.date}T${shift.start}:00`,
    timeZone: 'Asia/Tokyo'
   },
  end: { 
    dateTime: `${shift.date}T${shift.end}:00`,
    timeZone: 'Asia/Tokyo'
   },
  colorId: 1
}))
      fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${request.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          summary: "マクドナルド予定日",
          start: { 
            dateTime: `${shift.date}T${shift.start}:00`,
            timeZone: 'Asia/Tokyo'
           },
          end: { 
            dateTime: `${shift.date}T${shift.end}:00`,
            timeZone: 'Asia/Tokyo'
           },
          colorId: 1
        })
      })
      .then(response => response.json())
    .then(data => {
      sendResponse({ success: true, data });
    })
    .catch(error => {
      sendResponse({ success: false, error });
    });

    // Return true to indicate that the response will be sent asynchronously
    return true;
    }
  });