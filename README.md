# 🔄 AutoRefresh - Random Interval Chrome Extension

Extension Chrome tự động refresh trang web theo khoảng thời gian ngẫu nhiên trong khoảng **x đến y giây**.

## ✨ Tính năng

- 🎯 **Chọn tab cụ thể** để auto-refresh từ danh sách tất cả tab đang mở
- ⏱️ **Khoảng thời gian ngẫu nhiên** từ x đến y giây (tùy chỉnh)
- 📊 **Countdown realtime** hiển thị thời gian đến lần refresh tiếp theo
- 🎛️ **Quick Presets**: 5-10s, 15-30s, 30-60s, 1-2m, 5-10m
- 📈 **Đếm số lần** đã refresh
- 🔄 **Multi-tab support**: Có thể refresh nhiều tab cùng lúc
- 🎨 **Dark theme** đẹp với animation mượt mà

## 📦 Cài đặt

### Cách 1: Load thủ công (Developer Mode)

1. Mở Chrome và truy cập `chrome://extensions/`
2. Bật **Developer mode** (góc trên bên phải)
3. Click **"Load unpacked"**
4. Chọn thư mục `MS.AutoRefreshSite`
5. Extension sẽ xuất hiện trên thanh toolbar

### Cách 2: Pack extension
1. Tại `chrome://extensions/`, click **"Pack extension"**
2. Chọn thư mục source và tạo file `.crx`

## 🚀 Hướng dẫn sử dụng

1. **Click vào icon Extension** trên thanh Chrome
2. **Chọn tab** cần auto-refresh từ dropdown
3. **Đặt khoảng thời gian**: Tối thiểu (x) và Tối đa (y) giây
4. Click **"Bắt đầu AutoRefresh"**
5. Extension sẽ tự động refresh tab theo khoảng thời gian ngẫu nhiên

### Ví dụ:
- Đặt Min: **10s**, Max: **30s** → Tab sẽ được refresh sau mỗi khoảng 10-30 giây ngẫu nhiên

## 📁 Cấu trúc dự án

```
MS.AutoRefreshSite/
├── manifest.json       # Chrome Extension manifest v3
├── background.js       # Service Worker - xử lý alarm và refresh logic
├── popup.html          # Giao diện popup
├── popup.css           # Styles (dark theme)
├── popup.js            # Logic popup UI
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## 🔧 Kỹ thuật

- **Manifest V3** - Standard mới nhất của Chrome Extensions
- **Chrome Alarms API** - Đảm bảo refresh hoạt động ngay cả khi popup đóng
- **Chrome Storage API** - Lưu trạng thái persistent
- **Service Worker** - Background processing không block UI

## 📝 Lưu ý

- Extension sẽ **không refresh** các trang Chrome nội bộ (`chrome://...`)
- Alarm vẫn hoạt động khi **đóng popup** - chỉ dừng khi bấm nút Stop hoặc đóng tab
- Badge icon hiển thị **"ON"** khi đang active

---
*Created by NVMANH with Antigravity - 09/05/2026*
