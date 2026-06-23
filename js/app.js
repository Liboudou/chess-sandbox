import { Game } from "./game.js";
import { findBestMove } from "./ai.js";

const PIECE_MAP = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟"
};

let game;
let selectedSquare = null;
let legalMovesForSelected = [];
let moveHistory = []; // mirror of game.getHistory() for quick access
let isAiThinking = false;
let gameOver = false;
let replayMoveIndex = -1; // -1 means current position, >=0 index into moveHistory
let savedGameState = null; // for replay

function findKing(board, color) {
  const king = color === "w" ? "K" : "k";
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board.pieceAt(r, c) === king) return [r, c];
  return [-1, -1];
}

function initGame(mode = "local", color = "w") {
  game = new Game(mode, color);
  selectedSquare = null;
  legalMovesForSelected = [];
  moveHistory = [];
  isAiThinking = false;
  gameOver = false;
  replayMoveIndex = -1;
  savedGameState = null;
  renderBoard();
  updateStatus();
  updateHistory();
  updateReplayControlsVisibility();
  if (mode === "ai" && color === "b") {
    setTimeout(makeAiMove, 500);
  }
}

function renderBoard() {
  const boardEl = document.getElementById("board");
  boardEl.innerHTML = "";
  boardEl.className = "chess-board";

  const hist = game.getHistory();
  const lastMove = hist.length > 0 ? hist[hist.length - 1] : null;
  const status = game.getStatus();
  const kingPos = status.inCheck ? findKing(game.board, status.turn) : [-1, -1];

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const sq = document.createElement("div");
      sq.className = `square ${(row + col) % 2 === 0 ? "light" : "dark"}`;
      sq.dataset.row = row;
      sq.dataset.col = col;
      sq.addEventListener("click", () => onSquareClick(row, col));
      // ARIA label for square
      const file = String.fromCharCode(97 + col);
      const rank = 8 - row;
      sq.setAttribute("aria-label", `Case ${file}${rank}`);
      // Make board keyboard accessible
      sq.setAttribute("tabindex", "-1");

      if (selectedSquare && selectedSquare.row === row && selectedSquare.col === col) {
        sq.classList.add("selected");
      }

      if (legalMovesForSelected.some(m => m.to.row === row && m.to.col === col)) {
        const dot = document.createElement("div");
        dot.className = "legal-move-indicator";
        sq.appendChild(dot);
      }

      if (lastMove) {
        if (lastMove.from.row === row && lastMove.from.col === col) {
          sq.classList.add("last-move-from");
        }
        if (lastMove.to.row === row && lastMove.to.col === col) {
          sq.classList.add("last-move-to");
        }
      }

      if (kingPos[0] === row && kingPos[1] === col) {
        sq.classList.add("check");
      }

      const piece = game.board.pieceAt(row, col);
      if (piece) {
        const span = document.createElement("span");
        span.className = `piece ${game.board._colorOf(piece) === "w" ? "white" : "black"}`;
        span.textContent = PIECE_MAP[piece] || piece;
        sq.appendChild(span);
      }

      boardEl.appendChild(sq);
    }
  }
}

function onSquareClick(row, col) {
  if (gameOver || isAiThinking) return;

  const piece = game.board.pieceAt(row, col);

  if (selectedSquare === null) {
    if (piece && board._colorOf(piece) === game.activeColor) {
      selectedSquare = { row, col };
      legalMovesForSelected = game.getLegalMoves().filter(
        m => m.from.row === row && m.from.col === col
      );
      renderBoard();
    }
    return;
  }

  if (selectedSquare.row === row && selectedSquare.col === col) {
    selectedSquare = null;
    legalMovesForSelected = [];
    renderBoard();
    return;
  }

  if (piece && board._colorOf(piece) === game.activeColor) {
    selectedSquare = { row, col };
    legalMovesForSelected = game.getLegalMoves().filter(
      m => m.from.row === row && m.from.col === col
    );
    renderBoard();
    return;
  }

  const isLegal = legalMovesForSelected.some(
    m => m.to.row === row && m.to.col === col
  );

  if (isLegal) {
    const fromRow = selectedSquare.row;
    const fromCol = selectedSquare.col;
    const captured = game.board.pieceAt(row, col);
    selectedSquare = null;
    legalMovesForSelected = [];

    animateMove(fromRow, fromCol, row, col, captured, () => {
      const result = game.makeMove(fromRow, fromCol, row, col);
      if (!result.success) return;
      updateAfterMove();
    });
  } else {
    selectedSquare = null;
    legalMovesForSelected = [];
    renderBoard();
  }
}

