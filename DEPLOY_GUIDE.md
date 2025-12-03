# 🚀 Hướng Dẫn Deploy Chess Online Lên Internet

## 📋 Kiến Trúc Deploy

```
Frontend (FE) → Vercel     (https://yourapp.vercel.app)
Backend (BE)  → Render     (https://yourapp.onrender.com)
                hoặc Railway (https://yourapp.railway.app)
```

---

## BƯỚC 1: DEPLOY BACKEND LÊN RENDER

### 1.1 Tạo GitHub Repository

```bash
# Mở terminal tại thư mục NK
cd c:\Users\Khanh\Downloads\NK

# Khởi tạo git (nếu chưa có)
git init

# Thêm remote (thay YOUR_USERNAME và YOUR_REPO)
git remote add origin https://github.com/YOUR_USERNAME/chess-online.git

# Add và commit
git add .
git commit -m "Initial commit - Chess Online Game"

# Push lên GitHub
git push -u origin main
```

### 1.2 Deploy Backend trên Render

1. **Truy cập:** https://render.com
2. **Sign Up:** Dùng GitHub account
3. **New → Web Service**
4. **Connect Repository:** Chọn repo `chess-online`
5. **Cấu hình:**
   ```
   Name:           chess-online-backend
   Region:         Singapore (gần VN nhất)
   Branch:         main
   Root Directory: BE
   Runtime:        Node
   Build Command:  npm install
   Start Command:  npm start
   Instance Type:  Free
   ```
6. **Environment Variables:** (Không cần set gì)
7. **Create Web Service**
8. **Đợi 3-5 phút** → Lấy URL: `https://chess-online-backend.onrender.com`

---

## BƯỚC 2: CẬP NHẬT FRONTEND VỚI BACKEND URL

### 2.1 Sửa file `FE/script.js`

Tìm dòng:
```javascript
const BACKEND_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000' 
    : 'https://YOUR_BACKEND_URL.onrender.com';
```

Thay `YOUR_BACKEND_URL.onrender.com` bằng URL backend vừa deploy:
```javascript
const BACKEND_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000' 
    : 'https://chess-online-backend.onrender.com'; // URL từ Render
```

### 2.2 Commit và push

```bash
git add FE/script.js
git commit -m "Update backend URL"
git push
```

---

## BƯỚC 3: DEPLOY FRONTEND LÊN VERCEL

### 3.1 Deploy qua Vercel Dashboard

1. **Truy cập:** https://vercel.com
2. **Sign Up:** Dùng GitHub account
3. **Add New → Project**
4. **Import Git Repository:** Chọn repo `chess-online`
5. **Cấu hình:**
   ```
   Framework Preset:  Other
   Root Directory:    FE
   Build Command:     (để trống)
   Output Directory:  (để trống)
   Install Command:   (để trống)
   ```
6. **Deploy**
7. **Lấy URL:** `https://chess-online.vercel.app`

### 3.2 Hoặc Deploy qua CLI

```bash
# Cài Vercel CLI
npm install -g vercel

# Deploy
cd FE
vercel

# Làm theo hướng dẫn:
# - Login với GitHub
# - Chọn project settings
# - Deploy
```

---

## BƯỚC 4: TEST GAME ONLINE

### 4.1 Mở game

Truy cập: **https://chess-online.vercel.app**

### 4.2 Test 2 người chơi

**Người chơi 1:**
- Mở tab 1: https://chess-online.vercel.app
- Đăng nhập → Tạo phòng → Copy Room ID

**Người chơi 2:**
- Mở tab 2 (hoặc máy khác): https://chess-online.vercel.app
- Đăng nhập → Nhập Room ID → Vào phòng

**Chơi thử:** Di chuyển cờ → Kiểm tra đồng bộ!

---

## 🔧 XỬ LÝ SỰ CỐ

### Lỗi: "Cannot connect to server"

**Nguyên nhân:** Frontend không kết nối được Backend

**Giải pháp:**
1. Kiểm tra Backend URL trong `FE/script.js`
2. Kiểm tra Backend đã deploy chưa: https://chess-online-backend.onrender.com
3. Mở Console (F12) → Check lỗi CORS

### Lỗi: "Server is sleeping"

**Nguyên nhân:** Render free tier sleep sau 15 phút không dùng

**Giải pháp:**
- Đợi 30s để server wake up
- Hoặc upgrade lên paid plan ($7/tháng)
- Hoặc dùng Railway (không sleep)

### Lỗi: CORS

**Nguyên nhân:** Backend chặn request từ Frontend

**Giải pháp:**
Kiểm tra `BE/server.js` có CORS config đúng:
```javascript
cors: {
    origin: [
        "http://localhost:5000",
        "https://*.vercel.app"
    ]
}
```

---

## 🌟 NÂNG CAP (Optional)

### 1. Custom Domain

**Vercel:**
- Settings → Domains → Add Domain
- Mua domain từ Namecheap/GoDaddy
- Cấu hình DNS

**Kết quả:** `chess.yourdomain.com`

### 2. SSL/HTTPS

- Vercel tự động có HTTPS ✅
- Render tự động có HTTPS ✅

### 3. Analytics

Thêm Google Analytics vào `FE/index.html`:
```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=YOUR_GA_ID"></script>
```

### 4. SEO

Thêm vào `FE/index.html`:
```html
<meta name="description" content="Chơi cờ vua online miễn phí với bạn bè!">
<meta property="og:title" content="Chess Online - Cờ Vua Trực Tuyến">
<meta property="og:image" content="https://yourapp.vercel.app/preview.png">
```

---

## 📊 MONITORING

### Kiểm tra Backend Status

- Render Dashboard: https://dashboard.render.com
- Logs: Click vào service → Logs
- Metrics: CPU, Memory, Request count

### Kiểm tra Frontend Status

- Vercel Dashboard: https://vercel.com/dashboard
- Analytics: Visitors, Page views
- Deployment logs

---

## 💰 CHI PHÍ

| Dịch vụ | Free Tier | Paid |
|---------|-----------|------|
| Vercel (FE) | ✅ Unlimited | - |
| Render (BE) | ✅ 750 giờ/tháng | $7/tháng |
| Domain | - | ~$10/năm |

**Tổng:** **MIỄN PHÍ** hoặc $7/tháng nếu muốn server không sleep

---

## 🎯 CHECKLIST

- [ ] Push code lên GitHub
- [ ] Deploy Backend lên Render
- [ ] Copy Backend URL
- [ ] Sửa Frontend với Backend URL
- [ ] Push update lên GitHub
- [ ] Deploy Frontend lên Vercel
- [ ] Test game với 2 tab
- [ ] Chia sẻ link cho bạn bè! 🎉

---

## 🔗 LINKS QUAN TRỌNG

- **GitHub Repo:** https://github.com/YOUR_USERNAME/chess-online
- **Frontend (Vercel):** https://chess-online.vercel.app
- **Backend (Render):** https://chess-online-backend.onrender.com
- **Render Dashboard:** https://dashboard.render.com
- **Vercel Dashboard:** https://vercel.com/dashboard

---

## 🆘 HỖ TRỢ

Nếu gặp lỗi:
1. Check Console (F12)
2. Check Backend Logs (Render Dashboard)
3. Check Network tab (xem request có đến server không)

---

Chúc bạn deploy thành công! 🚀🎮
