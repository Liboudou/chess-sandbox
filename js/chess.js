const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const FILES = 'abcdefgh';
const RANKS = '87654321';

const KNIGHT_OFFSETS = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1]
];

const KING_OFFSETS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1]
];

function squareToRowCol(sq) {
  return { col: FILES.indexOf(sq[0]), row: RANKS.indexOf(sq[1]) };
}

function rowColToSquare(row, col) {
  return FILES[col] + RANKS[row];
}

function makeMoveObj(fromRow, fromCol, toRow, toCol, captured, promotion, isEnPassant, isCastle, castleSide) {
  return {
    from: { row: fromRow, col: fromCol },
    to: { row: toRow, col: toCol },
    captured: captured || null,
    promotion: promotion || null,
    isEnPassant,
    isCastle,
    castleSide
  };
}

class Board {
  constructor(fen) {
    this.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    if (fen) {
      const parsed = parseFen(fen);
      this.board = parsed.board.board;
    } else {
      this.loadStartingPosition();
    }
  }

  loadStartingPosition() {
    const ranks = STARTING_FEN.split(' ')[0].split('/');
    for (let r = 0; r < 8; r++) {
      let c = 0;
      for (const ch of ranks[r]) {
        if (ch >= '1' && ch <= '8') {
          c += parseInt(ch);
        } else {
          this.board[r][c++] = ch;
        }
      }
    }
  }

  pieceAt(row, col) {
    if (row < 0 || row > 7 || col < 0 || col > 7) return null;
    return this.board[row][col];
  }

  setPiece(row, col, piece) {
    this.board[row][col] = piece;
  }

  clone() {
    const b = new Board();
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        b.board[r][c] = this.board[r][c];
    return b;
  }

  _isWhite(p) {
    return typeof p === 'string' && p === p.toUpperCase();
  }

  _isBlack(p) {
    return typeof p === 'string' && p === p.toLowerCase();
  }

  _colorOf(p) {
    if (p == null) return null;
    return this._isWhite(p) ? 'w' : 'b';
  }
}

function findKing(board, color) {
  const king = color === 'w' ? 'K' : 'k';
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board.pieceAt(r, c) === king) return [r, c];
  return [-1, -1];
}

function isSquareAttackedBy(board, row, col, attackerColor) {
  const pawnDir = attackerColor === 'w' ? 1 : -1;
  for (const dc of [-1, 1]) {
    const pr = row + pawnDir;
    const pc = col + dc;
    if (pr >= 0 && pr <= 7 && pc >= 0 && pc <= 7) {
      const p = board.pieceAt(pr, pc);
      if (p && p.toUpperCase() === 'P' && board._colorOf(p) === attackerColor) return true;
    }
  }

  for (const [dr, dc] of KNIGHT_OFFSETS) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
      const p = board.pieceAt(nr, nc);
      if (p && p.toUpperCase() === 'N' && board._colorOf(p) === attackerColor) return true;
    }
  }

  for (const [dr, dc] of KING_OFFSETS) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
      const p = board.pieceAt(nr, nc);
      if (p && p.toUpperCase() === 'K' && board._colorOf(p) === attackerColor) return true;
    }
  }

  const DIAG_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  for (const [dr, dc] of DIAG_DIRS) {
    let nr = row + dr;
    let nc = col + dc;
    while (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
      const p = board.pieceAt(nr, nc);
      if (p != null) {
        const t = p.toUpperCase();
        if ((t === 'B' || t === 'Q') && board._colorOf(p) === attackerColor) return true;
        break;
      }
      nr += dr;
      nc += dc;
    }
  }

  const STRAIGHT_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of STRAIGHT_DIRS) {
    let nr = row + dr;
    let nc = col + dc;
    while (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
      const p = board.pieceAt(nr, nc);
      if (p != null) {
        const t = p.toUpperCase();
        if ((t === 'R' || t === 'Q') && board._colorOf(p) === attackerColor) return true;
        break;
      }
      nr += dr;
      nc += dc;
    }
  }

  return false;
}

