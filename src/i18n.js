document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.i18n').forEach(element => {
      const messageKey = element.getAttribute('data-i18n');
      element.textContent = chrome.i18n.getMessage(messageKey);
    });
  });