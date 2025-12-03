// ==================== GAME MODES ====================
let gameMode = null; // 'local' hoặc 'online'
let game = null; // Chess.js instance cho chế độ local
let selectedSquare = null;

// Separate timers for each player
let timerWhite = 600; // 10 minutes in seconds
let timerBlack = 600; // 10 minutes in seconds
let timerInterval = null;

let pendingPromotionMove = null;
let currentUser = null; // Thông tin user đăng nhập

// ==================== ONLINE MODE - VARIABLES ====================
// Backend URL Configuration
// Nếu đang test local: dùng localhost:5000
// Nếu đã deploy: thay YOUR_BACKEND_URL bằng URL từ Render/Railway
const BACKEND_URL = (() => {
    const hostname = window.location.hostname;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:5000';
    }
    
    // Backend URL từ Render
    const PRODUCTION_BACKEND = 'https://chess-backend-liot.onrender.com';
    
    // Kiểm tra xem đã deploy backend chưa
    if (PRODUCTION_BACKEND.includes('YOUR_BACKEND_URL')) {
        console.warn('⚠️ CHƯA CẤU HÌNH BACKEND URL!');
        console.warn('Vui lòng:');
        console.warn('1. Deploy backend lên Render/Railway');
        console.warn('2. Sửa PRODUCTION_BACKEND trong script.js');
        console.warn('3. Push lại lên GitHub');
        return null; // Không kết nối
    }
    
    return PRODUCTION_BACKEND;
})();

// Chỉ khởi tạo socket nếu có BACKEND_URL
const socket = BACKEND_URL ? io(BACKEND_URL, {
    transports: ['websocket', 'polling'], // Ưu tiên websocket
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    upgrade: true,
    rememberUpgrade: true
}) : null;

// Debug connection
if (socket) {
    socket.on('connect', () => {
        console.log('✅ Connected to server!', socket.id);
        console.log('🔗 Backend URL:', BACKEND_URL);
        showMessage('Đã kết nối đến máy chủ', 'success', 'loginSuccess');
    });

    socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error);
        console.error('🔗 Trying to connect to:', BACKEND_URL);
        showMessage('Không thể kết nối server! Kiểm tra backend đã chạy chưa.', 'error', 'loginError');
    });

    socket.on('disconnect', (reason) => {
        console.log('🔴 Disconnected:', reason);
        console.log('🔗 Backend URL was:', BACKEND_URL);
        if (reason === 'io server disconnect') {
            console.warn('⚠️ Server chủ động disconnect - Có thể do CORS hoặc authentication');
            showMessage('Mất kết nối server! Đang thử kết nối lại...', 'warning', 'loginError');
        }
    });

    socket.on('error', (error) => {
        console.error('❌ Socket error:', error);
    });
    
    // Matchmaking events
    socket.on('waiting_for_opponent', (data) => {
        console.log('⏳ Waiting for opponent...', data);
        updateMatchmakingStatus('🔍 Đang tìm đối thủ...');
    });
    
    socket.on('match_found', (data) => {
        console.log('✅ Match found!', data);
        currentRoomId = data.room_id;
        currentPlayerColor = data.your_color;
        
        // Khởi tạo game với trạng thái từ server
        game = new Chess(data.game_state.fen);
        
        // Hiển thị game container
        hideMatchmakingScreen();
        document.getElementById('localGameContainer').style.display = 'block';
        
        // Update UI
        renderBoardLocal();
        updateTimerDisplay();
        updateStatusLocal();
        
        // Hiển thị thông tin
        showMessageLocal(`🎮 Đã ghép trận! Bạn chơi ${data.your_color === 'white' ? 'Trắng ♔' : 'Đen ♚'}`, 'success');
        showMessageLocal(`⚔️ Đối thủ: ${data.opponent_name}`, 'info');
        
        // Start timer
        startTimer();
    });
    
    socket.on('opponent_disconnected', (data) => {
        stopTimer();
        alert('⚠️ ' + data.message);
        location.reload();
    });
} else {
    console.error('❌ Socket.IO không được khởi tạo - Chưa cấu hình backend URL!');
}

let gameOnline = new Chess(); // Chess.js instance cho online mode
let pendingPromotionMoveOnline = null;
let gameState = null;
let currentPlayerColor = null;
let currentRoomId = null;

// Piece symbols
const pieceMap = {
    'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
    'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
};

const pieceSymbols = {
    w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
    b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' }
};

// ==================== AUTHENTICATION ====================
function showRegister() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    clearAuthMessage();
}

function showLogin() {
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    clearAuthMessage();
}

function handleLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    if (!username || !password) {
        showAuthMessage('Vui lòng nhập đầy đủ thông tin!', 'error');
        return;
    }

    // Kiểm tra localStorage
    const users = JSON.parse(localStorage.getItem('chessUsers') || '[]');
    const user = users.find(u => u.username === username);

    if (!user) {
        showAuthMessage('Tên đăng nhập không tồn tại!', 'error');
        return;
    }

    if (user.password !== password) {
        showAuthMessage('Mật khẩu không đúng!', 'error');
        return;
    }

    // Đăng nhập thành công
    currentUser = { username: user.username, email: user.email };
    localStorage.setItem('currentChessUser', JSON.stringify(currentUser));
    showAuthMessage('Đăng nhập thành công!', 'success');
    setTimeout(() => {
        document.getElementById('authPanel').style.display = 'none';
        document.getElementById('modeSelection').style.display = 'block';
        document.getElementById('welcomeUser').textContent = `👤 ${currentUser.username}`;
    }, 1000);
}

function handleRegister() {
    const username = document.getElementById('registerUsername').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value.trim();
    const confirmPassword = document.getElementById('registerConfirmPassword').value.trim();

    if (!username || !email || !password || !confirmPassword) {
        showAuthMessage('Vui lòng nhập đầy đủ thông tin!', 'error');
        return;
    }

    if (username.length < 3) {
        showAuthMessage('Tên đăng nhập phải có ít nhất 3 ký tự!', 'error');
        return;
    }

    if (password.length < 6) {
        showAuthMessage('Mật khẩu phải có ít nhất 6 ký tự!', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showAuthMessage('Mật khẩu xác nhận không khớp!', 'error');
        return;
    }

    // Kiểm tra email hợp lệ
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showAuthMessage('Email không hợp lệ!', 'error');
        return;
    }

    // Kiểm tra username đã tồn tại chưa
    const users = JSON.parse(localStorage.getItem('chessUsers') || '[]');
    if (users.find(u => u.username === username)) {
        showAuthMessage('Tên đăng nhập đã tồn tại!', 'error');
        return;
    }

    // Đăng ký thành công
    users.push({ username, email, password });
    localStorage.setItem('chessUsers', JSON.stringify(users));
    showAuthMessage('Đăng ký thành công! Đang chuyển sang đăng nhập...', 'success');
    
    setTimeout(() => {
        showLogin();
        document.getElementById('loginUsername').value = username;
    }, 1500);
}

