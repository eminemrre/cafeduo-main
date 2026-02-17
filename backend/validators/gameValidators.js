const { createValidationError } = require('../middleware/errorContract');

const CHESS_SQUARE_RE = /^[a-h][1-8]$/;

const buildDetail = (path, message, value) => ({
  path,
  message,
  value,
});

const parseStrictPositiveInt = (rawValue) => {
  if (rawValue === undefined || rawValue === null) return null;
  const numeric = Number(rawValue);
  if (!Number.isInteger(numeric) || numeric <= 0) return null;
  return numeric;
};

const validateGameIdParam = (req, res, next) => {
  const parsedId = parseStrictPositiveInt(req.params?.id);
  if (!parsedId) {
    return next(
      createValidationError([
        buildDetail('params.id', 'Game id pozitif tam sayı olmalıdır.', req.params?.id),
      ])
    );
  }
  return next();
};

const validateCreateGamePayload = (req, res, next) => {
  const body = req.body && typeof req.body === 'object' ? req.body : null;
  const details = [];

  if (!body) {
    return next(createValidationError([buildDetail('body', 'JSON body zorunludur.', req.body)]));
  }

  const gameType = String(body.gameType || '').trim();
  if (!gameType) {
    details.push(buildDetail('body.gameType', 'gameType zorunludur.', body.gameType));
  } else if (gameType.length > 64) {
    details.push(buildDetail('body.gameType', 'gameType en fazla 64 karakter olabilir.', body.gameType));
  }

  if (body.points !== undefined) {
    const points = Number(body.points);
    if (!Number.isFinite(points) || points < 0 || points > 5000) {
      details.push(buildDetail('body.points', 'points 0 ile 5000 arasında sayı olmalıdır.', body.points));
    }
  }

  if (body.table !== undefined) {
    const table = String(body.table || '').trim();
    if (!table) {
      details.push(buildDetail('body.table', 'table boş string olamaz.', body.table));
    } else if (table.length > 16) {
      details.push(buildDetail('body.table', 'table en fazla 16 karakter olabilir.', body.table));
    }
  }

  if (body.chessClock !== undefined) {
    const chessClock = body.chessClock;
    if (!chessClock || typeof chessClock !== 'object' || Array.isArray(chessClock)) {
      details.push(buildDetail('body.chessClock', 'chessClock obje olmalıdır.', chessClock));
    } else {
      if (chessClock.baseSeconds !== undefined) {
        const value = Number(chessClock.baseSeconds);
        if (!Number.isFinite(value) || value < 60 || value > 1800) {
          details.push(
            buildDetail('body.chessClock.baseSeconds', 'baseSeconds 60-1800 aralığında olmalıdır.', chessClock.baseSeconds)
          );
        }
      }
      if (chessClock.incrementSeconds !== undefined) {
        const value = Number(chessClock.incrementSeconds);
        if (!Number.isFinite(value) || value < 0 || value > 30) {
          details.push(
            buildDetail(
              'body.chessClock.incrementSeconds',
              'incrementSeconds 0-30 aralığında olmalıdır.',
              chessClock.incrementSeconds
            )
          );
        }
      }
    }
  }

  if (details.length > 0) {
    return next(createValidationError(details));
  }
  return next();
};

const validateJoinGamePayload = (req, res, next) => {
  const details = [];
  const parsedId = parseStrictPositiveInt(req.params?.id);
  if (!parsedId) {
    details.push(buildDetail('params.id', 'Game id pozitif tam sayı olmalıdır.', req.params?.id));
  }

  if (req.body !== undefined && req.body !== null && typeof req.body !== 'object') {
    details.push(buildDetail('body', 'JSON body obje olmalıdır.', req.body));
  }

  if (req.body && typeof req.body === 'object' && req.body.guestName !== undefined) {
    const guestName = String(req.body.guestName || '').trim();
    if (!guestName) {
      details.push(buildDetail('body.guestName', 'guestName boş string olamaz.', req.body.guestName));
    } else if (guestName.length > 64) {
      details.push(buildDetail('body.guestName', 'guestName en fazla 64 karakter olabilir.', req.body.guestName));
    }
  }

  if (details.length > 0) {
    return next(createValidationError(details));
  }
  return next();
};

