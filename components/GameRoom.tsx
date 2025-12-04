import React, { useState, useEffect, useRef } from 'react';
import { Scissors, Scroll, Hand, User, Bot, Trophy, AlertCircle, Circle } from 'lucide-react';
import { RetroButton } from './RetroButton';
import { User as UserType } from '../types';
import { api } from '../lib/api';

interface GameRoomProps {
    currentUser: UserType;
    gameId: number;
    opponentName?: string;
    onGameEnd: (winner: string, points: number) => void;
    onLeave: () => void;
    onMinimize?: () => void;
}

type Move = 'rock' | 'paper' | 'scissors' | null;

export const GameRoom: React.FC<GameRoomProps> = ({ currentUser, gameId, opponentName, onGameEnd, onLeave, onMinimize }) => {
    const [playerMove, setPlayerMove] = useState<Move>(null);
    const [opponentMove, setOpponentMove] = useState<Move>(null);
    const [result, setResult] = useState<string>('');
    const [countdown, setCountdown] = useState<number | null>(null);
    const [isBot, setIsBot] = useState(false);
    const [waitingForOpponent, setWaitingForOpponent] = useState(true);

    // Timer refs for cleanup
    const timers = useRef<NodeJS.Timeout[]>([]);

    const addTimer = (callback: () => void, ms: number) => {
        const timer = setTimeout(() => {
            callback();
            timers.current = timers.current.filter(t => t !== timer);
        }, ms);
        timers.current.push(timer);
        return timer;
    };

    // Polling for Game State
    useEffect(() => {
        if (!gameId || isBot) return;

        const pollGame = async () => {
            try {
                const game = await api.games.get(gameId);

                // Check if opponent joined
                if (waitingForOpponent && game.guestName) {
                    setWaitingForOpponent(false);
                    // If we are host, the guestName is our opponent
                    if (currentUser.username === game.hostName) {
                        // We need a way to update the parent state or local display
                        // Since opponentName prop is read-only, we might need a local state or just rely on game data for display
                        // But for now, let's just force a re-render or use a local ref if needed. 
                        // Actually, we can just use game.guestName for display if opponentName is missing.
                    }
                }

                // Check for opponent move
                const isHost = currentUser.username === game.hostName;
                const oppMove = isHost ? game.player2Move : game.player1Move;

                if (oppMove && !opponentMove) {
                    setOpponentMove(oppMove as Move);
                }

                // Check for result reset (new round)
                if (!game.player1Move && !game.player2Move && result) {
                    resetRound();
                }

            } catch (err) {
                console.error("Polling error", err);
            }
        };

        const interval = setInterval(pollGame, 2000);
        return () => clearInterval(interval);
    }, [gameId, isBot, waitingForOpponent, opponentMove, result]);

    const startBotGame = () => {
        setIsBot(true);
        setWaitingForOpponent(false);
    };

    const handleMove = async (move: Move) => {
        if (playerMove) return;
        setPlayerMove(move);

        if (!isBot) {
            try {
                const isHost = currentUser.username === (opponentName || ''); // Logic check: actually we need to know if we are host.
                // Better: check against game data, but for now assume if we created it we are host.
                // Wait, opponentName is passed from Dashboard. If I joined, opponentName is Host.
                // If I am host, opponentName is undefined initially.

                // Let's rely on API to handle "which player am I" or send it.
                // Simplified: Send "host" or "guest" role based on logic.
                // Actually, let's just send the move and let server decide or send role.
                // For this simple implementation, let's assume:
                // If I am the creator (host), I am player 1.

                // We need to know if we are host or guest.
                // In Dashboard, we set opponentName.
                // If I created (Host), opponentName is undefined (until someone joins).
                // If I joined (Guest), opponentName is Host's name.

                const role = opponentName ? 'guest' : 'host';
                await api.games.move(gameId, { player: role, move });
            } catch (e) {
                console.error("Move failed", e);
            }
        }

        // Start countdown for reveal (Visual only, real reveal happens when both moved)
        setCountdown(3);
    };

    useEffect(() => {
        if (countdown === null) return;

        if (countdown > 0) {
            addTimer(() => setCountdown(countdown - 1), 1000);
        } else {
            // Reveal
            finishRound();
        }
    }, [countdown]);

    const finishRound = () => {
        // In multiplayer, we wait for opponent move from polling
        if (!isBot && !opponentMove) {
            // If opponent hasn't moved yet, we wait.
            // But countdown finished? 
            // Actually, for multiplayer, we shouldn't show countdown until BOTH have moved?
            // OR: We show "Waiting for opponent..." after we move.
            return;
        }

        // ... (rest of logic)

        let oppMove: Move = opponentMove;

        if (isBot) {
            const moves: Move[] = ['rock', 'paper', 'scissors'];
            oppMove = moves[Math.floor(Math.random() * 3)];
            setOpponentMove(oppMove);
        }

        determineWinner(playerMove, oppMove);
    };

    const determineWinner = (p1: Move, p2: Move) => {
        if (!p1 || !p2) return;

        if (p1 === p2) {
            setResult('BERABERE!');
            addTimer(resetRound, 3000);
        } else if (
            (p1 === 'rock' && p2 === 'scissors') ||
            (p1 === 'paper' && p2 === 'rock') ||
            (p1 === 'scissors' && p2 === 'paper')
        ) {
            setResult('KAZANDIN!');
            addTimer(() => onGameEnd(currentUser.username, isBot ? 0 : 100), 3000);
        } else {
            setResult('KAYBETTİN!');
            addTimer(() => onGameEnd('opponent', 0), 3000);
        }
    };

    const resetRound = async () => {
        setPlayerMove(null);
        setOpponentMove(null);
        setResult('');
        setCountdown(null);

        if (!isBot) {
            // Reset on server
            const role = opponentName ? 'guest' : 'host';
            await api.games.move(gameId, { player: role, move: null });
        }
    };

    const getIcon = (move: Move) => {
        if (!move) return <div className="w-16 h-16 bg-gray-700 rounded-full animate-pulse"></div>;
        switch (move) {
            case 'rock': return <div className="p-4 bg-pink-500 rounded-full"><Circle className="text-white" size={32} /></div>;
            case 'paper': return <div className="p-4 bg-blue-500 rounded-full"><Scroll className="text-white" size={32} /></div>;
            case 'scissors': return <div className="p-4 bg-yellow-500 rounded-full"><Scissors className="text-white" size={32} /></div>;
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[600px] bg-[#1a1f2e] border-4 border-gray-700 rounded-xl p-8 relative overflow-hidden">

            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-5 bg-[url('https://www.transparenttextures.com/patterns/pixel-weave.png')]"></div>

            {waitingForOpponent ? (
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
            ) : (
                <div className="w-full max-w-2xl z-10">

                    {/* Header */}
                    <div className="flex justify-between items-center mb-12 bg-black/40 p-4 rounded-lg border border-gray-700">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-600 rounded flex items-center justify-center">
                                <User className="text-white" />
                            </div>
                            <div>
                                <span className="block font-pixel text-white">{currentUser.username}</span>
                                <span className="text-xs text-blue-400">SEN</span>
                            </div>
                        </div>

                        <div className="font-pixel text-3xl text-yellow-500">VS</div>

                        <div className="flex items-center gap-3 text-right">
                            <div>
                                <span className="block font-pixel text-white">{isBot ? 'CAFE BOT' : (opponentName || 'RAKİP')}</span>
                                <span className="text-xs text-red-400">{isBot ? 'YAPAY ZEKA' : 'OYUNCU'}</span>
                            </div>
                            <div className="w-10 h-10 bg-red-600 rounded flex items-center justify-center">
                                {isBot ? <Bot className="text-white" /> : <User className="text-white" />}
                            </div>
                        </div>
                    </div>

                    {/* Top Actions */}
                    <div className="absolute top-4 right-4 flex gap-2">
                        {onMinimize && (
                            <button
                                onClick={onMinimize}
                                className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded border border-gray-500"
                                title="Panele Dön (Oyun Devam Eder)"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" /><path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" /></svg>
                            </button>
                        )}
                    </div>

                    {/* Game Area */}
                    <div className="flex justify-center items-center gap-12 mb-12 min-h-[200px]">
                        {/* Player */}
                        <div className={`transition-all duration-500 ${playerMove ? 'scale-125' : ''}`}>
                            {playerMove ? getIcon(playerMove) : <div className="w-24 h-24 border-4 border-dashed border-gray-600 rounded-full flex items-center justify-center text-gray-500 font-pixel">?</div>}
                        </div>

                        {/* Result/Countdown */}
                        <div className="text-center w-32">
                            {countdown !== null ? (
                                <span className="font-pixel text-6xl text-white animate-bounce block">{countdown > 0 ? countdown : 'GO!'}</span>
                            ) : result ? (
                                <span className={`font-pixel text-2xl ${result === 'KAZANDIN!' ? 'text-green-500' : result === 'KAYBETTİN!' ? 'text-red-500' : 'text-yellow-500'}`}>{result}</span>
                            ) : (
                                <span className="font-pixel text-xl text-gray-500">SEÇİM YAP</span>
                            )}
                        </div>

                        {/* Opponent */}
                        <div className={`transition-all duration-500 ${opponentMove ? 'scale-125' : ''}`}>
                            {opponentMove ? getIcon(opponentMove) : <div className="w-24 h-24 border-4 border-dashed border-gray-600 rounded-full flex items-center justify-center text-gray-500 font-pixel">?</div>}
                        </div>
                    </div>

                    {/* Controls */}
                    {!playerMove && !result && (
                        <div className="grid grid-cols-3 gap-4">
                            <button onClick={() => handleMove('rock')} className="bg-gray-800 hover:bg-pink-600 border-2 border-gray-600 hover:border-pink-400 p-6 rounded-xl flex flex-col items-center gap-2 transition-all group">
                                <div className="bg-black/30 p-3 rounded-full group-hover:scale-110 transition-transform"><Circle className="text-gray-300 group-hover:text-white" /></div>
                                <span className="font-pixel text-white">TAŞ</span>
                            </button>
                            <button onClick={() => handleMove('paper')} className="bg-gray-800 hover:bg-blue-600 border-2 border-gray-600 hover:border-blue-400 p-6 rounded-xl flex flex-col items-center gap-2 transition-all group">
                                <div className="bg-black/30 p-3 rounded-full group-hover:scale-110 transition-transform"><Scroll className="text-gray-300 group-hover:text-white" /></div>
                                <span className="font-pixel text-white">KAĞIT</span>
                            </button>
                            <button onClick={() => handleMove('scissors')} className="bg-gray-800 hover:bg-yellow-600 border-2 border-gray-600 hover:border-yellow-400 p-6 rounded-xl flex flex-col items-center gap-2 transition-all group">
                                <div className="bg-black/30 p-3 rounded-full group-hover:scale-110 transition-transform"><Scissors className="text-gray-300 group-hover:text-white" /></div>
                                <span className="font-pixel text-white">MAKAS</span>
                            </button>
                        </div>
                    )}

                    {result && (
                        <div className="text-center mt-8">
                            <RetroButton onClick={onLeave} variant="primary">LOBİYE DÖN</RetroButton>
                        </div>
                    )}

                    {isBot && (
                        <div className="mt-8 text-center">
                            <p className="text-xs text-gray-500 bg-black/30 inline-block px-3 py-1 rounded border border-gray-800">
                                <AlertCircle size={12} className="inline mr-1" />
                                Bot ile oynanan oyunlardan puan kazanılmaz.
                            </p>
                        </div>
                    )}

                </div>
            )}
        </div>
    );
};