function playAsGuest() {
    currentUser = { username: 'Khách_' + Math.random().toString(36).substring(7), guest: true };
    localStorage.setItem('currentChessUser', JSON.stringify(currentUser));
    document.getElementById('authPanel').style.display = 'none';
    document.getElementById('modeSelection').style.display = 'block';
    document.getElementById('welcomeUser').textContent = `👤 ${currentUser.username}`;
}

function logout() {
    if (confirm('Bạn có chắc muốn đăng xuất?')) {
        currentUser = null;
        localStorage.removeItem('currentChessUser');
        location.reload();
    }
}

function showAuthMessage(message, type) {
    const msgEl = document.getElementById('authMessage');
    msgEl.textContent = message;
    msgEl.className = `message ${type}`;
    msgEl.style.display = 'block';
}

function clearAuthMessage() {
    const msgEl = document.getElementById('authMessage');
    msgEl.style.display = 'none';
}

// Kiểm tra đăng nhập khi load trang
window.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('currentChessUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        document.getElementById('authPanel').style.display = 'none';
        document.getElementById('modeSelection').style.display = 'block';
        document.getElementById('welcomeUser').textContent = `👤 ${currentUser.username}`;
    }
});


// ==================== MODE SELECTION ====================
function selectMode(mode) {
    gameMode = mode;
    document.getElementById('modeSelection').style.display = 'none';
    
    if (mode === 'local') {
        // Chế độ Random Matchmaking
        if (!socket) {
            alert('❌ CHƯA CẤU HÌNH BACKEND!\n\nChế độ Random cần kết nối server để tìm đối thủ.');
            location.reload();
            return;
        }
        
        // Hiển thị loading và tìm đối thủ
        showMatchmakingScreen();
        
        // Gửi yêu cầu tìm trận
        const playerName = currentUser ? currentUser.username : 'Khách';
        socket.emit('find_match', { player_name: playerName });
        
    } else if (mode === 'ai') {
        // Khởi tạo Chess.js cho chế độ AI
        gameAI = new Chess();
        document.getElementById('aiGameContainer').style.display = 'block';
        document.getElementById('level-selection-modal').classList.add('active');
    } else if (mode === 'online') {
        // Kiểm tra backend đã cấu hình chưa
        if (!socket) {
            alert('❌ CHƯA CẤU HÌNH BACKEND!\n\n' +
                  'Chế độ Online cần backend server.\n\n' +
                  'Để chơi Online:\n' +
                  '1. Deploy backend lên Render/Railway\n' +
                  '2. Sửa PRODUCTION_BACKEND trong script.js (dòng 23)\n' +
                  '3. Push code lên GitHub\n\n' +
                  'Hoặc test local:\n' +
                  '1. Chạy: cd BE && npm start\n' +
                  '2. Mở: http://localhost:5000\n\n' +
                  'Xem chi tiết trong DEPLOY_GUIDE.md');
            location.reload();
            return;
        }
        
        // Hiển thị tên người chơi đã đăng nhập
        const onlineNameEl = document.getElementById('onlinePlayerName');
        if (onlineNameEl && currentUser) {
            onlineNameEl.textContent = currentUser.username;
        }
        document.getElementById('loginPanel').style.display = 'block';
    }
}

function backToMenu() {
    // Cancel matchmaking if waiting
    if (socket && gameMode === 'local') {
        socket.emit('cancel_matchmaking');
    }
    location.reload();
}

// Matchmaking UI functions
function showMatchmakingScreen() {
    // Create matchmaking overlay
    const overlay = document.createElement('div');
    overlay.id = 'matchmakingOverlay';
    overlay.innerHTML = `
        <div class="matchmaking-container">
            <div class="matchmaking-spinner"></div>
            <h2 id="matchmakingStatus">🔍 Đang tìm đối thủ...</h2>
            <p>Vui lòng đợi trong giây lát</p>
            <button class="btn-control" onclick="cancelMatchmaking()">Hủy</button>
        </div>
    `;
    document.body.appendChild(overlay);
}

function hideMatchmakingScreen() {
    const overlay = document.getElementById('matchmakingOverlay');
    if (overlay) {
        overlay.remove();
    }
}

function updateMatchmakingStatus(message) {
    const statusEl = document.getElementById('matchmakingStatus');
    if (statusEl) {
        statusEl.textContent = message;
    }
}

function cancelMatchmaking() {
    if (socket) {
        socket.emit('cancel_matchmaking');
    }
    hideMatchmakingScreen();
    location.reload();
}

// ==================== AI MODE - VARIABLES & DATA ====================
var gameAI = null;
var boardElAI = null;
var selectedSquareAI = null;
var currentDepth = 2;
var timerAI = 300;
var timerIntervalAI = null;
var pendingPromotionMoveAI = null;
var userColor = 'w';

const pieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