const validateMovePayload = (req, res, next) => {
  const body = req.body && typeof req.body === 'object' ? req.body : null;
  const details = [];
  const parsedId = parseStrictPositiveInt(req.params?.id);
  if (!parsedId) {
    details.push(buildDetail('params.id', 'Game id pozitif tam sayı olmalıdır.', req.params?.id));
  }

  if (!body) {
    details.push(buildDetail('body', 'JSON body zorunludur.', req.body));
  }

  if (body) {
    const actionKeys = ['chessMove', 'liveSubmission', 'scoreSubmission', 'gameState', 'move']
      .filter((key) => body[key] !== undefined && body[key] !== null);

    if (actionKeys.length === 0) {
      details.push(
        buildDetail(
          'body',
          'En az bir hamle payloadı göndermelisin (chessMove/liveSubmission/scoreSubmission/gameState/move).',
          body
        )
      );
    }
    if (actionKeys.length > 1) {
      details.push(
        buildDetail(
          'body',
          'Aynı istekte birden fazla hamle türü gönderilemez.',
          actionKeys
        )
      );
    }

    if (body.player !== undefined && !['host', 'guest'].includes(String(body.player))) {
      details.push(buildDetail('body.player', 'player sadece host veya guest olabilir.', body.player));
    }

    if (body.chessMove !== undefined) {
      const chessMove = body.chessMove;
      if (!chessMove || typeof chessMove !== 'object' || Array.isArray(chessMove)) {
        details.push(buildDetail('body.chessMove', 'chessMove obje olmalıdır.', chessMove));
      } else {
        const from = String(chessMove.from || '').trim().toLowerCase();
        const to = String(chessMove.to || '').trim().toLowerCase();
        if (!CHESS_SQUARE_RE.test(from)) {
          details.push(buildDetail('body.chessMove.from', 'from kare formatı geçersiz (örn: e2).', chessMove.from));
        }
        if (!CHESS_SQUARE_RE.test(to)) {
          details.push(buildDetail('body.chessMove.to', 'to kare formatı geçersiz (örn: e4).', chessMove.to));
        }
        if (chessMove.promotion !== undefined) {
          const promotion = String(chessMove.promotion || '').toLowerCase();
          if (!['q', 'r', 'b', 'n'].includes(promotion)) {
            details.push(buildDetail('body.chessMove.promotion', 'promotion q/r/b/n olmalıdır.', chessMove.promotion));
          }
        }
      }
    }

    if (body.liveSubmission !== undefined) {
      const liveSubmission = body.liveSubmission;
      if (!liveSubmission || typeof liveSubmission !== 'object' || Array.isArray(liveSubmission)) {
        details.push(buildDetail('body.liveSubmission', 'liveSubmission obje olmalıdır.', liveSubmission));
      } else {
        if (liveSubmission.mode !== undefined && String(liveSubmission.mode).trim().length > 64) {
          details.push(buildDetail('body.liveSubmission.mode', 'mode en fazla 64 karakter olabilir.', liveSubmission.mode));
        }
        ['score', 'roundsWon', 'round'].forEach((field) => {
          if (liveSubmission[field] !== undefined) {
            const value = Number(liveSubmission[field]);
            if (!Number.isFinite(value) || value < 0) {
              details.push(buildDetail(`body.liveSubmission.${field}`, `${field} negatif olamaz.`, liveSubmission[field]));
            }
          }
        });
        if (liveSubmission.done !== undefined && typeof liveSubmission.done !== 'boolean') {
          details.push(buildDetail('body.liveSubmission.done', 'done boolean olmalıdır.', liveSubmission.done));
        }
      }
    }

    if (body.scoreSubmission !== undefined) {
      const scoreSubmission = body.scoreSubmission;
      if (!scoreSubmission || typeof scoreSubmission !== 'object' || Array.isArray(scoreSubmission)) {
        details.push(buildDetail('body.scoreSubmission', 'scoreSubmission obje olmalıdır.', scoreSubmission));
      } else {
        ['score', 'roundsWon', 'durationMs'].forEach((field) => {
          if (scoreSubmission[field] !== undefined) {
            const value = Number(scoreSubmission[field]);
            if (!Number.isFinite(value) || value < 0) {
              details.push(buildDetail(`body.scoreSubmission.${field}`, `${field} negatif olamaz.`, scoreSubmission[field]));
            }
          }
        });
      }
    }

    if (body.gameState !== undefined) {
      const gameState = body.gameState;
      if (!gameState || typeof gameState !== 'object' || Array.isArray(gameState)) {
        details.push(buildDetail('body.gameState', 'gameState obje olmalıdır.', gameState));
      } else {
        try {
          const serialized = JSON.stringify(gameState);
          if (serialized.length > 50_000) {
            details.push(buildDetail('body.gameState', 'gameState boyutu 50KB sınırını aşıyor.', serialized.length));
          }
        } catch {
          details.push(buildDetail('body.gameState', 'gameState serialize edilemedi.', null));
        }
      }
    }

    if (body.move !== undefined) {
      const move = String(body.move || '').trim();
      if (!move) {
        details.push(buildDetail('body.move', 'move boş string olamaz.', body.move));
      } else if (move.length > 64) {
        details.push(buildDetail('body.move', 'move en fazla 64 karakter olabilir.', body.move));
      }
    }
  }

  if (details.length > 0) {
    return next(createValidationError(details));
  }
  return next();
};

module.exports = {
  validateGameIdParam,
  validateCreateGamePayload,
  validateJoinGamePayload,
  validateMovePayload,
};
