const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for now
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Serve static files
app.use(express.static(__dirname));

// ✅ ROOT PATH - This fixes the "Not Found" error!
app.get('/', (req, res) => {
    res.send('🚀 Skymingle Signaling Server is running!');
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        connections: io.engine.clientsCount,
        rooms: 0,
        timestamp: new Date().toISOString()
    });
});

const PORT = process.env.PORT || 3000;

// Store active rooms and users
const rooms = new Map();

// Socket.IO Connection Event
io.on('connection', (socket) => {
    console.log(`🔗 User connected: ${socket.id}`);

    // Join a room
    socket.on('join-room', (roomId) => {
        // Leave previous rooms
        const previousRooms = Array.from(socket.rooms).filter(r => r !== socket.id);
        previousRooms.forEach(room => {
            socket.leave(room);
        });
        
        // Join new room
        socket.join(roomId);
        
        // Track room
        if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
        }
        rooms.get(roomId).add(socket.id);
        
        console.log(`📥 User ${socket.id} joined room: ${roomId}`);
        
        // Notify others in the room
        socket.to(roomId).emit('signal', {
            sender: socket.id,
            signalData: {
                type: 'user-joined',
                userId: socket.id,
                timestamp: Date.now()
            }
        });
        
        // Send room info to the user
        const roomUsers = Array.from(rooms.get(roomId) || []);
        socket.emit('room-info', {
            roomId,
            users: roomUsers,
            count: roomUsers.length
        });
    });

    // Get room info on demand
    socket.on('get-room-info', (roomId) => {
        const roomUsers = Array.from(rooms.get(roomId) || []);
        socket.emit('room-info', {
            roomId,
            users: roomUsers,
            count: roomUsers.length
        });
    });

    // Handle signaling data (WebRTC)
    socket.on('signal', (data) => {
        const { roomId, targetUserId, signalData } = data;
        
        if (targetUserId) {
            // Send to specific user
            socket.to(targetUserId).emit('signal', {
                sender: socket.id,
                signalData: signalData
            });
        } else {
            // Broadcast to everyone in the room
            socket.to(roomId).emit('signal', {
                sender: socket.id,
                signalData: signalData
            });
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`🔗 User disconnected: ${socket.id}`);
        
        // Remove from all rooms
        rooms.forEach((userSet, roomId) => {
            if (userSet.has(socket.id)) {
                userSet.delete(socket.id);
                if (userSet.size === 0) {
                    rooms.delete(roomId);
                } else {
                    // Notify room about user leaving with updated list
                    const roomUsers = Array.from(userSet);
                    io.to(roomId).emit('room-info', {
                        roomId,
                        users: roomUsers,
                        count: roomUsers.length
                    });
                }
                
                // Notify others
                socket.to(roomId).emit('signal', {
                    sender: socket.id,
                    signalData: {
                        type: 'user-left',
                        userId: socket.id,
                        timestamp: Date.now()
                    }
                });
            }
        });
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`🚀 Skymingle Signaling Server running on port ${PORT}`);
    console.log(`📡 WebSocket endpoint: ${PORT}`);
    console.log(`🌐 Server is ready for connections`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    io.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
