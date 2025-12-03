const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { Chess } = require('chess.js');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: function(origin, callback) {
            // Cho phép requests không có origin (mobile apps, postman, etc.)
            if (!origin) return callback(null, true);
            
            const allowedOrigins = [
                'http://localhost:5000',
                'http://localhost:3000',
                'https://chess-online-rho.vercel.app'
            ];
            
            // Cho phép tất cả subdomain của vercel.app và onrender.com
            if (origin.includes('.vercel.app') || origin.includes('.onrender.com')) {
                return callback(null, true);
            }
            
            if (allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                console.log('❌ CORS blocked origin:', origin);
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ["GET", "POST"],
        credentials: true,
        allowedHeaders: ["Content-Type"]
    }
});

// Serve static files từ thư mục FE
app.use(express.static(path.join(__dirname, '../FE')));

// Lưu trữ thông tin các phòng
const rooms = new Map();

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('🟢 User connected:', socket.id);

    // Tạo/Vào phòng
    socket.on('join_room', (data) => {
        const { room_id, player_name } = data;
        
        // Kiểm tra phòng đã tồn tại chưa
        if (!rooms.has(room_id)) {
            // Tạo phòng mới
            const game = new Chess();
            rooms.set(room_id, {
                players: [],
                game: game,
                game_state: {
                    fen: game.fen(),
                    turn: 'white',
                    moves_history: []
                }
            });
            console.log(`🆕 Room created: ${room_id}`);
        }

        const room = rooms.get(room_id);

        // Kiểm tra phòng đã đầy chưa
        if (room.players.length >= 2) {
            socket.emit('error', { message: 'Phòng đã đầy!' });
            return;
        }

        // Thêm player vào phòng
        const playerColor = room.players.length === 0 ? 'white' : 'black';
        room.players.push({
            socket_id: socket.id,
            name: player_name,
            color: playerColor
        });

        // Join socket room
        socket.join(room_id);

        // Gửi thông tin về cho player vừa join
        socket.emit('room_joined', {
            room_id: room_id,
            player_color: playerColor,
            game_state: room.game_state
        });

        // Thông báo cho player khác (nếu có)
        socket.to(room_id).emit('player_joined', {
            player_name: player_name,
            player_color: playerColor,
            game_state: room.game_state
        });

        console.log(`✅ ${player_name} (${playerColor}) joined room ${room_id}`);
        console.log(`   Players in room: ${room.players.length}/2`);
    });

    // Xử lý nước đi
    socket.on('make_move', (data) => {
        const { room_id, from, to, promotion } = data;
        
        if (!rooms.has(room_id)) {
            socket.emit('error', { message: 'Phòng không tồn tại!' });
            return;
        }

        const room = rooms.get(room_id);
        const player = room.players.find(p => p.socket_id === socket.id);

        if (!player) {
            socket.emit('error', { message: 'Bạn không trong phòng này!' });
            return;
        }

        // Kiểm tra lượt đi
        const currentTurn = room.game.turn() === 'w' ? 'white' : 'black';
        if (player.color !== currentTurn) {
            socket.emit('error', { message: 'Chưa đến lượt của bạn!' });
            return;
        }

        // Thực hiện nước đi
        const moveObj = { from, to };
        if (promotion) moveObj.promotion = promotion;
        
        const move = room.game.move(moveObj);

        if (!move) {
            socket.emit('error', { message: 'Nước đi không hợp lệ!' });
            return;
        }

        // Cập nhật game state
        room.game_state = {
            fen: room.game.fen(),
            turn: room.game.turn() === 'w' ? 'white' : 'black',
            moves_history: room.game.history(),
            is_check: room.game.in_check(),
            is_checkmate: room.game.in_checkmate(),
            is_stalemate: room.game.in_stalemate(),
            is_draw: room.game.in_draw()
        };

        // Broadcast nước đi tới tất cả players trong phòng
        io.to(room_id).emit('move_made', {
            from: from,
            to: to,
            promotion: promotion,
            game_state: room.game_state,
            player_name: player.name
        });

        console.log(`♟️  ${player.name} moved: ${from} → ${to}`);

        // Kiểm tra game over
        if (room.game.game_over()) {
            let result = '';
            if (room.game.in_checkmate()) {
                const winner = room.game.turn() === 'w' ? 'black' : 'white';
                result = `Chiếu hết! ${winner === 'white' ? 'Trắng' : 'Đen'} thắng!`;
            } else if (room.game.in_draw()) {
                result = 'Hòa cờ!';
            } else if (room.game.in_stalemate()) {
                result = 'Hòa do stalemate!';
            }
            
            io.to(room_id).emit('game_over', { result });
            console.log(`🏁 Game over in room ${room_id}: ${result}`);
        }
    });

    // Reset game
    socket.on('reset_game', (data) => {
        const { room_id } = data;
        
        if (!rooms.has(room_id)) {
            socket.emit('error', { message: 'Phòng không tồn tại!' });
            return;
        }

        const room = rooms.get(room_id);
        room.game.reset();
        room.game_state = {
            fen: room.game.fen(),
            turn: 'white',
            moves_history: []
        };

        io.to(room_id).emit('game_reset', {
            game_state: room.game_state
        });

        console.log(`🔄 Game reset in room ${room_id}`);
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log('🔴 User disconnected:', socket.id);

        // Tìm và xóa player khỏi phòng
        for (const [room_id, room] of rooms.entries()) {
            const playerIndex = room.players.findIndex(p => p.socket_id === socket.id);
            
            if (playerIndex !== -1) {
                const player = room.players[playerIndex];
                room.players.splice(playerIndex, 1);
                
                // Thông báo cho player còn lại
                socket.to(room_id).emit('player_left', {
                    player_name: player.name
                });

                console.log(`👋 ${player.name} left room ${room_id}`);

                // Xóa phòng nếu không còn ai
                if (room.players.length === 0) {
                    rooms.delete(room_id);
                    console.log(`🗑️  Room ${room_id} deleted (empty)`);
                }
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📂 Serving frontend from: ${path.join(__dirname, '../FE')}`);
});
