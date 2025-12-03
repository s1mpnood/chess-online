# 🔍 Checklist Xử Lý Nước Đi - Chess Online

## ✅ FLOW HOÀN CHỈNH

### 1️⃣ **CLICK CHỌN QUÂN CỜ**
```javascript
handleSquareClick(clickedSquare)
├─ Kiểm tra lượt chơi (currentPlayerColor === turn)
├─ Lấy quân cờ: gameOnline.get(clickedSquare)
├─ Kiểm tra màu quân (white/black)
├─ SET selectedSquare = clickedSquare
├─ updateBoard() → Re-render với class 'selected'
└─ highlightPossibleMoves(clickedSquare)
    ├─ gameOnline.moves({ square: clickedSquare, verbose: true })
    └─ Thêm class 'possible-move' hoặc 'capture'
```

### 2️⃣ **CLICK VÀO Ô ĐÍCH**
```javascript
handleSquareClick(clickedSquare)
├─ selectedSquare ĐÃ CÓ
├─ Kiểm tra xem click vào quân khác của mình không
│   YES → Chọn quân mới
│   NO → Thử di chuyển
├─ Kiểm tra phong cấp (tốt lên hàng 8/1)
│   YES → Mở modal promotion
│   NO → attemptMove(from, to)
└─ Clear selectedSquare và highlights
```

### 3️⃣ **ATTEMPT MOVE (Client Validation)**
```javascript
attemptMove(from, to, promotion)
├─ Tạo Chess.js test instance
├─ Test move: testGame.move({ from, to, promotion })
├─ Nếu KHÔNG hợp lệ → Hiển thị lỗi
├─ Nếu HỢP LỆ:
│   ├─ Hiển thị "Đang gửi nước đi..."
│   └─ socket.emit('make_move', { room_id, from, to, promotion })
└─ CHỜ server response qua socket event 'move_made'
```

### 4️⃣ **SERVER XỬ LÝ** (BE/server.js)
```javascript
socket.on('make_move')
├─ Kiểm tra phòng tồn tại
├─ Kiểm tra player trong phòng
├─ Kiểm tra lượt chơi (turn === player.color)
├─ Validate move: room.game.move({ from, to, promotion })
├─ Nếu KHÔNG hợp lệ → emit 'error'
├─ Nếu HỢP LỆ:
│   ├─ Cập nhật room.game_state (FEN, turn, history)
│   ├─ io.to(room_id).emit('move_made', { from, to, game_state })
│   └─ Kiểm tra game over
└─ Broadcast tới CẢ 2 NGƯỜI CHƠI
```

### 5️⃣ **CLIENT NHẬN SOCKET EVENT**
```javascript
socket.on('move_made')
├─ gameState = data.game_state
├─ gameOnline.load(data.game_state.fen) → Đồng bộ FEN
├─ selectedSquare = null
├─ clearHighlights() → Xóa các class highlight
├─ updateBoard() → Re-render bàn cờ mới
├─ updateStatus() → Cập nhật lượt chơi
├─ addMoveToHistory(from, to) → Lịch sử nước đi
└─ Hiển thị thông báo
```

### 6️⃣ **UPDATE BOARD (Render)**
```javascript
updateBoard()
├─ Xóa board cũ: boardEl.innerHTML = ''
├─ Load FEN: gameOnline.load(gameState.fen)
├─ Lấy board: gameOnline.board()
├─ Loop 8x8:
│   ├─ Tạo square div
│   ├─ Nếu selectedSquare === squareId → Add class 'selected'
│   ├─ Nếu có quân cờ → Tạo piece div với symbol
│   └─ Add click event: handleSquareClick(squareId)
└─ Append vào DOM
```

### 7️⃣ **UPDATE STATUS**
```javascript
updateStatus()
├─ gameOnline.turn() → 'w' hoặc 'b'
├─ Hiển thị "♔ Trắng" hoặc "♚ Đen"
├─ Highlight lượt chơi hiện tại
├─ Kiểm tra:
│   ├─ gameOnline.isCheckmate() → "🎉 Chiến thắng!"
│   ├─ gameOnline.isDraw() → "🤝 Hòa!"
│   └─ gameOnline.inCheck() → "⚠️ Vua bị chiếu!"
└─ Hiển thị thông báo
```

## 🎯 TỔNG KẾT FLOW

```
USER CLICK QUÂN CỜ
    ↓
HIGHLIGHT CÁC Ô CÓ THỂ ĐI
    ↓
USER CLICK Ô ĐÍCH
    ↓
CLIENT VALIDATE (Chess.js)
    ↓
EMIT TO SERVER (Socket.IO)
    ↓
SERVER VALIDATE (Chess.js)
    ↓
UPDATE DATABASE (Room state)
    ↓
BROADCAST TO ALL PLAYERS
    ↓
CLIENT 1 & CLIENT 2 RECEIVE EVENT
    ↓
UPDATE BOARD SIMULTANEOUSLY
    ↓
REAL-TIME SYNC ✅
```

## 🔧 CÁC HÀM CHÍNH

| Hàm | Chức năng |
|-----|-----------|
| `handleSquareClick()` | Xử lý click vào ô cờ |
| `highlightPossibleMoves()` | Highlight các nước đi hợp lệ |
| `clearHighlights()` | Xóa highlight |
| `attemptMove()` | Validate và emit nước đi |
| `updateBoard()` | Render lại bàn cờ |
| `updateStatus()` | Cập nhật trạng thái game |
| `promoteOnline()` | Xử lý phong cấp |

## ✨ KIỂM TRA

- [x] Click chọn quân → Highlight
- [x] Click ô đích → Di chuyển
- [x] Validation client-side
- [x] Validation server-side
- [x] Đồng bộ real-time
- [x] Clear highlights sau move
- [x] Hiển thị lượt chơi
- [x] Phát hiện chiếu/chiếu hết
- [x] Phong cấp tốt
- [x] Lịch sử nước đi