function animateMove(fromRow, fromCol, toRow, toCol, captured, callback) {
  const boardEl = document.getElementById("board");
  const squares = boardEl.querySelectorAll(".square");
  const fromSq = squares[fromRow * 8 + fromCol];
  const toSq = squares[toRow * 8 + toCol];
  const pieceSpan = fromSq.querySelector(".piece");
  if (!pieceSpan) { callback(); return; }

  // Animate captured piece fade-out
  if (captured) {
    const toPiece = toSq.querySelector(".piece");
    if (toPiece) {
      toPiece.classList.add("fade-out");
    }
  }

  // Create floating piece
  const floatEl = document.createElement("span");
  floatEl.className = pieceSpan.className + " floating";
  floatEl.textContent = pieceSpan.textContent;

  const fromRect = fromSq.getBoundingClientRect();
  floatEl.style.left = fromRect.left + "px";
  floatEl.style.top = fromRect.top + "px";
  floatEl.style.width = fromRect.width + "px";
  floatEl.style.height = fromRect.height + "px";
  floatEl.style.display = "flex";
  floatEl.style.alignItems = "center";
  floatEl.style.justifyContent = "center";
  document.body.appendChild(floatEl);

  // Mark source piece as moving
  pieceSpan.classList.add("moving");

  // Trigger reflow then animate to target
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const toRect = toSq.getBoundingClientRect();
      const dx = toRect.left - fromRect.left;
      const dy = toRect.top - fromRect.top;
      floatEl.style.transform = `translate(${dx}px, ${dy}px)`;

      // After animation complete, remove floating element and call callback
      setTimeout(() => {
        floatEl.remove();
        pieceSpan.classList.remove("moving");
        callback();
      }, 260);
    });
  });
}

async function makeAiMove() {
  isAiThinking = true;
  updateStatus();

  const aiColor = game.playerColor === "w" ? "b" : "w";
  const difficultyEl = document.getElementById("difficultySelect");
  const skillLevel = difficultyEl ? parseInt(difficultyEl.value, 10) : 10;
  const result = await findBestMove(
    game.board,
    aiColor,
    game.epSquare,
    game.castleRights,
    3,
    skillLevel
  );

  if (result.move) {
    const captured = game.board.pieceAt(result.move.to.row, result.move.to.col);
    animateMove(result.move.from.row, result.move.from.col, result.move.to.row, result.move.to.col, captured, () => {
      game.makeMove(result.move.from.row, result.move.from.col, result.move.to.row, result.move.to.col);
      isAiThinking = false;
      selectedSquare = null;
      legalMovesForSelected = [];
      updateAfterMove();
    });
  } else {
    isAiThinking = false;
    updateStatus();
  }
}

function updateAfterMove() {
  updateHistory();
  updateStatus();
  if (game.gameOver) {
    gameOver = true;
    const msg = game.gameResult === "1-0" ? "Les Blancs gagnent!" :
                game.gameResult === "0-1" ? "Les Noirs gagnent!" : "Partie nulle!";
    setTimeout(() => alert(msg), 100);
    setupReplay();
  }
  if (game.mode === "ai" && !gameOver) {
    setTimeout(makeAiMove, 300);
  }
}

