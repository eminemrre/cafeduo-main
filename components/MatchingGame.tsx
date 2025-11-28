import React, { useState, useEffect, useRef } from 'react';
import { RetroButton } from './RetroButton';
import { User } from '../types';
import { AlertCircle, Bot, Square, Triangle, Circle, Star, Heart, Zap, User as UserIcon, Trophy } from 'lucide-react';

interface MatchingGameProps {
    currentUser: User;
    onGameEnd: (winner: string, points: number) => void;
    onLeave: () => void;
    isBot?: boolean;
    opponentName?: string;
}

interface Card {
    id: number;
    shape: string;
    pairId: number;
    isFlipped: boolean;
    isMatched: boolean;
}

const SHAPES = [
    { shape: 'square', pairId: 1, icon: Square, color: 'text-red-500' },
    { shape: 'triangle', pairId: 2, icon: Triangle, color: 'text-blue-500' },
    { shape: 'circle', pairId: 3, icon: Circle, color: 'text-green-500' },
    { shape: 'star', pairId: 4, icon: Star, color: 'text-yellow-500' },
    { shape: 'heart', pairId: 5, icon: Heart, color: 'text-pink-500' },
    { shape: 'zap', pairId: 6, icon: Zap, color: 'text-purple-500' },
];

export const MatchingGame: React.FC<MatchingGameProps> = ({ currentUser, onGameEnd, onLeave, isBot: initialIsBot = false, opponentName }) => {
    const [cards, setCards] = useState<Card[]>([]);
    const [flippedCards, setFlippedCards] = useState<number[]>([]);
    const [scores, setScores] = useState({ player: 0, opponent: 0 });
    const [turn, setTurn] = useState<'player' | 'opponent'>('player');
    const [isProcessing, setIsProcessing] = useState(false);
    const [gameOver, setGameOver] = useState(false);

    // Lobby State
    const [waitingForOpponent, setWaitingForOpponent] = useState(!opponentName);
    const [isBotMode, setIsBotMode] = useState(initialIsBot);

    // Refs for safe state access in timeouts
    const turnRef = useRef(turn);
    const gameOverRef = useRef(gameOver);
    const isProcessingRef = useRef(isProcessing);

    useEffect(() => {
        turnRef.current = turn;
    }, [turn]);

    useEffect(() => {
        gameOverRef.current = gameOver;
    }, [gameOver]);

    useEffect(() => {
        isProcessingRef.current = isProcessing;
    }, [isProcessing]);

    useEffect(() => {
        if (opponentName) {
            setWaitingForOpponent(false);
            setIsBotMode(false);
            initializeGame();
        }
    }, [opponentName]);

    const startBotGame = () => {
        setIsBotMode(true);
        setWaitingForOpponent(false);
        initializeGame();
    };

    const initializeGame = () => {
        const shuffled = [...SHAPES, ...SHAPES]
            .sort(() => Math.random() - 0.5)
            .map((item, index) => ({
                id: index,
                shape: item.shape,
                pairId: item.pairId,
                isFlipped: false,
                isMatched: false
            }));
        setCards(shuffled);
        setScores({ player: 0, opponent: 0 });
        setTurn('player');
        setFlippedCards([]);
        setIsProcessing(false);
        setGameOver(false);
    };

    // Opponent AI Turn
    useEffect(() => {
        if (!waitingForOpponent && isBotMode && turn === 'opponent' && !gameOver && !isProcessing) {
            const timer = setTimeout(() => {
                playOpponentTurn();
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [turn, gameOver, isProcessing, waitingForOpponent, isBotMode]);

    const handleCardClick = (id: number) => {
        if (waitingForOpponent || turn !== 'player' || isProcessing || cards[id].isFlipped || cards[id].isMatched) return;
        flipCard(id);
    };

    const flipCard = (id: number) => {
        const newCards = [...cards];
        newCards[id].isFlipped = true;
        setCards(newCards);

        const newFlipped = [...flippedCards, id];
        setFlippedCards(newFlipped);

        if (newFlipped.length === 2) {
            setIsProcessing(true);
            checkForMatch(newFlipped);
        }
    };

    const checkForMatch = (flipped: number[]) => {
        const [first, second] = flipped;
        // Check bounds to be safe
        if (!cards[first] || !cards[second]) return;

        const isMatch = cards[first].pairId === cards[second].pairId;

        setTimeout(() => {
            setCards(prevCards => {
                const newCards = [...prevCards];

                if (isMatch) {
                    newCards[first].isMatched = true;
                    newCards[second].isMatched = true;

                    // Update Score
                    setScores(prev => {
                        const newScores = { ...prev };
                        if (turnRef.current === 'player') newScores.player += 1;
                        else newScores.opponent += 1;
                        return newScores;
                    });
                } else {
                    newCards[first].isFlipped = false;
                    newCards[second].isFlipped = false;
                    // Switch turn only on miss
                    setTurn(prev => prev === 'player' ? 'opponent' : 'player');
                }

                // Check Game Over
                if (newCards.every(c => c.isMatched)) {
                    setGameOver(true);
                }

                return newCards;
            });

            setFlippedCards([]);
            setIsProcessing(false);
        }, 1000);
    };

    const playOpponentTurn = () => {
        if (turnRef.current !== 'opponent' || gameOverRef.current) return;

        // Simple AI: Pick random available cards
        const availableCards = cards
            .filter(c => !c.isMatched && !c.isFlipped)
            .map(c => c.id);

        if (availableCards.length < 2) return;

        setIsProcessing(true);

        // Pick first card
        const firstIdx = Math.floor(Math.random() * availableCards.length);
        const firstId = availableCards[firstIdx];

        setCards(prev => {
            const newCards = [...prev];
            newCards[firstId].isFlipped = true;
            return newCards;
        });
        setFlippedCards([firstId]);

        // Wait and pick second
        setTimeout(() => {
            if (turnRef.current !== 'opponent') return;

            const remainingCards = availableCards.filter(id => id !== firstId);
            if (remainingCards.length === 0) return;

            const secondIdx = Math.floor(Math.random() * remainingCards.length);
            const secondId = remainingCards[secondIdx];

            setCards(prev => {
                const newCards = [...prev];
                newCards[secondId].isFlipped = true;
                return newCards;
            });
            setFlippedCards([firstId, secondId]);

            checkForMatch([firstId, secondId]);
        }, 1000);
    };

    // Effect to handle game end callback
    useEffect(() => {
        if (gameOver) {
            const timer = setTimeout(() => {
                let winner = '';
                let points = 0;

                if (scores.player > scores.opponent) {
                    winner = currentUser.username;
                    points = 200; // Win points
                } else if (scores.opponent > scores.player) {
                    winner = 'opponent';
                    points = 0;
                } else {
                    winner = 'draw';
                    points = 50; // Draw points
                }

                onGameEnd(winner, isBotMode ? 0 : points);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [gameOver, scores, currentUser.username, onGameEnd, isBotMode]);

    const getShapeIcon = (shape: string) => {
        const shapeDef = SHAPES.find(s => s.shape === shape);
        if (!shapeDef) return null;
        const Icon = shapeDef.icon;
        return <Icon size={32} className={shapeDef.color} />;
    };

    if (waitingForOpponent) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[600px] bg-[#1a1f2e] border-4 border-gray-700 rounded-xl p-8 relative overflow-hidden">
                <div className="absolute inset-0 opacity-5 bg-[url('https://www.transparenttextures.com/patterns/pixel-weave.png')]"></div>
                <div className="text-center z-10">
                    <div className="animate-spin mb-4 inline-block">
                        <AlertCircle size={48} className="text-yellow-500" />
                    </div>
                    <h2 className="font-pixel text-2xl text-white mb-2">RAKİP BEKLENİYOR...</h2>
                    <p className="text-gray-400 mb-6">Oyuncu aranıyor.</p>

                    <button
                        onClick={startBotGame}
                        className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-lg font-pixel flex items-center gap-2 mx-auto transition-colors"
                    >
                        <Bot size={20} />
                        BOT İLE OYNA
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[600px] bg-[#1a1f2e] border-4 border-gray-700 rounded-xl p-8 relative overflow-hidden">
            <div className="absolute inset-0 opacity-5 bg-[url('https://www.transparenttextures.com/patterns/pixel-weave.png')]"></div>

            <div className="z-10 w-full max-w-2xl">
                {/* Header / Scoreboard */}
                <div className="flex justify-between items-center mb-8 bg-black/40 p-4 rounded-lg border border-gray-700">
                    <div className={`flex items-center gap-3 p-2 rounded transition-colors ${turn === 'player' ? 'bg-blue-900/30 border border-blue-500/50' : ''}`}>
                        <div className="w-10 h-10 bg-blue-600 rounded flex items-center justify-center">
                            <UserIcon className="text-white" />
                        </div>
                        <div>
                            <span className="block font-pixel text-white">{currentUser.username}</span>
                            <span className="font-retro text-xl text-yellow-400">{scores.player}</span>
                        </div>
                    </div>

                    <div className="text-center">
                        <h2 className="font-pixel text-white text-lg">EŞLEŞTİRME</h2>
                        <div className="text-xs text-gray-400 mt-1">
                            {turn === 'player' ? 'Sıra Sende!' : 'Rakip Düşünüyor...'}
                        </div>
                    </div>

                    <div className={`flex items-center gap-3 p-2 rounded transition-colors ${turn === 'opponent' ? 'bg-red-900/30 border border-red-500/50' : ''}`}>
                        <div className="text-right">
                            <span className="block font-pixel text-white">{isBotMode ? 'CAFE BOT' : (opponentName || 'RAKİP')}</span>
                            <span className="font-retro text-xl text-yellow-400">{scores.opponent}</span>
                        </div>
                        <div className="w-10 h-10 bg-red-600 rounded flex items-center justify-center">
                            {isBotMode ? <Bot className="text-white" /> : <UserIcon className="text-white" />}
                        </div>
                    </div>
                </div>

                {/* Game Grid */}
                <div className="grid grid-cols-4 gap-4 mb-8">
                    {cards.map(card => (
                        <button
                            key={card.id}
                            onClick={() => handleCardClick(card.id)}
                            className={`aspect-square rounded-lg flex items-center justify-center transition-all duration-500 transform ${card.isFlipped || card.isMatched
                                    ? 'bg-gray-800 rotate-y-180 border-2 border-gray-600'
                                    : 'bg-gradient-to-br from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 border-b-4 border-blue-900'
                                } ${card.isMatched ? 'opacity-50' : ''}`}
                            disabled={card.isMatched || card.isFlipped}
                        >
                            {(card.isFlipped || card.isMatched) ? getShapeIcon(card.shape) : (
                                <span className="font-pixel text-2xl text-white/20">?</span>
                            )}
                        </button>
                    ))}
                </div>

                {gameOver && (
                    <div className="text-center animate-bounce">
                        <h3 className="font-pixel text-3xl text-green-500 mb-2">OYUN BİTTİ!</h3>
                        <p className="text-gray-400">
                            {scores.player > scores.opponent ? 'KAZANDIN!' : scores.opponent > scores.player ? 'KAYBETTİN!' : 'BERABERE!'}
                        </p>
                    </div>
                )}

                {isBotMode && (
                    <div className="mt-4 text-center">
                        <p className="text-xs text-gray-500 bg-black/30 inline-block px-3 py-1 rounded border border-gray-800">
                            <AlertCircle size={12} className="inline mr-1" />
                            Bot modu aktif (Puan kazanılmaz).
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
