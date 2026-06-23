import { Board, generateLegalMoves, makeMove, isInCheck, isCheckmate, isStalemate } from './chess.js';

const PIECE_VALUES = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };

const PAWN_TABLE = [
  [ 0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [ 5,  5, 10, 25, 25, 10,  5,  5],
  [ 0,  0,  0, 20, 20,  0,  0,  0],
  [ 5, -5,-10,  0,  0,-10, -5,  5],
  [ 5, 10, 10,-20,-20, 10, 10,  5],
  [ 0,  0,  0,  0,  0,  0,  0,  0]
];

const KNIGHT_TABLE = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  0,  0,  0,-20,-40],
  [-30,  0, 10, 15, 15, 10,  0,-30],
  [-30,  5, 15, 20, 20, 15,  5,-30],
  [-30,  0, 15, 20, 20, 15,  0,-30],
  [-30,  5, 10, 15, 15, 10,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50]
];

const BISHOP_TABLE = [
  [-20,-10,-10,-10,-10,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5, 10, 10,  5,  0,-10],
  [-10,  5,  5, 10, 10,  5,  5,-10],
  [-10,  0, 10, 10, 10, 10,  0,-10],
  [-10, 10, 10, 10, 10, 10, 10,-10],
  [-10,  5,  0,  0,  0,  0,  5,-10],
  [-20,-10,-10,-10,-10,-10,-10,-20]
];

const ROOK_TABLE = [
  [ 0,  0,  0,  0,  0,  0,  0,  0],
  [ 5, 10, 10, 10, 10, 10, 10,  5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [-5,  0,  0,  0,  0,  0,  0, -5],
  [ 0,  0,  0,  5,  5,  0,  0,  0]
];

const QUEEN_TABLE = [
  [-20,-10,-10, -5, -5,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  5,  5,  5,  5,  0,-10],
  [ -5,  0,  5,  5,  5,  5,  0, -5],
  [  0,  0,  5,  5,  5,  5,  0, -5],
  [-10,  5,  5,  5,  5,  5,  0,-10],
  [-10,  0,  5,  0,  0,  0,  0,-10],
  [-20,-10,-10, -5, -5,-10,-10,-20]
];

const KING_TABLE = [
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],
  [-10,-20,-20,-20,-20,-20,-20,-10],
  [ 20, 20,  0,  0,  0,  0, 20, 20],
  [ 20, 30, 10,  0,  0, 10, 30, 20]
];

const PST = { P: PAWN_TABLE, N: KNIGHT_TABLE, B: BISHOP_TABLE, R: ROOK_TABLE, Q: QUEEN_TABLE, K: KING_TABLE };

function getPstValue(piece, row, col) {
  const type = piece.toUpperCase();
  const table = PST[type];
  if (!table) return 0;
  return table[row][col];
}

const CENTRE_SQUARES = [[3, 3], [3, 4], [4, 3], [4, 4]];

export function evaluateBoard(board, color) {
  const opponent = color === 'w' ? 'b' : 'w';
  let score = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board.pieceAt(r, c);
      if (!piece) continue;
      const pc = board._colorOf(piece);
      const sign = pc === color ? 1 : -1;
      const pstRow = pc === 'w' ? r : 7 - r;
      score += sign * PIECE_VALUES[piece.toUpperCase()];
      score += sign * getPstValue(piece, pstRow, c);
    }
  }

  const aiMobility = generateLegalMoves(board, color, '-', '-').length;
  const oppMobility = generateLegalMoves(board, opponent, '-', '-').length;
  score += (aiMobility - oppMobility);

  for (const [r, c] of CENTRE_SQUARES) {
    const p = board.pieceAt(r, c);
    if (p) {
      if (board._colorOf(p) === color) score += 10;
      else score -= 10;
    }
  }

  score += (Math.random() * 10 - 5);

  return score;
}

function moveOrderScore(board, move) {
  let score = 0;
  if (move.captured) {
    const piece = board.pieceAt(move.from.row, move.from.col);
    const attacker = piece ? PIECE_VALUES[piece.toUpperCase()] : 0;
    const victim = PIECE_VALUES[move.captured.toUpperCase()];
    score = 1000000 + victim * 10 - attacker;
  }
  if (move.promotion) {
    const promoVal = PIECE_VALUES[move.promotion.toUpperCase()];
    score += 500000 + promoVal;
  }
  return score;
}

function getCurrentColor(color, isMaximizing) {
  return isMaximizing ? color : (color === 'w' ? 'b' : 'w');
}

function isTimeout(startTime, timeLimit) {
  return Date.now() - startTime > timeLimit;
}

