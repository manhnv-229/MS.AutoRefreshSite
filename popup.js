/** ------------------------------------------
 * Mục đích: Logic chính cho popup của Chrome Extension AutoRefresh
 * Xử lý UI interactions, giao tiếp với background service worker
 * và cập nhật countdown timer realtime
 * @author NVMANH with Antigravity
 * @created 09/05/2026 03:49
 */

// -------------------------------------------------------
// DOM Elements
// -------------------------------------------------------
const tabSelect = document.getElementById("tabSelect");
const refreshTabsBtn = document.getElementById("refreshTabsBtn");
const tabPreviewTitle = document.getElementById("tabPreviewTitle");
const tabPreviewUrl = document.getElementById("tabPreviewUrl");
const tabFavicon = document.getElementById("tabFavicon");
const minSecondsInput = document.getElementById("minSeconds");
const maxSecondsInput = document.getElementById("maxSeconds");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusPanel = document.getElementById("statusPanel");
const countdownNum = document.getElementById("countdownNum");
const countdownBar = document.getElementById("countdownBar");
const refreshCount = document.getElementById("refreshCount");
const errorMsg = document.getElementById("errorMsg");
const globalStatus = document.getElementById("globalStatus");
const activeSessionsSection = document.getElementById("activeSessionsSection");
const activeSessionsList = document.getElementById("activeSessionsList");
const presetBtns = document.querySelectorAll(".preset-btn");

// -------------------------------------------------------
// State
// -------------------------------------------------------
let countdownInterval = null;
let currentTabId = null;
let currentState = null;

// -------------------------------------------------------
// Initialization
// -------------------------------------------------------

/** ------------------------------------------
 * Mục đích: Khởi tạo popup - load danh sách tab và state hiện tại
 */
async function init() {
  await loadTabs();
  await loadCurrentTabState();
  await loadActiveSessions();
  setupEventListeners();
}

/** ------------------------------------------
 * Mục đích: Load danh sách tất cả tab đang mở vào select box
 */
async function loadTabs() {
  try {
    const tabs = await chrome.tabs.query({});
    tabSelect.innerHTML = '<option value="">-- Chọn tab để auto-refresh --</option>';

    // Tab hiện tại được ưu tiên lên đầu
    const currentTab = tabs.find((t) => t.active);
    const otherTabs = tabs.filter((t) => !t.active);
    const sortedTabs = currentTab ? [currentTab, ...otherTabs] : tabs;

    sortedTabs.forEach((tab) => {
      if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) return;

      const option = document.createElement("option");
      option.value = tab.id;
      option.textContent = tab.title
        ? tab.title.substring(0, 50) + (tab.title.length > 50 ? "..." : "")
        : tab.url;
      option.dataset.url = tab.url;
      option.dataset.title = tab.title || tab.url;
      option.dataset.favIconUrl = tab.favIconUrl || "";

      // Đánh dấu tab hiện tại
      if (tab.active) {
        option.textContent = "✓ " + option.textContent + " (tab hiện tại)";
        option.selected = true;
      }

      tabSelect.appendChild(option);
    });

    // Trigger change để update preview
    if (tabSelect.value) {
      updateTabPreview();
      currentTabId = parseInt(tabSelect.value);
    }
  } catch (error) {
    showError("Không thể load danh sách tab: " + error.message);
  }
}

/** ------------------------------------------
 * Mục đích: Cập nhật preview thông tin tab được chọn
 */
function updateTabPreview() {
  const selectedOption = tabSelect.options[tabSelect.selectedIndex];
  if (!selectedOption || !selectedOption.value) {
    tabPreviewTitle.textContent = "Chưa chọn tab";
    tabPreviewUrl.textContent = "Hãy chọn tab bên trên";
    tabFavicon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 8v4l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
    return;
  }

  const title = selectedOption.dataset.title || selectedOption.textContent;
  const url = selectedOption.dataset.url || "";
  const favIconUrl = selectedOption.dataset.favIconUrl || "";

  tabPreviewTitle.textContent = title.replace(/^✓\s+/, "").replace(/\s+\(tab hiện tại\)$/, "");
  tabPreviewUrl.textContent = url;

  // Favicon
  if (favIconUrl) {
    tabFavicon.innerHTML = `<img src="${favIconUrl}" alt="favicon" onerror="this.parentElement.innerHTML='🌐'" />`;
  } else {
    tabFavicon.textContent = "🌐";
  }
}

