// ==================== 1. KHỞI TẠO & CẤU HÌNH ====================
var game = new Chess();
var boardEl = document.getElementById('chessboard');
var selectedSquare = null;
var currentDepth = 2; // Độ khó mặc định
var timer = 300;      // Thời gian 5 phút
var timerInterval = null;
var pendingPromotionMove = null; // Lưu nước đi chờ phong cấp
var userColor = 'w';
// Bản đồ ký hiệu quân cờ
const pieceSymbols = {
    w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
    b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' }
};

// ==================== 2. DATA TRÍ TUỆ NHÂN TẠO (HEURISTIC) ====================
const pieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

// Bảng điểm vị trí (Piece-Square Tables)
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
    // Dùng chung bảng cho các quân khác để tiết kiệm code
    b: [ [-20,-10,-10,-10,-10,-10,-10,-20], [-10,0,0,0,0,0,0,-10], [-10,0,5,10,10,5,0,-10], [-10,5,5,10,10,5,5,-10], [-10,0,10,10,10,10,0,-10], [-10,10,10,10,10,10,10,-10], [-10,5,0,0,0,0,5,-10], [-20,-10,-10,-10,-10,-10,-10,-20] ],
    r: [ [0,0,0,0,0,0,0,0], [5,10,10,10,10,10,10,5], [-5,0,0,0,0,0,0,-5], [-5,0,0,0,0,0,0,-5], [-5,0,0,0,0,0,0,-5], [-5,0,0,0,0,0,0,-5], [-5,0,0,0,0,0,0,-5], [0,0,0,5,5,0,0,0] ],
    q: [ [-20,-10,-10,-5,-5,-10,-10,-20], [-10,0,0,0,0,0,0,-10], [-10,0,5,5,5,5,0,-10], [-5,0,5,5,5,5,0,-5], [0,0,5,5,5,5,0,-5], [-10,5,5,5,5,5,0,-10], [-10,0,5,0,0,0,0,-10], [-20,-10,-10,-5,-5,-10,-10,-20] ],
    k: [ [-30,-40,-40,-50,-50,-40,-40,-30], [-30,-40,-40,-50,-50,-40,-40,-30], [-30,-40,-40,-50,-50,-40,-40,-30], [-30,-40,-40,-50,-50,-40,-40,-30], [-20,-30,-30,-40,-40,-30,-30,-20], [-10,-20,-20,-20,-20,-20,-20,-10], [20, 20,  0,  0,  0,  0, 20, 20], [20, 30, 10,  0,  0, 10, 30, 20] ]
};

