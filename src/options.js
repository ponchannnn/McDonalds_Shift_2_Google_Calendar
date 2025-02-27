document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('settingsForm');
    const statusMessage = document.getElementById('statusMessage');
  
    // Load saved settings
    chrome.storage.sync.get(['calendarTitle', 'calendarColor'], (result) => {
        form.calendarTitle.value = result.calendarTitle || "マクドナルド予定日";
        form.calendarColor.value = result.calendarColor || 1;
      });
  
    // Save settings
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const calendarTitle = form.calendarTitle.value;
      const calendarColor = form.calendarColor.value;
      chrome.storage.sync.set({ calendarTitle, calendarColor }, () => {
        statusMessage.textContent = chrome.i18n.getMessage("settingsSaved");
        setTimeout(() => {
          statusMessage.textContent = '';
        }, 3000);
      });
    });
  });