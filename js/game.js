import {
  Board, generateLegalMoves, makeMove, isInCheck,
  insufficientMaterial, parseFen, toFen, STARTING_FEN
} from './chess.js';

const FILES = 'abcdefgh';
const RANKS = '87654321';

function posHash(board, activeColor, castleRights, epSquare) {
  return toFen(board, activeColor, castleRights, epSquare, 0, 1);
}

class Game {
  constructor(mode = 'local', playerColor = 'w') {
    this.mode = mode;
    this.playerColor = playerColor;
    this._resetState();
  }

  _resetState() {
    const parsed = parseFen(STARTING_FEN);
    this.board = parsed.board;
    this.activeColor = parsed.activeColor;
    this.castleRights = parsed.castling;
    this.epSquare = parsed.epSquare;
    this.halfMoveClock = parsed.halfMoveClock;
    this.fullMoveNumber = parsed.fullMoveNumber;
    this.moveHistory = [];
    this.gameOver = false;
    this.gameResult = null;
    this.fen = STARTING_FEN;
    this.positionHistory = [posHash(this.board, this.activeColor, this.castleRights, this.epSquare)];
  }

  start() {
    this._resetState();
  }

  makeMove(fromRow, fromCol, toRow, toCol) {
    if (this.gameOver) {
      return {
        success: false, move: null, error: 'Game is already over',
        gameOver: true, result: this.gameResult
      };
    }

    const legalMoves = generateLegalMoves(this.board, this.activeColor, this.epSquare, this.castleRights);
    const matching = legalMoves.filter(m =>
      m.from.row === fromRow && m.from.col === fromCol &&
      m.to.row === toRow && m.to.col === toCol
    );

    if (matching.length === 0) {
      return { success: false, move: null, error: 'Illegal move', gameOver: false, result: null };
    }

    const move = matching.find(m => m.promotion && m.promotion.toUpperCase() === 'Q') || matching[0];

    const prevState = {
      board: this.board,
      activeColor: this.activeColor,
      castleRights: this.castleRights,
      epSquare: this.epSquare,
      halfMoveClock: this.halfMoveClock,
      fullMoveNumber: this.fullMoveNumber,
      gameOver: this.gameOver,
      gameResult: this.gameResult,
      positionHistory: [...this.positionHistory],
      fen: this.fen
    };

    const result = makeMove(this.board, move, this.epSquare, this.castleRights);

    this.board = result.board;
    this.castleRights = result.castleRights;
    this.epSquare = result.epSquare;

    const piece = result.move.piece;
    if (piece.toUpperCase() === 'P' || result.move.captured) {
      this.halfMoveClock = 0;
    } else {
      this.halfMoveClock++;
    }

    if (this.activeColor === 'b') {
      this.fullMoveNumber++;
    }

    this.activeColor = this.activeColor === 'w' ? 'b' : 'w';

    const hash = posHash(this.board, this.activeColor, this.castleRights, this.epSquare);
    this.positionHistory.push(hash);

    const inCheck = isInCheck(this.board, this.activeColor);
    const legal = generateLegalMoves(this.board, this.activeColor, this.epSquare, this.castleRights);
    const checkmate = inCheck && legal.length === 0;
    const stalemate = !inCheck && legal.length === 0;

    if (checkmate) {
      this.gameOver = true;
      this.gameResult = this.activeColor === 'w' ? '0-1' : '1-0';
    } else if (stalemate) {
      this.gameOver = true;
      this.gameResult = '1/2-1/2';
    } else if (insufficientMaterial(this.board)) {
      this.gameOver = true;
      this.gameResult = '1/2-1/2';
    } else if (this.halfMoveClock >= 100) {
      this.gameOver = true;
      this.gameResult = '1/2-1/2';
    } else if (this.positionHistory.filter(h => h === hash).length >= 3) {
      this.gameOver = true;
      this.gameResult = '1/2-1/2';
    }

    const moveRecord = {
      ...result.move,
      isCheck: inCheck,
      isCheckmate: checkmate
    };

    moveRecord.notation = this._notation(moveRecord, prevState.board, prevState.epSquare, prevState.castleRights);

    this.moveHistory.push({ move: moveRecord, prevState });
    this.fen = toFen(this.board, this.activeColor, this.castleRights, this.epSquare, this.halfMoveClock, this.fullMoveNumber);

    return {
      success: true,
      move: moveRecord,
      error: null,
      gameOver: this.gameOver,
      result: this.gameResult
    };
  }