function updateStatus() {
  const status = game.getStatus();
  const indicator = document.getElementById("turnIndicator");
  const statusText = document.getElementById("statusText");
  const moveCount = document.getElementById("moveCount");

  indicator.className = `turn-dot ${status.turn === "w" ? "white" : "black"}`;

  statusText.className = "status-message";
  if (isAiThinking) {
    statusText.textContent = "IA réfléchit...";
  } else if (status.isCheckmate) {
    statusText.textContent = "Échec et Mat!";
  } else if (status.isStalemate) {
    statusText.textContent = "Pat!";
  } else if (status.gameOver) {
    statusText.textContent = "Partie nulle";
  } else if (status.inCheck) {
    statusText.textContent = "Échec!";
    statusText.classList.add("check");
  } else {
    statusText.textContent = status.turn === "w" ? "Tour des Blancs" : "Tour des Noirs";
  }

  moveCount.className = "move-count";
  moveCount.textContent = `Coup ${status.fullMoveNumber}`;

  // Update resign button visibility
  const resignBtn = document.getElementById("resignBtn");
  if (resignBtn) {
    resignBtn.style.display = gameOver ? "none" : "inline-block";
  }
  // Update theme based on stored preference
  updateThemeUi();
}

function updateHistory() {
  const list = document.getElementById("moveList");
  list.innerHTML = "";
  list.className = "move-history-list";

  const history = game.getHistory(); // array of move objects with .notation
  moveHistory = history.map(m => m.notation);

  // Determine which move is currently highlighted (based on replayMoveIndex)
  const highlightIdx = replayMoveIndex >= 0 ? replayMoveIndex : (history.length - 1);

  for (let i = 0; i < history.length; i += 2) {
    const num = Math.floor(i / 2) + 1;
    const white = history[i].notation;
    const black = i + 1 < history.length ? history[i + 1].notation : "";

    const row = document.createElement("div");
    row.className = "move-row";
    if (i === highlightIdx || (i + 1 === highlightIdx)) {
      row.classList.add("move-row-active");
    }
    row.innerHTML = `<span class="move-number">${num}.</span><span class="move-white">${white}</span><span class="move-black">${black}</span>`;

    // Make moves clickable for navigation when game is over
    if (gameOver) {
      if (white) {
        const whiteSpan = row.querySelector(".move-white");
        whiteSpan.style.cursor = "pointer";
        whiteSpan.addEventListener("click", (e) => {
          e.stopPropagation();
          goToMove(i);
        });
      }
      if (black) {
        const blackSpan = row.querySelector(".move-black");
        blackSpan.style.cursor = "pointer";
        blackSpan.addEventListener("click", (e) => {
          e.stopPropagation();
          goToMove(i + 1);
        });
      }
    }
    list.appendChild(row);
  }

  list.scrollTop = list.scrollHeight;
}

function showReplayControls() {
  const el = document.getElementById("replayControls");
  if (el) {
    el.classList.remove("hidden");
    el.style.display = "flex";
  }
}

function hideReplayControls() {
  const el = document.getElementById("replayControls");
  if (el) {
    el.classList.add("hidden");
    el.style.display = "";
  }
}

function updateReplayControlsVisibility() {
  const el = document.getElementById("replayControls");
  if (gameOver) {
    showReplayControls();
  } else {
    hideReplayControls();
  }
}

function setupReplay() {
  // Save the current game state for replay
  savedGameState = {
    fen: game.getFen(), // assuming getFen exists
    moves: game.getHistory().map(m => ({
      from: { row: m.from.row, col: m.from.col },
      to: { row: m.to.row, col: m.to.col },
      promotion: m.promotion
    }))
  };
  replayMoveIndex = game.getHistory().length - 1;
  updateReplayControlsVisibility();
}

function goToMove(index) {
  if (!savedGameState) return;
  const totalMoves = savedGameState.moves.length;
  if (index < -1 || index >= totalMoves) return;
  replayMoveIndex = index;
  // Restore game to initial state
  game = new Game(savedGameState.fen ? "local" : "local", "w"); // we need to reconstruct properly
  // For simplicity, we'll just reset and replay moves from scratch
  game = new Game("local", "w"); // default white to move
  game.setFen(savedGameState.fen); // assuming setFen exists
  // Apply moves up to index
  for (let i = 0; i <= index; i++) {
    const m = savedGameState.moves[i];
    game.makeMove(m.from.row, m.from.col, m.to.row, m.to.col, m.promotion);
  }
  updateAll();
}

