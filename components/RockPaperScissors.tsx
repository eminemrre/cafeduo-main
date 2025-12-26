import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Trophy, X, Users, Signal } from 'lucide-react';
import { socketService } from '../lib/socket';

interface RockPaperScissorsProps {
    currentUser: User;
    isBot: boolean;
    gameId?: string; // Add gameId for multiplayer
    onGameEnd: (winner: string, points: number) => void;
    onLeave: () => void;
}

type Choice = 'rock' | 'paper' | 'scissors' | null;

const CHOICES: Record<'rock' | 'paper' | 'scissors', { name: string; emoji: string }> = {
    rock: { name: 'TAŞ', emoji: '✊' },
    paper: { name: 'KAĞIT', emoji: '✋' },
    scissors: { name: 'MAKAS', emoji: '✌️' },
};

export const RockPaperScissors: React.FC<RockPaperScissorsProps> = ({ currentUser, isBot, gameId, onGameEnd, onLeave }) => {
    const [playerChoice, setPlayerChoice] = useState<Choice>(null);
    const [opponentChoice, setOpponentChoice] = useState<Choice>(null); // For revealing
    const [playerScore, setPlayerScore] = useState(0);
    const [opponentScore, setOpponentScore] = useState(0);
    const [round, setRound] = useState(1);
    const [phase, setPhase] = useState<'waiting_for_opponent' | 'select' | 'waiting_reveal' | 'reveal'>('select');
    const [result, setResult] = useState('');
    const [gameOver, setGameOver] = useState(false);
    const [opponentName, setOpponentName] = useState(isBot ? 'BOT' : 'Rakip Bekleniyor...');
    const [opponentConnected, setOpponentConnected] = useState(isBot ? true : false);
    const [opponentMoved, setOpponentMoved] = useState(false); // Validates if opponent made a move (hidden)

    const MAX_ROUNDS = 5;
    const WIN_SCORE = 3;

    // --- SOCKET IO HANDLERS ---
    useEffect(() => {
        if (isBot || !gameId) {
            setPhase('select');
            return;
        }

        const socket = socketService.getSocket();

        // Join Game
        socket.emit('rps_join', { gameId, username: currentUser.username });
        setPhase('waiting_for_opponent');

        // Listeners
        socket.on('rps_update_players', (players: any[]) => {
            if (players.length === 2) {
                const opponent = players.find(p => p.username !== currentUser.username);
                if (opponent) {
                    setOpponentName(opponent.username);
                    setOpponentConnected(true);
                    if (phase === 'waiting_for_opponent') setPhase('select');
                }
            }
        });

        socket.on('rps_opponent_moved', () => {
            setOpponentMoved(true);
        });

        socket.on('rps_round_result', (data: any) => {
            // Determine which one is me
            const myData = data.p1.id === socket.id ? data.p1 : data.p2;
            const oppData = data.p1.id === socket.id ? data.p2 : data.p1;

            setPlayerChoice(myData.move);
            setOpponentChoice(oppData.move);
            setPlayerScore(myData.score);
            setOpponentScore(oppData.score);
            setOpponentMoved(false); // Reset moved flag

            setPhase('reveal');

            // Result Text
            if (data.winner === 'draw') {
                setResult('⚡ Berabere!');
            } else if (data.winner === socket.id) {
                setResult('🎉 Kazandın!');
            } else {
                setResult('💀 Kaybettin!');
            }

            // Next Round Logic
            setTimeout(() => {
                const maxReached = myData.score >= WIN_SCORE || oppData.score >= WIN_SCORE || round >= MAX_ROUNDS;

                if (maxReached) {
                    setGameOver(true);
                    const isWinner = myData.score > oppData.score;
                    setTimeout(() => onGameEnd(isWinner ? currentUser.username : opponentName, isWinner ? 10 : 0), 2000);
                } else {
                    setRound(r => r + 1);
                    setPlayerChoice(null);
                    setOpponentChoice(null);
                    setPhase('select');
                    setResult('');
                }
            }, 2000);
        });

        socket.on('rps_player_disconnected', () => {
            setOpponentConnected(false);
            setResult('⚠️ Rakip ayrıldı.');
            setOpponentName('Rakip Bekleniyor...');
            // Maybe pause game or declare winner?
        });

        return () => {
            socket.off('rps_update_players');
            socket.off('rps_opponent_moved');
            socket.off('rps_round_result');
            socket.off('rps_player_disconnected');
        };
    }, [isBot, gameId]);


    const handleChoice = (choice: Choice) => {
        if (gameOver || !choice) return;

        // BOT LOGIC
        if (isBot) {
            const botPick = (['rock', 'paper', 'scissors'] as const)[Math.floor(Math.random() * 3)];

            // ... (keep existing simple bot logic essentially, maybe simplified for unified state)
            setPlayerChoice(choice);
            setOpponentChoice(botPick); // Reveal immediately for bot
            setPhase('reveal');

            // Winner calc (reused logic could be better but sticking to simple for now)
            let winner = 'draw';
            if (choice !== botPick) {
                if ((choice === 'rock' && botPick === 'scissors') ||
                    (choice === 'scissors' && botPick === 'paper') ||
                    (choice === 'paper' && botPick === 'rock')) {
                    winner = 'p1';
                } else {
                    winner = 'p2';
                }
            }

            if (winner === 'p1') {
                setPlayerScore(s => s + 1);
                setResult('🎉 Kazandın!');
            } else if (winner === 'p2') {
                setOpponentScore(s => s + 1);
                setResult('💀 Kaybettin!');
            } else {
                setResult('⚡ Berabere!');
            }

            setTimeout(() => {
                if (playerScore + (winner === 'p1' ? 1 : 0) >= WIN_SCORE || opponentScore + (winner === 'p2' ? 1 : 0) >= WIN_SCORE || round >= MAX_ROUNDS) {
                    setGameOver(true);
                    const finalWinner = (playerScore + (winner === 'p1' ? 1 : 0)) > (opponentScore + (winner === 'p2' ? 1 : 0)) ? currentUser.username : 'BOT';
                    onGameEnd(finalWinner, 0); // No points for bot
                } else {
                    setRound(r => r + 1);
                    setPlayerChoice(null);
                    setOpponentChoice(null);
                    setPhase('select');
                    setResult('');
                }
            }, 1500);
            return;
        }

        // MULTIPLAYER LOGIC
        if (phase === 'select') {
            setPlayerChoice(choice); // Show selection locally
            setPhase('waiting_reveal'); // Wait for opponent
            socketService.emitMove(gameId!, choice); // Emit to server
        }
    };

    return (
        <div className="flex flex-col items-center min-h-[450px] bg-gradient-to-b from-gray-900 to-gray-800 rounded-xl p-6 relative overflow-hidden">
            {/* Connection Status Indicator */}
            {!isBot && (
                <div className={`absolute top-0 left-0 w-full h-1 ${opponentConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
            )}

            {/* Header */}
            <div className="w-full flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">✊✋✌️</span>
                    <div>
                        <h2 className="text-white font-bold">Taş Kağıt Makas</h2>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span>Tur {round}/{MAX_ROUNDS}</span>
                            {!isBot && (
                                <span className="flex items-center gap-1">
                                    <Users size={12} /> {opponentConnected ? 'Bağlı' : 'Bekleniyor...'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <button onClick={onLeave} className="bg-red-600/30 hover:bg-red-600/50 text-red-400 p-2 rounded-lg">
                    <X size={18} />
                </button>
            </div>

            {/* Scoreboard */}
            <div className="w-full max-w-sm flex justify-between items-center bg-black/30 rounded-lg p-3 mb-4 border border-gray-700">
                <div className="text-center flex-1">
                    <div className="text-green-400 font-bold text-sm truncate px-1">{currentUser.username}</div>
                    <div className="text-3xl font-bold text-white">{playerScore}</div>
                </div>
                <div className="text-gray-600 font-bold text-xs px-2">VS</div>
                <div className="text-center flex-1">
                    <div className={`${opponentConnected ? 'text-red-400' : 'text-gray-500'} font-bold text-sm truncate px-1`}>
                        {opponentName}
                    </div>
                    <div className="text-3xl font-bold text-white">{opponentScore}</div>
                </div>
            </div>

            {/* Game Area */}
            <div className="flex justify-center items-center gap-4 sm:gap-12 mb-6 min-h-[120px] w-full">
                {/* Player Card */}
                <div className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl border-2 flex items-center justify-center text-5xl transition-all duration-300
                    ${playerChoice ? 'border-green-500 bg-green-900/30 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'border-gray-600 bg-gray-800/50'}`}>
                    {playerChoice ? CHOICES[playerChoice].emoji : <span className="text-gray-600 text-3xl">?</span>}
                    {phase === 'waiting_reveal' && !result && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl animate-pulse">
                            <span className="text-xs text-white font-bold">Bekleniyor</span>
                        </div>
                    )}
                </div>

                {/* VS / Result Indicator */}
                <div className="flex flex-col items-center">
                    {result ? (
                        <div className="text-2xl animate-bounce">{result.includes('Kazandın') ? '🏆' : result.includes('Kaybettin') ? '❌' : '🤝'}</div>
                    ) : (
                        <span className="text-yellow-500 text-3xl font-bold">⚡</span>
                    )}
                </div>

                {/* Opponent Card */}
                <div className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl border-2 flex items-center justify-center text-5xl transition-all duration-300
                    ${opponentChoice ? 'border-red-500 bg-red-900/30 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'border-gray-600 bg-gray-800/50'}`}>

                    {phase === 'reveal' && opponentChoice ? (
                        CHOICES[opponentChoice].emoji
                    ) : (
                        opponentMoved ? (
                            <div className="animate-pulse text-4xl">✅</div> // Hidden move indicator
                        ) : (
                            <span className="text-gray-600 text-3xl">?</span>
                        )
                    )}

                    {!opponentConnected && !isBot && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-xl">
                            <Signal size={24} className="text-gray-500 animate-pulse" />
                        </div>
                    )}
                </div>
            </div>

            {/* Result Text */}
            {result && <div className="text-lg font-bold text-white mb-6 animate-fade-in">{result}</div>}

            {/* Controls */}
            {((phase === 'select') || (phase === 'waiting_for_opponent' && !isBot)) && !gameOver && (
                <div className="w-full">
                    {!isBot && phase === 'waiting_for_opponent' ? (
                        <div className="text-center text-gray-400 py-4 animate-pulse">
                            Rakip bekleniyor... Linki arkadaşınla paylaş!
                        </div>
                    ) : (
                        <div className="flex justify-center gap-3 sm:gap-6">
                            {(['rock', 'paper', 'scissors'] as const).map((c) => (
                                <button
                                    key={c}
                                    onClick={() => handleChoice(c)}
                                    disabled={phase !== 'select'}
                                    className="group relative w-20 h-24 sm:w-24 sm:h-28 rounded-xl border-2 border-gray-600 bg-gray-800 
                                        hover:bg-gray-700 hover:border-white hover:-translate-y-1 hover:shadow-lg hover:shadow-purple-500/20
                                        transition-all flex flex-col items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span className="text-3xl sm:text-4xl group-hover:scale-110 transition-transform">{CHOICES[c].emoji}</span>
                                    <span className="text-gray-300 text-xs font-bold uppercase tracking-wider group-hover:text-white">{CHOICES[c].name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Game Over Screen */}
            {gameOver && (
                <div className="text-center mt-2 animate-fade-in">
                    <h2 className={`text-2xl font-bold mb-2 ${playerScore > opponentScore ? 'text-yellow-400' : 'text-red-400'}`}>
                        {playerScore > opponentScore ? 'OYUN KAZANILDI!' : playerScore < opponentScore ? 'OYUN KAYBEDİLDİ' : 'BERABERE'}
                    </h2>
                    <button
                        onClick={onLeave}
                        className="bg-white text-black px-6 py-2 rounded-full font-bold hover:bg-gray-200 transition-colors"
                    >
                        Menüye Dön
                    </button>
                    {!isBot && playerScore > opponentScore && (
                        <div className="mt-2 text-green-400 text-sm font-mono">+10 PUAN KAZANDIN</div>
                    )}
                </div>
            )}
        </div>
    );
};