  undo() {
    if (this.moveHistory.length === 0) {
      return { success: false, move: null };
    }
    const entry = this.moveHistory.pop();
    const p = entry.prevState;
    this.board = p.board;
    this.activeColor = p.activeColor;
    this.castleRights = p.castleRights;
    this.epSquare = p.epSquare;
    this.halfMoveClock = p.halfMoveClock;
    this.fullMoveNumber = p.fullMoveNumber;
    this.gameOver = p.gameOver;
    this.gameResult = p.gameResult;
    this.positionHistory = p.positionHistory;
    this.fen = p.fen;
    return { success: true, move: entry.move };
  }

  getLegalMoves() {
    return generateLegalMoves(this.board, this.activeColor, this.epSquare, this.castleRights);
  }

  getFen() {
    return this.fen;
  }

  loadFen(fen) {
    const parsed = parseFen(fen);
    this.board = parsed.board;
    this.activeColor = parsed.activeColor;
    this.castleRights = parsed.castling;
    this.epSquare = parsed.epSquare;
    this.halfMoveClock = parsed.halfMoveClock;
    this.fullMoveNumber = parsed.fullMoveNumber;
    this.moveHistory = [];
    this.gameOver = false;
    this.gameResult = null;
    this.fen = fen;
    this.positionHistory = [posHash(this.board, this.activeColor, this.castleRights, this.epSquare)];
  }

  getStatus() {
    const inCheck = isInCheck(this.board, this.activeColor);
    const legal = generateLegalMoves(this.board, this.activeColor, this.epSquare, this.castleRights);
    return {
      turn: this.activeColor,
      inCheck,
      isCheckmate: inCheck && legal.length === 0,
      isStalemate: !inCheck && legal.length === 0,
      gameOver: this.gameOver,
      result: this.gameResult,
      halfMoveClock: this.halfMoveClock,
      fullMoveNumber: this.fullMoveNumber
    };
  }

  getHistory() {
    return this.moveHistory.map(e => e.move);
  }

  getMoveNotation(move) {
    if (move.notation) return move.notation;
    return this._notation(move, this.board, this.epSquare, this.castleRights);
  }

  _notation(move, board, epSquare, castleRights) {
    if (move.isCastle) {
      let n = move.castleSide === 'K' || move.castleSide === 'k' ? 'O-O' : 'O-O-O';
      if (move.isCheckmate) return n + '#';
      if (move.isCheck) return n + '+';
      return n;
    }

    const piece = move.piece || board.pieceAt(move.from.row, move.from.col);
    const pUpper = piece.toUpperCase();
    const isPawn = pUpper === 'P';
    const color = board._colorOf(piece);
    const dest = FILES[move.to.col] + RANKS[move.to.row];
    const isCapture = !!move.captured || move.isEnPassant;

    let notation = '';

    if (isPawn) {
      if (isCapture) notation += FILES[move.from.col];
    } else {
      notation += pUpper;

      const allLegal = generateLegalMoves(board, color, epSquare, castleRights);
      const candidates = allLegal.filter(m => {
        if (m.from.row === move.from.row && m.from.col === move.from.col) return false;
        if (m.to.row !== move.to.row || m.to.col !== move.to.col) return false;
        const p = board.pieceAt(m.from.row, m.from.col);
        return p && p.toUpperCase() === pUpper;
      });

      if (candidates.length > 0) {
        const diffFile = candidates.some(m => m.from.col !== move.from.col);
        const diffRank = candidates.some(m => m.from.row !== move.from.row);
        if (diffFile && diffRank) {
          notation += FILES[move.from.col] + RANKS[move.from.row];
        } else if (diffFile) {
          notation += FILES[move.from.col];
        } else {
          notation += RANKS[move.from.row];
        }
      }
    }

    if (isCapture) notation += 'x';

    notation += dest;

    if (move.promotion) notation += '=' + move.promotion.toUpperCase();

    if (move.isCheckmate) {
      notation += '#';
    } else if (move.isCheck) {
      notation += '+';
    }

    return notation;
  }
}

export { Game };
