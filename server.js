const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = new Server(server, {
    cors: {
        origin: "*", // For development - restrict in production
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Serve static files
app.use(express.static(__dirname));
app.get('/', (req, res) => {
    res.send('🚀 Skymingle Signaling Server is running!');
});
const PORT = process.env.PORT || 3000;

// Store active rooms and users
const rooms = new Map();
const users = new Map();

// Basic health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        connections: io.engine.clientsCount,
        rooms: rooms.size,
        timestamp: new Date().toISOString()
    });
});

// Socket.IO Connection Event
io.on('connection', (socket) => {
    console.log(`🔗 User connected: ${socket.id}`);
    users.set(socket.id, { id: socket.id, connectedAt: new Date() });

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
        users.delete(socket.id);
        
        // Remove from all rooms
        rooms.forEach((userSet, roomId) => {
            if (userSet.has(socket.id)) {
                userSet.delete(socket.id);
                if (userSet.size === 0) {
                    rooms.delete(roomId);
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
        
        updateRoomInfo();
    });
});

// Helper function to update room info
function updateRoomInfo() {
    rooms.forEach((userSet, roomId) => {
        io.to(roomId).emit('room-info', {
            roomId,
            users: Array.from(userSet),
            count: userSet.size
        });
    });
}

// Start the server
server.listen(PORT, () => {
    console.log(`🚀 Skymingle Signaling Server running on port ${PORT}`);
    console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}`);
    console.log(`🌐 HTTP endpoint: http://localhost:${PORT}`);
    console.log(`👥 Ready for connections...`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    io.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
