const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

const rooms = {}; // Room storage

io.on('connection', (socket) => {

    // 1. Generate Room Code
    socket.on('createRoom', ({ name, points }) => {
        const roomCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        rooms[roomCode] = {
            hostSocketId: socket.id,
            hostName: name,
            targetPoints: parseInt(points),
            currentPoints: 0,
            guestSocketId: null,
            guestName: null
        };

        socket.join(roomCode);
        socket.emit('codeGenerated', { roomCode });

        // 5 Minutes Expiry Logic
        setTimeout(() => {
            if (rooms[roomCode] && !rooms[roomCode].guestSocketId) {
                delete rooms[roomCode];
                socket.emit('codeExpired');
            }
        }, 5 * 60 * 1000);
    });

    // 2. Guest Request to Join
    socket.on('requestJoin', ({ roomCode, guestName }) => {
        const room = rooms[roomCode];
        if (room) {
            room.guestSocketId = socket.id;
            room.guestName = guestName;
            socket.join(roomCode);

            // Host ko join request bhejo
            io.to(room.hostSocketId).emit('joinRequestReceived', { guestName, roomCode });
        } else {
            socket.emit('errorMsg', 'Invalid or Expired Code!');
        }
    });

    // 3. Host Accepts Join
    socket.on('acceptJoin', ({ roomCode }) => {
        io.to(roomCode).emit('startChat', { 
            targetPoints: rooms[roomCode].targetPoints 
        });
    });

    // 4. Chat Message & Point Calculation (+3 per chat)
    socket.on('sendMessage', ({ roomCode, message, senderName }) => {
        const room = rooms[roomCode];
        if (room) {
            room.currentPoints += 3;
            const isCompleted = room.currentPoints >= room.targetPoints;

            io.to(roomCode).emit('newMessage', {
                senderName,
                message,
                currentPoints: room.currentPoints,
                isCompleted
            });
        }
    });
});

server.listen(3000, () => console.log('Server running on port 3000'));