function generatePawnMoves(board, color, r, c, epSquare, moves) {
  const dir = color === 'w' ? -1 : 1;
  const startRow = color === 'w' ? 6 : 1;
  const promoRow = color === 'w' ? 0 : 7;

  const nr = r + dir;
  if (nr >= 0 && nr <= 7 && board.pieceAt(nr, c) == null) {
    if (nr === promoRow) {
      for (const p of ['Q', 'R', 'B', 'N'])
        moves.push(makeMoveObj(r, c, nr, c, null, color === 'w' ? p : p.toLowerCase(), false, false, null));
    } else {
      moves.push(makeMoveObj(r, c, nr, c, null, null, false, false, null));
      if (r === startRow) {
        const nr2 = r + 2 * dir;
        if (board.pieceAt(nr2, c) == null)
          moves.push(makeMoveObj(r, c, nr2, c, null, null, false, false, null));
      }
    }
  }

  for (const dc of [-1, 1]) {
    const nc = c + dc;
    if (nc < 0 || nc > 7) continue;
    const nr2 = r + dir;
    if (nr2 < 0 || nr2 > 7) continue;

    const target = board.pieceAt(nr2, nc);
    if (target != null && board._colorOf(target) !== color) {
      if (nr2 === promoRow) {
        for (const p of ['Q', 'R', 'B', 'N'])
          moves.push(makeMoveObj(r, c, nr2, nc, target, color === 'w' ? p : p.toLowerCase(), false, false, null));
      } else {
        moves.push(makeMoveObj(r, c, nr2, nc, target, null, false, false, null));
      }
    }

    if (epSquare !== '-') {
      const ep = squareToRowCol(epSquare);
      if (ep.row === nr2 && ep.col === nc) {
        const capturedPawn = board.pieceAt(r, nc);
        if (capturedPawn && capturedPawn.toUpperCase() === 'P' && board._colorOf(capturedPawn) !== color)
          moves.push(makeMoveObj(r, c, nr2, nc, capturedPawn, null, true, false, null));
      }
    }
  }
}

function generateKnightMoves(board, color, r, c, moves) {
  for (const [dr, dc] of KNIGHT_OFFSETS) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
    const target = board.pieceAt(nr, nc);
    if (target == null || board._colorOf(target) !== color)
      moves.push(makeMoveObj(r, c, nr, nc, target, null, false, false, null));
  }
}

function generateSlidingMoves(board, color, r, c, directions, moves) {
  for (const [dr, dc] of directions) {
    let nr = r + dr;
    let nc = c + dc;
    while (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
      const target = board.pieceAt(nr, nc);
      if (target == null) {
        moves.push(makeMoveObj(r, c, nr, nc, null, null, false, false, null));
      } else {
        if (board._colorOf(target) !== color)
          moves.push(makeMoveObj(r, c, nr, nc, target, null, false, false, null));
        break;
      }
      nr += dr;
      nc += dc;
    }
  }
}

