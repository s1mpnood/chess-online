# 🎮 Hướng Dẫn Chạy Game Cờ Vua Online Real-time

## 📋 Yêu Cầu
- Node.js (phiên bản 14 trở lên)
- NPM hoặc Yarn

## 🚀 Cách Chạy

### Bước 1: Cài đặt Backend
```cmd
cd BE
npm install
```

### Bước 2: Chạy Server
```cmd
npm start
```
Hoặc để tự động reload khi code thay đổi:
```cmd
npm run dev
```

Server sẽ chạy tại: **http://localhost:5000**

### Bước 3: Mở Game
Mở trình duyệt và truy cập: **http://localhost:5000**

## 🎯 Cách Chơi 2 Người

### Người Chơi 1 (Tạo phòng)
1. Đăng nhập hoặc chơi với tên khách
2. Chọn "Cờ Vua Online"
3. Bấm **"Tạo Phòng Mới"**
4. **Copy Room ID** (ví dụ: `room_abc123`)
5. Gửi Room ID cho bạn bè qua Zalo/Messenger/...
6. Đợi người chơi thứ 2 vào

### Người Chơi 2 (Vào phòng)
1. Đăng nhập hoặc chơi với tên khách
2. Chọn "Cờ Vua Online"
3. **Nhập Room ID** mà bạn bè gửi
4. Bấm **"Vào Phòng"**
5. Bắt đầu chơi!

## ✨ Tính Năng Real-time
- ✅ **Đồng bộ nước đi ngay lập tức** giữa 2 người chơi
- ✅ **Validation luật cờ vua** trên cả client và server
- ✅ **Hiển thị lượt chơi** - Chỉ được di chuyển khi đến lượt
- ✅ **Thông báo real-time** khi đối thủ đi cờ
- ✅ **Tự động phát hiện chiếu, chiếu hết, hòa**
- ✅ **Chơi lại** - Reset game cho cả 2 người
- ✅ **Ngắt kết nối** - Thông báo khi người chơi rời phòng

## 🌐 Test Trên 2 Máy Khác Nhau

### Nếu muốn chơi qua mạng LAN:
1. Tìm địa chỉ IP của máy chạy server:
   ```cmd
   ipconfig
   ```
   Tìm dòng **IPv4 Address** (ví dụ: `192.168.1.100`)

2. Sửa file `FE/script.js` dòng 11:
   ```javascript
   const socket = io('http://192.168.1.100:5000');
   ```

3. Máy khác truy cập: **http://192.168.1.100:5000**

## 🐛 Xử Lý Lỗi

### Lỗi: "Cannot connect to server"
- Đảm bảo server đã chạy (`npm start` trong thư mục BE)
- Kiểm tra port 5000 chưa bị chiếm dụng

### Lỗi: "Room đã đầy"
- Mỗi phòng chỉ cho phép tối đa 2 người
- Tạo phòng mới hoặc đợi phòng khác

### Lỗi: "Nước đi không hợp lệ"
- Chỉ được di chuyển khi đến lượt
- Tuân thủ luật cờ vua

## 📝 Cấu Trúc Thư Mục
```
NK/
├── BE/                 # Backend Server
│   ├── server.js       # Socket.IO server
│   └── package.json    # Dependencies
└── FE/                 # Frontend
    ├── index.html      # UI
    ├── script.js       # Game logic
    └── style.css       # Styling
```

## 🎊 Chúc Bạn Chơi Vui!