function quiescenceSearch(board, alpha, beta, isMaximizing, color, epSquare, castleRights, qsDepth, nodesRef, startTime, timeLimit) {
  nodesRef.count++;

  if (nodesRef.count % 1000 === 0 && isTimeout(startTime, timeLimit)) {
    throw new Error('timeout');
  }

  const standPat = evaluateBoard(board, color);

  if (isMaximizing) {
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;
  } else {
    if (standPat <= alpha) return alpha;
    if (standPat < beta) beta = standPat;
  }

  if (qsDepth >= 4) {
    return isMaximizing ? alpha : beta;
  }

  const currentColor = getCurrentColor(color, isMaximizing);
  const allMoves = generateLegalMoves(board, currentColor, epSquare, castleRights);
  const captures = allMoves.filter(m => m.captured != null);

  if (captures.length === 0) {
    return isMaximizing ? alpha : beta;
  }

  captures.sort((a, b) => moveOrderScore(board, b) - moveOrderScore(board, a));

  for (const move of captures) {
    const result = makeMove(board, move, epSquare, castleRights);
    const score = quiescenceSearch(result.board, alpha, beta, !isMaximizing, color, result.epSquare, result.castleRights, qsDepth + 1, nodesRef, startTime, timeLimit);

    if (isMaximizing) {
      if (score > alpha) alpha = score;
    } else {
      if (score < beta) beta = score;
    }

    if (alpha >= beta) break;
  }

  return isMaximizing ? alpha : beta;
}

function minimax(board, depth, alpha, beta, isMaximizing, color, epSquare, castleRights, nodesRef, startTime, timeLimit) {
  nodesRef.count++;

  if (nodesRef.count % 1000 === 0 && isTimeout(startTime, timeLimit)) {
    throw new Error('timeout');
  }

  const currentColor = getCurrentColor(color, isMaximizing);
  const moves = generateLegalMoves(board, currentColor, epSquare, castleRights);

  if (moves.length === 0) {
    if (isInCheck(board, currentColor)) {
      return isMaximizing ? -99999 : 99999;
    }
    return 0;
  }

  if (depth === 0) {
    return quiescenceSearch(board, alpha, beta, isMaximizing, color, epSquare, castleRights, 0, nodesRef, startTime, timeLimit);
  }

  const orderedMoves = [...moves];
  orderedMoves.sort((a, b) => moveOrderScore(board, b) - moveOrderScore(board, a));

  for (const move of orderedMoves) {
    const result = makeMove(board, move, epSquare, castleRights);
    const score = minimax(result.board, depth - 1, alpha, beta, !isMaximizing, color, result.epSquare, result.castleRights, nodesRef, startTime, timeLimit);

    if (isMaximizing) {
      if (score > alpha) alpha = score;
    } else {
      if (score < beta) beta = score;
    }

    if (alpha >= beta) break;
  }

  return isMaximizing ? alpha : beta;
}

export function findBestMove(board, color, epSquare, castleRights, depth = 3) {
  let bestMove = null;
  let bestScore = -Infinity;
  let totalNodes = 0;
  let completedDepth = 0;

  const startTime = Date.now();
  const timeLimit = 200;

  for (let d = 1; d <= depth; d++) {
    let alpha = -Infinity;
    let beta = Infinity;
    const nodesRef = { count: 0 };
    let currentBestMove = null;
    let currentBestScore = -Infinity;
    let aborted = false;

    try {
      const moves = generateLegalMoves(board, color, epSquare, castleRights);

      if (moves.length === 0) {
        return { move: null, score: evaluateBoard(board, color), nodes: 0, depth: 0 };
      }

      if (bestMove) {
        const pvIdx = moves.findIndex(m =>
          m.from.row === bestMove.from.row &&
          m.from.col === bestMove.from.col &&
          m.to.row === bestMove.to.row &&
          m.to.col === bestMove.to.col &&
          m.promotion === bestMove.promotion
        );
        if (pvIdx > 0) {
          [moves[0], moves[pvIdx]] = [moves[pvIdx], moves[0]];
        }
      }

      const pvMove = moves[0];
      const remaining = moves.slice(1);
      remaining.sort((a, b) => moveOrderScore(board, b) - moveOrderScore(board, a));
      const orderedMoves = [pvMove, ...remaining];

      for (const move of orderedMoves) {
        if (isTimeout(startTime, timeLimit)) {
          aborted = true;
          break;
        }

        const result = makeMove(board, move, epSquare, castleRights);
        const score = minimax(result.board, d - 1, alpha, beta, false, color, result.epSquare, result.castleRights, nodesRef, startTime, timeLimit);

        if (score > currentBestScore) {
          currentBestScore = score;
          currentBestMove = move;
        }
        if (score > alpha) alpha = score;
      }

      if (currentBestMove) {
        bestMove = currentBestMove;
        bestScore = currentBestScore;
      }
      totalNodes += nodesRef.count;
      completedDepth = d;

      if (aborted || isTimeout(startTime, timeLimit)) break;
    } catch (e) {
      if (e.message === 'timeout') break;
      throw e;
    }
  }

  return {
    move: bestMove,
    score: bestScore,
    nodes: totalNodes,
    depth: completedDepth
  };
}
