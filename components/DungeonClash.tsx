import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import { api } from '../lib/api';
import { Sword, Shield, Zap, Trophy, AlertCircle, X, Heart, RefreshCw } from 'lucide-react';

interface DungeonClashProps {
    currentUser: User;
    gameId: number | null;
    opponentName?: string;
    isBot: boolean;
    onGameEnd: (winner: string, points: number) => void;
    onLeave: () => void;
    onMinimize?: () => void;
}

// Card types for the clash game
type CardType = 'attack' | 'defend' | 'magic';

interface Card {
    type: CardType;
    power: number;
    name: string;
    emoji: string;
}

const CARDS: Record<CardType, Card> = {
    attack: { type: 'attack', power: 20, name: 'SALDIRI', emoji: '⚔️' },
    defend: { type: 'defend', power: 15, name: 'SAVUNMA', emoji: '🛡️' },
    magic: { type: 'magic', power: 25, name: 'BÜYÜ', emoji: '✨' },
};

// Game logic: attack > magic > defend > attack (like RPS)
const getWinner = (p1: CardType, p2: CardType): 'p1' | 'p2' | 'draw' => {
    if (p1 === p2) return 'draw';
    if (
        (p1 === 'attack' && p2 === 'magic') ||
        (p1 === 'magic' && p2 === 'defend') ||
        (p1 === 'defend' && p2 === 'attack')
    ) {
        return 'p1';
    }
    return 'p2';
};

