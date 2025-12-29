const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Serve static files (like logo.png) from the root directory
app.use(express.static(__dirname));

// Serve your index.html file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let waitingPlayer = null; 

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // 1. Authenticate: Attach user info to the socket
    socket.on('authenticate', (userData) => {
        socket.user = userData; 
        console.log(`User Identified: ${userData.name}`);
    });

    // 2. Matchmaking
    socket.on('findMatch', () => {
        // Safety check: Don't pair if authentication hasn't happened yet
        if (!socket.user) {
            socket.emit('error', 'Please log in first.');
            return;
        }

        if (waitingPlayer && waitingPlayer.id !== socket.id) {
            const roomId = `room_${waitingPlayer.id}_${socket.id}`;
            const opponent = waitingPlayer;
            waitingPlayer = null;

            socket.join(roomId);
            opponent.join(roomId);

            // Pair them and send opponent data to both
            opponent.emit('matchFound', { 
                roomId, 
                role: 1, 
                opponentName: socket.user.name, 
                opponentPhoto: socket.user.photo 
            });

            socket.emit('matchFound', { 
                roomId, 
                role: 2, 
                opponentName: opponent.user.name, 
                opponentPhoto: opponent.user.photo 
            });
            
            io.to(roomId).emit('startGame');
        } else {
            waitingPlayer = socket;
            socket.emit('searching');
        }
    });

    // 3. Game Actions
    socket.on('emitMove', (data) => {
        socket.to(data.roomId).emit('opponentMove', data);
    });

    socket.on('emitPass', (data) => {
        socket.to(data.roomId).emit('opponentPass');
    });

    socket.on('syncDice', (data) => {
        socket.to(data.roomId).emit('diceSynced', data);
    });

    // 4. Resignation & Leaving
    socket.on('playerResigned', (data) => {
        socket.to(data.roomId).emit('opponentResigned', { 
            playerId: data.playerId 
        });
    });

    socket.on('leaveRoom', (data) => {
        socket.leave(data.roomId);
    });

    // 5. Disconnect
    socket.on('disconnect', () => {
        if (waitingPlayer && waitingPlayer.id === socket.id) {
            waitingPlayer = null;
        }
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
