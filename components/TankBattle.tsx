import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User } from '../types';
import { RetroButton } from './RetroButton';
import { api } from '../lib/api';
import { submitScoreAndWaitForWinner } from '../lib/multiplayer';
import { GAME_ASSETS } from '../lib/gameAssets';
import { playGameSfx } from '../lib/gameAudio';
import { socketService } from '../lib/socket';

interface TankBattleProps {
    currentUser: User;
    gameId: string | number | null;
    opponentName?: string;
    isBot: boolean;
    onGameEnd: (winner: string, points: number) => void;
    onLeave: () => void;
}

interface LiveSubmissionState {
    score?: number;
    round?: number;
    done?: boolean;
}

interface GameSnapshot {
    id: string | number;
    status?: string;
    winner?: string | null;
    hostName?: string;
    guestName?: string | null;
    gameState?: {
        resolvedWinner?: string;
        live?: {
            submissions?: Record<string, LiveSubmissionState>;
            resolvedWinner?: string;
        };
    };
}

interface GameStateUpdatedPayload {
    type?: string;
    gameId?: string | number;
}

// ------- Game constants -------
const CANVAS_W = 800;
const CANVAS_H = 400;
const TANK_W = 48;
const TANK_H = 28;
const BARREL_LEN = 32;
const PROJECTILE_R = 4;
const GRAVITY = 0.18;
const MAX_HP = 3;
const TERRAIN_SEGMENTS = 40;
const EXPLOSION_DURATION = 350;
const HIT_RADIUS = 30;

// Color palette (retro-futuristic)
const C = {
    sky1: '#04112a',
    sky2: '#0a1e44',
    ground: '#0d2a15',
    groundLine: '#1a5c2e',
    tankPlayer: '#15d4ff',
    tankPlayerDark: '#0a8eb3',
    tankBot: '#ff5c7c',
    tankBotDark: '#b33a52',
    barrel: '#c0d8e8',
    projectile: '#ffe066',
    explosion: '#ff9f43',
    explosionInner: '#ffe066',
    hud: '#15d4ff',
    hudDim: 'rgba(21,212,255,0.35)',
    text: '#edf6ff',
    textDim: '#91a8c9',
};

// Simple terrain generation
const generateTerrain = (): number[] => {
    const points: number[] = [];
    const base = CANVAS_H * 0.65;
    for (let i = 0; i <= TERRAIN_SEGMENTS; i++) {
        const x = i / TERRAIN_SEGMENTS;
        const hill1 = Math.sin(x * Math.PI * 2.3) * 35;
        const hill2 = Math.sin(x * Math.PI * 1.1 + 1.2) * 25;
        const hill3 = Math.sin(x * Math.PI * 4.5 + 0.5) * 10;
        points.push(base + hill1 + hill2 + hill3);
    }
    return points;
};

const terrainYAt = (terrain: number[], xNorm: number): number => {
    const idx = xNorm * TERRAIN_SEGMENTS;
    const lo = Math.max(0, Math.min(TERRAIN_SEGMENTS, Math.floor(idx)));
    const hi = Math.min(TERRAIN_SEGMENTS, lo + 1);
    const t = idx - lo;
    return terrain[lo] * (1 - t) + terrain[hi] * t;
};