const pst = {
    p: [
        [0,  0,  0,  0,  0,  0,  0,  0],
        [50, 50, 50, 50, 50, 50, 50, 50],
        [10, 10, 20, 30, 30, 20, 10, 10],
        [5,  5, 10, 25, 25, 10,  5,  5],
        [0,  0,  0, 20, 20,  0,  0,  0],
        [5, -5,-10,  0,  0,-10, -5,  5],
        [5, 10, 10,-20,-20, 10, 10,  5],
        [0,  0,  0,  0,  0,  0,  0,  0]
    ],
    n: [
        [-50,-40,-30,-30,-30,-30,-40,-50],
        [-40,-20,  0,  0,  0,  0,-20,-40],
        [-30,  0, 10, 15, 15, 10,  0,-30],
        [-30,  5, 15, 20, 20, 15,  5,-30],
        [-30,  0, 15, 20, 20, 15,  0,-30],
        [-30,  5, 10, 15, 15, 10,  5,-30],
        [-40,-20,  0,  5,  5,  0,-20,-40],
        [-50,-40,-30,-30,-30,-30,-40,-50]
    ],
    b: [ [-20,-10,-10,-10,-10,-10,-10,-20], [-10,0,0,0,0,0,0,-10], [-10,0,5,10,10,5,0,-10], [-10,5,5,10,10,5,5,-10], [-10,0,10,10,10,10,0,-10], [-10,10,10,10,10,10,10,-10], [-10,5,0,0,0,0,5,-10], [-20,-10,-10,-10,-10,-10,-10,-20] ],
    r: [ [0,0,0,0,0,0,0,0], [5,10,10,10,10,10,10,5], [-5,0,0,0,0,0,0,-5], [-5,0,0,0,0,0,0,-5], [-5,0,0,0,0,0,0,-5], [-5,0,0,0,0,0,0,-5], [-5,0,0,0,0,0,0,-5], [0,0,0,5,5,0,0,0] ],
    q: [ [-20,-10,-10,-5,-5,-10,-10,-20], [-10,0,0,0,0,0,0,-10], [-10,0,5,5,5,5,0,-10], [-5,0,5,5,5,5,0,-5], [0,0,5,5,5,5,0,-5], [-10,5,5,5,5,5,0,-10], [-10,0,5,0,0,0,0,-10], [-20,-10,-10,-5,-5,-10,-10,-20] ],
    k: [ [-30,-40,-40,-50,-50,-40,-40,-30], [-30,-40,-40,-50,-50,-40,-40,-30], [-30,-40,-40,-50,-50,-40,-40,-30], [-30,-40,-40,-50,-50,-40,-40,-30], [-20,-30,-30,-40,-40,-30,-30,-20], [-10,-20,-20,-20,-20,-20,-20,-10], [20, 20,  0,  0,  0,  0, 20, 20], [20, 30, 10,  0,  0, 10, 30, 20] ]
};

function evaluateBoard(gameNode) {
    let totalEvaluation = 0;
    const board = gameNode.board();

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece) {
                let value = pieceValues[piece.type];
                let pstValue = 0;
                if (piece.color === 'w') {
                    pstValue = pst[piece.type][row][col];
                } else {
                    pstValue = pst[piece.type][7 - row][col];
                }
                if (piece.color === 'w') {
                    totalEvaluation += (value + pstValue);
                } else {
                    totalEvaluation -= (value + pstValue);
                }
            }
        }
    }
    return totalEvaluation;
}

function orderMoves(moves) {
    return moves.sort((a, b) => {
        if (a.captured && !b.captured) return -1;
        if (!a.captured && b.captured) return 1;
        if (a.captured && b.captured) {
            const valA = pieceValues[a.captured] || 0;
            const valB = pieceValues[b.captured] || 0;
            return valB - valA;
        }
        if (a.promotion && !b.promotion) return -1;
        if (!a.promotion && b.promotion) return 1;
        return 0; 
    });
}

