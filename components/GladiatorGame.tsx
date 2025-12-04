import React, { useState, useEffect, useRef } from 'react';
import { RetroButton } from './RetroButton';
import { User } from '../types';
import { Sword, Shield, Heart, Zap, Skull, Trophy, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';

interface GladiatorGameProps {
    currentUser: User;
    gameId: number | null;
    opponentName?: string;
    isBot: boolean;
    onGameEnd: (winner: string, points: number) => void;
    onLeave: () => void;
    onMinimize?: () => void;
}

interface FighterStats {
    hp: number;
    maxHp: number;
    energy: number;
    maxEnergy: number;
    shield: number;
}

type ActionType = 'light' | 'heavy' | 'defend' | 'rest';

export const GladiatorGame: React.FC<GladiatorGameProps> = ({ currentUser, gameId, opponentName, isBot, onGameEnd, onLeave, onMinimize }) => {
    const [player, setPlayer] = useState<FighterStats>({ hp: 100, maxHp: 100, energy: 100, maxEnergy: 100, shield: 0 });
    const [opponent, setOpponent] = useState<FighterStats>({ hp: 100, maxHp: 100, energy: 100, maxEnergy: 100, shield: 0 });
    const [turn, setTurn] = useState<'player' | 'opponent'>('player');
    const [logs, setLogs] = useState<string[]>(['Savaş başladı!']);
    const [gameOver, setGameOver] = useState(false);
    const [winner, setWinner] = useState<string | null>(null);
    const [animating, setAnimating] = useState(false);
    const [waitingForOpponent, setWaitingForOpponent] = useState(!isBot);

    const [timeLeft, setTimeLeft] = useState(15);
    const logsContainerRef = useRef<HTMLDivElement>(null);

    // Polling for Game State
    useEffect(() => {
        if (!gameId || isBot) {
            setWaitingForOpponent(false);
            return;
        }

        const pollGame = async () => {
            try {
                const game = await api.games.get(gameId);

                // Check if opponent joined
                if (waitingForOpponent && game.guestName) {
                    setWaitingForOpponent(false);
                }

                // Sync Game State
                if (game.gameState && !animating) {
                    const state = game.gameState;
                    // Determine who is who
                    const isHost = currentUser.username === game.hostName;

                    // If it's my turn in DB but local says opponent, update
                    // Or just sync everything
                    // Ideally we sync HP, Energy, Turn

                    // Simple sync:
                    if (isHost) {
                        // I am player 1
                        // If state says turn is player 2 (opponent), update local
                        if (state.turn === 'player2' && turn === 'player') setTurn('opponent');
                        if (state.turn === 'player1' && turn === 'opponent') setTurn('player');

                        // Sync opponent stats (player 2)
                        if (JSON.stringify(opponent) !== JSON.stringify(state.player2)) setOpponent(state.player2);
                        // Sync my stats (player 1) - only if I didn't just move? 
                        // Actually, let's trust server state if it changes
                        if (JSON.stringify(player) !== JSON.stringify(state.player1)) setPlayer(state.player1);

                    } else {
                        // I am player 2 (Guest)
                        if (state.turn === 'player1' && turn === 'player') setTurn('opponent');
                        if (state.turn === 'player2' && turn === 'opponent') setTurn('player');

                        if (JSON.stringify(opponent) !== JSON.stringify(state.player1)) setOpponent(state.player1);
                        if (JSON.stringify(player) !== JSON.stringify(state.player2)) setPlayer(state.player2);
                    }

                    // Sync logs?
                    if (state.lastLog && !logs.includes(state.lastLog)) {
                        addLog(state.lastLog);
                    }
                }

            } catch (err) {
                console.error("Polling error", err);
            }
        };

        const interval = setInterval(pollGame, 2000);
        return () => clearInterval(interval);
    }, [gameId, isBot, waitingForOpponent, turn, player, opponent]);


    // Timer Logic
    useEffect(() => {
        if (turn === 'player' && !gameOver && !animating && !waitingForOpponent) {
            setTimeLeft(15);
            const timer = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        handlePlayerAction('rest'); // Auto-rest on timeout
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [turn, gameOver, animating, waitingForOpponent]);

    // Auto-scroll logs (Fix layout shift)
    useEffect(() => {
        if (logsContainerRef.current) {
            logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
        }
    }, [logs]);

    // Bot Turn
    useEffect(() => {
        if (isBot && turn === 'opponent' && !gameOver) {
            const timer = setTimeout(() => {
                playOpponentTurn();
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [turn, gameOver, isBot]);

    const addLog = (message: string) => {
        setLogs(prev => [...prev, message]);
    };

    const playOpponentTurn = () => {
        // Simple AI
        let action: ActionType = 'light';

        if (opponent.hp < 30 && opponent.energy >= 30) {
            action = 'rest'; // Heal if low HP
        } else if (opponent.energy >= 60) {
            action = Math.random() > 0.5 ? 'heavy' : 'light';
        } else if (opponent.energy < 20) {
            action = 'rest'; // Recover energy
        } else {
            action = Math.random() > 0.7 ? 'defend' : 'light';
        }

        executeMove('opponent', action);
    };

    const handlePlayerAction = (action: ActionType) => {
        if (turn !== 'player' || gameOver || animating) return;
        executeMove('player', action);
    };

    const executeMove = async (attacker: 'player' | 'opponent', action: ActionType) => {
        setAnimating(true);
        const isPlayer = attacker === 'player';
        const currentStats = isPlayer ? player : opponent;
        const targetStats = isPlayer ? opponent : player;
        const setAttacker = isPlayer ? setPlayer : setOpponent;
        const setTarget = isPlayer ? setOpponent : setPlayer;
        const attackerName = isPlayer ? 'SEN' : (opponentName || 'BOT');

        let newAttacker = { ...currentStats };
        let newTarget = { ...targetStats };
        let logMsg = '';

        // Reset shield at start of turn
        newAttacker.shield = 0;

        switch (action) {
            case 'light':
                if (newAttacker.energy < 20) {
                    logMsg = `${attackerName} yorgun! Saldıramadı.`;
                    break;
                }
                newAttacker.energy -= 20;
                const dmgL = Math.max(0, 15 - newTarget.shield);
                newTarget.hp = Math.max(0, newTarget.hp - dmgL);
                logMsg = `${attackerName} Hızlı Saldırı yaptı! ${dmgL} hasar.`;
                break;

            case 'heavy':
                if (newAttacker.energy < 50) {
                    logMsg = `${attackerName} çok yorgun! Ağır saldırı yapamadı.`;
                    break;
                }
                newAttacker.energy -= 50;
                const dmgH = Math.max(0, 35 - newTarget.shield);
                newTarget.hp = Math.max(0, newTarget.hp - dmgH);
                logMsg = `${attackerName} AĞIR SALDIRI yaptı! ${dmgH} hasar.`;
                break;

            case 'defend':
                newAttacker.energy = Math.min(newAttacker.maxEnergy, newAttacker.energy + 10);
                newAttacker.shield = 15;
                logMsg = `${attackerName} savunmaya geçti. Kalkan kazandı.`;
                break;

            case 'rest':
                newAttacker.energy = Math.min(newAttacker.maxEnergy, newAttacker.energy + 40);
                newAttacker.hp = Math.min(newAttacker.maxHp, newAttacker.hp + 10);
                logMsg = `${attackerName} dinlendi. Can ve Enerji yeniledi.`;
                break;
        }

        setAttacker(newAttacker);
        setTarget(newTarget);
        addLog(logMsg);

        // Sync with Server if not Bot
        if (!isBot && gameId) {
            const isHost = !opponentName; // Rough check, better to use prop
            // Construct state
            const newState = {
                player1: isHost ? newAttacker : newTarget,
                player2: isHost ? newTarget : newAttacker,
                turn: isHost ? 'player2' : 'player1',
                lastLog: logMsg
            };
            await api.games.move(gameId, { gameState: newState });
        }

        setTimeout(() => {
            setAnimating(false);
            checkWinCondition(newTarget, isPlayer);
        }, 500);
    };

    const checkWinCondition = (targetStats: FighterStats, isPlayerAttacker: boolean) => {
        if (targetStats.hp <= 0) {
            setGameOver(true);
            const winnerName = isPlayerAttacker ? currentUser.username : (opponentName || 'BOT');
            setWinner(winnerName);

            if (isPlayerAttacker) {
                setTimeout(() => onGameEnd(currentUser.username, isBot ? 0 : 150), 2000);
            } else {
                setTimeout(() => onGameEnd('opponent', 0), 2000);
            }
        } else {
            setTurn(isPlayerAttacker ? 'opponent' : 'player');
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[600px] bg-[#1a0b0b] border-4 border-[#4a1c1c] rounded-xl p-4 relative overflow-hidden font-pixel">

            {/* Background */}
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-brick-wall.png')] opacity-20"></div>

            {waitingForOpponent ? (
                <div className="relative z-20 text-center">
                    <div className="animate-spin mb-4 inline-block">
                        <AlertCircle size={48} className="text-red-500" />
                    </div>
                    <h2 className="font-pixel text-2xl text-white mb-2">RAKİP BEKLENİYOR...</h2>
                    <p className="text-gray-400 mb-6">Arenaya bir savaşçı aranıyor.</p>

                    <button
                        onClick={async () => {
                            if (gameId) await api.games.delete(gameId);
                            onLeave();
                        }}
                        className="bg-red-900/50 hover:bg-red-800 text-red-200 px-4 py-2 rounded border border-red-800 transition-colors text-sm"
                    >
                        İPTAL ET & ÇIK
                    </button>
                </div>
            ) : (
                <>
                    {/* Header */}
                    <div className="relative z-10 w-full flex justify-between items-center bg-black/50 p-4 rounded-lg border border-[#4a1c1c] mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-900 rounded border-2 border-blue-500 flex items-center justify-center">
                                <Shield size={24} className="text-blue-300" />
                            </div>
                            <div>
                                <div className="text-blue-300">SEN</div>
                                <div className="text-xs text-gray-400">GLADYATÖR</div>
                            </div>
                        </div>

                        {/* Timer Display */}
                        <div className="flex flex-col items-center">
                            <div className="text-2xl text-[#d4af37] drop-shadow-md mb-1">VS</div>
                            {turn === 'player' && !gameOver && (
                                <div className={`text-xl font-bold ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                                    {timeLeft}s
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-4 text-right">
                            <div>
                                <div className="text-red-300">{opponentName || 'ARENA BOTU'}</div>
                                <div className="text-xs text-gray-400">{isBot ? 'YAPAY ZEKA' : 'RAKİP'}</div>
                            </div>
                            <div className="w-12 h-12 bg-red-900 rounded border-2 border-red-500 flex items-center justify-center">
                                <Skull size={24} className="text-red-300" />
                            </div>
                        </div>
                    </div>


                    {/* Top Actions */}
                    <div className="absolute top-4 right-4 flex gap-2 z-30">
                        {onMinimize && (
                            <button
                                onClick={onMinimize}
                                className="bg-gray-900/80 hover:bg-gray-800 text-white p-2 rounded border border-gray-600"
                                title="Panele Dön (Oyun Devam Eder)"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" /><path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" /></svg>
                            </button>
                        )}
                    </div>

                    {/* Arena */}
                    <div className="relative z-10 w-full max-w-4xl grid grid-cols-2 gap-12 mb-8">

                        {/* Player Stats */}
                        <div className="bg-black/40 p-6 rounded-xl border border-blue-900/50 relative">
                            {turn === 'player' && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs px-3 py-1 rounded-full animate-bounce">SENİN SIRAN</div>}

                            <div className="mb-4">
                                <div className="flex justify-between text-sm mb-1 text-red-400"><span>CAN</span> <span>{player.hp}/{player.maxHp}</span></div>
                                <div className="w-full h-4 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                                    <div className="h-full bg-red-600 transition-all duration-500" style={{ width: `${(player.hp / player.maxHp) * 100}%` }}></div>
                                </div>
                            </div>
                            <div className="mb-4">
                                <div className="flex justify-between text-sm mb-1 text-yellow-400"><span>ENERJİ</span> <span>{player.energy}/{player.maxEnergy}</span></div>
                                <div className="w-full h-4 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                                    <div className="h-full bg-yellow-600 transition-all duration-500" style={{ width: `${(player.energy / player.maxEnergy) * 100}%` }}></div>
                                </div>
                            </div>
                            {player.shield > 0 && (
                                <div className="flex items-center gap-2 text-blue-400 text-sm">
                                    <Shield size={16} /> <span>Kalkan: {player.shield}</span>
                                </div>
                            )}

                            {/* Avatar Placeholder */}
                            <div className="mt-6 flex justify-center">
                                <div className={`w-32 h-32 bg-blue-900/20 rounded-full border-4 border-blue-500/50 flex items-center justify-center transition-transform duration-300 ${turn === 'player' ? 'scale-110 shadow-[0_0_20px_rgba(59,130,246,0.5)]' : 'opacity-70'}`}>
                                    <Sword size={48} className="text-blue-400" />
                                </div>
                            </div>
                        </div>

                        {/* Opponent Stats */}
                        <div className="bg-black/40 p-6 rounded-xl border border-red-900/50 relative">
                            {turn === 'opponent' && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs px-3 py-1 rounded-full animate-bounce">RAKİP SIRASI</div>}

                            <div className="mb-4">
                                <div className="flex justify-between text-sm mb-1 text-red-400"><span>CAN</span> <span>{opponent.hp}/{opponent.maxHp}</span></div>
                                <div className="w-full h-4 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                                    <div className="h-full bg-red-600 transition-all duration-500" style={{ width: `${(opponent.hp / opponent.maxHp) * 100}%` }}></div>
                                </div>
                            </div>
                            <div className="mb-4">
                                <div className="flex justify-between text-sm mb-1 text-yellow-400"><span>ENERJİ</span> <span>{opponent.energy}/{opponent.maxEnergy}</span></div>
                                <div className="w-full h-4 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                                    <div className="h-full bg-yellow-600 transition-all duration-500" style={{ width: `${(opponent.energy / opponent.maxEnergy) * 100}%` }}></div>
                                </div>
                            </div>
                            {opponent.shield > 0 && (
                                <div className="flex items-center gap-2 text-blue-400 text-sm">
                                    <Shield size={16} /> <span>Kalkan: {opponent.shield}</span>
                                </div>
                            )}

                            {/* Avatar Placeholder */}
                            <div className="mt-6 flex justify-center">
                                <div className={`w-32 h-32 bg-red-900/20 rounded-full border-4 border-red-500/50 flex items-center justify-center transition-transform duration-300 ${turn === 'opponent' ? 'scale-110 shadow-[0_0_20px_rgba(239,68,68,0.5)]' : 'opacity-70'}`}>
                                    <Skull size={48} className="text-red-400" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Controls */}
                    {!gameOver ? (
                        <div className="relative z-10 grid grid-cols-4 gap-4 w-full max-w-2xl">
                            <button
                                onClick={() => handlePlayerAction('light')}
                                disabled={turn !== 'player' || player.energy < 20}
                                className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-gray-600 p-4 rounded-lg flex flex-col items-center gap-2 transition-all hover:-translate-y-1"
                            >
                                <Sword size={24} className="text-white" />
                                <span className="text-xs text-gray-300">HIZLI SALDIRI</span>
                                <span className="text-[10px] text-yellow-500">-20 ENERJİ</span>
                            </button>

                            <button
                                onClick={() => handlePlayerAction('heavy')}
                                disabled={turn !== 'player' || player.energy < 50}
                                className="bg-gray-800 hover:bg-red-900 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-red-800 p-4 rounded-lg flex flex-col items-center gap-2 transition-all hover:-translate-y-1"
                            >
                                <Zap size={24} className="text-red-400" />
                                <span className="text-xs text-gray-300">AĞIR SALDIRI</span>
                                <span className="text-[10px] text-yellow-500">-50 ENERJİ</span>
                            </button>

                            <button
                                onClick={() => handlePlayerAction('defend')}
                                disabled={turn !== 'player'}
                                className="bg-gray-800 hover:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-blue-800 p-4 rounded-lg flex flex-col items-center gap-2 transition-all hover:-translate-y-1"
                            >
                                <Shield size={24} className="text-blue-400" />
                                <span className="text-xs text-gray-300">SAVUNMA</span>
                                <span className="text-[10px] text-green-500">+10 ENERJİ</span>
                            </button>

                            <button
                                onClick={() => handlePlayerAction('rest')}
                                disabled={turn !== 'player'}
                                className="bg-gray-800 hover:bg-green-900 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-green-800 p-4 rounded-lg flex flex-col items-center gap-2 transition-all hover:-translate-y-1"
                            >
                                <RefreshCw size={24} className="text-green-400" />
                                <span className="text-xs text-gray-300">DİNLEN</span>
                                <span className="text-[10px] text-green-500">HP & ENERJİ</span>
                            </button>
                        </div>
                    ) : (
                        <div className="relative z-20 text-center animate-fade-in-up">
                            <h2 className="text-4xl text-yellow-500 mb-4 drop-shadow-lg">{winner === currentUser.username ? 'ZAFER!' : 'MAĞLUBİYET'}</h2>
                            <p className="text-gray-400 mb-6">{winner === currentUser.username ? 'Arenanın şampiyonu sensin!' : 'Daha çok çalışmalısın.'}</p>
                            <RetroButton onClick={onLeave} variant="primary">LOBİYE DÖN</RetroButton>
                        </div>
                    )}
                </>
            )}

            {/* Battle Log */}
            <div ref={logsContainerRef} className="relative z-10 w-full max-w-2xl mt-8 h-32 bg-black/60 border border-gray-800 rounded-lg p-4 overflow-y-auto font-mono text-xs">
                {logs.map((log, i) => (
                    <div key={i} className="mb-1 text-gray-300 border-b border-gray-800/50 pb-1 last:border-0">
                        <span className="text-gray-500">[{i + 1}]</span> {log}
                    </div>
                ))}
            </div>

        </div>
    );
};