// ==================== 3. HÀM ĐÁNH GIÁ ĐIỂM SỐ ====================
function evaluateBoard(gameNode) {
    let totalEvaluation = 0;
    const board = gameNode.board();

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece) {
                // 1. Điểm cơ bản
                let value = pieceValues[piece.type];

                // 2. Điểm vị trí (Đảo bảng nếu là quân Đen)
                let pstValue = 0;
                if (piece.color === 'w') {
                    pstValue = pst[piece.type][row][col];
                } else {
                    pstValue = pst[piece.type][7 - row][col];
                }

                // Cộng/Trừ theo màu
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
// ==================== HÀM SẮP XẾP NƯỚC ĐI  ====================
// Ưu tiên xem xét các nước Ăn Quân trước để cắt tỉa Alpha-Beta tốt hơn
function orderMoves(moves) {
    return moves.sort((a, b) => {
        // 1. Ưu tiên nước ăn quân (Captures)
        if (a.captured && !b.captured) return -1;
        if (!a.captured && b.captured) return 1;
        
        // 2. Nếu cả 2 cùng ăn quân -> So sánh giá trị quân bị ăn
        if (a.captured && b.captured) {
            const valA = pieceValues[a.captured] || 0;
            const valB = pieceValues[b.captured] || 0;
            return valB - valA; // Quân nào giá trị to hơn (Hậu, Xe) thì xếp trước
        }

        // 3. (Nâng cao) Nếu không ăn quân, ưu tiên nước đi phong cấp
        if (a.promotion && !b.promotion) return -1;
        if (!a.promotion && b.promotion) return 1;

        return 0; 
    });
}
// ==================== 4. THUẬT TOÁN MINIMAX + ALPHA BETA ====================
function minimax(gameNode, depth, alpha, beta, isMaximizingPlayer) {
    if (depth === 0 || gameNode.game_over()) {
        return evaluateBoard(gameNode);
    }

    // 1. Lấy danh sách nước đi (verbose: true để lấy thông tin chi tiết)
    let newGameMoves = gameNode.moves({ verbose: true });
    
    // 2. SẮP XẾP: Ưu tiên nước ăn quân trước (Thay vì random)
    // Giúp Alpha-Beta cắt tỉa tốt hơn gấp nhiều lần
    newGameMoves = orderMoves(newGameMoves);

    if (isMaximizingPlayer) {
        let maxEval = -Infinity;
        for (let i = 0; i < newGameMoves.length; i++) {
            gameNode.move(newGameMoves[i]);
            const ev = minimax(gameNode, depth - 1, alpha, beta, false);
            gameNode.undo();
            
            maxEval = Math.max(maxEval, ev);
            alpha = Math.max(alpha, ev);
            if (beta <= alpha) break; // Cắt tỉa
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
            if (beta <= alpha) break; // Cắt tỉa
        }
        return minEval;
    }
}


function makeBestMove() {
    const aiColor = userColor === 'w' ? 'b' : 'w'; // Máy là màu ngược lại với bạn
    
    // Kiểm tra lại cho chắc chắn
    if (game.turn() !== aiColor) return; 

    let possibleMoves = game.moves({ verbose: true });
    if (possibleMoves.length === 0) return;
    possibleMoves = orderMoves(possibleMoves);
    let bestMove = null;
    // Nếu Máy là Trắng -> Muốn điểm cao nhất (-Infinity)
    // Nếu Máy là Đen -> Muốn điểm thấp nhất (Infinity)
    let bestValue = (aiColor === 'w') ? -Infinity : Infinity;

    for (let i = 0; i < possibleMoves.length; i++) {
        game.move(possibleMoves[i]);
        
        // Gọi Minimax
        // Nếu Máy là Trắng -> Lượt sau là Đen (Minimizing) -> false
        // Nếu Máy là Đen -> Lượt sau là Trắng (Maximizing) -> true
        const isNextTurnMaximizing = (aiColor === 'b');
        
        const boardValue = minimax(game, currentDepth - 1, -Infinity, Infinity, isNextTurnMaximizing);
        
        game.undo();

        if (aiColor === 'w') {
            // Máy Trắng tìm Max
            if (boardValue > bestValue) {
                bestValue = boardValue;
                bestMove = possibleMoves[i];
            }
        } else {
            // Máy Đen tìm Min
            if (boardValue < bestValue) {
                bestValue = boardValue;
                bestMove = possibleMoves[i];
            }
        }
    }

    if (bestMove) {
        game.move(bestMove);
        afterMoveLogic();
    }
}

// ==================== 5. XỬ LÝ GIAO DIỆN & TƯƠNG TÁC ====================

const statusEl = document.getElementById('game-status');

function updateStatus(text, isThinking = false) {
    if (statusEl) {
        statusEl.textContent = text;
        if (isThinking) {
            statusEl.style.color = '#111010ff'; // Màu đỏ nổi bật
            statusEl.innerHTML = 'Lượt của đen... <span class="loading-dots">...</span>'; 
        } else {
            statusEl.style.color = '#333'; // Màu đen bình thường
        }
    }
}
function renderBoard() {

    boardEl.innerHTML = '';
    const board = game.board();
    const rows = (userColor === 'w') ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
    const cols = (userColor === 'w') ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
    rows.forEach(row => {
        cols.forEach(col => {
            const squareDiv = document.createElement('div');
            const isLight = (row + col) % 2 === 0;
            squareDiv.className = `square ${isLight ? 'light' : 'dark'}`;
            
            const squareId = String.fromCharCode(97 + col) + (8 - row); // a8, h1...
            squareDiv.dataset.square = squareId;

            // Highlight ô chọn & Gợi ý
            if (selectedSquare === squareId) squareDiv.classList.add('selected');
            if (selectedSquare && document.getElementById('toggle-hint').checked) {
                const moves = game.moves({ square: selectedSquare, verbose: true });
                if (moves.find(m => m.to === squareId)) {
                    squareDiv.classList.add('highlight');
                }
            }

            // Vẽ quân cờ
            const piece = board[row][col];
            if (piece) {
                const pieceDiv = document.createElement('div');
                pieceDiv.className = 'piece';
                pieceDiv.textContent = pieceSymbols[piece.color][piece.type];
                if (piece.color === game.turn()) pieceDiv.style.cursor = 'pointer';
                squareDiv.appendChild(pieceDiv);
            }

            squareDiv.addEventListener('click', () => onSquareClick(squareId));
            boardEl.appendChild(squareDiv);
        });
    });
    updateStatusUI();
}

function onSquareClick(clickedSquare) {
    // 1. Chọn quân
    if (!selectedSquare) {
        const piece = game.get(clickedSquare);
        if (piece && piece.color === game.turn() && piece.color === userColor) {
            selectedSquare = clickedSquare;
            renderBoard();
        }
        return;
    }

    // 2. Xử lý Phong cấp (Promotion)
    const piece = game.get(selectedSquare);
    const isPawn = piece && piece.type === 'p';
    // Kiểm tra hàng cuối (Trắng lên hàng 8, Đen xuống hàng 1)
    const isPromotionRank = (piece.color === 'w' && clickedSquare[1] === '8') || 
                            (piece.color === 'b' && clickedSquare[1] === '1');
    
    // Nếu là nước đi hợp lệ vào ô phong cấp
    const moves = game.moves({ verbose: true, square: selectedSquare });
    const validMove = moves.find(m => m.to === clickedSquare);

    if (validMove && isPawn && isPromotionRank) {
        // Mở Modal Phong cấp, CHƯA ĐI NGAY
        pendingPromotionMove = { from: selectedSquare, to: clickedSquare };
        document.getElementById('promotion-modal').classList.add('active');
        return; 
    }

    // 3. Di chuyển bình thường
    try {
        const move = game.move({
            from: selectedSquare,
            to: clickedSquare,
            promotion: 'q' // Mặc định là Hậu nếu không qua Modal (fallback)
        });

        if (move) {
            afterMoveLogic();
        } else {
            // Nếu bấm sai luật hoặc bấm vào quân mình -> Chọn lại
            const p = game.get(clickedSquare);
            if (p && p.color === game.turn()) selectedSquare = clickedSquare;
            else selectedSquare = null;
            renderBoard();
        }
    } catch (e) {
        selectedSquare = null;
        renderBoard();
    }
}

// Logic chạy sau khi một nước đi thành công (của người hoặc máy)

// ==================== SỬA LẠI HÀM LOGIC SAU KHI ĐI ====================
function afterMoveLogic() {
    selectedSquare = null;
    renderBoard();
    
    // 1. Kiểm tra thắng thua
    if (game.game_over()) {
        stopTimer();
        showGameOver(); // Gọi popup kết thúc
        return;
    }

    // 2. KIỂM TRA LƯỢT ĐI (SỬA Ở ĐÂY)
    // Thay vì kiểm tra (game.turn() === 'b'), ta kiểm tra xem có phải lượt người chơi không
    if (game.turn() !== userColor) {
        // --- ĐÂY LÀ LƯỢT CỦA MÁY ---
        updateStatus(" Đối thủ đang suy nghĩ...", true);
        stopTimer(); // Dừng đồng hồ của người
        
        // Gọi máy đánh sau 100ms
        setTimeout(() => {
            makeBestMove(); 
        }, 100); 
    } else {
        // --- ĐÂY LÀ LƯỢT CỦA BẠN ---
        updateStatus(" Lượt của bạn");
        startTimer(); // Bắt đầu tính giờ cho người
    }
}
function showGameOver() {
    stopTimer();
    
    if (game.in_checkmate()) {
        // game.turn() là phe đang bị chiếu bí (người thua)
        
        // Nếu phe bị chiếu bí TRÙNG với màu người chơi -> Người chơi THUA
        if (game.turn() === userColor) {
            showPopupResult(" BẠN THUA!", "Bạn đã bị chiếu bí.", "#d9534f"); // Màu đỏ
        } 
        // Ngược lại -> Máy THUA (Người chơi thắng)
        else {
            showPopupResult(" CHIẾN THẮNG!", "Chúc mừng! Bạn đã chiếu bí máy.", "#28a745"); // Màu xanh
        }
    } 
    else if (game.in_draw()) {
        showPopupResult(" HÒA CỜ", "Ván đấu kết thúc với tỉ số hòa.", "#666"); // Màu xám
    }
}

function updateStatusUI() {
    // 1. Lấy lịch sử ván đấu để tìm các quân bị ăn
    const history = game.history({ verbose: true });
    
    // Mảng chứa các quân bị ăn (dạng ký tự: 'p', 'n', 'q'...)
    const whiteLost = []; // Quân Trắng bị mất (do Đen ăn)
    const blackLost = []; // Quân Đen bị mất (do Trắng ăn)

    history.forEach(move => {
        if (move.captured) {
            if (move.color === 'w') {
                // Trắng đi và ăn quân -> Thì quân bị mất là của Đen
                blackLost.push(move.captured);
            } else {
                // Đen đi và ăn quân -> Thì quân bị mất là của Trắng
                whiteLost.push(move.captured);
            }
        }
    });

    // Hàm sắp xếp quân bị ăn theo giá trị (Hậu -> Xe -> Tượng/Mã -> Tốt)
    const sortOrder = { q: 1, r: 2, b: 3, n: 4, p: 5 };
    whiteLost.sort((a, b) => sortOrder[a] - sortOrder[b]);
    blackLost.sort((a, b) => sortOrder[a] - sortOrder[b]);

    // 2. Vẽ lên giao diện
    const whiteDiv = document.getElementById('captured-white');
    const blackDiv = document.getElementById('captured-black');
    
    // Xóa nội dung cũ
    whiteDiv.innerHTML = '';
    blackDiv.innerHTML = '';

    // Vẽ quân Trắng bị mất
    whiteLost.forEach(type => {
        const span = document.createElement('span');
        span.className = 'captured-piece';
        span.textContent = pieceSymbols['w'][type]; // Lấy icon quân trắng
        span.style.color = '#ccc'; // Màu xám nhạt cho quân trắng đã chết
        span.style.fontSize = '24px';
        span.style.marginRight = '5px';
        whiteDiv.appendChild(span);
    });

    // Vẽ quân Đen bị mất
    blackLost.forEach(type => {
        const span = document.createElement('span');
        span.className = 'captured-piece';
        span.textContent = pieceSymbols['b'][type]; // Lấy icon quân đen
        span.style.color = '#333'; // Màu đen đậm
        span.style.fontSize = '24px';
        span.style.marginRight = '5px';
        blackDiv.appendChild(span);
    });
}

// ==================== 6. XỬ LÝ PHONG CẤP (MODAL) ====================
function promotePiece(type) {
    if (!pendingPromotionMove) return;
    
    // type nhận vào là: 'queen', 'rook', 'bishop', 'knight'
    // Chuyển sang ký hiệu chess.js: q, r, b, n
    const code = type === 'knight' ? 'n' : type.charAt(0);

    game.move({
        from: pendingPromotionMove.from,
        to: pendingPromotionMove.to,
        promotion: code
    });

    // Ẩn modal và tiếp tục game
    document.getElementById('promotion-modal').classList.remove('active');
    pendingPromotionMove = null;
    afterMoveLogic();
}

// Gắn sự kiện cho các nút trong Modal Phong cấp
document.getElementById('promote-queen').onclick = () => promotePiece('queen');
document.getElementById('promote-rook').onclick = () => promotePiece('rook');
document.getElementById('promote-bishop').onclick = () => promotePiece('bishop');
document.getElementById('promote-knight').onclick = () => promotePiece('knight');


// ==================== 7. ĐỒNG HỒ & NÚT ĐIỀU KHIỂN ====================
function startTimer() {
    const isTimerEnabled = document.getElementById('toggle-timer').checked;
    if (!isTimerEnabled) return; 

    if (timerInterval) return;

    timerInterval = setInterval(() => {
        timer--;
        updateTimerDisplay();
        
        if (timer <= 0) {
            stopTimer(); // Dừng đồng hồ
            
            // --- THAY ĐỔI Ở ĐÂY ---
            // Gọi hàm showPopupResult (Popup xịn) thay vì alert
            showPopupResult("⌛ HẾT GIỜ!", "Rất tiếc, bạn đã hết thời gian. Đối thủ thắng!", "#d9534f");
        }
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

function resetTimer() {
    stopTimer();
    timer = 300; // Reset về 5 phút
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const m = Math.floor(timer / 60);
    const s = timer % 60;
    const display = document.getElementById('timer-display');
    if (display) {
        display.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
}

// Nút điều khiển
document.getElementById('btn-time-start').onclick = startTimer;
document.getElementById('btn-time-pause').onclick = stopTimer;
document.getElementById('btn-time-reset').onclick = resetTimer;

// ==================== TÍNH NĂNG CHƠI LẠI (DÙNG POPUP) ====================

// 1. Bấm nút Chơi lại -> Hiện bảng hỏi
document.getElementById('btn-restart').onclick = () => {
    document.getElementById('restart-modal').classList.add('active');
};

// 2. Bấm "Hủy" -> Đóng bảng
document.getElementById('cancel-restart-btn').onclick = () => {
    document.getElementById('restart-modal').classList.remove('active');
};

// 3. Bấm "Đồng ý" -> Reset game
document.getElementById('confirm-restart-btn').onclick = () => {
    document.getElementById('restart-modal').classList.remove('active'); // Ẩn bảng
    
    // Thực hiện Reset
    game.reset();
    resetTimer();
    selectedSquare = null;
    renderBoard();
    
    // Hiện lại bảng chọn màu để bắt đầu ván mới
    document.getElementById('chooseColorModal').classList.add('active');
};

document.getElementById('btn-undo').onclick = () => {
    game.undo(); // Undo Máy
    game.undo(); // Undo Người
    renderBoard();
};

document.getElementById('ai-level').onchange = (e) => {
    currentDepth = parseInt(e.target.value);
};

// ==================== 8. MODAL LUẬT & CẤP ĐỘ ====================
// Đóng mở modal luật
document.getElementById('btn-rules').onclick = () => {
    document.getElementById('rules-modal').classList.add('active');
};
document.querySelector('#rules-modal .close-btn').onclick = () => {
    document.getElementById('rules-modal').classList.remove('active');
};

// Chọn cấp độ ban đầu
document.querySelectorAll('.level-btn').forEach(btn => {
    btn.onclick = () => {
        currentDepth = parseInt(btn.dataset.level);
        document.getElementById('ai-level').value = currentDepth;
        document.getElementById('level-selection-modal').classList.remove('active');
        document.getElementById('chooseColorModal').classList.add('active'); // Hiện chọn màu
    };
});

// Chọn màu
document.getElementById('chooseWhite').onclick = () => {
    document.getElementById('chooseColorModal').classList.remove('active');
    renderBoard();
};
document.getElementById('chooseBlack').onclick = () => {
    document.getElementById('chooseColorModal').classList.remove('active');
    renderBoard();
    // Nếu chọn Đen -> Máy (Trắng) đi trước
    // Cần thêm logic đảo ngược nếu bạn muốn máy cầm Trắng
    // Ở code này mặc định Máy luôn cầm Đen để đơn giản. 
    // Nếu muốn đổi màu máy, cần sửa logic makeBestMove.
    setTimeout(makeBestMove, 500); 
};

function adjustTime(seconds) {
    // Chỉ cho chỉnh khi đồng hồ đang dừng
    if (timerInterval) return; 
    
    timer += seconds;
    
    // Giới hạn: Không được dưới 1 phút (60s)
    if (timer < 60) timer = 60;
    
    updateTimerDisplay();
}

// Gắn sự kiện cho nút Lên (Thêm 1 phút)
const btnUp = document.getElementById('btn-time-up');
if (btnUp) {
    btnUp.onclick = () => adjustTime(60);
}

// Gắn sự kiện cho nút Xuống (Giảm 1 phút)
const btnDown = document.getElementById('btn-time-down');
if (btnDown) {
    btnDown.onclick = () => adjustTime(-60);
}
// 2. Thêm sự kiện cho nút Bật/Tắt tính giờ 
document.getElementById('toggle-timer').onchange = (e) => {
    if (e.target.checked) {
        // Nếu BẬT lại -> Chạy tiếp (nếu đang trong lượt người chơi)
        if (game.turn() === 'w') startTimer();
        
        // Hiện lại màu đen cho đồng hồ
        document.getElementById('timer-display').style.color = '#333';
        document.getElementById('timer-display').style.textDecoration = 'none';
    } else {
        // Nếu TẮT -> Dừng ngay lập tức
        stopTimer();
        
        // Làm mờ đồng hồ để biết là đang tắt
        document.getElementById('timer-display').style.color = '#ccc';
        document.getElementById('timer-display').style.textDecoration = 'line-through';
    }
};
// ==================== TÍNH NĂNG ĐẦU HÀNG ====================
// 1. Bấm nút Đầu hàng -> Hiện Popup
document.getElementById('btn-resign').onclick = () => {
    if (game.game_over()) return; // Hết game thì không cần đầu hàng
    document.getElementById('resign-modal').classList.add('active'); // Hiện bảng
};

// 2. Bấm " Đánh tiếp" -> Ẩn Popup
document.getElementById('cancel-resign-btn').onclick = () => {
    document.getElementById('resign-modal').classList.remove('active');
};

// 3. Bấm " Chịu thua" -> Xử thua và Reset
document.getElementById('confirm-resign-btn').onclick = () => {
    document.getElementById('resign-modal').classList.remove('active'); // Ẩn bảng hỏi
    stopTimer();
    
    // HIỆN POPUP THÔNG BÁO THUA
    showPopupResult("🏳️ ĐẦU HÀNG", "Bạn đã chịu thua. Đối thủ thắng!", "#d9534f");
};

// ==================== CẬP NHẬT: POPUP KẾT THÚC GAME ====================

// 1. Hàm hiển thị Popup Kết thúc (Thay thế alert)
function showPopupResult(title, message, color) {
    const modal = document.getElementById('game-over-modal');
    const titleEl = document.getElementById('game-over-title');
    const msgEl = document.getElementById('game-over-message');
    const contentEl = modal.querySelector('.modal-content');

    titleEl.textContent = title;
    titleEl.style.color = color; // Đổi màu chữ tiêu đề (Đỏ/Xanh/Đen)
    contentEl.style.borderColor = color; // Đổi màu viền bảng
    msgEl.textContent = message;

    modal.classList.add('active'); // Hiện bảng
}

// 2. Sự kiện nút "Chơi ván mới" trong Popup
document.getElementById('btn-gameover-restart').onclick = () => {
    document.getElementById('game-over-modal').classList.remove('active');
    
    // Reset toàn bộ game
    game.reset();
    resetTimer();
    selectedSquare = null;
    renderBoard();
    updateStatus(" Ván mới bắt đầu");
    document.getElementById('chooseColorModal').classList.add('active');
};

// 1. Xử lý nút chọn Trắng
document.getElementById('chooseWhite').onclick = function() {
    userColor = 'w';
    document.getElementById('chooseColorModal').classList.remove('active'); // Tắt bảng
    renderBoard(); // Vẽ lại bàn cờ (quân trắng ở dưới)
};

// 2. Xử lý nút chọn Đen
document.getElementById('chooseBlack').onclick = function() {
    userColor = 'b';
    document.getElementById('chooseColorModal').classList.remove('active');
    renderBoard(); // Vẽ lại bàn cờ (quân đen ở dưới)
    
    // Nếu chọn Đen thì Máy (Trắng) đi trước ngay lập tức
    setTimeout(makeBestMove, 500);
};

// 3. QUAN TRỌNG: Lệnh bật bảng chọn màu khi vừa vào game
document.getElementById('chooseColorModal').classList.add('active');
// ==================== KHỞI CHẠY ====================
renderBoard();
updateTimerDisplay();