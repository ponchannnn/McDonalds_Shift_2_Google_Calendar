async function getGoogleAuthToken(interactive = true) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(token);
      }
    });
  });
}

async function getUserInfo(token) {
  const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
}

window.onload = async () => {
  // ユーザー情報の取得と表示
  try {
    const token = await getGoogleAuthToken();
    if (!token) {
      document.getElementById('userInfo').textContent = chrome.i18n.getMessage('noUserLoggedIn');
      return;
    } else {
      const userInfo = await getUserInfo(token);
      document.getElementById('userInfo').textContent = `${userInfo.name}`;
    }
  } catch (error) {
    console.error("Error getting user info:", error);
  }

  // 保存された設定の読み込み
  chrome.storage.sync.get(['calendarTitle', 'calendarColor'], (data) => {
    document.getElementById('calendarTitle').value = data.calendarTitle || '';
    document.getElementById('calendarColor').value = data.calendarColor || '1';
  });
};


document.getElementById('switchAccountBtn').addEventListener('click', () => {
  chrome.identity.getAuthToken({ 'interactive': false }, function(current_token) {
    if (!chrome.runtime.lastError && current_token) {
      // Chromeのキャッシュからトークンを削除
      chrome.identity.removeCachedAuthToken({ token: current_token }, function() {
        // Googleのサーバー上でも無効化（念のため）
        fetch('https://accounts.google.com/o/oauth2/revoke?token=' + current_token)
          .then(() => {
            window.close();
          });
      });
    } else {
      document.getElementById('statusMessage').textContent = chrome.i18n.getMessage("notLoggedIn");
    }
  });
});

const form = document.getElementById('settingsForm');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const calendarTitle = form.calendarTitle.value;
      const calendarColor = form.calendarColor.value;
      chrome.storage.sync.set({ calendarTitle, calendarColor }, () => {
        statusMessage.textContent = chrome.i18n.getMessage("settingsSaved");
      });
    });