import { Game } from "./game.js";
import { findBestMove } from "./ai.js";

const PIECE_MAP = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟"
};

let game;
let selectedSquare = null;
let legalMovesForSelected = [];
let moveHistory = [];
let isAiThinking = false;
let gameOver = false;

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
  renderBoard();
  updateStatus();
  updateHistory();
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
      legalMovesForSelected = getLegalMoves().filter(
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
    legalMovesForSelected = getLegalMoves().filter(
      m => m.from.row === row && m.from.col === col
    );
    renderBoard();
    return;
  }

  const isLegal = legalMovesForSelected.some(
    m => m.to.row === row && m.to.col === col
  );

  if (isLegal) {
    const result = makeMove(selectedSquare.row, selectedSquare.col, row, col);
    selectedSquare = null;
    legalMovesForSelected = [];
    renderBoard();
    updateHistory();
    updateStatus();

    if (game.gameOver) {
      gameOver = true;
      const msg = game.gameResult === "1-0" ? "Les Blancs gagnent!" :
        game.gameResult === "0-1" ? "Les Noirs gagnent!" : "Partie nulle!";
      setTimeout(() => alert(msg), 100);
    }

    if (game.mode === "ai" && !game.gameOver) {
      setTimeout(makeAiMove, 300);
    }
  } else {
    selectedSquare = null;
    legalMovesForSelected = [];
    renderBoard();
  }
}

async function makeAiMove() {
  isAiThinking = true;
  updateStatus();

  const aiColor = game.playerColor === "w" ? "b" : "w";
  const difficultyEl = document.getElementById("difficultySelect");
  const skillLevel = difficultyEl ? parseInt(difficultySelect.value, 10) : 10;
  const result = await findBestMove(
    game.board,
    aiColor,
    game.epSquare,
    game.castleRights,
    3,
    skillLevel
  );

  if (result.move) {
    setTimeout(() => {
      game.makeMove(result.move.from.row, result.move.from.col, result.move.to.row, result.move.to.col);
      isAiThinking = false;
      selectedSquare = null;
      legalMovesForSelected = [];
      renderBoard();
      updateHistory();
      updateStatus();

      if (game.gameOver) {
        gameOver = true;
        const msg = game.gameResult === "1-0" ? "Les Blancs gagnent!" :
          game.gameResult === "0-1" ? "Les Noirs gagnent!" : "Partie nulle!";
        setTimeout(() => alert(msg), 100);
      }

      if (game.mode === "ai" && !game.gameOver && game.activeColor !== game.playerColor) {
        setTimeout(makeAiMove, 300);
      }
    }, 50);
  } else {
    isAiThinking = false;
    updateStatus();
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
}

function updateHistory() {
  const list = document.getElementById("moveList");
  list.innerHTML = "";
  list.className = "move-history-list";

  const history = game.getHistory();
  moveHistory = history.map(m => m.notation);

  if (history.length === 0) {
    const empty = document.createElement("div");
    empty.className = "no-moves";
    empty.textContent = "Aucun coup";
    list.appendChild(empty);
    return;
  }

  for (let i = 0; i < history.length; i += 2) {
    const num = Math.floor(i / 2) + 1;
    const white = history[i].notation;
    const black = i + 1 < history.length ? history[i + 1].notation : "";

    const row = document.createElement("div");
    row.className = "move-row";
    row.innerHTML = `<span class="move-number">${num}.</span><span class="move-white">${white}</span><span class="move-black">${black}</span>`;
    list.appendChild(row);
  }

  list.scrollTop = list.scrollHeight;
}

function showPromotionDialog(callback) {
  const dialog = document.getElementById("promotionDialog");
  const choices = document.getElementById("promotionChoices");
  choices.innerHTML = "";
  dialog.className = "promotion-overlay";

  const color = game.activeColor;
  const promoPieces = color === "w"
    ? [{ piece: "Q", char: "♕" }, { piece: "R", char: "♖" }, { piece: "B", char: "♗" }, { piece: "N", char: "♘" }]
    : [{ piece: "q", char: "♛" }, { piece: "r", char: "♜" }, { piece: "b", char: "♝" }, { piece: "n", char: "♞" }];

  for (const { piece, char } of promoPieces) {
    const btn = document.createElement("button");
    btn.className = "promotion-choice";
    btn.textContent = char;
    btn.addEventListener("click", () => {
      dialog.classList.remove("promotion-overlay");
      dialog.classList.add("hidden");
      callback(piece);
    });
    choices.appendChild(btn);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initGame();

  document.getElementById("newGameBtn").addEventListener("click", () => {
    const mode = document.getElementById("modeSelect").value;
    const color = document.getElementById("colorSelect").value;
    gameOver = false;
    isAiThinking = false;
    initGame(mode, color);
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

  // Difficulty selector
  const difficultySelect = document.getElementById("difficultySelect");
  window.difficulty = parseInt(difficultySelect.value, 10);
  difficultySelect.addEventListener("change", () => {
    window.difficulty = parseInt(difficultySelect.value, 10);
    // If using Stockfish, update skill level
    if (window.currentEngine && window.currentEngine instanceof StockfishEngine) {
      window.currentEngine.setSkillLevel(window.difficulty - 1);
    }
  });
});