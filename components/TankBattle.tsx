import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User } from '../types';
import { RetroButton } from './RetroButton';
import { api } from '../lib/api';
import { submitScoreAndWaitForWinner } from '../lib/multiplayer';
import { GAME_ASSETS } from '../lib/gameAssets';
import { playGameSfx } from '../lib/gameAudio';
import { socketService } from '../lib/socket';
import { ConnectionOverlay } from './ConnectionOverlay';
import {
    CANVAS_H,
    CANVAS_W,
    MAX_HP,
    TANK_H,
    buildProjectile,
    clampWind,
    computeGameSeed,
    createTankPositions,
    deterministicWindForTurn,
    generateTerrain,
    getPlayerScoreFromOpponentHp,
    getTankBarrelStart,
    normalizeNameKey,
    parseFiniteNumber,
    resolveGroundImpact,
    resolveNextTurnState,
    terrainYAt,
} from '../lib/game-logic/tankBattle';

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

interface TankWindow extends Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => Promise<void> | void;
}

// ------- Game constants -------
const TANK_W = 48;
const BARREL_LEN = 32;
const PROJECTILE_R = 4;
const GRAVITY = 0.10;
const TERRAIN_SEGMENTS = 40;
const EXPLOSION_DURATION = 350;
const MIN_TANK_GAP = 0.4; // minimum normalised distance between tanks
const TURN_TIME = 20; // seconds per turn

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