function minimax(gameNode, depth, alpha, beta, isMaximizingPlayer) {
    if (depth === 0 || gameNode.game_over()) {
        return evaluateBoard(gameNode);
    }

    let newGameMoves = gameNode.moves({ verbose: true });
    newGameMoves = orderMoves(newGameMoves);

    if (isMaximizingPlayer) {
        let maxEval = -Infinity;
        for (let i = 0; i < newGameMoves.length; i++) {
            gameNode.move(newGameMoves[i]);
            const ev = minimax(gameNode, depth - 1, alpha, beta, false);
            gameNode.undo();
            maxEval = Math.max(maxEval, ev);
            alpha = Math.max(alpha, ev);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (let i = 0; i < newGameMoves.length; i++) {
            gameNode.move(newGameMoves[i]);
            const ev = minimax(gameNode, depth - 1, alpha, beta, true);
            gameNode.undo();
            minEval = Math.min(minEval, ev);
            beta = Math.min(beta, ev);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

function makeBestMove() {
    const aiColor = userColor === 'w' ? 'b' : 'w';
    if (gameAI.turn() !== aiColor) return; 

    let possibleMoves = gameAI.moves({ verbose: true });
    if (possibleMoves.length === 0) return;
    possibleMoves = orderMoves(possibleMoves);
    let bestMove = null;
    let bestValue = (aiColor === 'w') ? -Infinity : Infinity;

    for (let i = 0; i < possibleMoves.length; i++) {
        gameAI.move(possibleMoves[i]);
        const isNextTurnMaximizing = (aiColor === 'b');
        const boardValue = minimax(gameAI, currentDepth - 1, -Infinity, Infinity, isNextTurnMaximizing);
        gameAI.undo();

        if (aiColor === 'w') {
            if (boardValue > bestValue) {
                bestValue = boardValue;
                bestMove = possibleMoves[i];
            }
        } else {
            if (boardValue < bestValue) {
                bestValue = boardValue;
                bestMove = possibleMoves[i];
            }
        }
    }

    if (bestMove) {
        gameAI.move(bestMove);
        afterMoveLogicAI();
    }
}

function updateStatusAI(text, isThinking = false) {
    const statusEl = document.getElementById('game-status');
    if (statusEl) {
        statusEl.textContent = text;
        if (isThinking) {
            statusEl.style.color = '#111010ff';
            statusEl.innerHTML = 'Lượt của đen... <span class="loading-dots">...</span>'; 
        } else {
            statusEl.style.color = '#333';
        }
    }
}

function renderBoardAI() {
    boardElAI = document.getElementById('chessboard-ai');
    if (!boardElAI) return;
    
    boardElAI.innerHTML = '';
    const board = gameAI.board();
    const rows = (userColor === 'w') ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
    const cols = (userColor === 'w') ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
    
    rows.forEach(row => {
        cols.forEach(col => {
            const squareDiv = document.createElement('div');
            const isLight = (row + col) % 2 === 0;
            squareDiv.className = `square ${isLight ? 'light' : 'dark'}`;
            
            const squareId = String.fromCharCode(97 + col) + (8 - row);
            squareDiv.dataset.square = squareId;

            if (selectedSquareAI === squareId) squareDiv.classList.add('selected');
            if (selectedSquareAI && document.getElementById('toggle-hint') && document.getElementById('toggle-hint').checked) {
                const moves = gameAI.moves({ square: selectedSquareAI, verbose: true });
                if (moves.find(m => m.to === squareId)) {
                    squareDiv.classList.add('highlight');
                }
            }

            const piece = board[row][col];
            if (piece) {
                const pieceDiv = document.createElement('div');
                pieceDiv.className = 'piece';
                pieceDiv.textContent = pieceSymbols[piece.color][piece.type];
                if (piece.color === gameAI.turn()) pieceDiv.style.cursor = 'pointer';
                squareDiv.appendChild(pieceDiv);
            }

            squareDiv.addEventListener('click', () => onSquareClickAI(squareId));
            boardElAI.appendChild(squareDiv);
        });
    });
    updateStatusUIAI();
}

function onSquareClickAI(clickedSquare) {
    if (!selectedSquareAI) {
        const piece = gameAI.get(clickedSquare);
        if (piece && piece.color === gameAI.turn() && piece.color === userColor) {
            selectedSquareAI = clickedSquare;
            renderBoardAI();
        }
        return;
    }

    const piece = gameAI.get(selectedSquareAI);
    const isPawn = piece && piece.type === 'p';
    const isPromotionRank = (piece.color === 'w' && clickedSquare[1] === '8') || 
                            (piece.color === 'b' && clickedSquare[1] === '1');
    
    const moves = gameAI.moves({ verbose: true, square: selectedSquareAI });
    const validMove = moves.find(m => m.to === clickedSquare);

    if (validMove && isPawn && isPromotionRank) {
        pendingPromotionMoveAI = { from: selectedSquareAI, to: clickedSquare };
        document.getElementById('promotion-modal-ai').classList.add('active');
        return; 
    }

    try {
        const move = gameAI.move({
            from: selectedSquareAI,
            to: clickedSquare,
            promotion: 'q'
        });

        if (move) {
            afterMoveLogicAI();
        } else {
            const p = gameAI.get(clickedSquare);
            if (p && p.color === gameAI.turn()) selectedSquareAI = clickedSquare;
            else selectedSquareAI = null;
            renderBoardAI();
        }
    } catch (e) {
        selectedSquareAI = null;
        renderBoardAI();
    }
}

function afterMoveLogicAI() {
    selectedSquareAI = null;
    renderBoardAI();
    
    if (gameAI.game_over()) {
        stopTimerAI();
        showGameOverAI();
        return;
    }

    if (gameAI.turn() !== userColor) {
        updateStatusAI(" Đối thủ đang suy nghĩ...", true);
        stopTimerAI();
        setTimeout(() => {
            makeBestMove(); 
        }, 100); 
    } else {
        updateStatusAI(" Lượt của bạn");
        startTimerAI();
    }
}

function showGameOverAI() {
    stopTimerAI();
    
    if (gameAI.in_checkmate()) {
        if (gameAI.turn() === userColor) {
            showPopupResultAI(" BẠN THUA!", "Bạn đã bị chiếu bí.", "#d9534f");
        } else {
            showPopupResultAI(" CHIẾN THẮNG!", "Chúc mừng! Bạn đã chiếu bí máy.", "#28a745");
        }
    } else if (gameAI.in_draw()) {
        showPopupResultAI(" HÒA CỜ", "Ván đấu kết thúc với tỉ số hòa.", "#666");
    }
}

function showPopupResultAI(title, message, color) {
    const modal = document.getElementById('game-over-modal');
    const titleEl = document.getElementById('game-over-title');
    const msgEl = document.getElementById('game-over-message');
    const contentEl = modal.querySelector('.modal-content');

    titleEl.textContent = title;
    titleEl.style.color = color;
    contentEl.style.borderColor = color;
    msgEl.textContent = message;
    modal.classList.add('active');
}

function updateStatusUIAI() {
    const history = gameAI.history({ verbose: true });
    const whiteLost = [];
    const blackLost = [];

    history.forEach(move => {
        if (move.captured) {
            if (move.color === 'w') {
                blackLost.push(move.captured);
            } else {
                whiteLost.push(move.captured);
            }
        }
    });

    const sortOrder = { q: 1, r: 2, b: 3, n: 4, p: 5 };
    whiteLost.sort((a, b) => sortOrder[a] - sortOrder[b]);
    blackLost.sort((a, b) => sortOrder[a] - sortOrder[b]);

    const whiteDiv = document.getElementById('captured-white');
    const blackDiv = document.getElementById('captured-black');
    
    if (whiteDiv) whiteDiv.innerHTML = '';
    if (blackDiv) blackDiv.innerHTML = '';

    whiteLost.forEach(type => {
        const span = document.createElement('span');
        span.className = 'captured-piece';
        span.textContent = pieceSymbols['w'][type];
        span.style.color = '#ccc';
        span.style.fontSize = '24px';
        span.style.marginRight = '5px';
        if (whiteDiv) whiteDiv.appendChild(span);
    });

    blackLost.forEach(type => {
        const span = document.createElement('span');
        span.className = 'captured-piece';
        span.textContent = pieceSymbols['b'][type];
        span.style.color = '#333';
        span.style.fontSize = '24px';
        span.style.marginRight = '5px';
        if (blackDiv) blackDiv.appendChild(span);
    });
}

function promotePieceAI(type) {
    if (!pendingPromotionMoveAI) return;
    const code = type === 'knight' ? 'n' : type.charAt(0);
    gameAI.move({
        from: pendingPromotionMoveAI.from,
        to: pendingPromotionMoveAI.to,
        promotion: code
    });
    document.getElementById('promotion-modal-ai').classList.remove('active');
    pendingPromotionMoveAI = null;
    afterMoveLogicAI();
}

function startTimerAI() {
    const toggleEl = document.getElementById('toggle-timer');
    const isTimerEnabled = toggleEl ? toggleEl.checked : false;
    if (!isTimerEnabled) return; 
    if (timerIntervalAI) return;

    timerIntervalAI = setInterval(() => {
        timerAI--;
        updateTimerDisplayAI();
        if (timerAI <= 0) {
            stopTimerAI();
            showPopupResultAI("⌛ HẾT GIỜ!", "Rất tiếc, bạn đã hết thời gian. Đối thủ thắng!", "#d9534f");
        }
    }, 1000);
}

function stopTimerAI() {
    clearInterval(timerIntervalAI);
    timerIntervalAI = null;
}

function resetTimerAI() {
    stopTimerAI();
    timerAI = 300;
    updateTimerDisplayAI();
}

function updateTimerDisplayAI() {
    const m = Math.floor(timerAI / 60);
    const s = timerAI % 60;
    const display = document.getElementById('timer-display-ai');
    if (display) {
        display.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
}

function adjustTimeAI(seconds) {
    if (timerIntervalAI) return;
    timerAI += seconds;
    if (timerAI < 60) timerAI = 60;
    updateTimerDisplayAI();
}

// AI Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const promoteQueen = document.getElementById('promote-queen');
    const promoteRook = document.getElementById('promote-rook');
    const promoteBishop = document.getElementById('promote-bishop');
    const promoteKnight = document.getElementById('promote-knight');
    
    if (promoteQueen) promoteQueen.onclick = () => promotePieceAI('queen');
    if (promoteRook) promoteRook.onclick = () => promotePieceAI('rook');
    if (promoteBishop) promoteBishop.onclick = () => promotePieceAI('bishop');
    if (promoteKnight) promoteKnight.onclick = () => promotePieceAI('knight');

    const btnTimeStart = document.getElementById('btn-time-start');
    const btnTimePause = document.getElementById('btn-time-pause');
    const btnTimeReset = document.getElementById('btn-time-reset');
    const btnTimeUp = document.getElementById('btn-time-up');
    const btnTimeDown = document.getElementById('btn-time-down');
    
    if (btnTimeStart) btnTimeStart.onclick = startTimerAI;
    if (btnTimePause) btnTimePause.onclick = stopTimerAI;
    if (btnTimeReset) btnTimeReset.onclick = resetTimerAI;
    if (btnTimeUp) btnTimeUp.onclick = () => adjustTimeAI(60);
    if (btnTimeDown) btnTimeDown.onclick = () => adjustTimeAI(-60);

    const toggleTimer = document.getElementById('toggle-timer');
    if (toggleTimer) {
        toggleTimer.onchange = (e) => {
            const displayEl = document.getElementById('timer-display-ai');
            if (e.target.checked) {
                if (gameAI && gameAI.turn() === userColor) startTimerAI();
                if (displayEl) {
                    displayEl.style.color = '#333';
                    displayEl.style.textDecoration = 'none';
                }
            } else {
                stopTimerAI();
                if (displayEl) {
                    displayEl.style.color = '#ccc';
                    displayEl.style.textDecoration = 'line-through';
                }
            }
        };
    }

    const btnRestart = document.getElementById('btn-restart');
    if (btnRestart) {
        btnRestart.onclick = () => {
            document.getElementById('restart-modal').classList.add('active');
        };
    }

    const cancelRestartBtn = document.getElementById('cancel-restart-btn');
    if (cancelRestartBtn) {
        cancelRestartBtn.onclick = () => {
            document.getElementById('restart-modal').classList.remove('active');
        };
    }

    const confirmRestartBtn = document.getElementById('confirm-restart-btn');
    if (confirmRestartBtn) {
        confirmRestartBtn.onclick = () => {
            document.getElementById('restart-modal').classList.remove('active');
            gameAI.reset();
            resetTimerAI();
            selectedSquareAI = null;
            renderBoardAI();
            document.getElementById('chooseColorModal').classList.add('active');
        };
    }

    const btnUndo = document.getElementById('btn-undo');
    if (btnUndo) {
        btnUndo.onclick = () => {
            if (gameAI) {
                gameAI.undo();
                gameAI.undo();
                renderBoardAI();
            }
        };
    }

    const aiLevel = document.getElementById('ai-level');
    if (aiLevel) {
        aiLevel.onchange = (e) => {
            currentDepth = parseInt(e.target.value);
        };
    }

    const btnRules = document.getElementById('btn-rules');
    if (btnRules) {
        btnRules.onclick = () => {
            document.getElementById('rules-modal').classList.add('active');
        };
    }

    const closeBtn = document.querySelector('#rules-modal .close-btn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            document.getElementById('rules-modal').classList.remove('active');
        };
    }

    const levelBtns = document.querySelectorAll('.level-btn');
    levelBtns.forEach(btn => {
        btn.onclick = () => {
            currentDepth = parseInt(btn.dataset.level);
            const aiLevelEl = document.getElementById('ai-level');
            if (aiLevelEl) aiLevelEl.value = currentDepth;
            document.getElementById('level-selection-modal').classList.remove('active');
            document.getElementById('chooseColorModal').classList.add('active');
        };
    });

    const chooseWhite = document.getElementById('chooseWhite');
    if (chooseWhite) {
        chooseWhite.onclick = function() {
            userColor = 'w';
            document.getElementById('chooseColorModal').classList.remove('active');
            renderBoardAI();
        };
    }

    const chooseBlack = document.getElementById('chooseBlack');
    if (chooseBlack) {
        chooseBlack.onclick = function() {
            userColor = 'b';
            document.getElementById('chooseColorModal').classList.remove('active');
            renderBoardAI();
            setTimeout(makeBestMove, 500);
        };
    }

    const btnResign = document.getElementById('btn-resign');
    if (btnResign) {
        btnResign.onclick = () => {
            if (gameAI && !gameAI.game_over()) {
                document.getElementById('resign-modal').classList.add('active');
            }
        };
    }

    const cancelResignBtn = document.getElementById('cancel-resign-btn');
    if (cancelResignBtn) {
        cancelResignBtn.onclick = () => {
            document.getElementById('resign-modal').classList.remove('active');
        };
    }

    const confirmResignBtn = document.getElementById('confirm-resign-btn');
    if (confirmResignBtn) {
        confirmResignBtn.onclick = () => {
            document.getElementById('resign-modal').classList.remove('active');
            stopTimerAI();
            showPopupResultAI("🏳️ ĐẦU HÀNG", "Bạn đã chịu thua. Đối thủ thắng!", "#d9534f");
        };
    }

    const btnGameoverRestart = document.getElementById('btn-gameover-restart');
    if (btnGameoverRestart) {
        btnGameoverRestart.onclick = () => {
            document.getElementById('game-over-modal').classList.remove('active');
            gameAI.reset();
            resetTimerAI();
            selectedSquareAI = null;
            renderBoardAI();
            updateStatusAI(" Ván mới bắt đầu");
            document.getElementById('chooseColorModal').classList.add('active');
        };
    }
});

// ==================== ONLINE MODE - SOCKET EVENTS ====================

// Connect event đã được định nghĩa ở trên (dòng 16-28)

socket.on('room_joined', function(data) {
    currentPlayerColor = data.player_color;
    currentRoomId = data.room_id;
    gameState = data.game_state;
    
    // Load FEN từ server vào Chess.js
    gameOnline.load(data.game_state.fen);
    
    document.getElementById('loginPanel').style.display = 'none';
    document.getElementById('gameContainer').classList.add('active');
    document.getElementById('currentRoomDisplay').textContent = data.room_id;
    
    updateBoard();
    updateStatus();
    showMessage(`Vào phòng thành công! Bạn chơi với màu ${currentPlayerColor === 'white' ? '♔ Trắng' : '♚ Đen'}`, 'success', 'gameSuccess');
});

socket.on('player_joined', function(data) {
    gameState = data.game_state;
    gameOnline.load(data.game_state.fen);
    updateBoard();
    updateStatus();
    showMessage(`${data.player_name} đã vào phòng! Trận đấu bắt đầu!`, 'success', 'gameSuccess');
});

socket.on('move_made', function(data) {
    gameState = data.game_state;
    
    // Load FEN từ server (đồng bộ game state)
    gameOnline.load(data.game_state.fen);
    
    // Clear highlights và selected square
    selectedSquare = null;
    clearHighlights();
    
    updateBoard();
    updateStatus();
    addMoveToHistory(data.from, data.to);
    
    // Hiển thị thông báo nếu là nước đi của đối thủ
    if (data.player_name !== currentUser.username) {
        showMessage(`${data.player_name} đã đi: ${data.from} → ${data.to}`, 'success', 'gameSuccess');
    } else {
        showMessage('Nước đi thành công!', 'success', 'gameSuccess');
    }
});

socket.on('game_reset', function(data) {
    gameState = data.game_state;
    gameOnline.load(data.game_state.fen);
    selectedSquare = null;
    clearHighlights();
    updateBoard();
    updateStatus();
    document.getElementById('movesList').innerHTML = '';
    showMessage('Trò chơi đã được đặt lại', 'success', 'gameSuccess');
});

socket.on('error', function(data) {
    showMessage(data.message, 'error', 'gameError');
});

socket.on('player_left', function(data) {
    showMessage('Người chơi khác đã rời phòng', 'error', 'gameError');
});

socket.on('game_over', function(data) {
    showMessage(`🏁 ${data.result}`, 'success', 'gameSuccess');
});

// ==================== LOCAL MODE - CHESS LOGIC ====================

function renderBoardLocal() {
    const boardEl = document.getElementById('chessboard-local');
    boardEl.innerHTML = '';
    const board = game.board();

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const squareDiv = document.createElement('div');
            const isLight = (row + col) % 2 === 0;
            squareDiv.className = `square ${isLight ? 'light' : 'dark'}`;
            
            const squareId = String.fromCharCode(97 + col) + (8 - row);
            squareDiv.dataset.square = squareId;

            if (selectedSquare === squareId) squareDiv.classList.add('selected');

            const piece = board[row][col];
            if (piece) {
                const pieceDiv = document.createElement('div');
                pieceDiv.className = 'piece';
                pieceDiv.textContent = pieceSymbols[piece.color][piece.type];
                pieceDiv.style.cursor = 'pointer';
                squareDiv.appendChild(pieceDiv);
            }

            squareDiv.addEventListener('click', () => onSquareClickLocal(squareId));
            boardEl.appendChild(squareDiv);
        }
    }
    updateStatusLocal();
}