/** ------------------------------------------
 * Mục đích: Load trạng thái refresh hiện tại của tab đang được chọn
 */
async function loadCurrentTabState() {
  if (!tabSelect.value) return;

  const tabId = parseInt(tabSelect.value);

  try {
    const response = await chrome.runtime.sendMessage({
      action: "GET_STATE",
      tabId,
    });

    if (response.success && response.state && response.state.active) {
      currentState = response.state;
      updateUIForActiveState(response.state);
    } else {
      updateUIForIdleState();
    }
  } catch (error) {
    console.error("Error loading state:", error);
    updateUIForIdleState();
  }
}

/** ------------------------------------------
 * Mục đích: Load và hiển thị tất cả tab đang có auto-refresh active
 */
async function loadActiveSessions() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: "GET_ALL_ACTIVE",
    });

    if (response.success && response.activeStates && response.activeStates.length > 0) {
      const currentTabId = tabSelect.value ? parseInt(tabSelect.value) : null;
      // Lọc bỏ tab hiện tại đang hiển thị trong UI chính
      const otherActiveSessions = response.activeStates.filter(
        (s) => s.tabId !== currentTabId
      );

      if (otherActiveSessions.length > 0) {
        renderActiveSessions(otherActiveSessions);
        activeSessionsSection.style.display = "block";
      } else {
        activeSessionsSection.style.display = "none";
      }

      // Update global status badge
      const totalActive = response.activeStates.length;
      if (totalActive > 0) {
        globalStatus.textContent = `${totalActive} ACTIVE`;
        globalStatus.classList.add("active");
      } else {
        globalStatus.textContent = "IDLE";
        globalStatus.classList.remove("active");
      }
    } else {
      activeSessionsSection.style.display = "none";
      globalStatus.textContent = "IDLE";
      globalStatus.classList.remove("active");
    }
  } catch (error) {
    console.error("Error loading active sessions:", error);
  }
}

/** ------------------------------------------
 * Mục đích: Render danh sách các session đang active vào DOM
 * @param {Array} sessions - Danh sách các session đang active
 */
function renderActiveSessions(sessions) {
  activeSessionsList.innerHTML = "";

  sessions.forEach((session) => {
    const item = document.createElement("div");
    item.className = "session-item";
    item.innerHTML = `
      <span class="session-title" title="${session.tabUrl || ''}">${session.tabTitle || "Tab " + session.tabId}</span>
      <span class="session-interval">${session.minSeconds}-${session.maxSeconds}s</span>
      <button class="session-stop-btn" data-tab-id="${session.tabId}" title="Dừng refresh tab này">✕</button>
    `;

    item.querySelector(".session-stop-btn").addEventListener("click", async (e) => {
      const tabId = parseInt(e.target.dataset.tabId);
      await chrome.runtime.sendMessage({ action: "STOP_REFRESH", tabId });
      await loadActiveSessions();
    });

    activeSessionsList.appendChild(item);
  });
}

// -------------------------------------------------------
// UI State Updates
// -------------------------------------------------------

/** ------------------------------------------
 * Mục đích: Cập nhật UI khi tab đang ở trạng thái active refresh
 * @param {object} state - Trạng thái refresh hiện tại
 */
function updateUIForActiveState(state) {
  startBtn.style.display = "none";
  stopBtn.style.display = "flex";
  statusPanel.style.display = "block";
  minSecondsInput.value = state.minSeconds;
  maxSecondsInput.value = state.maxSeconds;
  refreshCount.textContent = state.refreshCount || 0;

  // Bắt đầu countdown
  startCountdown(state);
}

/** ------------------------------------------
 * Mục đích: Cập nhật UI về trạng thái idle (chưa refresh)
 */
