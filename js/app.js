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
    if (piece && game.board._colorOf(piece) === game.activeColor) {
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

  if (piece && game.board._colorOf(piece) === game.activeColor) {
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
      renderBoard();
      updateHistory();
      updateStatus();

      if (game.gameOver) {
        gameOver = true;
        const msg = game.gameResult === "1-0" ? "Les Blancs gagnent!"
          : game.gameResult === "0-1" ? "Les Noirs gagnent!"
          : "Partie nulle!";
        setTimeout(() => alert(msg), 100);
      }

      if (game.mode === "ai" && !game.gameOver) {
        setTimeout(makeAiMove, 300);
      }
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
      renderBoard();
      updateHistory();
      updateStatus();

      if (game.gameOver) {
        gameOver = true;
        const msg = game.gameResult === "1-0" ? "Les Blancs gagnent!"
          : game.gameResult === "0-1" ? "Les Noirs gagnent!"
          : "Partie nulle!";
        setTimeout(() => alert(msg), 100);
      }

      if (game.mode === "ai" && !game.gameOver && game.activeColor !== game.playerColor) {
        setTimeout(makeAiMove, 300);
      }
    });
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
    ? [{ piece: "Q", char: "\u2655" }, { piece: "R", char: "\u2656" }, { piece: "B", char: "\u2657" }, { piece: "N", char: "\u2658" }]
    : [{ piece: "q", char: "\u265B" }, { piece: "r", char: "\u265C" }, { piece: "b", char: "\u265D" }, { piece: "n", char: "\u265E" }];

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

function exportPgn() {
  const history = game.getHistory();
  if (history.length === 0) {
    alert("Aucun coup à exporter");
    return;
  }

  const formatDate = () => {
    const d = new Date();
    return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
  };

  const pgnTags = [
    `[Event "Partie d'échecs"]`,
    `[Site "?"]`,
    `[Date "${formatDate()}"]`,
    `[Round "?"]`,
    `[White "${game.playerColor === 'w' ? 'Joueur' : 'IA'}"]`,
    `[Black "${game.playerColor === 'b' ? 'Joueur' : 'IA'}"]`,
    `[Result "${game.gameResult || '*'}"]`,
  ];

  // Build move text
  let moveText = "";
  let moveNum = 1;
  for (let i = 0; i < history.length; i += 2) {
    moveText += moveNum + ". " + history[i].notation + " ";
    if (i + 1 < history.length) {
      moveText += history[i + 1].notation + " ";
    }
    moveNum++;
  }
  moveText += (game.gameResult || '*');

  const pgn = pgnTags.join("\n") + "\n\n" + moveText;

  // Download
  const blob = new Blob([pgn], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "partie.pgn";
  a.click();
  URL.revokeObjectURL(url);
}

function importPgn() {
  const text = document.getElementById("importPgnText").value;
  if (!text.trim()) { alert("Colle un PGN d'abord"); return; }

  try {
    // Parse headers
    const headerRegex = /\[(\w+)\s+"([^"]*)"\]/g;
    const headers = {};
    let m;
    while ((m = headerRegex.exec(text)) !== null) {
      headers[m[1]] = m[2];
    }

    // Parse move text: remove headers, annotations, result
    let movesText = text.replace(/\[.*?\]/g, "").trim();
    movesText = movesText.replace(/\{[^}]*\}/g, "");
    movesText = movesText.replace(/\$\d+/g, "");
    movesText = movesText.replace(/\s*(1-0|0-1|1\/2-1\/2|\*)\s*$/, "");
    movesText = movesText.replace(/\d+\.(\.\.)?\s*/g, "");
    const moveTokens = movesText.trim().split(/\s+/);
    if (!moveTokens[0]) { alert("Aucun coup trouvé dans le PGN"); return; }

    // Start new game
    const mode = document.getElementById("modeSelect").value;
    const color = document.getElementById("colorSelect").value;
    gameOver = false;
    isAiThinking = false;
    initGame("local", "w");
    game.mode = mode;
    game.playerColor = color;

    // Replay moves
    for (const token of moveTokens) {
      if (!token) continue;
      const legalMoves = game.getLegalMoves();
      let found = false;
      for (const lm of legalMoves) {
        const notation = game.getMoveNotation(lm);
        if (notation === token) {
          const result = game.makeMove(lm.from.row, lm.from.col, lm.to.row, lm.to.col);
          if (!result.success) break;
          found = true;
          break;
        }
      }
      if (!found) {
        console.warn("Coup inconnu:", token);
        break;
      }
    }

    renderBoard();
    updateHistory();
    updateStatus();
    document.getElementById("importPgnDialog").classList.add("hidden");
  } catch (e) {
    console.error("Erreur import PGN:", e);
    alert("Erreur lors de l'import PGN. Vérifie le format.");
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
});