function onSquareClickLocal(clickedSquare) {
    if (!selectedSquare) {
        const piece = game.get(clickedSquare);
        if (piece && piece.color === game.turn()) {
            selectedSquare = clickedSquare;
            renderBoardLocal();
        }
        return;
    }

    // Xử lý phong cấp
    const piece = game.get(selectedSquare);
    const isPawn = piece && piece.type === 'p';
    const isPromotionRank = (piece.color === 'w' && clickedSquare[1] === '8') || 
                            (piece.color === 'b' && clickedSquare[1] === '1');
    
    const moves = game.moves({ verbose: true, square: selectedSquare });
    const validMove = moves.find(m => m.to === clickedSquare);

    if (validMove && isPawn && isPromotionRank) {
        pendingPromotionMove = { from: selectedSquare, to: clickedSquare };
        document.getElementById('promotion-modal-local').classList.add('active');
        return;
    }

    try {
        const move = game.move({
            from: selectedSquare,
            to: clickedSquare,
            promotion: 'q'
        });

        if (move) {
            selectedSquare = null;
            renderBoardLocal();
            checkGameOverLocal();
        } else {
            const p = game.get(clickedSquare);
            if (p && p.color === game.turn()) selectedSquare = clickedSquare;
            else selectedSquare = null;
            renderBoardLocal();
        }
    } catch (e) {
        selectedSquare = null;
        renderBoardLocal();
    }
}

