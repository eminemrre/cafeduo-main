const createGameHandlers = ({
  pool,
  isDbConnected,
  logger,
  supportedGameTypes,
  normalizeGameType,
  normalizeTableCode,
  getGameParticipants,
  normalizeParticipantName,
  sanitizeScoreSubmission,
  pickWinnerFromResults,
  getMemoryGames,
  setMemoryGames,
}) => {
  const isAdminActor = (user) => user?.role === 'admin' || user?.isAdmin === true;

  const getGames = async (req, res) => {
    const adminActor = isAdminActor(req.user);
    const hasCheckIn =
      Boolean(req.user?.cafe_id) &&
      Boolean(normalizeTableCode(req.user?.table_number));

    if (!adminActor && !hasCheckIn) {
      return res.json([]);
    }

    if (await isDbConnected()) {
      const result = await pool.query(
        `
        SELECT 
          id, 
          host_name as "hostName", 
          game_type as "gameType", 
          points, 
          table_code as "table", 
          status, 
          guest_name as "guestName", 
          created_at as "createdAt" 
        FROM games 
        WHERE status = 'waiting'
          AND game_type = ANY($1::text[])
        ORDER BY created_at DESC
      `,
        [[...supportedGameTypes]]
      );
      return res.json(result.rows);
    }

    const filtered = getMemoryGames().filter((game) => {
      if (String(game.status || '').toLowerCase() !== 'waiting') {
        return false;
      }
      if (!supportedGameTypes.has(String(game.gameType || '').trim())) {
        return false;
      }
      return true;
    });
    return res.json(filtered);
  };

  const createGame = async (req, res) => {
    const hostName = String(req.user?.username || '').trim();
    const gameType = normalizeGameType(req.body?.gameType);
    const points = Math.max(0, Math.floor(Number(req.body?.points || 0)));
    const actorTableCode = normalizeTableCode(req.user?.table_number);
    const table = actorTableCode || normalizeTableCode(req.body?.table) || 'MASA00';
    const adminActor = isAdminActor(req.user);
    const hasCheckIn = Boolean(req.user?.cafe_id) && Boolean(actorTableCode);
    const actorPoints = Math.max(0, Math.floor(Number(req.user?.points || 0)));

    if (!hostName || !gameType) {
      return res.status(400).json({ error: 'hostName ve gameType zorunludur.' });
    }
    if (!adminActor && !hasCheckIn) {
      return res.status(403).json({ error: 'Oyun kurmak için önce kafe check-in işlemi yapmalısın.' });
    }
    if (points > actorPoints && !adminActor) {
      return res.status(400).json({ error: 'Katılım puanı mevcut bakiyenden yüksek olamaz.' });
    }
    if (points > 5000) {
      return res.status(400).json({ error: 'Katılım puanı üst limiti aşıldı.' });
    }

    if (await isDbConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const existingGame = await client.query(
          `
            SELECT
              id,
              host_name as "hostName",
              game_type as "gameType",
              points,
              table_code as "table",
              status,
              guest_name as "guestName",
              created_at as "createdAt"
            FROM games
            WHERE (host_name = $1 OR guest_name = $1)
              AND status IN ('waiting', 'active')
            ORDER BY created_at DESC
            LIMIT 1
            FOR UPDATE
          `,
          [hostName]
        );

        if (existingGame.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: 'Önce mevcut oyunu tamamla veya lobiye dön.',
            game: existingGame.rows[0],
          });
        }

        const result = await client.query(
          `
            INSERT INTO games (host_name, game_type, points, table_code, status, game_state)
            VALUES ($1, $2, $3, $4, 'waiting', '{}'::jsonb)
            RETURNING
              id,
              host_name as "hostName",
              game_type as "gameType",
              points,
              table_code as "table",
              status,
              guest_name as "guestName",
              game_state as "gameState",
              created_at as "createdAt"
          `,
          [hostName, gameType, points, table]
        );

        await client.query('COMMIT');
        return res.status(201).json(result.rows[0]);
      } catch (err) {
        await client.query('ROLLBACK');
        logger.error('Create game error', err);
        return res.status(500).json({ error: 'Oyun kurulamadı.' });
      } finally {
        client.release();
      }
    }

    const memoryGames = getMemoryGames();
    const existingMemoryGame = memoryGames.find(
      (game) =>
        (game.hostName === hostName || game.guestName === hostName) &&
        (game.status === 'waiting' || game.status === 'active')
    );
    if (existingMemoryGame) {
      return res.status(409).json({
        error: 'Önce mevcut oyunu tamamla veya lobiye dön.',
        game: existingMemoryGame,
      });
    }

    const newGame = {
      id: Date.now(),
      hostName,
      gameType,
      points,
      table,
      status: 'waiting',
      guestName: null,
      gameState: {},
      createdAt: new Date().toISOString(),
    };
    const nextGames = [newGame, ...memoryGames];
    setMemoryGames(nextGames);
    return res.status(201).json(newGame);
  };

  const joinGame = async (req, res) => {
    const { id } = req.params;
    const guestName = String(req.user?.username || '').trim();
    const adminActor = isAdminActor(req.user);
    const actorTableCode = normalizeTableCode(req.user?.table_number);
    const hasCheckIn = Boolean(req.user?.cafe_id) && Boolean(actorTableCode);

    if (!guestName) {
      return res.status(400).json({ error: 'guestName zorunludur.' });
    }
    if (!adminActor && !hasCheckIn) {
      return res.status(403).json({ error: 'Oyuna katılmak için önce kafe check-in işlemi yapmalısın.' });
    }

    if (await isDbConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const gameResult = await client.query(
          `
            SELECT
              id,
              host_name,
              game_type,
              points,
              table_code,
              status,
              guest_name,
              game_state,
              created_at
            FROM games
            WHERE id = $1
            FOR UPDATE
          `,
          [id]
        );

        if (gameResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Oyun bulunamadı.' });
        }

        const game = gameResult.rows[0];
        if (String(game.host_name || '').toLowerCase() === guestName.toLowerCase()) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Kendi oyununa katılamazsın.' });
        }

        if (game.status === 'finished') {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Bu oyun zaten tamamlandı.' });
        }

        if (game.status === 'active') {
          const canonicalGuest = normalizeParticipantName(guestName, game);
          if (
            canonicalGuest &&
            String(game.guest_name || '').trim() &&
            canonicalGuest.toLowerCase() === String(game.guest_name).toLowerCase()
          ) {
            await client.query('COMMIT');
            return res.json({
              success: true,
              game: {
                id: game.id,
                hostName: game.host_name,
                gameType: game.game_type,
                points: game.points,
                table: game.table_code,
                status: game.status,
                guestName: game.guest_name,
                gameState: game.game_state,
                createdAt: game.created_at,
              },
            });
          }

          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Oyun dolu.' });
        }

        const playerBusy = await client.query(
          `
            SELECT id
            FROM games
            WHERE id <> $1
              AND status = 'active'
              AND (host_name = $2 OR guest_name = $2)
            LIMIT 1
          `,
          [id, guestName]
        );

        if (playerBusy.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Bu kullanıcı zaten aktif bir oyunda.' });
        }

        const updatedResult = await client.query(
          `
            UPDATE games
            SET status = 'active',
                guest_name = $1
            WHERE id = $2
              AND status = 'waiting'
            RETURNING
              id,
              host_name as "hostName",
              game_type as "gameType",
              points,
              table_code as "table",
              status,
              guest_name as "guestName",
              game_state as "gameState",
              created_at as "createdAt"
          `,
          [guestName, id]
        );

        if (updatedResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Bu oyun artık katılıma uygun değil.' });
        }

        await client.query('COMMIT');
        return res.json({ success: true, game: updatedResult.rows[0] });
      } catch (err) {
        await client.query('ROLLBACK');
        logger.error('Join game error', err);
        return res.status(500).json({ error: 'Oyuna katılım sırasında hata oluştu.' });
      } finally {
        client.release();
      }
    }

    const memoryGames = getMemoryGames();
    const game = memoryGames.find((item) => String(item.id) === String(id));
    if (!game) {
      return res.status(404).json({ error: 'Oyun bulunamadı.' });
    }
    if (String(game.hostName || '').toLowerCase() === guestName.toLowerCase()) {
      return res.status(400).json({ error: 'Kendi oyununa katılamazsın.' });
    }
    if (game.status === 'finished') {
      return res.status(409).json({ error: 'Bu oyun zaten tamamlandı.' });
    }
    if (game.status === 'active') {
      if (String(game.guestName || '').toLowerCase() === guestName.toLowerCase()) {
        return res.json({ success: true, game });
      }
      return res.status(409).json({ error: 'Oyun dolu.' });
    }

    game.status = 'active';
    game.guestName = guestName;
    return res.json({ success: true, game });
  };

  const getGameState = async (req, res) => {
    const { id } = req.params;
    if (await isDbConnected()) {
      const result = await pool.query(
        `
        SELECT
          id,
          host_name as "hostName",
          game_type as "gameType",
          points,
          table_code as "table",
          status,
          guest_name as "guestName",
          player1_move as "player1Move",
          player2_move as "player2Move",
          game_state as "gameState",
          created_at as "createdAt"
        FROM games
        WHERE id = $1
      `,
        [id]
      );
      if (result.rows.length > 0) {
        return res.json(result.rows[0]);
      }
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = getMemoryGames().find((item) => String(item.id) === String(id));
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    return res.json(game);
  };

  const getUserGameHistory = async (req, res) => {
    const targetUsername = String(req.params?.username || '').trim();
    const actorUsername = String(req.user?.username || '').trim();
    const adminActor = isAdminActor(req.user);

    if (!targetUsername) {
      return res.status(400).json({ error: 'username zorunludur.' });
    }

    if (!adminActor && actorUsername.toLowerCase() !== targetUsername.toLowerCase()) {
      return res.status(403).json({ error: 'Sadece kendi oyun geçmişini görüntüleyebilirsin.' });
    }

    const mapHistoryRow = (game) => {
      const hostName = String(game.hostName || game.host_name || '').trim();
      const guestName = String(game.guestName || game.guest_name || '').trim();
      const actorLower = targetUsername.toLowerCase();
      const isHost = hostName.toLowerCase() === actorLower;
      const opponentName = isHost ? guestName || 'Rakip' : hostName || 'Rakip';
      const winner = game.winner ? String(game.winner) : null;

      return {
        id: game.id,
        gameType: String(game.gameType || game.game_type || ''),
        points: Math.max(0, Number(game.points || 0)),
        table: String(game.table || game.table_code || ''),
        status: String(game.status || ''),
        winner,
        didWin: Boolean(winner) && winner.toLowerCase() === targetUsername.toLowerCase(),
        opponentName,
        createdAt: game.createdAt || game.created_at || new Date().toISOString(),
      };
    };

    if (await isDbConnected()) {
      try {
        const result = await pool.query(
          `
            SELECT
              id,
              host_name as "hostName",
              guest_name as "guestName",
              game_type as "gameType",
              points,
              table_code as "table",
              status,
              winner,
              created_at as "createdAt"
            FROM games
            WHERE status = 'finished'
              AND game_type = ANY($2::text[])
              AND (
                LOWER(host_name) = LOWER($1)
                OR LOWER(COALESCE(guest_name, '')) = LOWER($1)
              )
            ORDER BY created_at DESC
            LIMIT 25
          `,
          [targetUsername, [...supportedGameTypes]]
        );

        return res.json(result.rows.map(mapHistoryRow));
      } catch (err) {
        logger.error('Get game history error', err);
        return res.status(500).json({ error: 'Oyun geçmişi yüklenemedi.' });
      }
    }

    const history = getMemoryGames()
      .filter((game) => {
        const status = String(game.status || '').toLowerCase();
        if (status !== 'finished') return false;
        if (!supportedGameTypes.has(String(game.gameType || '').trim())) return false;
        const hostLower = String(game.hostName || '').toLowerCase();
        const guestLower = String(game.guestName || '').toLowerCase();
        return hostLower === targetUsername.toLowerCase() || guestLower === targetUsername.toLowerCase();
      })
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 25)
      .map(mapHistoryRow);

    return res.json(history);
  };

  const makeMove = async (req, res) => {
    const { id } = req.params;
    const { player, move, gameState, scoreSubmission } = req.body || {};
    const actorName = String(req.user?.username || '').trim();

    if (await isDbConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const gameResult = await client.query(
          `
            SELECT id, host_name, guest_name, status, game_state
            FROM games
            WHERE id = $1
            FOR UPDATE
          `,
          [id]
        );

        if (gameResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Oyun bulunamadı.' });
        }

        const game = gameResult.rows[0];
        if (game.status === 'finished') {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Bu oyun tamamlandı, hamle kabul edilmiyor.' });
        }

        const actorParticipant = normalizeParticipantName(actorName, game);
        const adminActor = isAdminActor(req.user);
        if (!actorParticipant && !adminActor) {
          await client.query('ROLLBACK');
          return res.status(403).json({ error: 'Bu oyunun oyuncusu değilsin.' });
        }

        const currentState = game.game_state && typeof game.game_state === 'object' ? game.game_state : {};

        if (scoreSubmission) {
          if (game.status !== 'active') {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Skor gönderimi için oyun aktif olmalı.' });
          }

          if (!actorParticipant) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Bu oyunun oyuncusu değilsin.' });
          }

          const scorePayload =
            scoreSubmission && typeof scoreSubmission === 'object' ? scoreSubmission : {};

          const nextResults = {
            ...(currentState.results && typeof currentState.results === 'object' ? currentState.results : {}),
            [actorParticipant]: sanitizeScoreSubmission({
              ...scorePayload,
              username: actorName,
            }),
          };

          const participants = getGameParticipants(game);
          const resolvedWinner = pickWinnerFromResults(nextResults, participants);
          const nextState = {
            ...currentState,
            results: nextResults,
            ...(resolvedWinner ? { resolvedWinner } : {}),
          };

          await client.query(
            `
              UPDATE games
              SET game_state = $1::jsonb
              WHERE id = $2
            `,
            [JSON.stringify(nextState), id]
          );

          await client.query('COMMIT');
          return res.json({
            success: true,
            gameState: nextState,
            resolvedWinner: resolvedWinner || null,
            waitingFor: participants.filter((name) => !nextResults[name]),
          });
        }

        if (gameState && typeof gameState === 'object') {
          const mergedState = {
            ...currentState,
            ...gameState,
          };

          if (currentState.results && !mergedState.results) {
            mergedState.results = currentState.results;
          }

          await client.query(
            `
              UPDATE games
              SET game_state = $1::jsonb
              WHERE id = $2
            `,
            [JSON.stringify(mergedState), id]
          );
          await client.query('COMMIT');
          return res.json({ success: true, gameState: mergedState });
        }

        const hostName = String(game.host_name || '').trim().toLowerCase();
        const guestName = String(game.guest_name || '').trim().toLowerCase();
        const actorNormalized = String(actorParticipant || '').trim().toLowerCase();
        const resolvedPlayer = adminActor
          ? (player === 'guest' ? 'guest' : 'host')
          : actorNormalized === hostName
            ? 'host'
            : actorNormalized === guestName
              ? 'guest'
              : null;

        if (resolvedPlayer !== 'host' && resolvedPlayer !== 'guest') {
          await client.query('ROLLBACK');
          return res.status(403).json({ error: 'Bu hamleyi yapmaya yetkin yok.' });
        }

        const query =
          resolvedPlayer === 'host'
            ? 'UPDATE games SET player1_move = $1 WHERE id = $2'
            : 'UPDATE games SET player2_move = $1 WHERE id = $2';
        await client.query(query, [String(move || '').slice(0, 64), id]);
        await client.query('COMMIT');
        return res.json({ success: true });
      } catch (err) {
        await client.query('ROLLBACK');
        logger.error('Game move update error', err);
        return res.status(500).json({ error: 'Hamle kaydedilemedi.' });
      } finally {
        client.release();
      }
    }

    const game = getMemoryGames().find((item) => String(item.id) === String(id));
    if (!game) {
      return res.status(404).json({ error: 'Oyun bulunamadı.' });
    }
    if (game.status === 'finished') {
      return res.status(409).json({ error: 'Bu oyun tamamlandı, hamle kabul edilmiyor.' });
    }

    const actorParticipant = normalizeParticipantName(actorName, {
      host_name: game.hostName,
      guest_name: game.guestName,
    });
    const adminActor = isAdminActor(req.user);
    if (!actorParticipant && !adminActor) {
      return res.status(403).json({ error: 'Bu oyunun oyuncusu değilsin.' });
    }

    if (scoreSubmission) {
      if (!actorParticipant) {
        return res.status(403).json({ error: 'Bu oyunun oyuncusu değilsin.' });
      }
      const canonicalParticipant = normalizeParticipantName(actorName, {
        host_name: game.hostName,
        guest_name: game.guestName,
      });
      if (!canonicalParticipant) {
        return res.status(403).json({ error: 'Bu oyunun oyuncusu değilsin.' });
      }
      game.gameState = game.gameState || {};
      game.gameState.results = game.gameState.results || {};
      game.gameState.results[canonicalParticipant] = sanitizeScoreSubmission({
        ...(typeof scoreSubmission === 'object' ? scoreSubmission : {}),
        username: actorName,
      });

      const participants = getGameParticipants({
        host_name: game.hostName,
        guest_name: game.guestName,
      });
      const resolvedWinner = pickWinnerFromResults(game.gameState.results, participants);
      if (resolvedWinner) {
        game.gameState.resolvedWinner = resolvedWinner;
      }

      return res.json({
        success: true,
        gameState: game.gameState,
        resolvedWinner: resolvedWinner || null,
        waitingFor: participants.filter((name) => !game.gameState.results[name]),
      });
    }

    if (gameState && typeof gameState === 'object') {
      game.gameState = { ...(game.gameState || {}), ...gameState };
      return res.json({ success: true, gameState: game.gameState });
    }

    const hostName = String(game.hostName || '').trim().toLowerCase();
    const guestName = String(game.guestName || '').trim().toLowerCase();
    const actorNormalized = String(actorParticipant || '').trim().toLowerCase();
    const resolvedPlayer = adminActor
      ? (player === 'guest' ? 'guest' : 'host')
      : actorNormalized === hostName
        ? 'host'
        : actorNormalized === guestName
          ? 'guest'
          : null;
    if (resolvedPlayer === 'host') {
      game.player1Move = String(move || '').slice(0, 64);
    } else if (resolvedPlayer === 'guest') {
      game.player2Move = String(move || '').slice(0, 64);
    } else {
      return res.status(403).json({ error: 'Bu hamleyi yapmaya yetkin yok.' });
    }

    return res.json({ success: true });
  };

  const finishGame = async (req, res) => {
    const { id } = req.params;
    const requestedWinner = req.body?.winner;
    const actorName = String(req.user?.username || '').trim();

    if (await isDbConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const gameResult = await client.query(
          `
            SELECT id, host_name, guest_name, status, winner, game_state
            FROM games
            WHERE id = $1
            FOR UPDATE
          `,
          [id]
        );

        if (gameResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Oyun bulunamadı.' });
        }

        const game = gameResult.rows[0];
        const actorParticipant = normalizeParticipantName(actorName, game);
        const adminActor = isAdminActor(req.user);
        if (!actorParticipant && !adminActor) {
          await client.query('ROLLBACK');
          return res.status(403).json({ error: 'Bu oyunu kapatma yetkin yok.' });
        }

        const participants = getGameParticipants(game);
        const stateResults =
          game.game_state && typeof game.game_state.results === 'object' ? game.game_state.results : {};
        const winnerFromState = normalizeParticipantName(game.game_state?.resolvedWinner, game);
        const winnerFromResults = pickWinnerFromResults(stateResults, participants);
        const winnerFromRequest = normalizeParticipantName(requestedWinner, game);
        const finalWinner = winnerFromState || winnerFromResults || winnerFromRequest;

        if (!finalWinner) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Kazanan belirlenemedi. Her iki oyuncu da skoru göndermeli.' });
        }

        if (game.status === 'finished') {
          await client.query('ROLLBACK');
          if (String(game.winner || '').toLowerCase() === finalWinner.toLowerCase()) {
            return res.json({ success: true, winner: game.winner, alreadyFinished: true });
          }
          return res.status(409).json({ error: 'Oyun zaten farklı bir sonuçla tamamlandı.' });
        }

        await client.query(
          `
            UPDATE games
            SET status = 'finished',
                winner = $1::text,
                game_state = jsonb_set(
                  COALESCE(game_state, '{}'::jsonb),
                  ARRAY['resolvedWinner'],
                  to_jsonb($1::text),
                  true
                )
            WHERE id = $2
          `,
          [finalWinner, id]
        );

        await client.query('COMMIT');
        return res.json({ success: true, winner: finalWinner });
      } catch (err) {
        await client.query('ROLLBACK');
        logger.error('Finish game error', err);
        return res.status(500).json({ error: 'Oyun tamamlanamadı.' });
      } finally {
        client.release();
      }
    }

    const game = getMemoryGames().find((item) => String(item.id) === String(id));
    if (!game) {
      return res.status(404).json({ error: 'Oyun bulunamadı.' });
    }

    const actorParticipant = normalizeParticipantName(actorName, {
      host_name: game.hostName,
      guest_name: game.guestName,
    });
    const adminActor = isAdminActor(req.user);
    if (!actorParticipant && !adminActor) {
      return res.status(403).json({ error: 'Bu oyunu kapatma yetkin yok.' });
    }

    const participants = getGameParticipants({
      host_name: game.hostName,
      guest_name: game.guestName,
    });
    const winnerFromState = normalizeParticipantName(game.gameState?.resolvedWinner, {
      host_name: game.hostName,
      guest_name: game.guestName,
    });
    const winnerFromResults = pickWinnerFromResults(game.gameState?.results || {}, participants);
    const winnerFromRequest = normalizeParticipantName(requestedWinner, {
      host_name: game.hostName,
      guest_name: game.guestName,
    });
    const finalWinner = winnerFromState || winnerFromResults || winnerFromRequest;

    if (!finalWinner) {
      return res.status(409).json({ error: 'Kazanan belirlenemedi. Her iki oyuncu da skoru göndermeli.' });
    }

    game.status = 'finished';
    game.winner = finalWinner;
    game.gameState = {
      ...(game.gameState || {}),
      resolvedWinner: finalWinner,
    };
    return res.json({ success: true, winner: finalWinner });
  };

  const deleteGame = async (req, res) => {
    const { id } = req.params;

    if (await isDbConnected()) {
      const result = await pool.query(
        `
          DELETE FROM games
          WHERE id = $1
            AND (
              LOWER(host_name) = LOWER($2)
              OR LOWER(COALESCE(guest_name, '')) = LOWER($2)
              OR $3 = true
            )
          RETURNING id
        `,
        [id, req.user?.username || '', isAdminActor(req.user)]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Oyun bulunamadı veya silme yetkiniz yok.' });
      }
      return res.json({ success: true });
    }

    const currentGames = getMemoryGames();
    const nextGames = currentGames.filter((game) => {
      if (String(game.id) !== String(id)) return true;
      if (isAdminActor(req.user)) return false;
      const actor = String(req.user?.username || '').toLowerCase();
      return String(game.hostName || '').toLowerCase() !== actor && String(game.guestName || '').toLowerCase() !== actor;
    });
    if (nextGames.length === currentGames.length) {
      return res.status(404).json({ error: 'Oyun bulunamadı veya silme yetkiniz yok.' });
    }
    setMemoryGames(nextGames);
    return res.json({ success: true });
  };

  return {
    getGames,
    createGame,
    joinGame,
    getGameState,
    getUserGameHistory,
    makeMove,
    finishGame,
    deleteGame,
  };
};

module.exports = {
  createGameHandlers,
};
