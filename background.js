/** ------------------------------------------
 * Mục đích: Service Worker xử lý logic auto-refresh cho Chrome Extension
 * Quản lý các alarm timers, trạng thái refresh cho từng tab
 * @author NVMANH with Antigravity
 * @created 09/05/2026 03:49
 */

// -------------------------------------------------------
// State management - lưu trữ thông tin refresh cho các tab
// -------------------------------------------------------
let refreshStates = {};

/** ------------------------------------------
 * Mục đích: Tính thời gian ngẫu nhiên trong khoảng [min, max] giây
 * @param {number} min - Thời gian tối thiểu (giây)
 * @param {number} max - Thời gian tối đa (giây)
 * @returns {number} Thời gian ngẫu nhiên tính bằng giây
 */
function getRandomInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** ------------------------------------------
 * Mục đích: Lên lịch refresh tiếp theo cho một tab cụ thể
 * @param {number} tabId - ID của tab cần refresh
 * @param {number} minSeconds - Thời gian tối thiểu (giây)
 * @param {number} maxSeconds - Thời gian tối đa (giây)
 */
function scheduleNextRefresh(tabId, minSeconds, maxSeconds) {
  const delaySeconds = getRandomInterval(minSeconds, maxSeconds);
  const nextRefreshAt = Date.now() + delaySeconds * 1000;

  // Lưu thông tin vào state
  refreshStates[tabId] = {
    ...refreshStates[tabId],
    nextRefreshAt,
    delaySeconds,
    active: true,
  };

  // Tạo alarm với tên unique cho tab
  const alarmName = `refresh_tab_${tabId}`;
  chrome.alarms.create(alarmName, {
    delayInMinutes: delaySeconds / 60,
  });

  // Lưu state vào storage để popup đọc được
  saveStatesToStorage();
}

/** ------------------------------------------
 * Mục đích: Bắt đầu auto-refresh cho một tab
 * @param {number} tabId - ID của tab
 * @param {number} minSeconds - Thời gian tối thiểu (giây)
 * @param {number} maxSeconds - Thời gian tối đa (giây)
 * @param {string} tabUrl - URL của tab (để hiển thị)
 * @param {string} tabTitle - Title của tab
 */
function startRefresh(tabId, minSeconds, maxSeconds, tabUrl, tabTitle) {
  // Hủy alarm cũ nếu có
  chrome.alarms.clear(`refresh_tab_${tabId}`);

  refreshStates[tabId] = {
    tabId,
    tabUrl,
    tabTitle,
    minSeconds,
    maxSeconds,
    active: true,
    refreshCount: 0,
    startedAt: Date.now(),
  };

  scheduleNextRefresh(tabId, minSeconds, maxSeconds);
  updateIcon(tabId, true);
}

/** ------------------------------------------
 * Mục đích: Dừng auto-refresh cho một tab
 * @param {number} tabId - ID của tab cần dừng
 */
function stopRefresh(tabId) {
  chrome.alarms.clear(`refresh_tab_${tabId}`);

  if (refreshStates[tabId]) {
    refreshStates[tabId].active = false;
    refreshStates[tabId].nextRefreshAt = null;
  }

  saveStatesToStorage();
  updateIcon(tabId, false);
}

/** ------------------------------------------
 * Mục đích: Cập nhật badge icon trên extension button
 * @param {number} tabId - ID của tab
 * @param {boolean} isActive - Trạng thái đang chạy hay không
 */
function updateIcon(tabId, isActive) {
  if (isActive) {
    chrome.action.setBadgeText({ text: "ON", tabId });
    chrome.action.setBadgeBackgroundColor({ color: "#00e5ff", tabId });
    chrome.action.setBadgeTextColor({ color: "#0a0a1a", tabId });
  } else {
    chrome.action.setBadgeText({ text: "", tabId });
  }
}

/** ------------------------------------------
 * Mục đích: Lưu refreshStates vào chrome.storage để popup đọc được
 */
function saveStatesToStorage() {
  chrome.storage.local.set({ refreshStates });
}

/** ------------------------------------------
 * Mục đích: Load refreshStates từ chrome.storage khi service worker khởi động lại
 */
async function loadStatesFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["refreshStates"], (result) => {
      if (result.refreshStates) {
        refreshStates = result.refreshStates;
      }
      resolve();
    });
  });
}

// -------------------------------------------------------
// Event Listeners
// -------------------------------------------------------

/** ------------------------------------------
 * Mục đích: Xử lý khi alarm được kích hoạt (đến lúc refresh)
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith("refresh_tab_")) return;

  const tabId = parseInt(alarm.name.replace("refresh_tab_", ""));

  // Load state từ storage (vì service worker có thể bị reset)
  await loadStatesFromStorage();

  const state = refreshStates[tabId];
  if (!state || !state.active) return;

  try {
    // Lấy thông tin tab hiện tại để có URL mới nhất
    const tab = await chrome.tabs.get(tabId);

    // Sử dụng tabs.update thay vì reload để tránh lỗi "Confirm Form Resubmission" 
    // khi trang web được nạp bằng phương thức POST (ví dụ sau khi gửi form).
    // Điều này giúp quá trình auto-refresh diễn ra mượt mà không bị ngắt quãng bởi hộp thoại hệ thống.
    await chrome.tabs.update(tabId, { url: tab.url });

    // Cập nhật refresh count
    refreshStates[tabId].refreshCount = (state.refreshCount || 0) + 1;
    refreshStates[tabId].lastRefreshedAt = Date.now();

    // Lên lịch refresh tiếp theo
    scheduleNextRefresh(tabId, state.minSeconds, state.maxSeconds);
  } catch (error) {
    // Tab đã bị đóng hoặc không còn tồn tại
    console.log(`Tab ${tabId} không còn tồn tại, dừng auto-refresh`);
    delete refreshStates[tabId];
    saveStatesToStorage();
  }
});

/** ------------------------------------------
 * Mục đích: Xử lý messages từ popup
 * @param {object} message - Message từ popup
 * @param {object} sender - Thông tin sender
 * @param {function} sendResponse - Callback trả về response
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    // Load state mới nhất từ storage
    await loadStatesFromStorage();

    switch (message.action) {
      case "START_REFRESH":
        startRefresh(
          message.tabId,
          message.minSeconds,
          message.maxSeconds,
          message.tabUrl,
          message.tabTitle
        );
        sendResponse({ success: true });
        break;

      case "STOP_REFRESH":
        stopRefresh(message.tabId);
        sendResponse({ success: true });
        break;

      case "GET_STATE":
        sendResponse({
          success: true,
          state: refreshStates[message.tabId] || null,
          allStates: refreshStates,
        });
        break;

      case "GET_ALL_ACTIVE":
        const activeStates = Object.values(refreshStates).filter(
          (s) => s.active
        );
        sendResponse({ success: true, activeStates });
        break;

      default:
        sendResponse({ success: false, error: "Unknown action" });
    }
  })();

  // Quan trọng: return true để async response hoạt động
  return true;
});

/** ------------------------------------------
 * Mục đích: Xử lý khi tab bị đóng - dừng auto-refresh cho tab đó
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  if (refreshStates[tabId]) {
    chrome.alarms.clear(`refresh_tab_${tabId}`);
    delete refreshStates[tabId];
    saveStatesToStorage();
  }
});

/** ------------------------------------------
 * Mục đích: Khởi tạo - load state khi service worker bắt đầu
 */
loadStatesFromStorage().then(() => {
  console.log("AutoRefresh Extension - Service Worker started");
});