function promotePieceLocal(type) {
    if (!pendingPromotionMove) return;
    
    const code = type === 'knight' ? 'n' : type.charAt(0);
    game.move({
        from: pendingPromotionMove.from,
        to: pendingPromotionMove.to,
        promotion: code
    });

    document.getElementById('promotion-modal-local').classList.remove('active');
    pendingPromotionMove = null;
    selectedSquare = null;
    renderBoardLocal();
    checkGameOverLocal();
    updateTimerDisplay(); // Update timer highlight after move
}

function checkGameOverLocal() {
    if (game.game_over()) {
        stopTimer();
        if (game.in_checkmate()) {
            const winner = game.turn() === 'w' ? 'Đen' : 'Trắng';
            showMessageLocal(`🎉 ${winner} chiến thắng!`, 'success');
        } else if (game.in_draw()) {
            showMessageLocal('🤝 Hòa cờ!', 'success');
        }
    } else if (game.in_check()) {
        showMessageLocal('⚠️ Chiếu!', 'warning');
    }
    updateTimerDisplay(); // Update timer highlight
}

function updateStatusLocal() {
    const statusEl = document.getElementById('game-status-local');
    if (statusEl) {
        const turn = game.turn() === 'w' ? '♔ Trắng' : '♚ Đen';
        statusEl.textContent = turn;
    }
    updateTimerDisplay(); // Update timer highlight when turn changes
}

function showMessageLocal(message, type) {
    const msgEl = document.getElementById('message-local');
    if (msgEl) {
        msgEl.textContent = message;
        msgEl.className = `message ${type}`;
        msgEl.classList.add('show');
        setTimeout(() => msgEl.classList.remove('show'), 3000);
    }
}

function resetGameLocal() {
    if (confirm('Bạn có chắc chắn muốn chơi lại?')) {
        game.reset();
        selectedSquare = null;
        resetTimer();
        renderBoardLocal();
    }
}

function resignGame() {
    const currentTurn = game.turn() === 'w' ? 'Trắng' : 'Đen';
    if (confirm(`Bạn có chắc chắn muốn đầu hàng?\n${currentTurn} sẽ thua!`)) {
        const winner = game.turn() === 'w' ? 'Đen' : 'Trắng';
        stopTimer();
        showMessageLocal(`🏳️ ${currentTurn} đã đầu hàng! ${winner} thắng!`, 'info');
        setTimeout(() => {
            if (confirm('Chơi lại?')) {
                resetGameLocal();
            }
        }, 1000);
    }
}

