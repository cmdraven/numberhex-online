const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Serve your index.html file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

let waitingPlayer = null; 

io.on('connection', (socket) => {
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
    });

    socket.on('emitMove', (data) => {
        socket.to(data.roomId).emit('opponentMove', data);
    });

    socket.on('emitPass', (data) => {
        socket.to(data.roomId).emit('opponentPass');
    });

    socket.on('disconnect', () => {
        if (waitingPlayer && waitingPlayer.id === socket.id) waitingPlayer = null;
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