function updateUIForIdleState() {
  startBtn.style.display = "flex";
  stopBtn.style.display = "none";
  statusPanel.style.display = "none";

  // Dừng countdown
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

/** ------------------------------------------
 * Mục đích: Bắt đầu countdown timer hiển thị realtime
 * @param {object} state - Trạng thái refresh chứa nextRefreshAt và delaySeconds
 */
function startCountdown(state) {
  if (countdownInterval) clearInterval(countdownInterval);

  const updateCountdown = () => {
    if (!state.nextRefreshAt) {
      countdownNum.textContent = "--";
      countdownBar.style.width = "100%";
      return;
    }

    const remaining = Math.max(0, Math.ceil((state.nextRefreshAt - Date.now()) / 1000));
    const total = state.delaySeconds || 1;
    const progress = Math.max(0, (remaining / total) * 100);

    countdownNum.textContent = remaining;
    countdownBar.style.width = progress + "%";

    // Thêm màu sắc theo thời gian còn lại
    if (remaining <= 3) {
      countdownNum.style.color = "#f59e0b";
    } else if (remaining <= total * 0.2) {
      countdownNum.style.color = "#10b981";
    } else {
      countdownNum.style.color = "var(--accent-cyan)";
    }

    // Auto-reload state khi countdown xong
    if (remaining <= 0) {
      setTimeout(async () => {
        await loadCurrentTabState();
        await loadActiveSessions();
      }, 1500);
    }
  };

  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
}

// -------------------------------------------------------
// Event Listeners
// -------------------------------------------------------

/** ------------------------------------------
 * Mục đích: Setup tất cả event listeners cho UI
 */
function setupEventListeners() {
  // Tab select change
  tabSelect.addEventListener("change", async () => {
    currentTabId = tabSelect.value ? parseInt(tabSelect.value) : null;
    updateTabPreview();

    // Stop current countdown
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }

    await loadCurrentTabState();
    hideError();
  });

  // Refresh tabs button
  refreshTabsBtn.addEventListener("click", async () => {
    refreshTabsBtn.style.transform = "rotate(360deg)";
    refreshTabsBtn.style.transition = "transform 0.5s ease";
    setTimeout(() => {
      refreshTabsBtn.style.transform = "";
    }, 500);
    await loadTabs();
    await loadCurrentTabState();
  });

  // Start button
  startBtn.addEventListener("click", async () => {
    const selectedOption = tabSelect.options[tabSelect.selectedIndex];
    if (!selectedOption || !selectedOption.value) {
      showError("Vui lòng chọn tab cần auto-refresh!");
      return;
    }

    const tabId = parseInt(selectedOption.value);
    const minSec = parseInt(minSecondsInput.value);
    const maxSec = parseInt(maxSecondsInput.value);

    // Validation
    if (isNaN(minSec) || minSec < 1) {
      showError("Thời gian tối thiểu phải >= 1 giây!");
      return;
    }
    if (isNaN(maxSec) || maxSec < 1) {
      showError("Thời gian tối đa phải >= 1 giây!");
      return;
    }
    if (minSec >= maxSec) {
      showError("Thời gian tối thiểu phải nhỏ hơn tối đa!");
      return;
    }

    hideError();

    try {
      // Lấy thông tin tab
      const tab = await chrome.tabs.get(tabId);

      const response = await chrome.runtime.sendMessage({
        action: "START_REFRESH",
        tabId,
        minSeconds: minSec,
        maxSeconds: maxSec,
        tabUrl: tab.url,
        tabTitle: tab.title,
      });

      if (response.success) {
        // Load state mới và update UI
        await loadCurrentTabState();
        await loadActiveSessions();
      }
    } catch (error) {
      showError("Lỗi: " + error.message);
    }
  });

  // Stop button
  stopBtn.addEventListener("click", async () => {
    const tabId = parseInt(tabSelect.value);
    if (!tabId) return;

    await chrome.runtime.sendMessage({ action: "STOP_REFRESH", tabId });
    updateUIForIdleState();
    await loadActiveSessions();
  });

  // Preset buttons
  presetBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const min = parseInt(btn.dataset.min);
      const max = parseInt(btn.dataset.max);
      minSecondsInput.value = min;
      maxSecondsInput.value = max;

      // Visual feedback
      presetBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  // Input validation - min <= max
  minSecondsInput.addEventListener("input", () => {
    const min = parseInt(minSecondsInput.value);
    const max = parseInt(maxSecondsInput.value);
    if (min >= max) {
      maxSecondsInput.value = min + 10;
    }
    presetBtns.forEach((b) => b.classList.remove("active"));
  });

  maxSecondsInput.addEventListener("input", () => {
    presetBtns.forEach((b) => b.classList.remove("active"));
  });
}

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

/** ------------------------------------------
 * Mục đích: Hiển thị thông báo lỗi
 * @param {string} message - Nội dung lỗi
 */
function showError(message) {
  errorMsg.textContent = message;
  errorMsg.style.display = "flex";
  setTimeout(hideError, 4000);
}

/** ------------------------------------------
 * Mục đích: Ẩn thông báo lỗi
 */
function hideError() {
  errorMsg.style.display = "none";
}

// -------------------------------------------------------
// Start
// -------------------------------------------------------
document.addEventListener("DOMContentLoaded", init);