// Timer functions - Separate for each player
function startTimer() {
    if (timerInterval) return;
    
    timerInterval = setInterval(() => {
        // Get current turn
        const currentTurn = game.turn(); // 'w' or 'b'
        
        // Decrement timer for current player
        if (currentTurn === 'w') {
            timerWhite--;
            if (timerWhite <= 0) {
                stopTimer();
                showMessageLocal('⏰ Hết giờ! Đen thắng!', 'error');
                setTimeout(() => {
                    if (confirm('Chơi lại?')) {
                        resetGameLocal();
                    }
                }, 1000);
                return;
            }
        } else {
            timerBlack--;
            if (timerBlack <= 0) {
                stopTimer();
                showMessageLocal('⏰ Hết giờ! Trắng thắng!', 'error');
                setTimeout(() => {
                    if (confirm('Chơi lại?')) {
                        resetGameLocal();
                    }
                }, 1000);
                return;
            }
        }
        
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

function resetTimer() {
    stopTimer();
    timerWhite = 600;
    timerBlack = 600;
    updateTimerDisplay();
}

function updateTimerDisplay() {
    // Update white timer
    const mWhite = Math.floor(timerWhite / 60);
    const sWhite = timerWhite % 60;
    const displayWhite = document.getElementById('timer-white');
    if (displayWhite) {
        displayWhite.textContent = `${mWhite.toString().padStart(2, '0')}:${sWhite.toString().padStart(2, '0')}`;
    }
    
    // Update black timer
    const mBlack = Math.floor(timerBlack / 60);
    const sBlack = timerBlack % 60;
    const displayBlack = document.getElementById('timer-black');
    if (displayBlack) {
        displayBlack.textContent = `${mBlack.toString().padStart(2, '0')}:${sBlack.toString().padStart(2, '0')}`;
    }
    
    // Highlight active timer
    const currentTurn = game.turn();
    if (displayWhite && displayBlack) {
        if (currentTurn === 'w') {
            displayWhite.classList.add('timer-active');
            displayBlack.classList.remove('timer-active');
        } else {
            displayBlack.classList.add('timer-active');
            displayWhite.classList.remove('timer-active');
        }
    }
}

// ==================== ONLINE MODE - GAME FUNCTIONS ====================

// Tạo phòng mới
function createRoom() {
    if (!socket) {
        alert('❌ CHƯA CẤU HÌNH BACKEND!\n\nVui lòng:\n1. Deploy backend lên Render/Railway\n2. Sửa PRODUCTION_BACKEND trong script.js (dòng 23)\n3. Push code lên GitHub\n\nXem hướng dẫn trong DEPLOY_GUIDE.md');
        return;
    }
    
    if (!currentUser) {
        showMessage('Vui lòng đăng nhập trước!', 'error', 'loginError');
        return;
    }

    // Tạo Room ID ngẫu nhiên
    const newRoomId = 'room_' + Math.random().toString(36).substring(2, 9);
    
    // Tự động join vào phòng vừa tạo
    socket.emit('join_room', {
        room_id: newRoomId,
        player_name: currentUser.username
    });
    
    // Hiển thị Room ID để copy
    document.getElementById('displayRoomId').textContent = newRoomId;
    document.getElementById('roomIdDisplay').style.display = 'block';
    document.getElementById('roomInputGroup').style.display = 'none';
    document.getElementById('onlineButtons').style.display = 'none';
    
    showMessage('Đang tạo phòng và chờ kết nối server...', 'success', 'loginSuccess');
}

// Vào phòng có sẵn
function joinRoom() {
    if (!socket) {
        alert('❌ CHƯA CẤU HÌNH BACKEND!\n\nVui lòng:\n1. Deploy backend lên Render/Railway\n2. Sửa PRODUCTION_BACKEND trong script.js (dòng 23)\n3. Push code lên GitHub\n\nXem hướng dẫn trong DEPLOY_GUIDE.md');
        return;
    }
    
    if (!currentUser) {
        showMessage('Vui lòng đăng nhập trước!', 'error', 'loginError');
        return;
    }

    const roomId = document.getElementById('roomId').value.trim();

    if (!roomId) {
        showMessage('Vui lòng nhập ID phòng!', 'error', 'loginError');
        return;
    }

    showMessage('Đang vào phòng...', 'success', 'loginSuccess');
    
    // Emit vào phòng với tên từ currentUser
    socket.emit('join_room', {
        room_id: roomId,
        player_name: currentUser.username
    });
}

// Copy Room ID
function copyRoomId() {
    const roomId = document.getElementById('displayRoomId').textContent;
    navigator.clipboard.writeText(roomId).then(() => {
        showMessage('Đã copy ID phòng!', 'success', 'loginSuccess');
    }).catch(() => {
        // Fallback cho trình duyệt cũ
        const input = document.createElement('input');
        input.value = roomId;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showMessage('Đã copy ID phòng!', 'success', 'loginSuccess');
    });
}

// Copy Room ID từ game đang chơi
function copyCurrentRoomId() {
    if (currentRoomId) {
        navigator.clipboard.writeText(currentRoomId).then(() => {
            showMessage('Đã copy ID phòng!', 'success', 'gameSuccess');
        }).catch(() => {
            const input = document.createElement('input');
            input.value = currentRoomId;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            showMessage('Đã copy ID phòng!', 'success', 'gameSuccess');
        });
    }
}

// Giữ lại hàm cũ để tương thích
function joinGame() {
    joinRoom();
}

function resetGame() {
    if (confirm('Bạn có chắc chắn muốn chơi lại?')) {
        // Emit tới server - server sẽ reset và broadcast
        socket.emit('reset_game', { room_id: currentRoomId });
        showMessage('Đang đặt lại game...', 'success', 'gameSuccess');
    }
}

function leaveGame() {
    if (confirm('Bạn có chắc chắn muốn rời phòng?')) {
        location.reload();
    }
}

function updateBoard() {
    const boardEl = document.getElementById('chessboard');
    boardEl.innerHTML = '';

    // Load FEN vào Chess.js nếu có
    if (gameState.fen) {
        gameOnline.load(gameState.fen);
    }

    const board = gameOnline.board();

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const squareDiv = document.createElement('div');
            const isLight = (row + col) % 2 === 0;
            squareDiv.className = `square ${isLight ? 'light' : 'dark'}`;
            
            const squareId = String.fromCharCode(97 + col) + (8 - row);
            squareDiv.dataset.square = squareId;

            if (selectedSquare === squareId) squareDiv.classList.add('selected');

            const piece = board[row][col];
            if (piece) {
                const pieceDiv = document.createElement('div');
                pieceDiv.className = 'piece';
                pieceDiv.textContent = pieceSymbols[piece.color][piece.type];
                pieceDiv.style.cursor = 'pointer';
                squareDiv.appendChild(pieceDiv);
            }

            squareDiv.addEventListener('click', () => handleSquareClick(squareId));
            boardEl.appendChild(squareDiv);
        }
    }
}

function updateStatus() {
    const turn = gameOnline.turn() === 'w' ? 'white' : 'black';
    document.getElementById('currentTurn').textContent = 
        turn === 'white' ? '♔ Trắng' : '♚ Đen';

    const turnStatus = document.getElementById('turnStatus');
    if (turn === currentPlayerColor) {
        turnStatus.classList.add('active');
    } else {
        turnStatus.classList.remove('active');
    }

    // Update game status messages
    if (gameOnline.in_checkmate()) {
        const winner = turn === 'white' ? 'Đen' : 'Trắng';
        showMessage(`🎉 Chiến thắng! ${winner} chiến thắng!`, 'success', 'gameSuccess');
    } else if (gameOnline.in_draw() || gameOnline.in_stalemate()) {
        showMessage('🤝 Hòa! Không còn nước đi hợp lệ', 'success', 'gameSuccess');
    } else if (gameOnline.in_check()) {
        showMessage('⚠️ Vua bị chiếu!', 'warning', 'gameSuccess');
    }
}

function handleSquareClick(clickedSquare) {
    const turn = gameOnline.turn() === 'w' ? 'white' : 'black';
    
    if (turn !== currentPlayerColor) {
        showMessage('Chưa đến lượt của bạn', 'error', 'gameError');
        return;
    }

    if (!selectedSquare) {
        // Chọn quân cờ
        const piece = gameOnline.get(clickedSquare);
        if (piece && ((currentPlayerColor === 'white' && piece.color === 'w') || 
                       (currentPlayerColor === 'black' && piece.color === 'b'))) {
            selectedSquare = clickedSquare;
            updateBoard(); // Re-render để hiển thị selected
            highlightPossibleMoves(clickedSquare);
        }
    } else {
        if (selectedSquare === clickedSquare) {
            // Bỏ chọn
            selectedSquare = null;
            clearHighlights();
            updateBoard();
        } else {
            // Kiểm tra xem có click vào quân khác của mình không
            const clickedPiece = gameOnline.get(clickedSquare);
            if (clickedPiece && ((currentPlayerColor === 'white' && clickedPiece.color === 'w') || 
                                  (currentPlayerColor === 'black' && clickedPiece.color === 'b'))) {
                // Chọn quân khác
                selectedSquare = clickedSquare;
                clearHighlights();
                updateBoard();
                highlightPossibleMoves(clickedSquare);
            } else {
                // Thử di chuyển
                const from = selectedSquare;
                const to = clickedSquare;
                
                // Kiểm tra phong cấp
                const piece = gameOnline.get(from);
                if (piece && piece.type === 'p' && 
                    ((piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1'))) {
                    pendingPromotionMoveOnline = { from, to };
                    document.getElementById('promotion-modal-online').classList.add('active');
                } else {
                    attemptMove(from, to);
                }
                selectedSquare = null;
                clearHighlights();
            }
        }
    }
}

function highlightPossibleMoves(fromSquare) {
    const moves = gameOnline.moves({ square: fromSquare, verbose: true });
    moves.forEach(move => {
        const square = document.querySelector(`[data-square="${move.to}"]`);
        if (square) {
            if (move.captured) {
                square.classList.add('possible-move', 'capture');
            } else {
                square.classList.add('possible-move');
            }
        }
    });
}

function clearHighlights() {
    document.querySelectorAll('.square.selected, .square.possible-move').forEach(el => {
        el.classList.remove('selected', 'possible-move', 'capture');
    });
}

function attemptMove(from, to, promotion) {
    // Kiểm tra nước đi hợp lệ trước khi emit (client-side validation)
    const moveObj = { from, to };
    if (promotion) moveObj.promotion = promotion;
    
    // Test move (không thực sự thay đổi game state)
    const testGame = new Chess(gameOnline.fen());
    const testMove = testGame.move(moveObj);
    
    if (!testMove) {
        showMessage('Nước đi không hợp lệ!', 'error', 'gameError');
        clearHighlights();
        updateBoard();
        return;
    }
    
    // Hiển thị loading state
    showMessage('Đang gửi nước đi...', 'success', 'gameSuccess');
    
    // Emit move tới server - server sẽ validate và broadcast
    socket.emit('make_move', {
        room_id: currentRoomId,
        from: from,
        to: to,
        promotion: promotion
    });
    
    // Game state sẽ được cập nhật từ socket event 'move_made'
}

function checkGameOverOnline() {
    if (gameOnline.game_over()) {
        if (gameOnline.in_checkmate()) {
            const winner = gameOnline.turn() === 'w' ? 'Đen' : 'Trắng';
            showMessage(`🎉 ${winner} chiến thắng!`, 'success', 'gameSuccess');
        } else if (gameOnline.in_draw() || gameOnline.in_stalemate()) {
            showMessage('🤝 Hòa cờ!', 'success', 'gameSuccess');
        }
    }
}

function promoteOnline(type) {
    if (!pendingPromotionMoveOnline) return;
    
    const code = type === 'knight' ? 'n' : type.charAt(0);
    attemptMove(
        pendingPromotionMoveOnline.from,
        pendingPromotionMoveOnline.to,
        code
    );
    
    document.getElementById('promotion-modal-online').classList.remove('active');
    pendingPromotionMoveOnline = null;
}

function addMoveToHistory(from, to) {
    const movesList = document.getElementById('movesList');
    const moveNumber = Math.floor((gameState.moves_history.length) / 2) + 1;
    const moveItem = document.createElement('div');
    moveItem.className = 'move-item';
    moveItem.textContent = `${moveNumber}. ${from} → ${to}`;
    movesList.appendChild(moveItem);
    movesList.parentElement.scrollTop = movesList.parentElement.scrollHeight;
}

function showMessage(message, type, elementId) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.classList.add('show');

    setTimeout(() => {
        element.classList.remove('show');
    }, 5000);
}

// Xóa đoạn tự động tạo Room ID
// Để người dùng chủ động tạo hoặc nhập