export const TankBattle: React.FC<TankBattleProps> = ({
    currentUser,
    gameId,
    opponentName,
    isBot,
    onGameEnd,
    onLeave,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [angle, setAngle] = useState(45);
    const [power, setPower] = useState(60);
    const [playerHP, setPlayerHP] = useState(MAX_HP);
    const [opponentHP, setOpponentHP] = useState(MAX_HP);
    const [isPlayerTurn, setIsPlayerTurn] = useState(true);
    const [firing, setFiring] = useState(false);
    const [done, setDone] = useState(false);
    const [message, setMessage] = useState('Açı ve güç ayarla, ateş et!');
    const [resolvingMatch, setResolvingMatch] = useState(false);

    const terrainRef = useRef<number[]>(generateTerrain());
    const projectileRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
    const explosionRef = useRef<{ x: number; y: number; startTime: number } | null>(null);
    const animFrameRef = useRef<number>(0);
    const finishHandledRef = useRef(false);
    const matchStartedAtRef = useRef(Date.now());
    const pollRef = useRef<number | null>(null);
    const hostNameRef = useRef('');
    const guestNameRef = useRef('');

    const target = useMemo(() => (isBot ? 'BOT' : (opponentName || 'Rakip')), [isBot, opponentName]);

    // Tank positions
    const playerTankX = 0.12;
    const opponentTankX = 0.88;
    const playerTankY = terrainYAt(terrainRef.current, playerTankX);
    const opponentTankY = terrainYAt(terrainRef.current, opponentTankX);

    const finishFromServer = useCallback((winnerRaw: string | null) => {
        if (finishHandledRef.current) return;
        finishHandledRef.current = true;
        const winner = String(winnerRaw || '').trim() || 'Berabere';
        const points = winner.toLowerCase() === currentUser.username.toLowerCase() ? 10 : 0;
        setDone(true);
        setMessage(winner === 'Berabere' ? 'Oyun berabere tamamlandı.' : `${winner} kazandı!`);
        window.setTimeout(() => onGameEnd(winner, points), 900);
    }, [currentUser.username, onGameEnd]);

    const applySnapshot = useCallback((snapshot: GameSnapshot) => {
        if (snapshot.hostName) hostNameRef.current = String(snapshot.hostName);
        if (snapshot.guestName) guestNameRef.current = String(snapshot.guestName);

        const winner =
            String(snapshot.gameState?.resolvedWinner || snapshot.gameState?.live?.resolvedWinner || snapshot.winner || '').trim() || null;
        if (String(snapshot.status || '').toLowerCase() === 'finished') {
            finishFromServer(winner);
        }
    }, [finishFromServer]);

    const fetchSnapshot = useCallback(async (silent = false) => {
        if (isBot || !gameId) return;
        try {
            const snapshot = await api.games.get(gameId) as GameSnapshot;
            applySnapshot(snapshot);
        } catch (err) {
            console.error('TankBattle snapshot error', err);
        }
    }, [applySnapshot, gameId, isBot]);

    // Multiplayer sync
    const syncLiveProgress = useCallback(async (score: number, currentRound: number, isDone: boolean) => {
        if (isBot || !gameId) return;
        try {
            await api.games.move(gameId, {
                liveSubmission: {
                    mode: 'Tank Düellosu',
                    score,
                    roundsWon: score,
                    round: currentRound,
                    done: isDone,
                    submissionKey: `tank|${String(gameId)}|${currentUser.username}|${currentRound}|${score}|${isDone ? 1 : 0}`,
                },
            });
        } catch (err) {
            console.error('TankBattle live submission failed', err);
        }
    }, [currentUser.username, gameId, isBot]);

    const finalizeMatch = useCallback(async (localWinner: string, playerScoreValue: number) => {
        if (finishHandledRef.current) return;
        if (isBot || !gameId) {
            const points = localWinner === currentUser.username ? 10 : 0;
            finishHandledRef.current = true;
            setDone(true);
            setMessage(localWinner === currentUser.username ? 'Tebrikler, kazandın!' : `${target} kazandı!`);
            setTimeout(() => onGameEnd(localWinner, points), 900);
            return;
        }

        setResolvingMatch(true);
        setMessage('Skorun kaydedildi. Rakip sonucu bekleniyor...');

        try {
            const durationMs = Math.max(1, Date.now() - matchStartedAtRef.current);
            const { winner, finished } = await submitScoreAndWaitForWinner({
                gameId,
                username: currentUser.username,
                score: playerScoreValue,
                roundsWon: playerScoreValue,
                durationMs,
            });

            if (!finished) {
                setMessage('Sunucu sonucu henüz kesinleştirmedi.');
                finishHandledRef.current = true;
                setTimeout(() => onGameEnd('Sonuç Bekleniyor', 0), 900);
                return;
            }

            const resolvedWinner = winner || 'Berabere';
            const points = winner && winner === currentUser.username ? 10 : 0;
            setDone(true);
            setMessage(
                !winner
                    ? 'Maç berabere tamamlandı.'
                    : points > 0
                        ? 'Maçı kazandın!'
                        : 'Maçı rakip aldı.'
            );
            finishHandledRef.current = true;
            setTimeout(() => onGameEnd(resolvedWinner, points), 900);
        } catch {
            setMessage('Bağlantı sorunu: sonuç sunucudan doğrulanamadı.');
            finishHandledRef.current = true;
            setTimeout(() => onGameEnd('Sonuç Bekleniyor', 0), 900);
        } finally {
            setResolvingMatch(false);
        }
    }, [currentUser.username, gameId, isBot, onGameEnd, target]);

    const [wind, setWind] = useState(0); // -2.5 to 2.5

    const generateWind = useCallback(() => {
        if (isBot) {
            setWind(Number((Math.random() * 5 - 2.5).toFixed(1)));
            return;
        }
        // For multiplayer, sync wind via game state if possible or let host generate.
        // Simplified: Generate locally for now, since it's just visual/fun
        setWind(Number((Math.random() * 5 - 2.5).toFixed(1)));
    }, [isBot]);

    useEffect(() => {
        const socket = socketService.getSocket();
        const handleOpponentMove = (payload: any) => {
            if (String(payload?.gameId) !== String(gameId)) return;

            const moveData = payload?.move;
            if (!moveData || typeof moveData.angle !== 'number' || typeof moveData.power !== 'number') return;

            // Rakip ateş etti!
            if (moveData.wind !== undefined) setWind(moveData.wind);

            setMessage(`${target} ateş etti!`);
            playGameSfx('hit', 0.25);

            const angleRad = (180 - moveData.angle) * (Math.PI / 180);
            const speed = moveData.power * 0.08;
            const startX = opponentTankX * CANVAS_W;
            const startY = opponentTankY - TANK_H + 4;

            projectileRef.current = {
                x: startX,
                y: startY,
                vx: Math.cos(angleRad) * speed,
                vy: -Math.sin(angleRad) * speed,
            };
        };

        socket.on('opponent_move', handleOpponentMove);
        return () => {
            socket.off('opponent_move', handleOpponentMove);
        };
    }, [gameId, opponentTankX, opponentTankY, target]);

    // ------- Draw -------
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const terrain = terrainRef.current;

        // Sky gradient
        const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
        skyGrad.addColorStop(0, C.sky1);
        skyGrad.addColorStop(1, C.sky2);
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // Stars
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        for (let i = 0; i < 30; i++) {
            const sx = ((i * 137 + 29) % CANVAS_W);
            const sy = ((i * 73 + 11) % (CANVAS_H * 0.5));
            ctx.beginPath();
            ctx.arc(sx, sy, 0.8, 0, Math.PI * 2);
            ctx.fill();
        }

        // Terrain
        ctx.beginPath();
        ctx.moveTo(0, CANVAS_H);
        for (let i = 0; i <= TERRAIN_SEGMENTS; i++) {
            ctx.lineTo((i / TERRAIN_SEGMENTS) * CANVAS_W, terrain[i]);
        }
        ctx.lineTo(CANVAS_W, CANVAS_H);
        ctx.closePath();
        const terrainGrad = ctx.createLinearGradient(0, CANVAS_H * 0.5, 0, CANVAS_H);
        terrainGrad.addColorStop(0, C.ground);
        terrainGrad.addColorStop(1, '#051210');
        ctx.fillStyle = terrainGrad;
        ctx.fill();

        // Terrain edge line
        ctx.beginPath();
        for (let i = 0; i <= TERRAIN_SEGMENTS; i++) {
            const x = (i / TERRAIN_SEGMENTS) * CANVAS_W;
            if (i === 0) ctx.moveTo(x, terrain[i]);
            else ctx.lineTo(x, terrain[i]);
        }
        ctx.strokeStyle = C.groundLine;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Helper: draw tank
        const drawTank = (xNorm: number, yPos: number, color: string, darkColor: string, facingRight: boolean, hp: number, barrelAngle: number) => {
            const x = xNorm * CANVAS_W;
            // Treads
            ctx.fillStyle = darkColor;
            ctx.fillRect(x - TANK_W / 2, yPos - 6, TANK_W, 12);
            // Body
            ctx.fillStyle = color;
            ctx.fillRect(x - TANK_W / 2 + 4, yPos - TANK_H + 4, TANK_W - 8, TANK_H - 10);
            // Turret dome
            ctx.beginPath();
            ctx.arc(x, yPos - TANK_H + 4, 12, Math.PI, 0);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = darkColor;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            // Barrel
            const bAngleRad = (facingRight ? -barrelAngle : -(180 - barrelAngle)) * (Math.PI / 180);
            const bx = x;
            const by = yPos - TANK_H + 4;
            ctx.beginPath();
            ctx.moveTo(bx, by);
            ctx.lineTo(bx + Math.cos(bAngleRad) * BARREL_LEN, by + Math.sin(bAngleRad) * BARREL_LEN);
            ctx.strokeStyle = C.barrel;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.stroke();
            ctx.lineCap = 'butt';
            // HP pips
            for (let i = 0; i < MAX_HP; i++) {
                ctx.fillStyle = i < hp ? '#39d98a' : 'rgba(255,255,255,0.15)';
                ctx.fillRect(x - (MAX_HP * 7) / 2 + i * 7, yPos - TANK_H - 10, 5, 5);
            }
        };

        drawTank(playerTankX, playerTankY, C.tankPlayer, C.tankPlayerDark, true, playerHP, angle);
        drawTank(opponentTankX, opponentTankY, C.tankBot, C.tankBotDark, false, opponentHP, isBot ? 55 : 45);

        // Projectile
        const proj = projectileRef.current;
        if (proj) {
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, PROJECTILE_R, 0, Math.PI * 2);
            ctx.fillStyle = C.projectile;
            ctx.fill();
            ctx.shadowColor = C.projectile;
            ctx.shadowBlur = 12;
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Explosion
        const exp = explosionRef.current;
        if (exp) {
            const elapsed = Date.now() - exp.startTime;
            const progress = Math.min(1, elapsed / EXPLOSION_DURATION);
            const radius = 8 + progress * 28;
            const alpha = 1 - progress;

            ctx.beginPath();
            ctx.arc(exp.x, exp.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,159,67,${alpha * 0.6})`;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(exp.x, exp.y, radius * 0.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,224,102,${alpha * 0.8})`;
            ctx.fill();
        }

        // HUD overlay
        ctx.fillStyle = C.textDim;
        ctx.font = '11px monospace';
        ctx.fillText(`Açı: ${angle}°  Güç: ${power}%`, 10, 20);

        // Draw Wind
        let windStr = 'Yok';
        if (wind < 0) windStr = '◄◄ ' + Math.abs(wind);
        if (wind > 0) windStr = '►► ' + Math.abs(wind);
        ctx.fillStyle = wind === 0 ? C.textDim : '#39d98a';
        ctx.fillText(`Rüzgar: ${windStr}`, 10, 36);

        ctx.fillStyle = C.textDim;
        ctx.fillText(isPlayerTurn ? '» Senin sıran' : `» ${target} ateş ediyor...`, 10, 52);
    }, [angle, isPlayerTurn, opponentHP, playerHP, power, target, isBot, playerTankX, playerTankY, opponentTankX, opponentTankY, wind]);

    // ------- Fire -------
    const fire = useCallback(() => {
        if (done || firing || resolvingMatch || !isPlayerTurn) return;
        setFiring(true);
        playGameSfx('hit', 0.3);

        const angleRad = angle * (Math.PI / 180);
        const speed = power * 0.08;
        const startX = playerTankX * CANVAS_W;
        const startY = playerTankY - TANK_H + 4;

        if (!isBot && gameId) {
            socketService.emitMove(String(gameId), { angle, power, wind });
        }

        projectileRef.current = {
            x: startX,
            y: startY,
            vx: Math.cos(angleRad) * speed,
            vy: -Math.sin(angleRad) * speed,
        };
    }, [angle, done, firing, isPlayerTurn, playerTankX, playerTankY, power, resolvingMatch, gameId, isBot, wind]);

    // ------- Projectile physics loop -------
    useEffect(() => {
        const terrain = terrainRef.current;
        let running = true;

        const tick = () => {
            if (!running) return;
            const proj = projectileRef.current;

            if (proj) {
                proj.vy += GRAVITY;

                // Apply wind effect (only affects X velocity slightly)
                proj.vx += (wind * 0.005);

                proj.x += proj.vx;
                proj.y += proj.vy;

                // Check terrain collision
                const xNorm = proj.x / CANVAS_W;
                if (xNorm >= 0 && xNorm <= 1) {
                    const groundY = terrainYAt(terrain, xNorm);
                    if (proj.y >= groundY) {
                        // Hit ground
                        const opX = opponentTankX * CANVAS_W;
                        const opY = opponentTankY;
                        // Sadece rakip isabetlerini değil, oyuncu kendini de vurabilir veya kimin sırasındaysa tersini kontrol et
                        const isPlayerShooting = isPlayerTurn;

                        const targetX = isPlayerShooting ? opponentTankX * CANVAS_W : playerTankX * CANVAS_W;
                        const targetY = isPlayerShooting ? opponentTankY : playerTankY;

                        const dist = Math.sqrt((proj.x - targetX) ** 2 + (proj.y - targetY) ** 2);

                        explosionRef.current = { x: proj.x, y: proj.y, startTime: Date.now() };
                        projectileRef.current = null;
                        playGameSfx(dist <= HIT_RADIUS ? 'success' : 'fail', 0.25);

                        if (dist <= HIT_RADIUS) {
                            // Hit!
                            if (isPlayerShooting) {
                                const newHP = Math.max(0, opponentHP - 1);
                                setOpponentHP(newHP);
                                setMessage('İsabet! Rakip tankı vurdun!');

                                if (newHP <= 0) {
                                    void syncLiveProgress(MAX_HP - playerHP + 1, MAX_HP - newHP, true);
                                    void finalizeMatch(currentUser.username, MAX_HP);
                                    return;
                                }
                            } else {
                                const newHP = Math.max(0, playerHP - 1);
                                setPlayerHP(newHP);
                                setMessage('Tankın vuruldu!');

                                if (newHP <= 0) {
                                    void syncLiveProgress(MAX_HP - newHP, MAX_HP - opponentHP + 1, true);
                                    void finalizeMatch(target, 0);
                                    return;
                                }
                            }
                        } else {
                            setMessage(isPlayerShooting ? 'Iskaladın! Rakibin sırası.' : 'Rakip ıskaladı! Senin sıran.');
                        }

                        // Switch turn after explosion
                        setTimeout(() => {
                            explosionRef.current = null;
                            setIsPlayerTurn(!isPlayerShooting);
                            setFiring(false);
                            generateWind();

                            // Bot fires back
                            if (isBot && isPlayerShooting) {
                                setTimeout(() => {
                                    botFire();
                                }, 800);
                            }
                        }, EXPLOSION_DURATION);
                        return;
                    }
                }

                // Went off screen
                if (proj.x < -50 || proj.x > CANVAS_W + 50 || proj.y > CANVAS_H + 50) {
                    const isPlayerShooting = isPlayerTurn;
                    projectileRef.current = null;
                    setMessage('Mermi alanın dışına çıktı. Sıra değişti.');
                    setIsPlayerTurn(!isPlayerShooting);
                    setFiring(false);
                    generateWind();

                    // Bot fires back
                    if (isBot && isPlayerShooting) {
                        setTimeout(() => {
                            botFire();
                        }, 800);
                    }
                    return;
                }
            }

            draw();
            animFrameRef.current = requestAnimationFrame(tick);
        };

        animFrameRef.current = requestAnimationFrame(tick);
        return () => {
            running = false;
            cancelAnimationFrame(animFrameRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draw, opponentHP, playerHP, isBot, wind]);

    // ------- Bot AI -------
    const botFire = useCallback(() => {
        if (done) return;
        setMessage(`${target} ateş ediyor...`);

        setTimeout(() => {
            playGameSfx('hit', 0.25);
            // Bot aims toward player with some randomness
            const dx = playerTankX * CANVAS_W - opponentTankX * CANVAS_W;
            const dy = playerTankY - opponentTankY;
            const baseAngle = Math.atan2(-dy, -dx) * (180 / Math.PI);
            const botAngle = Math.max(15, Math.min(80, baseAngle + (Math.random() * 20 - 10)));
            const botPower = 55 + Math.random() * 25;

            const angleRad = (180 - botAngle) * (Math.PI / 180);
            const speed = botPower * 0.08;
            const startX = opponentTankX * CANVAS_W;
            const startY = opponentTankY - TANK_H + 4;

            // Just launch the projectile — the main tick loop handles collision
            projectileRef.current = {
                x: startX,
                y: startY,
                vx: Math.cos(angleRad) * speed,
                vy: -Math.sin(angleRad) * speed,
            };
        }, 600);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [done, target, playerTankX, playerTankY, opponentTankX, opponentTankY]);

    // Init
    useEffect(() => {
        finishHandledRef.current = false;
        matchStartedAtRef.current = Date.now();
        setPlayerHP(MAX_HP);
        setOpponentHP(MAX_HP);
        setIsPlayerTurn(true);
        setFiring(false);
        setDone(false);
        setResolvingMatch(false);
        setAngle(45);
        setPower(60);
        setMessage('Açı ve güç ayarla, ateş et!');
        terrainRef.current = generateTerrain();
        draw();
    }, [gameId, draw]);

    // Multiplayer setup
    useEffect(() => {
        if (isBot || !gameId) return;
        void fetchSnapshot();
        const socket = socketService.getSocket();
        socketService.joinGame(String(gameId));
        const onRealtime = (payload: GameStateUpdatedPayload) => {
            if (String(payload?.gameId || '') !== String(gameId)) return;
            void fetchSnapshot(true);
        };
        socket.on('game_state_updated', onRealtime);
        pollRef.current = window.setInterval(() => {
            if (document.visibilityState === 'hidden' || done) return;
            void fetchSnapshot(true);
        }, 3000);
        return () => {
            socket.off('game_state_updated', onRealtime);
            if (pollRef.current) window.clearInterval(pollRef.current);
        };
    }, [done, fetchSnapshot, gameId, isBot]);

    return (
        <div
            className="max-w-3xl mx-auto rf-panel border-cyan-400/22 rounded-xl p-4 sm:p-6 text-white relative overflow-hidden"
            data-testid="tank-battle"
            style={{
                backgroundImage: `linear-gradient(165deg, rgba(4, 17, 41, 0.92), rgba(2, 28, 52, 0.9)), url('${GAME_ASSETS.backgrounds.tankBattle}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }}
        >
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_96%,rgba(34,211,238,0.08)_100%)] [background-size:100%_4px] opacity-50" />

            <div className="flex items-center justify-between mb-4">
                <h2 className="font-pixel text-lg">Tank Düellosu</h2>
                <button onClick={onLeave} className="text-[var(--rf-muted)] hover:text-white text-sm">Oyundan Çık</button>
            </div>

            {/* Scoreboard */}
            <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                <div className="bg-[#0a1732]/80 p-3 rounded border border-cyan-400/20">
                    <div className="text-xs text-[var(--rf-muted)] flex items-center justify-center gap-1">
                        <span className="text-cyan-300">⬥</span> Sen
                    </div>
                    <div className="font-bold flex items-center justify-center gap-1">
                        {Array.from({ length: MAX_HP }, (_, i) => (
                            <span key={i} className={i < playerHP ? 'text-emerald-400' : 'text-slate-600'}>♥</span>
                        ))}
                    </div>
                </div>
                <div className="bg-[#0a1732]/80 p-3 rounded border border-cyan-400/20">
                    <div className="text-xs text-[var(--rf-muted)]">VS</div>
                    <div className="font-pixel text-sm text-cyan-200">{isPlayerTurn ? 'SEN' : target.toUpperCase()}</div>
                </div>
                <div className="bg-[#0a1732]/80 p-3 rounded border border-cyan-400/20">
                    <div className="text-xs text-[var(--rf-muted)] flex items-center justify-center gap-1">
                        <span className="text-red-400">⬥</span> {target}
                    </div>
                    <div className="font-bold flex items-center justify-center gap-1">
                        {Array.from({ length: MAX_HP }, (_, i) => (
                            <span key={i} className={i < opponentHP ? 'text-red-400' : 'text-slate-600'}>♥</span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Canvas */}
            <div className="rounded-xl border border-cyan-400/25 overflow-hidden mb-4 bg-[#04112a]">
                <canvas
                    ref={canvasRef}
                    width={CANVAS_W}
                    height={CANVAS_H}
                    className="w-full h-auto block"
                    style={{ imageRendering: 'auto' }}
                />
            </div>

            <p className="text-sm text-[var(--rf-muted)] mb-4">{message}</p>

            {/* Controls */}
            {!done && (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-[#0a1732]/80 p-3 rounded border border-cyan-400/20">
                            <label htmlFor="tank-angle" className="text-xs text-[var(--rf-muted)] block mb-1">
                                Açı: {angle}°
                            </label>
                            <input
                                id="tank-angle"
                                type="range"
                                min={5}
                                max={85}
                                value={angle}
                                onChange={(e) => setAngle(Number(e.target.value))}
                                disabled={!isPlayerTurn || firing || resolvingMatch}
                                className="w-full accent-cyan-400 relative z-20 pointer-events-auto touch-auto"
                                style={{ minHeight: '30px' }}
                                data-testid="tank-angle-slider"
                            />
                        </div>
                        <div className="bg-[#0a1732]/80 p-3 rounded border border-cyan-400/20">
                            <label htmlFor="tank-power" className="text-xs text-[var(--rf-muted)] block mb-1">
                                Güç: {power}%
                            </label>
                            <input
                                id="tank-power"
                                type="range"
                                min={10}
                                max={100}
                                value={power}
                                onChange={(e) => setPower(Number(e.target.value))}
                                disabled={!isPlayerTurn || firing || resolvingMatch}
                                className="w-full accent-amber-400 relative z-20 pointer-events-auto touch-auto"
                                style={{ minHeight: '30px' }}
                                data-testid="tank-power-slider"
                            />
                        </div>
                    </div>

                    <RetroButton
                        onClick={fire}
                        disabled={!isPlayerTurn || firing || resolvingMatch || done}
                        data-testid="tank-fire-button"
                    >
                        🔥 ATEŞ ET
                    </RetroButton>
                </div>
            )}

            {done && (
                <div className="mt-4">
                    <RetroButton onClick={onLeave}>Lobiye Dön</RetroButton>
                </div>
            )}
        </div>
    );
};
