# ⚠️ LỖI: KHÔNG KẾT NỐI ĐƯỢC SERVER

## 🔍 Nguyên Nhân

Khi deploy lên **Vercel**, frontend chạy tại `https://yourapp.vercel.app` nhưng:
- ❌ **Backend chưa được deploy** 
- ❌ Hoặc chưa cấu hình URL backend trong code

## ✅ Giải Pháp - 2 Cách

### 🚀 **CÁCH 1: Deploy Backend (Khuyến nghị)**

#### Bước 1: Deploy Backend lên Render

1. Vào **https://render.com**
2. Sign in với GitHub (`s1mpnood`)
3. **New → Web Service**
4. Connect repo: `chess-online`
5. Settings:
   ```
   Name:         chess-backend
   Region:       Singapore
   Branch:       main
   Root Dir:     BE
   Build:        npm install
   Start:        npm start
   Instance:     Free
   ```
6. **Create Web Service**
7. Đợi 3-5 phút → Copy URL: 
   ```
   https://chess-backend-xxxx.onrender.com
   ```

#### Bước 2: Cập nhật Frontend

1. Mở file `FE/script.js`
2. Tìm dòng 23:
   ```javascript
   const PRODUCTION_BACKEND = 'https://YOUR_BACKEND_URL.onrender.com';
   ```
3. Thay bằng URL thật:
   ```javascript
   const PRODUCTION_BACKEND = 'https://chess-backend-xxxx.onrender.com';
   ```

#### Bước 3: Push Update

```bash
git add FE/script.js
git commit -m "Update production backend URL"
git push
```

Vercel sẽ **tự động redeploy** trong 1-2 phút!

#### Bước 4: Test

1. Mở: `https://yourapp.vercel.app`
2. F12 → Console → Thấy: `✅ Connected to server!`
3. Chơi online thử!

---

### 🏠 **CÁCH 2: Test Local (Không cần deploy)**

Nếu chỉ muốn test thử:

```bash
# Terminal 1: Chạy backend
cd BE
npm install
npm start

# Server chạy tại: http://localhost:5000
```

Sau đó mở: **http://localhost:5000** (KHÔNG phải Vercel URL)

---

## 📊 So Sánh 2 Cách

| Cách | Ưu điểm | Nhược điểm |
|------|---------|------------|
| **Deploy Backend** | ✅ Chơi online thật<br>✅ Chia sẻ được link<br>✅ Bạn bè vào được | ⏱️ Mất 10 phút setup |
| **Test Local** | ⚡ Nhanh (2 phút)<br>🆓 Miễn phí 100% | ❌ Chỉ test được<br>❌ Không chia sẻ được |

---

## 🆘 Troubleshooting

### Lỗi: "Cannot read properties of null (reading 'emit')"

**Nguyên nhân:** Code đang cố emit socket nhưng socket = null

**Giải pháp:** Đã fix trong commit mới nhất. Pull code mới nhất:
```bash
git pull
```

### Lỗi: Console hiển thị "⚠️ CHƯA CẤU HÌNH BACKEND URL!"

**Nguyên nhân:** Chưa deploy backend hoặc chưa sửa URL trong `script.js`

**Giải pháp:** Follow **CÁCH 1** ở trên

### Lỗi: "Server is sleeping" (Render)

**Nguyên nhân:** Render free tier sleep sau 15 phút không dùng

**Giải pháp:** 
- Đợi 30s để server wake up
- Hoặc dùng Railway (không sleep): https://railway.app

---

## 🎯 TÓM TẮT NHANH

### Để chơi online THẬT:
1. Deploy BE lên Render ← **BẮT BUỘC**
2. Copy BE URL
3. Sửa `FE/script.js` dòng 23
4. Push lên GitHub
5. Vercel auto redeploy
6. Done! 🎉

### Để test local:
1. `cd BE && npm start`
2. Mở `http://localhost:5000`
3. Done! (Nhưng không share được)

---

**Hiện tại code đã được fix để:**
- ✅ Hiển thị cảnh báo rõ ràng khi chưa có backend
- ✅ Hướng dẫn user cách fix
- ✅ Không crash khi socket = null
- ✅ Work tốt với cả localhost và production

Refresh trang Vercel để thấy thông báo mới! 🚀