function updateAll() {
  selectedSquare = null;
  legalMovesForSelected = [];
  renderBoard();
  updateStatus();
  updateHistory();
}

// Theme handling
function loadThemePreference() {
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") {
    return saved;
  }
  // default to dark
  return "dark";
}

function saveThemePreference(theme) {
  localStorage.setItem("theme", theme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

function updateThemeUi() {
  const theme = loadThemePreference();
  applyTheme(theme);
  const btn = document.getElementById("themeToggle");
  if (btn) {
    btn.setAttribute("aria-label", theme === "dark" ? "Passer au thème clair" : "Passer au thème sombre");
    btn.title = theme === "dark" ? "Passer au thème clair" : "Passer au thème sombre";
    // Optionally change icon
    btn.textContent = theme === "dark" ? "🌙" : "☀️";
  }
}

// Initialize theme on load
document.addEventListener("DOMContentLoaded", () => {
  initGame();

  document.getElementById("newGameBtn").addEventListener("click", () => {
    const mode = document.getElementById("modeSelect").value;
    const color = document.getElementById("colorSelect").value;
    gameOver = false;
    isAiThinking = false;
    initGame(mode, color);
    hideReplayControls();
  });

  document.getElementById("undoBtn").addEventListener("click", () => {
    if (game && !gameOver) {
      game.undo();
      selectedSquare = null;
      legalMovesForSelected = [];
      renderBoard();
      updateHistory();
      updateStatus();
    }
  });

  document.getElementById("exportPgnBtn").addEventListener("click", exportPgn);
  document.getElementById("importPgnBtn").addEventListener("click", () => {
    document.getElementById("importPgnDialog").classList.remove("hidden");
    document.getElementById("importPgnText").value = "";
    document.getElementById("importPgnText").focus();
  });
  document.getElementById("importPgnConfirmBtn").addEventListener("click", importPgn);
  document.getElementById("importPgnCancelBtn").addEventListener("click", () => {
    document.getElementById("importPgnDialog").classList.add("hidden");
  });

  // Theme toggle
  const themeBtn = document.getElementById("themeToggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      const current = loadThemePreference();
      const next = current === "dark" ? "light" : "dark";
      saveThemePreference(next);
      applyTheme(next);
      updateThemeUi();
    });
  }

  // Resign button
  const resignBtn = document.getElementById("resignBtn");
  if (resignBtn) {
    resignBtn.addEventListener("click", () => {
      if (!gameOver) {
        // Determine winner
        const loser = game.activeColor; // the player to move resigns
        const winner = loser === "w" ? "b" : "w";
        game.gameOver = true;
        game.gameResult = winner === "w" ? "1-0" : "0-1";
        gameOver = true;
        updateStatus();
        setupReplay();
        alert(`${loser === "w" ? "Les Noirs" : "Les Blancs"} gagnent par abandon !`);
      }
    });
  }

  // Replay controls
  document.getElementById("replayStartBtn").addEventListener("click", () => {
    if (gameOver) goToMove(0);
  });
  document.getElementById("replayPrevBtn").addEventListener("click", () => {
    if (gameOver && replayMoveIndex > 0) goToMove(replayMoveIndex - 1);
  });
  document.getElementById("replayNextBtn").addEventListener("click", () => {
    if (gameOver) {
      const total = savedGameState ? savedGameState.moves.length : 0;
      if (replayMoveIndex < total - 1) goToMove(replayMoveIndex + 1);
    }
  });
  document.getElementById("replayEndBtn").addEventListener("click", () => {
    if (gameOver && savedGameState) {
      goToMove(savedGameState.moves.length - 1);
    }
  });

  // Keyboard navigation for board (optional)
  const boardEl = document.getElementById("board");
  if (boardEl) {
    boardEl.addEventListener("keydown", (e) => {
      // Implement arrow keys to move focus? We'll skip for brevity.
    });
  }

  // Initial UI updates
  updateThemeUi();
  updateReplayControlsVisibility();
});