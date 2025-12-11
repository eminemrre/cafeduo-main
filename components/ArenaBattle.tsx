import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { api } from '../lib/api';
import { Sword, Shield, Heart, Zap, Trophy, AlertCircle, RefreshCw, X } from 'lucide-react';

interface ArenaBattleProps {
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
    defending: boolean;
}

type ActionType = 'quick' | 'heavy' | 'defend' | 'rest';

// Sprite animation frames
const SOLDIER_SPRITES = {
    idle: '/sprites/soldier/Soldier-Idle.png',
    attack1: '/sprites/soldier/Soldier-Attack01.png',
    attack2: '/sprites/soldier/Soldier-Attack02.png',
    hurt: '/sprites/soldier/Soldier-Hurt.png',
    death: '/sprites/soldier/Soldier-Death.png',
};

const ORC_SPRITES = {
    idle: '/sprites/orc/Orc-Idle.png',
    attack1: '/sprites/orc/Orc-Attack01.png',
    attack2: '/sprites/orc/Orc-Attack02.png',
    hurt: '/sprites/orc/Orc-Hurt.png',
    death: '/sprites/orc/Orc-Death.png',
};

export const ArenaBattle: React.FC<ArenaBattleProps> = ({
    currentUser,
    gameId,
    opponentName,
    isBot,
    onGameEnd,
    onLeave,
    onMinimize
}) => {
    // Game State
    const [player, setPlayer] = useState<FighterStats>({
        hp: 100, maxHp: 100, energy: 100, maxEnergy: 100, defending: false
    });
    const [opponent, setOpponent] = useState<FighterStats>({
        hp: 100, maxHp: 100, energy: 100, maxEnergy: 100, defending: false
    });
    const [turn, setTurn] = useState<'player' | 'opponent'>('player');
    const [gameOver, setGameOver] = useState(false);
    const [winner, setWinner] = useState<string | null>(null);
    const [waitingForOpponent, setWaitingForOpponent] = useState(!isBot && !!gameId);

    // Animation State
    const [playerSprite, setPlayerSprite] = useState(SOLDIER_SPRITES.idle);
    const [opponentSprite, setOpponentSprite] = useState(ORC_SPRITES.idle);
    const [animating, setAnimating] = useState(false);
    const [battleLog, setBattleLog] = useState<string[]>(['⚔️ Arenaya hoş geldin!']);

    // Timer
    const [timeLeft, setTimeLeft] = useState(15);
    const pollRef = useRef<NodeJS.Timeout | null>(null);

    // Polling for multiplayer sync
    useEffect(() => {
        if (isBot || !gameId) {
            setWaitingForOpponent(false);
            return;
        }

        const pollGame = async () => {
            try {
                const game = await api.games.get(gameId);

                // Check if opponent joined
                if (waitingForOpponent && game.guestName) {
                    setWaitingForOpponent(false);
                    addLog(`🎮 ${game.guestName} arenaya girdi!`);
                }

                // Sync game state (only when not animating)
                if (game.gameState && !animating && !waitingForOpponent) {
                    const state = game.gameState;
                    const isHost = currentUser.username === game.hostName;

                    // Update stats
                    if (isHost) {
                        if (state.player1) setPlayer(state.player1);
                        if (state.player2) setOpponent(state.player2);
                        if (state.turn === 'player2' && turn === 'player') setTurn('opponent');
                        if (state.turn === 'player1' && turn === 'opponent') setTurn('player');
                    } else {
                        if (state.player1) setOpponent(state.player1);
                        if (state.player2) setPlayer(state.player2);
                        if (state.turn === 'player1' && turn === 'player') setTurn('opponent');
                        if (state.turn === 'player2' && turn === 'opponent') setTurn('player');
                    }

                    // Check for game over
                    if (state.winner && !gameOver) {
                        setGameOver(true);
                        setWinner(state.winner);
                    }
                }
            } catch (err) {
                console.error('Poll error:', err);
            }
        };

        pollRef.current = setInterval(pollGame, 1500);
        pollGame(); // Immediate first check

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [gameId, isBot, waitingForOpponent, animating, turn, gameOver]);

    // Turn Timer
    useEffect(() => {
        if (turn !== 'player' || gameOver || animating || waitingForOpponent) return;

        setTimeLeft(15);
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleAction('rest'); // Auto-rest on timeout
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [turn, gameOver, animating, waitingForOpponent]);

    // Bot AI
    useEffect(() => {
        if (!isBot || turn !== 'opponent' || gameOver || animating) return;

        const timer = setTimeout(() => {
            // Simple AI logic
            let action: ActionType = 'quick';
            if (opponent.hp < 30 && opponent.energy >= 30) {
                action = 'rest';
            } else if (opponent.energy >= 40) {
                action = Math.random() > 0.6 ? 'heavy' : 'quick';
            } else if (opponent.energy < 20) {
                action = 'rest';
            } else {
                action = Math.random() > 0.7 ? 'defend' : 'quick';
            }
            executeAction('opponent', action);
        }, 1200);

        return () => clearTimeout(timer);
    }, [turn, gameOver, isBot, animating]);

    const addLog = (msg: string) => {
        setBattleLog(prev => [...prev.slice(-4), msg]);
    };

    const handleAction = (action: ActionType) => {
        if (turn !== 'player' || gameOver || animating) return;
        executeAction('player', action);
    };

    const executeAction = async (attacker: 'player' | 'opponent', action: ActionType) => {
        setAnimating(true);
        const isPlayerAttacking = attacker === 'player';
        const attackerStats = isPlayerAttacking ? player : opponent;
        const targetStats = isPlayerAttacking ? opponent : player;
        const setAttacker = isPlayerAttacking ? setPlayer : setOpponent;
        const setTarget = isPlayerAttacking ? setOpponent : setPlayer;
        const attackerName = isPlayerAttacking ? 'SEN' : (opponentName || 'ORC');

        // Set attack sprite
        if (isPlayerAttacking) {
            setPlayerSprite(action === 'heavy' ? SOLDIER_SPRITES.attack2 : SOLDIER_SPRITES.attack1);
        } else {
            setOpponentSprite(action === 'heavy' ? ORC_SPRITES.attack2 : ORC_SPRITES.attack1);
        }

        let newAttacker = { ...attackerStats, defending: false };
        let newTarget = { ...targetStats };
        let logMsg = '';
        let damage = 0;

        switch (action) {
            case 'quick':
                if (newAttacker.energy < 15) {
                    logMsg = `${attackerName} çok yorgun!`;
                } else {
                    newAttacker.energy -= 15;
                    damage = newTarget.defending ? 5 : 15;
                    newTarget.hp = Math.max(0, newTarget.hp - damage);
                    logMsg = `${attackerName} hızlı saldırdı! ${damage} hasar`;
                    // Show hurt sprite
                    if (isPlayerAttacking) setOpponentSprite(ORC_SPRITES.hurt);
                    else setPlayerSprite(SOLDIER_SPRITES.hurt);
                }
                break;

            case 'heavy':
                if (newAttacker.energy < 35) {
                    logMsg = `${attackerName} ağır saldırı için enerjisi yok!`;
                } else {
                    newAttacker.energy -= 35;
                    damage = newTarget.defending ? 10 : 30;
                    newTarget.hp = Math.max(0, newTarget.hp - damage);
                    logMsg = `${attackerName} AĞIR SALDIRI! ${damage} hasar`;
                    if (isPlayerAttacking) setOpponentSprite(ORC_SPRITES.hurt);
                    else setPlayerSprite(SOLDIER_SPRITES.hurt);
                }
                break;

            case 'defend':
                newAttacker.defending = true;
                newAttacker.energy = Math.min(newAttacker.maxEnergy, newAttacker.energy + 10);
                logMsg = `${attackerName} savunmaya geçti 🛡️`;
                break;

            case 'rest':
                newAttacker.energy = Math.min(newAttacker.maxEnergy, newAttacker.energy + 25);
                newAttacker.hp = Math.min(newAttacker.maxHp, newAttacker.hp + 5);
                logMsg = `${attackerName} dinleniyor 💤`;
                break;
        }

        addLog(logMsg);
        setAttacker(newAttacker);
        setTarget(newTarget);

        // Sync to server if multiplayer
        if (!isBot && gameId && isPlayerAttacking) {
            const isHost = !opponentName;
            const newState = {
                player1: isHost ? newAttacker : newTarget,
                player2: isHost ? newTarget : newAttacker,
                turn: isHost ? 'player2' : 'player1',
                lastAction: action
            };
            await api.games.move(gameId, { gameState: newState });
        }

        // Check win condition
        setTimeout(() => {
            // Reset sprites to idle
            setPlayerSprite(SOLDIER_SPRITES.idle);
            setOpponentSprite(ORC_SPRITES.idle);

            if (newTarget.hp <= 0) {
                const winnerName = isPlayerAttacking ? currentUser.username : (opponentName || 'BOT');
                setGameOver(true);
                setWinner(winnerName);

                // Show death animation
                if (isPlayerAttacking) {
                    setOpponentSprite(ORC_SPRITES.death);
                } else {
                    setPlayerSprite(SOLDIER_SPRITES.death);
                }

                // Finish game on server
                if (!isBot && gameId) {
                    api.games.finish(gameId, winnerName);
                }

                // Call onGameEnd
                setTimeout(() => {
                    const points = isBot ? 0 : 10;
                    onGameEnd(winnerName, isPlayerAttacking ? points : 0);
                }, 2000);
            } else {
                setTurn(isPlayerAttacking ? 'opponent' : 'player');
            }

            setAnimating(false);
        }, 600);
    };

    const handleCancel = async () => {
        if (gameId) {
            await api.games.delete(gameId);
        }
        onLeave();
    };

    // Render waiting screen
    if (waitingForOpponent) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px] bg-gradient-to-b from-gray-900 to-gray-800 rounded-xl p-8">
                <div className="animate-pulse mb-6">
                    <Sword size={64} className="text-yellow-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">RAKİP BEKLENİYOR...</h2>
                <p className="text-gray-400 mb-8">Arena'ya bir savaşçı aranıyor</p>
                <button
                    onClick={handleCancel}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-lg transition-colors"
                >
                    <X size={20} /> İPTAL ET
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center min-h-[600px] bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 rounded-xl p-4 relative overflow-hidden">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10 bg-[url('/sprites/dungeon-bg.png')] bg-repeat"></div>

            {/* Header */}
            <div className="relative z-10 w-full flex justify-between items-center bg-black/50 p-3 rounded-lg border border-yellow-900/50 mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-900/50 rounded-full flex items-center justify-center border-2 border-blue-500">
                        <span className="text-lg">⚔️</span>
                    </div>
                    <div>
                        <div className="text-blue-300 font-bold text-sm">SEN</div>
                        <div className="text-xs text-gray-500">SOLDIER</div>
                    </div>
                </div>

                {/* Timer */}
                {turn === 'player' && !gameOver && (
                    <div className={`text-2xl font-bold ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                        {timeLeft}s
                    </div>
                )}

                <div className="flex items-center gap-3 text-right">
                    <div>
                        <div className="text-red-300 font-bold text-sm">{opponentName || 'ORC'}</div>
                        <div className="text-xs text-gray-500">{isBot ? 'BOT' : 'OYUNCU'}</div>
                    </div>
                    <div className="w-10 h-10 bg-red-900/50 rounded-full flex items-center justify-center border-2 border-red-500">
                        <span className="text-lg">👹</span>
                    </div>
                </div>
            </div>

            {/* Minimize button */}
            {onMinimize && (
                <button
                    onClick={onMinimize}
                    className="absolute top-4 right-4 z-20 bg-gray-800 hover:bg-gray-700 p-2 rounded border border-gray-600"
                    title="Küçült"
                >
                    <RefreshCw size={18} className="text-white" />
                </button>
            )}

            {/* Arena - Characters */}
            <div className="relative z-10 w-full flex justify-between items-end px-8 py-8 min-h-[280px]">
                {/* Player (Soldier) */}
                <div className="flex flex-col items-center">
                    <div className={`relative ${turn === 'player' ? 'scale-110' : 'opacity-80'} transition-transform`}>
                        <img
                            src={playerSprite}
                            alt="Soldier"
                            className="w-32 h-32 object-contain pixelated"
                            style={{ imageRendering: 'pixelated' }}
                        />
                        {turn === 'player' && !gameOver && (
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs px-2 py-1 rounded animate-bounce">
                                SENİN SIRAN
                            </div>
                        )}
                    </div>
                    {/* HP Bar */}
                    <div className="w-32 mt-2">
                        <div className="flex justify-between text-xs text-red-400 mb-1">
                            <span>HP</span>
                            <span>{player.hp}/{player.maxHp}</span>
                        </div>
                        <div className="h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                            <div
                                className="h-full bg-gradient-to-r from-red-600 to-red-500 transition-all duration-300"
                                style={{ width: `${(player.hp / player.maxHp) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                    {/* Energy Bar */}
                    <div className="w-32 mt-1">
                        <div className="flex justify-between text-xs text-yellow-400 mb-1">
                            <span>ENERJİ</span>
                            <span>{player.energy}/{player.maxEnergy}</span>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                            <div
                                className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 transition-all duration-300"
                                style={{ width: `${(player.energy / player.maxEnergy) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                </div>

                {/* VS */}
                <div className="text-yellow-500 text-4xl font-bold animate-pulse">VS</div>

                {/* Opponent (Orc) */}
                <div className="flex flex-col items-center">
                    <div className={`relative ${turn === 'opponent' ? 'scale-110' : 'opacity-80'} transition-transform`}>
                        <img
                            src={opponentSprite}
                            alt="Orc"
                            className="w-32 h-32 object-contain pixelated transform -scale-x-100"
                            style={{ imageRendering: 'pixelated' }}
                        />
                        {turn === 'opponent' && !gameOver && (
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs px-2 py-1 rounded animate-bounce">
                                RAKİP SIRASI
                            </div>
                        )}
                    </div>
                    {/* HP Bar */}
                    <div className="w-32 mt-2">
                        <div className="flex justify-between text-xs text-red-400 mb-1">
                            <span>HP</span>
                            <span>{opponent.hp}/{opponent.maxHp}</span>
                        </div>
                        <div className="h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                            <div
                                className="h-full bg-gradient-to-r from-red-600 to-red-500 transition-all duration-300"
                                style={{ width: `${(opponent.hp / opponent.maxHp) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                    {/* Energy Bar */}
                    <div className="w-32 mt-1">
                        <div className="flex justify-between text-xs text-yellow-400 mb-1">
                            <span>ENERJİ</span>
                            <span>{opponent.energy}/{opponent.maxEnergy}</span>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                            <div
                                className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 transition-all duration-300"
                                style={{ width: `${(opponent.energy / opponent.maxEnergy) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Battle Log */}
            <div className="relative z-10 w-full max-w-lg bg-black/60 border border-gray-700 rounded-lg p-3 mb-4 h-20 overflow-y-auto">
                {battleLog.map((log, i) => (
                    <div key={i} className="text-sm text-gray-300">
                        {log}
                    </div>
                ))}
            </div>

            {/* Action Buttons */}
            {!gameOver ? (
                <div className="relative z-10 grid grid-cols-4 gap-3 w-full max-w-lg">
                    <button
                        onClick={() => handleAction('quick')}
                        disabled={turn !== 'player' || player.energy < 15 || animating}
                        className="flex flex-col items-center gap-1 bg-gray-800 hover:bg-orange-900 disabled:opacity-40 disabled:cursor-not-allowed border-2 border-orange-600 p-3 rounded-lg transition-all"
                    >
                        <Sword size={24} className="text-orange-400" />
                        <span className="text-xs text-white">HIZLI</span>
                        <span className="text-[10px] text-yellow-500">-15 EP</span>
                    </button>

                    <button
                        onClick={() => handleAction('heavy')}
                        disabled={turn !== 'player' || player.energy < 35 || animating}
                        className="flex flex-col items-center gap-1 bg-gray-800 hover:bg-red-900 disabled:opacity-40 disabled:cursor-not-allowed border-2 border-red-600 p-3 rounded-lg transition-all"
                    >
                        <Zap size={24} className="text-red-400" />
                        <span className="text-xs text-white">AĞIR</span>
                        <span className="text-[10px] text-yellow-500">-35 EP</span>
                    </button>

                    <button
                        onClick={() => handleAction('defend')}
                        disabled={turn !== 'player' || animating}
                        className="flex flex-col items-center gap-1 bg-gray-800 hover:bg-blue-900 disabled:opacity-40 disabled:cursor-not-allowed border-2 border-blue-600 p-3 rounded-lg transition-all"
                    >
                        <Shield size={24} className="text-blue-400" />
                        <span className="text-xs text-white">SAVUN</span>
                        <span className="text-[10px] text-green-500">+10 EP</span>
                    </button>

                    <button
                        onClick={() => handleAction('rest')}
                        disabled={turn !== 'player' || animating}
                        className="flex flex-col items-center gap-1 bg-gray-800 hover:bg-green-900 disabled:opacity-40 disabled:cursor-not-allowed border-2 border-green-600 p-3 rounded-lg transition-all"
                    >
                        <Heart size={24} className="text-green-400" />
                        <span className="text-xs text-white">DİNLEN</span>
                        <span className="text-[10px] text-green-500">+25 EP</span>
                    </button>
                </div>
            ) : (
                <div className="relative z-20 text-center animate-fade-in-up">
                    <Trophy size={64} className={`mx-auto mb-4 ${winner === currentUser.username ? 'text-yellow-500' : 'text-gray-500'}`} />
                    <h2 className={`text-3xl font-bold mb-2 ${winner === currentUser.username ? 'text-yellow-400' : 'text-red-400'}`}>
                        {winner === currentUser.username ? '🎉 ZAFER!' : '💀 YENİLDİN'}
                    </h2>
                    <p className="text-gray-400 mb-6">
                        {winner === currentUser.username
                            ? (isBot ? 'Bot kazanılmadığı için puan yok!' : '+10 puan kazandın!')
                            : 'Bir dahaki sefere!'}
                    </p>
                    <button
                        onClick={onLeave}
                        className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold px-8 py-3 rounded-lg transition-colors"
                    >
                        LOBİYE DÖN
                    </button>
                </div>
            )}

            {/* Bot warning */}
            {isBot && !gameOver && (
                <div className="relative z-10 mt-4 text-center text-xs text-gray-500 bg-black/40 px-4 py-2 rounded">
                    <AlertCircle size={14} className="inline mr-1" />
                    Bot ile oynanan oyunlardan puan kazanılmaz
                </div>
            )}
        </div>
    );
};