export const TankBattle: React.FC<TankBattleProps> = ({
    currentUser,
    gameId,
    opponentName,
    isBot,
    onGameEnd,
    onLeave,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const canvasShakeRef = useRef({ x: 0, y: 0, intensity: 0 });
    const particlesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string }>>([]);
    const shockwavesRef = useRef<Array<{ x: number; y: number; radius: number; maxRadius: number; alpha: number; startTime: number }>>([]);
    const [angle, setAngle] = useState(45);
    const [power, setPower] = useState(60);
    const [playerHP, setPlayerHP] = useState(MAX_HP);
    const [opponentHP, setOpponentHP] = useState(MAX_HP);
    const [isPlayerTurn, setIsPlayerTurn] = useState(true);
    const [firing, setFiring] = useState(false);
    const [done, setDone] = useState(false);
    const [message, setMessage] = useState('Açı ve güç ayarla, ateş et!');
    const [resolvingMatch, setResolvingMatch] = useState(false);
    const [turnTimer, setTurnTimer] = useState(TURN_TIME);
    const [wind, setWind] = useState(0); // -2.5 to 2.5
    const playerHPRef = useRef(MAX_HP);
    const opponentHPRef = useRef(MAX_HP);
    const finalizingRef = useRef(false);

    // Compute seed FIRST so terrain + positions use it
    const gameSeed = useMemo(() => computeGameSeed(gameId), [gameId]);

    // Terrain + positions initialized FROM seed (both clients produce identical results)
    const terrainRef = useRef<number[]>(generateTerrain(gameSeed));
    const projectileRef = useRef<{ x: number; y: number; vx: number; vy: number; firedBy: 'player' | 'opponent' } | null>(null);
    const explosionRef = useRef<{ x: number; y: number; startTime: number } | null>(null);
    const animFrameRef = useRef<number>(0);
    const finishHandledRef = useRef(false);
    const matchStartedAtRef = useRef(Date.now());
    const pollRef = useRef<number | null>(null);
    const turnTimerRef = useRef<number | null>(null);
    const turnIndexRef = useRef(0);
    const isHostRef = useRef<boolean>(true);
    const hostNameRef = useRef('');
    const guestNameRef = useRef('');

    const target = useMemo(() => (isBot ? 'BOT' : (opponentName || 'Rakip')), [isBot, opponentName]);

    // Tank positions — deterministic from seed
    const [tankPositions, setTankPositions] = useState(() => createTankPositions(gameSeed));
    const playerTankX = tankPositions.px;
    const opponentTankX = tankPositions.ox;
    const playerTankY = terrainYAt(terrainRef.current, playerTankX);
    const opponentTankY = terrainYAt(terrainRef.current, opponentTankX);
    const getPlayerScore = useCallback(() => getPlayerScoreFromOpponentHp(opponentHPRef.current), []);

    useEffect(() => {
        playerHPRef.current = playerHP;
    }, [playerHP]);

    useEffect(() => {
        opponentHPRef.current = opponentHP;
    }, [opponentHP]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const tankWindow = window as TankWindow;
        const previousAdvanceTime = tankWindow.advanceTime;
        const renderGameToText = () =>
            JSON.stringify({
                mode: done ? 'finished' : 'playing',
                gameType: 'Tank Düellosu',
                turn: isPlayerTurn ? 'player' : 'opponent',
                player: {
                    name: currentUser.username,
                    hp: playerHPRef.current,
                    x: Number((playerTankX * CANVAS_W).toFixed(1)),
                    y: Number(playerTankY.toFixed(1)),
                    angle,
                    power,
                },
                opponent: {
                    name: target,
                    hp: opponentHPRef.current,
                    x: Number((opponentTankX * CANVAS_W).toFixed(1)),
                    y: Number(opponentTankY.toFixed(1)),
                },
                projectile: projectileRef.current
                    ? {
                        x: Number(projectileRef.current.x.toFixed(1)),
                        y: Number(projectileRef.current.y.toFixed(1)),
                        vx: Number(projectileRef.current.vx.toFixed(2)),
                        vy: Number(projectileRef.current.vy.toFixed(2)),
                        firedBy: projectileRef.current.firedBy,
                    }
                    : null,
                wind,
                turnTimer,
                message,
            });

        tankWindow.render_game_to_text = renderGameToText;
        tankWindow.advanceTime = (ms: number) => {
            if (typeof previousAdvanceTime === 'function') {
                return previousAdvanceTime(ms);
            }
            return new Promise<void>((resolve) => {
                window.setTimeout(resolve, Math.max(0, Math.floor(ms)));
            });
        };

        return () => {
            if (tankWindow.render_game_to_text === renderGameToText) {
                delete tankWindow.render_game_to_text;
            }
            if (previousAdvanceTime) {
                tankWindow.advanceTime = previousAdvanceTime;
            } else if (tankWindow.advanceTime) {
                delete tankWindow.advanceTime;
            }
        };
    }, [
        angle,
        currentUser.username,
        done,
        isPlayerTurn,
        message,
        opponentTankX,
        opponentTankY,
        playerTankX,
        playerTankY,
        target,
        turnTimer,
        power,
        wind,
    ]);

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
            const safeScore = Math.max(0, Math.floor(score));
            const safeRound = Math.max(0, Math.floor(currentRound));
            await api.games.move(gameId, {
                liveSubmission: {
                    mode: 'Tank Düellosu',
                    score: safeScore,
                    roundsWon: safeScore,
                    round: safeRound,
                    done: isDone,
                    submissionKey: `tank|${String(gameId)}|${currentUser.username}|${safeRound}|${safeScore}|${isDone ? 1 : 0}`,
                },
            });
        } catch (err) {
            console.error('TankBattle live submission failed', err);
        }
    }, [currentUser.username, gameId, isBot]);

    const finalizeMatch = useCallback(async (localWinner: string, playerScoreValue: number) => {
        if (finishHandledRef.current || finalizingRef.current) return;
        finalizingRef.current = true;
        if (isBot || !gameId) {
            const points = normalizeNameKey(localWinner) === normalizeNameKey(currentUser.username) ? 10 : 0;
            finishHandledRef.current = true;
            setDone(true);
            setMessage(points > 0 ? 'Tebrikler, kazandın!' : `${target} kazandı!`);
            setTimeout(() => onGameEnd(localWinner, points), 900);
            finalizingRef.current = false;
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
            const points = winner && normalizeNameKey(winner) === normalizeNameKey(currentUser.username) ? 10 : 0;
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
            finalizingRef.current = false;
        }
    }, [currentUser.username, gameId, isBot, onGameEnd, target]);

    const advanceTurnState = useCallback((explicitTurn?: unknown, explicitWind?: unknown) => {
        const { nextTurn, nextWind } = resolveNextTurnState({
            currentTurn: turnIndexRef.current,
            explicitTurn,
            explicitWind,
            isBot,
            gameSeed,
        });
        turnIndexRef.current = nextTurn;
        setWind(nextWind);

        return { nextTurn, nextWind };
    }, [gameSeed, isBot]);

    useEffect(() => {
        const socket = socketService.getSocket();
        const handleOpponentMove = (payload: any) => {
            if (String(payload?.gameId) !== String(gameId)) return;
            const moveData = payload?.move;
            if (!moveData) return;

            // 🔒 SECURITY: Validate opponent move structure
            if (moveData.action && typeof moveData.action !== 'string') return;
            if (typeof moveData.angle === 'number' && (moveData.angle < 0 || moveData.angle > 360)) return;
            if (typeof moveData.power === 'number' && (moveData.power < 0 || moveData.power > 200)) return;

            // Handle shot result from opponent (HP sync)
            if (moveData.action === 'shot_result') {
                // 🔒 CRITICAL FIX: Clear opponent projectile and explosion if still flying
                projectileRef.current = null;
                explosionRef.current = null;
                // 🔒 CRITICAL FIX: Clear turn timer to prevent timeout misfire
                if (turnTimerRef.current) {
                    window.clearInterval(turnTimerRef.current);
                    turnTimerRef.current = null;
                }

                if (moveData.hit && moveData.targetIsShooter === false) {
                    const nextPlayerHP = Math.max(0, playerHPRef.current - 1);
                    playerHPRef.current = nextPlayerHP;
                    setPlayerHP(nextPlayerHP);
                    setMessage(nextPlayerHP <= 0 ? 'Tankın yok edildi!' : 'Tankın vuruldu!');
                    playGameSfx('fail', 0.3);
                    if (nextPlayerHP <= 0) {
                        const playerScore = getPlayerScore();
                        void syncLiveProgress(playerScore, turnIndexRef.current + 1, true);
                        void finalizeMatch(target, playerScore);
                        return;
                    }
                } else {
                    setMessage('Rakip ıskaladı! Senin sıran.');
                }
                advanceTurnState(moveData.nextTurn, moveData.nextWind);
                setIsPlayerTurn(true);
                setFiring(false);
                return;
            }

            // Handle turn timeout from opponent
            if (moveData.action === 'turn_timeout') {
                // 🔒 CRITICAL FIX: Clear any lingering projectile and timer
                projectileRef.current = null;
                explosionRef.current = null;
                if (turnTimerRef.current) {
                    window.clearInterval(turnTimerRef.current);
                    turnTimerRef.current = null;
                }
                advanceTurnState(moveData.nextTurn, moveData.nextWind);
                setIsPlayerTurn(true);
                setFiring(false);
                setMessage('Rakibin süresi doldu! Senin sıran.');
                return;
            }

            // Handle game over from opponent
            if (moveData.action === 'game_over') {
                projectileRef.current = null;
                explosionRef.current = null;
                if (turnTimerRef.current) {
                    window.clearInterval(turnTimerRef.current);
                    turnTimerRef.current = null;
                }
                const winner = moveData.winner;
                void finalizeMatch(winner, getPlayerScore());
                return;
            }

            // Handle opponent leaving
            if (moveData.action === 'player_left') {
                setMessage('Rakip oyundan ayrıldı. Sonuç doğrulanıyor...');
                void fetchSnapshot(true);
                return;
            }

            // Handle fire from opponent (angle/power)
            if (typeof moveData.angle !== 'number' || typeof moveData.power !== 'number') return;

            const incomingTurn = parseFiniteNumber(moveData.turn);
            if (incomingTurn !== null) {
                turnIndexRef.current = Math.max(0, Math.floor(incomingTurn));
            }

            // 🔒 CRITICAL FIX: Clear any lingering projectile before opponent fires
            if (projectileRef.current !== null) {
                projectileRef.current = null;
                explosionRef.current = null;
            }

            // Opponent fired!
            const incomingWind = parseFiniteNumber(moveData.wind);
            if (incomingWind !== null) {
                setWind(clampWind(incomingWind));
            } else if (!isBot) {
                setWind(deterministicWindForTurn(gameSeed, turnIndexRef.current));
            }
            setIsPlayerTurn(false);
            setFiring(true);
            setMessage(`${target} ateş etti!`);
            playGameSfx('hit', 0.25);

            const start = getTankBarrelStart(opponentTankX, opponentTankY);
            projectileRef.current = buildProjectile({
                angle: moveData.angle,
                power: moveData.power,
                startX: start.x,
                startY: start.y,
                firedBy: 'opponent',
            });
        };

        socket.on('opponent_move', handleOpponentMove);
        return () => {
            socket.off('opponent_move', handleOpponentMove);
        };
    }, [advanceTurnState, fetchSnapshot, finalizeMatch, gameId, gameSeed, getPlayerScore, isBot, opponentTankX, opponentTankY, syncLiveProgress, target]);

    // ------- Particle System -------
    const spawnParticles = (x: number, y: number, count: number, color: string) => {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 3;
            particlesRef.current.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                maxLife: 20 + Math.random() * 20,
                color,
            });
        }
    };

    const spawnShockwave = (x: number, y: number) => {
        shockwavesRef.current.push({
            x,
            y,
            radius: 5,
            maxRadius: 60,
            alpha: 1,
            startTime: Date.now(),
        });
    };

    const triggerScreenshake = (intensity: number) => {
        canvasShakeRef.current.intensity = intensity;
    };

    // ------- Draw -------
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Apply screenshake
        const shake = canvasShakeRef.current;
        if (shake.intensity > 0.5) {
            shake.x = (Math.random() - 0.5) * shake.intensity;
            shake.y = (Math.random() - 0.5) * shake.intensity;
            shake.intensity *= 0.9;
        } else {
            shake.x = 0;
            shake.y = 0;
            shake.intensity = 0;
        }

        ctx.save();
        ctx.translate(shake.x, shake.y);

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

        // Shockwaves
        shockwavesRef.current = shockwavesRef.current.filter((sw) => {
            const elapsed = Date.now() - sw.startTime;
            const progress = Math.min(1, elapsed / 400);
            sw.radius = sw.maxRadius * progress;
            sw.alpha = 1 - progress;
            if (progress >= 1) return false;

            ctx.beginPath();
            ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 159, 67, ${sw.alpha * 0.8})`;
            ctx.lineWidth = 3;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(sw.x, sw.y, sw.radius * 0.6, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 224, 102, ${sw.alpha * 0.5})`;
            ctx.lineWidth = 2;
            ctx.stroke();
            return true;
        });

        // Particles
        particlesRef.current = particlesRef.current.filter((p) => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.15; // gravity
            p.life -= 1 / p.maxLife;
            if (p.life <= 0) return false;

            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2 * p.life, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            return true;
        });

        ctx.restore(); // End screenshake

        // HUD overlay (no shake)
        ctx.fillStyle = C.textDim;
        ctx.font = 'bold 12px "Chakra Petch", monospace';
        ctx.fillText(`AÇI: ${angle}°`, 10, 20);

        // Power bar
        const powerBarX = 70;
        const powerBarY = 12;
        const powerBarW = 80;
        const powerBarH = 8;
        const powerRatio = (power - 10) / 90;
        const powerColor = power < 35 ? '#f43f5e' : power < 70 ? '#f59e0b' : '#39d98a';
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(powerBarX, powerBarY, powerBarW, powerBarH);
        ctx.fillStyle = powerColor;
        ctx.shadowColor = powerColor;
        ctx.shadowBlur = 8;
        ctx.fillRect(powerBarX, powerBarY, powerBarW * powerRatio, powerBarH);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.font = '10px "Chakra Petch", monospace';
        ctx.fillText(`${power}%`, powerBarX + powerBarW + 6, powerBarY + 7);

        // Wind arrow
        ctx.font = 'bold 12px "Chakra Petch", monospace';
        ctx.fillStyle = wind === 0 ? C.textDim : '#39d98a';
        ctx.fillText('RÜZGAR:', 10, 40);
        const windArrowX = 70;
        const windArrowY = 35;
        if (wind !== 0) {
            const arrowDir = wind > 0 ? 1 : -1;
            const arrowLen = Math.min(40, Math.abs(wind) * 14);
            ctx.strokeStyle = '#39d98a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(windArrowX, windArrowY);
            ctx.lineTo(windArrowX + arrowLen * arrowDir, windArrowY);
            ctx.stroke();
            // Arrowhead
            ctx.beginPath();
            ctx.moveTo(windArrowX + arrowLen * arrowDir, windArrowY);
            ctx.lineTo(windArrowX + arrowLen * arrowDir - 6 * arrowDir, windArrowY - 4);
            ctx.lineTo(windArrowX + arrowLen * arrowDir - 6 * arrowDir, windArrowY + 4);
            ctx.closePath();
            ctx.fillStyle = '#39d98a';
            ctx.fill();
            ctx.fillStyle = '#39d98a';
            ctx.fillText(`${Math.abs(wind)}`, windArrowX + arrowLen * arrowDir + (arrowDir > 0 ? 4 : -20), windArrowY + 4);
        } else {
            ctx.fillStyle = C.textDim;
            ctx.fillText('Yok', windArrowX, windArrowY + 4);
        }

        // Turn indicator
        ctx.fillStyle = isPlayerTurn ? '#39d98a' : C.textDim;
        ctx.font = 'bold 11px "Chakra Petch", monospace';
        const turnText = isPlayerTurn ? '▲ SENİN SIRAN' : `▼ ${target.toUpperCase()} ATEŞ EDİYOR...`;
        ctx.fillText(turnText, 10, 58);
    }, [angle, isPlayerTurn, opponentHP, playerHP, power, target, isBot, playerTankX, playerTankY, opponentTankX, opponentTankY, wind]);

    // ------- Fire -------
    const fire = useCallback(() => {
        if (done || firing || resolvingMatch || !isPlayerTurn) return;
        // 🔒 CRITICAL FIX: Prevent firing while any projectile is still in flight
        if (projectileRef.current !== null) {
            setMessage('Mermi hâlâ havada! Bekle...');
            return;
        }
        setFiring(true);
        playGameSfx('hit', 0.3);

        if (!isBot && gameId) {
            socketService.emitMove(String(gameId), { angle, power, wind, turn: turnIndexRef.current });
        }

        const start = getTankBarrelStart(playerTankX, playerTankY);
        projectileRef.current = buildProjectile({
            angle,
            power,
            startX: start.x,
            startY: start.y,
            firedBy: 'player',
        });
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

                // 🔥 Particle trail every few frames
                if (Math.random() < 0.4) {
                    particlesRef.current.push({
                        x: proj.x,
                        y: proj.y,
                        vx: (Math.random() - 0.5) * 0.5,
                        vy: (Math.random() - 0.5) * 0.5,
                        life: 1,
                        maxLife: 10 + Math.random() * 10,
                        color: proj.firedBy === 'player' ? '#ffe066' : '#ff9f43',
                    });
                }

                // Check terrain collision
                const xNorm = proj.x / CANVAS_W;
                if (xNorm >= 0 && xNorm <= 1) {
                    const groundY = terrainYAt(terrain, xNorm);
                    if (proj.y >= groundY) {
                        const impact = resolveGroundImpact({
                            projectile: proj,
                            playerTankX,
                            playerTankY,
                            opponentTankX,
                            opponentTankY,
                            playerHp: playerHPRef.current,
                            opponentHp: opponentHPRef.current,
                        });

                        explosionRef.current = { x: proj.x, y: proj.y, startTime: Date.now() };
                        projectileRef.current = null;
                        playGameSfx(impact.isHit ? 'success' : 'fail', 0.25);

                        // 🔥 Visual effects on impact
                        spawnParticles(proj.x, proj.y, impact.isHit ? 25 : 12, impact.isHit ? '#ff5c7c' : '#ffe066');
                        spawnShockwave(proj.x, proj.y);
                        triggerScreenshake(impact.isHit ? 6 : 3);

                        if (impact.shooterIsPlayer) {
                            // Player fired — only player side handles damage + sync
                            if (impact.isHit) {
                                const newHP = impact.nextOpponentHp;
                                opponentHPRef.current = newHP;
                                setOpponentHP(newHP);
                                setMessage('İsabet! Rakip tankı vurdun!');
                                const score = MAX_HP - newHP;
                                void syncLiveProgress(score, turnIndexRef.current + 1, newHP <= 0);

                                if (newHP <= 0) {
                                    setDone(true);
                                    setMessage('Tebrikler, kazandın!');
                                    // Notify opponent game is over
                                    if (!isBot && gameId) {
                                        socketService.emitMove(String(gameId), { action: 'game_over', winner: currentUser.username });
                                    }
                                    void finalizeMatch(currentUser.username, score);
                                    return;
                                }
                            } else {
                                setMessage('Iskaladın! Rakibin sırası.');
                            }

                            const { nextTurn, nextWind } = advanceTurnState();
                            if (!isBot && gameId) {
                                socketService.emitMove(String(gameId), {
                                    action: 'shot_result',
                                    hit: impact.isHit,
                                    targetIsShooter: false,
                                    nextTurn,
                                    nextWind,
                                });
                            }

                            // Switch turn
                            setTimeout(() => {
                                explosionRef.current = null;
                                setIsPlayerTurn(false);
                                setFiring(false);
                                // Bot fires back
                                if (isBot) {
                                    setTimeout(() => botFire(), 800);
                                }
                            }, EXPLOSION_DURATION);
                        } else {
                            // Opponent fired — only show visual (HP sync comes via socket)
                            if (impact.isHit) {
                                setMessage('Tankın vuruldu!');
                            } else {
                                setMessage('Rakip ıskaladı! Senin sıran.');
                            }

                            setTimeout(() => {
                                explosionRef.current = null;
                                // Turn handoff will be handled by shot_result socket event
                                // For bot mode, switch here directly
                                if (isBot) {
                                    advanceTurnState();
                                    setIsPlayerTurn(true);
                                    setFiring(false);
                                }
                            }, EXPLOSION_DURATION);
                        }
                        return;
                    }
                }

                // Went off screen
                if (proj.x < -50 || proj.x > CANVAS_W + 50 || proj.y > CANVAS_H + 50) {
                    const shooterIsPlayer = proj.firedBy === 'player';
                    projectileRef.current = null;
                    spawnParticles(proj.x < 0 ? 0 : proj.x > CANVAS_W ? CANVAS_W : proj.x, proj.y > CANVAS_H ? CANVAS_H : proj.y, 6, '#91a8c9');

                    if (shooterIsPlayer) {
                        setMessage('Mermi alanın dışına çıktı. Sıra değişti.');
                        const { nextTurn, nextWind } = advanceTurnState();
                        if (!isBot && gameId) {
                            socketService.emitMove(String(gameId), {
                                action: 'shot_result',
                                hit: false,
                                targetIsShooter: false,
                                nextTurn,
                                nextWind,
                            });
                        }
                        setIsPlayerTurn(false);
                        setFiring(false);
                        if (isBot) {
                            setTimeout(() => botFire(), 800);
                        }
                    } else {
                        setMessage('Rakip ıskaladı! Senin sıran.');
                        if (isBot) {
                            advanceTurnState();
                            setIsPlayerTurn(true);
                            setFiring(false);
                        }
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
    }, [advanceTurnState, currentUser.username, draw, finalizeMatch, gameId, isBot, opponentHP, playerHP, syncLiveProgress, wind]);

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

            const start = getTankBarrelStart(opponentTankX, opponentTankY);
            projectileRef.current = buildProjectile({
                angle: botAngle,
                power: botPower,
                startX: start.x,
                startY: start.y,
                firedBy: 'opponent',
            });
        }, 600);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [done, target, playerTankX, playerTankY, opponentTankX, opponentTankY]);

    // Init
    useEffect(() => {
        finishHandledRef.current = false;
        matchStartedAtRef.current = Date.now();
        setPlayerHP(MAX_HP);
        setOpponentHP(MAX_HP);
        playerHPRef.current = MAX_HP;
        opponentHPRef.current = MAX_HP;
        setFiring(false);
        setDone(false);
        setResolvingMatch(false);
        finalizingRef.current = false;
        setAngle(45);
        setPower(60);
        // Regenerate terrain and tank positions using gameId seed for sync
        const seed = gameSeed || 1;
        terrainRef.current = generateTerrain(seed);
        setTankPositions(createTankPositions(seed));
        turnIndexRef.current = 0;
        setWind(isBot ? clampWind(Math.random() * 5 - 2.5) : deterministicWindForTurn(seed, 0));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameId, gameSeed, isBot]);

    // Multiplayer setup — determine host/guest role
    useEffect(() => {
        if (isBot || !gameId) {
            isHostRef.current = true;
            setIsPlayerTurn(true);
            setMessage('Açı ve güç ayarla, ateş et!');
            return;
        }
        void (async () => {
            try {
                const snapshot = await api.games.get(gameId) as GameSnapshot;
                applySnapshot(snapshot);
                const hostName = snapshot.hostName || '';
                isHostRef.current = normalizeNameKey(hostName) === normalizeNameKey(currentUser.username);
                // Host goes first
                setIsPlayerTurn(isHostRef.current);
                setMessage(isHostRef.current ? 'Sen başlıyorsun! Açı ve güç ayarla.' : 'Rakip başlıyor, sıranı bekle...');
            } catch {
                isHostRef.current = true;
                setIsPlayerTurn(true);
                setMessage('Açı ve güç ayarla, ateş et!');
            }
        })();

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
        }, 15000);
        return () => {
            socket.off('game_state_updated', onRealtime);
            if (pollRef.current) window.clearInterval(pollRef.current);
        };
    }, [done, fetchSnapshot, gameId, isBot]);

    // ------- Turn Timer (20s) -------
    useEffect(() => {
        if (done || firing || resolvingMatch) return;
        if (!isBot && !isPlayerTurn) {
            setTurnTimer(TURN_TIME);
            return;
        }

        setTurnTimer(TURN_TIME);
        turnTimerRef.current = window.setInterval(() => {
            setTurnTimer(prev => {
                if (prev <= 1) {
                    if (turnTimerRef.current) window.clearInterval(turnTimerRef.current);

                    if (isBot) {
                        const timedOutPlayerTurn = isPlayerTurn;
                        if (timedOutPlayerTurn) {
                            setMessage('Süre doldu! Sıra rakipte.');
                            advanceTurnState();
                            setIsPlayerTurn(false);
                            setTimeout(() => botFire(), 600);
                        } else {
                            setMessage('Rakibin süresi doldu! Senin sıran.');
                            advanceTurnState();
                            setIsPlayerTurn(true);
                        }
                        return TURN_TIME;
                    }

                    // Multiplayer: only active local player emits timeout handoff
                    const { nextTurn, nextWind } = advanceTurnState();
                    setMessage('Süre doldu! Sıra rakipte.');
                    setIsPlayerTurn(false);
                    if (gameId) {
                        socketService.emitMove(String(gameId), {
                            action: 'turn_timeout',
                            nextTurn,
                            nextWind,
                        });
                    }
                    return TURN_TIME;
                }
                return prev - 1;
            });
        }, 1000);
        return () => {
            if (turnTimerRef.current) window.clearInterval(turnTimerRef.current);
        };
    }, [advanceTurnState, botFire, done, firing, gameId, isBot, isPlayerTurn, resolvingMatch]);

    // ------- Leave = Forfeit -------
    const handleLeave = useCallback(() => {
        if (!done && !finishHandledRef.current) {
            setDone(true);
            setMessage('Oyundan ayrılıyorsun. Sonuç kaydediliyor...');
            const finalizeLeave = async () => {
                if (isBot || !gameId) {
                    finishHandledRef.current = true;
                    onGameEnd(target, 0);
                    return;
                }
                try {
                    await api.games.resign(gameId);
                } catch (err) {
                    console.error('TankBattle resign failed, falling back to live sync', err);
                    await syncLiveProgress(0, turnIndexRef.current + 1, true);
                } finally {
                    finishHandledRef.current = true;
                    onGameEnd(target, 0);
                }
            };
            if (!isBot && gameId) {
                socketService.emitMove(String(gameId), { action: 'player_left' });
            }
            void finalizeLeave();
        } else {
            onLeave();
        }
    }, [done, gameId, isBot, onGameEnd, onLeave, syncLiveProgress, target]);

    return (
        <>
            <ConnectionOverlay gameId={gameId} />
            <div
                className="max-w-3xl mx-auto rf-screen-card noise-bg p-4 sm:p-6 text-white relative overflow-hidden"
                data-testid="tank-battle"
                style={{
                backgroundImage: `linear-gradient(165deg, rgba(4, 17, 41, 0.92), rgba(2, 28, 52, 0.9)), url('${GAME_ASSETS.backgrounds.tankBattle}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }}
        >
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_95%,rgba(34,211,238,0.09)_100%)] [background-size:100%_4px] opacity-60 z-0" />

            <div className="relative z-10">
                <div className="rf-terminal-strip mb-2">Sistem TR-X // Zırhlı Çatışma</div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-2xl sm:text-3xl uppercase tracking-[0.08em] leading-none">
                        Tank Düellosu
                    </h2>
                    <div className="flex items-center gap-3">
                        {!done && (
                            <span className={`font-pixel text-sm px-2 py-1 border ${turnTimer <= 5 ? 'text-red-300 border-red-400/40 animate-pulse' : 'text-cyan-300 border-cyan-400/35'}`}>
                                ⏱ {turnTimer}s
                            </span>
                        )}
                        <button
                            onClick={handleLeave}
                            className="text-rose-200 hover:text-rose-100 text-xs px-3 py-2 border border-rose-400/45 bg-rose-500/12 hover:bg-rose-500/24 transition-colors uppercase tracking-[0.16em]"
                        >
                            Oyundan Çık
                        </button>
                    </div>
                </div>

                {/* Scoreboard */}
                <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                    <div className="rf-screen-card-muted p-3">
                        <div className="text-xs text-[var(--rf-muted)] flex items-center justify-center gap-1">
                            <span className="text-cyan-300">⬥</span> Sen
                        </div>
                        <div className="font-bold flex items-center justify-center gap-1">
                            {Array.from({ length: MAX_HP }, (_, i) => (
                                <span key={i} className={i < playerHP ? 'text-emerald-400' : 'text-cyan-900/80'}>♥</span>
                            ))}
                        </div>
                    </div>
                    <div className="rf-screen-card-muted p-3">
                        <div className="text-xs text-[var(--rf-muted)]">VS</div>
                        <div className="font-pixel text-sm text-cyan-200">{isPlayerTurn ? 'SEN' : target.toUpperCase()}</div>
                    </div>
                    <div className="rf-screen-card-muted p-3">
                        <div className="text-xs text-[var(--rf-muted)] flex items-center justify-center gap-1">
                            <span className="text-red-400">⬥</span> {target}
                        </div>
                        <div className="font-bold flex items-center justify-center gap-1">
                            {Array.from({ length: MAX_HP }, (_, i) => (
                                <span key={i} className={i < opponentHP ? 'text-red-400' : 'text-cyan-900/80'}>♥</span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Canvas */}
                <div className="rf-screen-card-muted p-2 mb-4">
                    <canvas
                        ref={canvasRef}
                        width={CANVAS_W}
                        height={CANVAS_H}
                        className="w-full h-auto block border border-cyan-400/20 bg-[#04112a]"
                        style={{ imageRendering: 'auto' }}
                    />
                </div>

                <p className="text-sm text-[var(--rf-muted)] mb-4 pl-3 border-l-2 border-cyan-400/55">{message}</p>

                {/* Controls */}
                {!done && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rf-screen-card-muted p-3">
                                <label htmlFor="tank-angle" className="text-xs text-[var(--rf-muted)] block mb-1 uppercase tracking-[0.12em]">
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
                            <div className="rf-screen-card-muted p-3">
                                <label htmlFor="tank-power" className="text-xs text-[var(--rf-muted)] block mb-1 uppercase tracking-[0.12em]">
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
        </div>
        </>
    );
};
