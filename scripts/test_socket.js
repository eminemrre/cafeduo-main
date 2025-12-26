const io = require("socket.io-client");

const socket = io("http://localhost:3001");

socket.on("connect", () => {
    console.log("✅ Connected to server with ID:", socket.id);

    socket.emit("join_game", "test-game-123");
    socket.emit("game_move", { gameId: "test-game-123", move: "rock", player: "p1" });
});

socket.on("opponent_move", (data) => {
    console.log("✅ Received opponent_move:", data);
    // socket.disconnect();
});

socket.on("container_test", () => {
    // Keep alive for a bit
});

setTimeout(() => {
    console.log("Closing test...");
    socket.disconnect();
}, 2000);
