const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// 1. FIX FOR LOGO: Serve static files from the root directory
app.use(express.static(__dirname));

// Serve your index.html file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let waitingPlayer = null; 

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    socket.on('authenticate', (userData) => {
        socket.user = userData; // Attach user info to this specific connection
        console.log(`${userData.name} joined the game server.`);
    });
    // When a user clicks 'Find Match'
    socket.on('findMatch', () => {
        if (waitingPlayer && waitingPlayer.id !== socket.id) {
            const roomId = `room_${waitingPlayer.id}_${socket.id}`;
            const opponent = waitingPlayer;
            waitingPlayer = null;

            socket.join(roomId);
            opponent.join(roomId);

            
            // Pair them: Player 1 is Blue, Player 2 is Red
            opponent.emit('matchFound', { roomId, role: 1 });
            socket.emit('matchFound', { roomId, role: 2 });
            
            io.to(roomId).emit('startGame');
        } else {
            waitingPlayer = socket;
            socket.emit('searching');
        }

        if (waitingPlayer) {
             const roomId = `room_${waitingPlayer.id}_${socket.id}`;
             io.to(roomId).emit('matchFound', { 
                 role: 2, 
                 opponentName: waitingPlayer.user.name 
             });
        }
    });

    socket.on('emitMove', (data) => {
        socket.to(data.roomId).emit('opponentMove', data);
    });

    socket.on('emitPass', (data) => {
        socket.to(data.roomId).emit('opponentPass');
    });

    socket.on('syncDice', (data) => {
        socket.to(data.roomId).emit('diceSynced', data);
    });

    // RESIGNATION LOGIC (Now correctly inside the connection block)
    socket.on('playerResigned', (data) => {
        socket.to(data.roomId).emit('opponentResigned', { 
            playerId: data.playerId 
        });
    });

    socket.on('leaveRoom', (data) => {
        socket.leave(data.roomId);
    });

    socket.on('disconnect', () => {
        if (waitingPlayer && waitingPlayer.id === socket.id) waitingPlayer = null;
        console.log('User disconnected');
    });

    socket.on('playerResigned', (data) => {
    // This sends the message to everyone in the room EXCEPT the person who resigned
        socket.to(data.roomId).emit('opponentResigned', { 
        playerId: data.playerId 
        });
    });

    
    
}); // <--- This closes io.on('connection')

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