function generateKingMoves(board, color, r, c, castleRights, moves) {
  const opponent = color === 'w' ? 'b' : 'w';

  for (const [dr, dc] of KING_OFFSETS) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
    const target = board.pieceAt(nr, nc);
    if (target == null || board._colorOf(target) !== color)
      moves.push(makeMoveObj(r, c, nr, nc, target, null, false, false, null));
  }

  if (color === 'w' && r === 7 && c === 4) {
    if (castleRights.includes('K') &&
        board.pieceAt(7, 5) == null && board.pieceAt(7, 6) == null &&
        board.pieceAt(7, 7) === 'R' &&
        !isSquareAttackedBy(board, 7, 4, opponent) &&
        !isSquareAttackedBy(board, 7, 5, opponent) &&
        !isSquareAttackedBy(board, 7, 6, opponent)) {
      moves.push(makeMoveObj(7, 4, 7, 6, null, null, false, true, 'K'));
    }
    if (castleRights.includes('Q') &&
        board.pieceAt(7, 1) == null && board.pieceAt(7, 2) == null && board.pieceAt(7, 3) == null &&
        board.pieceAt(7, 0) === 'R' &&
        !isSquareAttackedBy(board, 7, 4, opponent) &&
        !isSquareAttackedBy(board, 7, 3, opponent) &&
        !isSquareAttackedBy(board, 7, 2, opponent)) {
      moves.push(makeMoveObj(7, 4, 7, 2, null, null, false, true, 'Q'));
    }
  }
  if (color === 'b' && r === 0 && c === 4) {
    if (castleRights.includes('k') &&
        board.pieceAt(0, 5) == null && board.pieceAt(0, 6) == null &&
        board.pieceAt(0, 7) === 'r' &&
        !isSquareAttackedBy(board, 0, 4, opponent) &&
        !isSquareAttackedBy(board, 0, 5, opponent) &&
        !isSquareAttackedBy(board, 0, 6, opponent)) {
      moves.push(makeMoveObj(0, 4, 0, 6, null, null, false, true, 'k'));
    }
    if (castleRights.includes('q') &&
        board.pieceAt(0, 1) == null && board.pieceAt(0, 2) == null && board.pieceAt(0, 3) == null &&
        board.pieceAt(0, 0) === 'r' &&
        !isSquareAttackedBy(board, 0, 4, opponent) &&
        !isSquareAttackedBy(board, 0, 3, opponent) &&
        !isSquareAttackedBy(board, 0, 2, opponent)) {
      moves.push(makeMoveObj(0, 4, 0, 2, null, null, false, true, 'q'));
    }
  }
}

function generatePseudoLegalMoves(board, color, epSquare, castleRights) {
  const moves = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board.pieceAt(r, c);
      if (piece == null) continue;
      if (board._colorOf(piece) !== color) continue;
      switch (piece.toUpperCase()) {
        case 'P': generatePawnMoves(board, color, r, c, epSquare, moves); break;
        case 'N': generateKnightMoves(board, color, r, c, moves); break;
        case 'B': generateSlidingMoves(board, color, r, c, [[-1,-1],[-1,1],[1,-1],[1,1]], moves); break;
        case 'R': generateSlidingMoves(board, color, r, c, [[-1,0],[1,0],[0,-1],[0,1]], moves); break;
        case 'Q': generateSlidingMoves(board, color, r, c, [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]], moves); break;
        case 'K': generateKingMoves(board, color, r, c, castleRights, moves); break;
      }
    }
  }
  return moves;
}

function generateLegalMoves(board, color, epSquare, castleRights) {
  const pseudo = generatePseudoLegalMoves(board, color, epSquare, castleRights);
  const legal = [];
  for (const move of pseudo) {
    const result = makeMove(board, move, epSquare, castleRights);
    if (!isInCheck(result.board, color)) legal.push(move);
  }
  return legal;
}

function makeMove(board, move, epSquare, castleRights) {
  const newBoard = board.clone();
  const piece = board.pieceAt(move.from.row, move.from.col);
  const color = board._colorOf(piece);
  let newCastleRights = castleRights;
  let newEpSquare = '-';

  newBoard.setPiece(move.from.row, move.from.col, null);

  if (move.isEnPassant) {
    newBoard.setPiece(move.from.row, move.to.col, null);
  }

  if (move.promotion) {
    newBoard.setPiece(move.to.row, move.to.col, move.promotion);
  } else {
    newBoard.setPiece(move.to.row, move.to.col, piece);
  }

  if (move.isCastle) {
    const row = move.from.row;
    if (move.castleSide === 'K' || move.castleSide === 'k') {
      newBoard.setPiece(row, 7, null);
      newBoard.setPiece(row, 5, color === 'w' ? 'R' : 'r');
    } else {
      newBoard.setPiece(row, 0, null);
      newBoard.setPiece(row, 3, color === 'w' ? 'R' : 'r');
    }
  }

  if (piece.toUpperCase() === 'K') {
    if (color === 'w') {
      newCastleRights = newCastleRights.replace(/[KQ]/g, '');
    } else {
      newCastleRights = newCastleRights.replace(/[kq]/g, '');
    }
  }
  if ((move.from.row === 7 && move.from.col === 7) || (move.to.row === 7 && move.to.col === 7))
    newCastleRights = newCastleRights.replace('K', '');
  if ((move.from.row === 7 && move.from.col === 0) || (move.to.row === 7 && move.to.col === 0))
    newCastleRights = newCastleRights.replace('Q', '');
  if ((move.from.row === 0 && move.from.col === 7) || (move.to.row === 0 && move.to.col === 7))
    newCastleRights = newCastleRights.replace('k', '');
  if ((move.from.row === 0 && move.from.col === 0) || (move.to.row === 0 && move.to.col === 0))
    newCastleRights = newCastleRights.replace('q', '');
  if (newCastleRights === '') newCastleRights = '-';

  if (piece.toUpperCase() === 'P' && Math.abs(move.to.row - move.from.row) === 2) {
    const epRow = (move.from.row + move.to.row) / 2;
    newEpSquare = rowColToSquare(epRow, move.from.col);
  }

  const captured = move.captured || (move.isEnPassant ? board.pieceAt(move.from.row, move.to.col) : null);

  const enrichedMove = {
    from: move.from,
    to: move.to,
    captured,
    promotion: move.promotion,
    isEnPassant: move.isEnPassant,
    isCastle: move.isCastle,
    castleSide: move.castleSide,
    piece
  };

  return {
    board: newBoard,
    epSquare: newEpSquare,
    castleRights: newCastleRights,
    move: enrichedMove
  };
}