export const DungeonClash: React.FC<DungeonClashProps> = ({
    currentUser,
    gameId,
    opponentName,
    isBot,
    onGameEnd,
    onLeave,
    onMinimize
}) => {
    const [playerHP, setPlayerHP] = useState(100);
    const [opponentHP, setOpponentHP] = useState(100);
    const [playerCard, setPlayerCard] = useState<CardType | null>(null);
    const [opponentCard, setOpponentCard] = useState<CardType | null>(null);
    const [round, setRound] = useState(1);
    const [phase, setPhase] = useState<'select' | 'reveal' | 'result'>('select');
    const [roundWinner, setRoundWinner] = useState<string | null>(null);
    const [gameOver, setGameOver] = useState(false);
    const [winner, setWinner] = useState<string | null>(null);
    const [waitingForOpponent, setWaitingForOpponent] = useState(!isBot && !!gameId);
    const [waitingForCard, setWaitingForCard] = useState(false);
    const [battleLog, setBattleLog] = useState<string[]>(['🏰 Zindan Kapıları Açıldı!']);

    const pollRef = useRef<NodeJS.Timeout | null>(null);

    // Multiplayer polling
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
                    addLog(`⚔️ ${game.guestName} savaşa katıldı!`);
                }

                // Check for opponent's card
                if (waitingForCard && game.gameState) {
                    const isHost = currentUser.username === game.hostName;
                    const oppCardField = isHost ? 'player2Card' : 'player1Card';

                    if (game.gameState[oppCardField]) {
                        setOpponentCard(game.gameState[oppCardField]);
                        setWaitingForCard(false);
                        resolveRound(playerCard!, game.gameState[oppCardField]);
                    }
                }
            } catch (err) {
                console.error('Poll error:', err);
            }
        };

        pollRef.current = setInterval(pollGame, 1500);
        pollGame();

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [gameId, isBot, waitingForOpponent, waitingForCard, playerCard]);

    const addLog = (msg: string) => {
        setBattleLog(prev => [...prev.slice(-3), msg]);
    };

    const handleCardSelect = async (card: CardType) => {
        if (phase !== 'select' || gameOver) return;

        setPlayerCard(card);

        if (isBot) {
            // Bot picks random card
            const cards: CardType[] = ['attack', 'defend', 'magic'];
            const botCard = cards[Math.floor(Math.random() * 3)];
            setOpponentCard(botCard);

            setTimeout(() => {
                resolveRound(card, botCard);
            }, 800);
        } else if (gameId) {
            // Send to server and wait for opponent
            const isHost = !opponentName;
            const newState = {
                player1Card: isHost ? card : null,
                player2Card: isHost ? null : card,
                round
            };
            await api.games.move(gameId, { gameState: newState });
            setWaitingForCard(true);
        }
    };

    const resolveRound = (pCard: CardType, oCard: CardType) => {
        setPhase('reveal');

        const result = getWinner(pCard, oCard);
        let newPlayerHP = playerHP;
        let newOpponentHP = opponentHP;
        let logMsg = '';

        if (result === 'p1') {
            const damage = CARDS[pCard].power;
            newOpponentHP = Math.max(0, opponentHP - damage);
            setOpponentHP(newOpponentHP);
            logMsg = `${CARDS[pCard].emoji} ${CARDS[pCard].name} kazandı! -${damage} HP`;
            setRoundWinner('player');
        } else if (result === 'p2') {
            const damage = CARDS[oCard].power;
            newPlayerHP = Math.max(0, playerHP - damage);
            setPlayerHP(newPlayerHP);
            logMsg = `💀 Rakip ${CARDS[oCard].name} ile kazandı! -${damage} HP`;
            setRoundWinner('opponent');
        } else {
            logMsg = '⚡ Berabere! İki taraf da aynı kartı seçti.';
            setRoundWinner(null);
        }

        addLog(`Tur ${round}: ${logMsg}`);

        // Check game over
        setTimeout(() => {
            if (newPlayerHP <= 0 || newOpponentHP <= 0) {
                setGameOver(true);
                const winnerName = newOpponentHP <= 0 ? currentUser.username : (opponentName || 'BOT');
                setWinner(winnerName);

                if (!isBot && gameId) {
                    api.games.finish(gameId, winnerName);
                }

                setTimeout(() => {
                    const points = isBot ? 0 : 10;
                    onGameEnd(winnerName, newOpponentHP <= 0 ? points : 0);
                }, 2000);
            } else {
                // Next round
                setTimeout(() => {
                    setPlayerCard(null);
                    setOpponentCard(null);
                    setRound(r => r + 1);
                    setPhase('select');
                    setRoundWinner(null);
                }, 1500);
            }
        }, 1000);
    };

    const handleCancel = async () => {
        if (gameId) {
            await api.games.delete(gameId);
        }
        onLeave();
    };

    // Waiting screen
    if (waitingForOpponent) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px] bg-gradient-to-b from-purple-900 to-gray-900 rounded-xl p-8">
                <div className="animate-pulse mb-6">
                    <Shield size={64} className="text-purple-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">RAKİP BEKLENİYOR...</h2>
                <p className="text-gray-400 mb-8">Zindana bir savaşçı aranıyor</p>
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
        <div className="flex flex-col items-center min-h-[600px] bg-gradient-to-b from-purple-900 via-gray-800 to-gray-900 rounded-xl p-4 relative overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 opacity-20 bg-[url('/sprites/dungeon-bg.png')] bg-repeat"></div>

            {/* Header */}
            <div className="relative z-10 w-full flex justify-between items-center bg-black/50 p-3 rounded-lg border border-purple-900/50 mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600/50 rounded-full flex items-center justify-center border-2 border-blue-400">
                        🧙
                    </div>
                    <div>
                        <div className="text-blue-300 font-bold text-sm">SEN</div>
                        <div className="text-xs text-gray-500">HP: {playerHP}/100</div>
                    </div>
                </div>

                <div className="text-center">
                    <div className="text-purple-400 text-sm">TUR</div>
                    <div className="text-white text-2xl font-bold">{round}</div>
                </div>

                <div className="flex items-center gap-3 text-right">
                    <div>
                        <div className="text-red-300 font-bold text-sm">{opponentName || 'CANAVAR'}</div>
                        <div className="text-xs text-gray-500">HP: {opponentHP}/100</div>
                    </div>
                    <div className="w-10 h-10 bg-red-600/50 rounded-full flex items-center justify-center border-2 border-red-400">
                        👹
                    </div>
                </div>
            </div>

            {/* Minimize button */}
            {onMinimize && (
                <button
                    onClick={onMinimize}
                    className="absolute top-4 right-4 z-20 bg-gray-800 hover:bg-gray-700 p-2 rounded border border-gray-600"
                >
                    <RefreshCw size={18} className="text-white" />
                </button>
            )}

            {/* HP Bars */}
            <div className="relative z-10 w-full max-w-md grid grid-cols-2 gap-8 mb-6">
                <div>
                    <div className="h-4 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                        <div
                            className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-500"
                            style={{ width: `${playerHP}%` }}
                        ></div>
                    </div>
                </div>
                <div>
                    <div className="h-4 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                        <div
                            className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-500"
                            style={{ width: `${opponentHP}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* Card Display Area */}
            <div className="relative z-10 flex justify-center items-center gap-12 mb-6 min-h-[160px]">
                {/* Player Card */}
                <div className={`w-28 h-36 rounded-xl border-4 ${playerCard ? 'border-blue-500 bg-blue-900/50' : 'border-gray-600 bg-gray-800/50'} flex items-center justify-center transition-all transform ${phase === 'reveal' && roundWinner === 'player' ? 'scale-110' : ''}`}>
                    {playerCard ? (
                        <div className="text-center">
                            <div className="text-4xl mb-2">{CARDS[playerCard].emoji}</div>
                            <div className="text-xs text-white font-bold">{CARDS[playerCard].name}</div>
                        </div>
                    ) : (
                        <div className="text-gray-500 text-4xl">?</div>
                    )}
                </div>

                {/* VS */}
                <div className="text-purple-400 text-2xl font-bold">⚔️</div>

                {/* Opponent Card */}
                <div className={`w-28 h-36 rounded-xl border-4 ${opponentCard ? 'border-red-500 bg-red-900/50' : 'border-gray-600 bg-gray-800/50'} flex items-center justify-center transition-all transform ${phase === 'reveal' && roundWinner === 'opponent' ? 'scale-110' : ''}`}>
                    {phase === 'reveal' && opponentCard ? (
                        <div className="text-center">
                            <div className="text-4xl mb-2">{CARDS[opponentCard].emoji}</div>
                            <div className="text-xs text-white font-bold">{CARDS[opponentCard].name}</div>
                        </div>
                    ) : (
                        <div className="text-gray-500 text-4xl">?</div>
                    )}
                </div>
            </div>

            {/* Battle Log */}
            <div className="relative z-10 w-full max-w-md bg-black/60 border border-purple-800 rounded-lg p-3 mb-4 h-16 overflow-y-auto">
                {battleLog.map((log, i) => (
                    <div key={i} className="text-sm text-gray-300">{log}</div>
                ))}
            </div>

            {/* Card Selection */}
            {!gameOver ? (
                phase === 'select' && !waitingForCard ? (
                    <div className="relative z-10 flex gap-4">
                        {(['attack', 'defend', 'magic'] as CardType[]).map((type) => (
                            <button
                                key={type}
                                onClick={() => handleCardSelect(type)}
                                className={`w-24 h-32 rounded-xl border-4 border-purple-600 bg-purple-900/50 hover:bg-purple-800 hover:scale-105 transition-all flex flex-col items-center justify-center gap-2`}
                            >
                                <div className="text-3xl">{CARDS[type].emoji}</div>
                                <div className="text-xs text-white font-bold">{CARDS[type].name}</div>
                                <div className="text-[10px] text-purple-300">{CARDS[type].power} güç</div>
                            </button>
                        ))}
                    </div>
                ) : waitingForCard ? (
                    <div className="relative z-10 text-center text-purple-300 animate-pulse">
                        <div className="text-lg mb-2">⏳ Rakip seçiyor...</div>
                    </div>
                ) : null
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
                        className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-8 py-3 rounded-lg transition-colors"
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
