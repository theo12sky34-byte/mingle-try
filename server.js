const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// THIS FIXES THE "NOT FOUND" ERROR
app.get('/', (req, res) => {
    res.send('✅ Skymingle Server is LIVE!');
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
