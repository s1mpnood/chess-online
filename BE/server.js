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

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Backend is running',
        cors: {
            origin: req.headers.origin,
            allowed: true
        }
    });
});

// CORS test endpoint
app.get('/test-cors', (req, res) => {
    res.json({ 
        message: 'CORS working!',
        origin: req.headers.origin 
    });
});

// Lưu trữ thông tin các phòng
const rooms = new Map();
// Hàng đợi matchmaking
const matchmakingQueue = [];
// Lưu timeout timers
const queueTimeouts = new Map();

// Broadcast số người đang chờ cho tất cả clients
function broadcastQueueCount() {
    io.emit('queue_update', { count: matchmakingQueue.length });
}

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('🟢 User connected:', socket.id);

    // Random matchmaking - Tự động ghép đôi
    socket.on('find_match', (data) => {
        const { player_name } = data;
        console.log('🔍 Finding match for:', player_name);
        
        // Xóa khỏi queue cũ nếu đang chờ (tránh duplicate)
        const oldIndex = matchmakingQueue.findIndex(p => p.socket_id === socket.id);
        if (oldIndex !== -1) {
            const oldTimeout = queueTimeouts.get(socket.id);
            if (oldTimeout) clearTimeout(oldTimeout);
            matchmakingQueue.splice(oldIndex, 1);
        }
        
        // Kiểm tra xem có ai đang chờ không
        if (matchmakingQueue.length > 0) {
            // Lấy người đầu tiên và xóa timeout của họ
            const opponent = matchmakingQueue.shift();
            const opponentTimeout = queueTimeouts.get(opponent.socket_id);
            if (opponentTimeout) {
                clearTimeout(opponentTimeout);
                queueTimeouts.delete(opponent.socket_id);
            }
            
            // Tạo room ID ngẫu nhiên
            const room_id = `random_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Tạo phòng mới
            const game = new Chess();
            
            // Random xem ai chơi trắng, ai chơi đen
            const isWhite = Math.random() < 0.5;
            const player1Color = isWhite ? 'white' : 'black';
            const player2Color = isWhite ? 'black' : 'white';
            
            rooms.set(room_id, {
                players: [
                    { socket_id: opponent.socket_id, name: opponent.player_name, color: player1Color },
                    { socket_id: socket.id, name: player_name, color: player2Color }
                ],
                game: game,
                game_state: {
                    fen: game.fen(),
                    turn: 'white',
                    moves_history: []
                }
            });
            
            // Join cả 2 vào room
            opponent.socket.join(room_id);
            socket.join(room_id);
            
            // Thông báo cho cả 2
            opponent.socket.emit('match_found', {
                room_id: room_id,
                your_color: player1Color,
                opponent_name: player_name,
                game_state: rooms.get(room_id).game_state
            });
            
            socket.emit('match_found', {
                room_id: room_id,
                your_color: player2Color,
                opponent_name: opponent.player_name,
                game_state: rooms.get(room_id).game_state
            });
            
            console.log(`✅ Match created: ${opponent.player_name} vs ${player_name} in room ${room_id}`);
            
            // Broadcast queue count update
            broadcastQueueCount();
        } else {
            // Thêm vào hàng đợi
            matchmakingQueue.push({
                socket_id: socket.id,
                socket: socket,
                player_name: player_name,
                timestamp: Date.now()
            });
            
            socket.emit('waiting_for_opponent', {
                message: 'Đang tìm đối thủ...',
                queue_position: matchmakingQueue.length
            });
            
            // Broadcast queue count to all
            broadcastQueueCount();
            
            // Set timeout 2 phút - tự động hủy nếu không tìm được
            const timeout = setTimeout(() => {
                const index = matchmakingQueue.findIndex(p => p.socket_id === socket.id);
                if (index !== -1) {
                    matchmakingQueue.splice(index, 1);
                    socket.emit('matchmaking_timeout', {
                        message: 'Không tìm thấy đối thủ. Vui lòng thử lại!'
                    });
                    queueTimeouts.delete(socket.id);
                    broadcastQueueCount();
                    console.log(`⏱️ ${player_name} timed out from queue`);
                }
            }, 120000); // 2 phút = 120000ms
            
            queueTimeouts.set(socket.id, timeout);
            
            console.log(`⏳ ${player_name} added to queue. Queue size: ${matchmakingQueue.length}`);
        }
    });
    
    // Hủy tìm trận
    socket.on('cancel_matchmaking', () => {
        const index = matchmakingQueue.findIndex(p => p.socket_id === socket.id);
        if (index !== -1) {
            matchmakingQueue.splice(index, 1);
            
            // Clear timeout
            const timeout = queueTimeouts.get(socket.id);
            if (timeout) {
                clearTimeout(timeout);
                queueTimeouts.delete(socket.id);
            }
            
            socket.emit('matchmaking_cancelled', {
                message: 'Đã hủy tìm trận'
            });
            
            broadcastQueueCount();
            console.log(`❌ Player removed from queue. Queue size: ${matchmakingQueue.length}`);
        }
    });

    // Tạo/Vào phòng (cho chế độ Tạo phòng)
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
        console.log(`📡 Broadcasted to room ${room_id}: ${room.players.length} players`);
        console.log(`📊 Game state FEN: ${room.game_state.fen}`);

        // Kiểm tra game over với Chess.js built-in methods
        if (room.game.game_over()) {
            let result = '';
            if (room.game.in_checkmate()) {
                const winner = room.game.turn() === 'w' ? 'black' : 'white';
                result = `Chiếu hết! ${winner === 'white' ? 'Trắng' : 'Đen'} thắng!`;
            } else if (room.game.in_stalemate()) {
                result = 'Hòa cờ do chiếu bí (Stalemate)!';
            } else if (room.game.in_threefold_repetition()) {
                result = 'Hòa cờ do lặp nước đi 3 lần!';
            } else if (room.game.insufficient_material()) {
                result = 'Hòa cờ do không đủ quân để chiếu hết!';
            } else if (room.game.in_draw()) {
                result = 'Hòa cờ!';
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
    
    // Player surrendered
    socket.on('player_surrendered', (data) => {
        const { room_id, player_name } = data;
        
        if (!rooms.has(room_id)) return;
        
        // Broadcast surrender - không tính điểm
        io.to(room_id).emit('player_surrendered_broadcast', {
            player_name: player_name,
            message: `${player_name} đã đầu hàng! Trận này không tính điểm.`
        });
        
        console.log(`🏳️ ${player_name} surrendered in room ${room_id}`);
    });

    // Disconnect
    socket.on('disconnect', () => {
        console.log('🔴 User disconnected:', socket.id);
        
        // Xóa khỏi hàng đợi matchmaking nếu có
        const queueIndex = matchmakingQueue.findIndex(p => p.socket_id === socket.id);
        if (queueIndex !== -1) {
            matchmakingQueue.splice(queueIndex, 1);
            console.log(`❌ Player removed from matchmaking queue`);
        }
        
        // Thông báo đối thủ nếu đang trong game
        for (const [room_id, room] of rooms.entries()) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                io.to(room_id).emit('opponent_disconnected', {
                    message: 'Đối thủ đã ngắt kết nối'
                });
                console.log(`⚠️ Player disconnected from room ${room_id}`);
                break;
            }
        }

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
const HOST = '0.0.0.0'; // Render requires listening on 0.0.0.0

server.listen(PORT, HOST, () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    console.log(`📂 Serving frontend from: ${path.join(__dirname, '../FE')}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