function isInCheck(board, color) {
  const [kr, kc] = findKing(board, color);
  if (kr === -1) return false;
  const opp = color === 'w' ? 'b' : 'w';
  return isSquareAttackedBy(board, kr, kc, opp);
}

function isCheckmate(board, color, epSquare = '-', castleRights = '-') {
  if (!isInCheck(board, color)) return false;
  return generateLegalMoves(board, color, epSquare, castleRights).length === 0;
}

function isStalemate(board, color, epSquare = '-', castleRights = '-') {
  if (isInCheck(board, color)) return false;
  return generateLegalMoves(board, color, epSquare, castleRights).length === 0;
}

function insufficientMaterial(board) {
  const pieces = { w: [], b: [] };
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board.pieceAt(r, c);
      if (p == null) continue;
      if (p.toUpperCase() === 'K') continue;
      pieces[board._colorOf(p)].push(p.toUpperCase());
    }
  }
  const all = pieces.w.concat(pieces.b);
  if (all.length === 0) return true;
  if (all.length === 1 && (all[0] === 'B' || all[0] === 'N')) return true;
  return false;
}

function parseFen(fen) {
  const parts = fen.trim().split(/\s+/);
  const boardStr = parts[0];
  const activeColor = parts[1] || 'w';
  const castling = parts[2] || '-';
  const epSquare = parts[3] || '-';
  const halfMoveClock = parseInt(parts[4] || '0', 10);
  const fullMoveNumber = parseInt(parts[5] || '1', 10);

  const board = new Board();
  const rows = boardStr.split('/');
  for (let r = 0; r < 8; r++) {
    let c = 0;
    for (const ch of rows[r]) {
      if (ch >= '1' && ch <= '8') {
        c += parseInt(ch, 10);
      } else {
        board.setPiece(r, c, ch);
        c++;
      }
    }
  }

  return { board, activeColor, castling, epSquare, halfMoveClock, fullMoveNumber };
}

function toFen(board, activeColor = 'w', castling = '-', epSquare = '-', halfMoveClock = 0, fullMoveNumber = 1) {
  const rows = [];
  for (let r = 0; r < 8; r++) {
    let row = '';
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      const p = board.pieceAt(r, c);
      if (p == null) {
        empty++;
      } else {
        if (empty > 0) { row += empty; empty = 0; }
        row += p;
      }
    }
    if (empty > 0) row += empty;
    rows.push(row);
  }
  return rows.join('/') + ' ' + activeColor + ' ' + castling + ' ' + epSquare + ' ' + halfMoveClock + ' ' + fullMoveNumber;
}

export {
  Board,
  generateLegalMoves,
  makeMove,
  isInCheck,
  isCheckmate,
  isStalemate,
  insufficientMaterial,
  parseFen,
  toFen,
  STARTING_FEN
};
