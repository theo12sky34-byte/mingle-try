// ============================================
// 1. STATUS FUNCTION
// ============================================
function setStatus(message, isError = false) {
    const statusElement = document.getElementById('status');
    if (statusElement) {
        statusElement.textContent = message;
        if (isError) {
            statusElement.style.color = '#ff4444';
        } else {
            statusElement.style.color = '#4CAF50';
        }
    } else {
        console.log('Status:', message);
    }
}

// ============================================
// 2. DOM ELEMENT REFERENCES
// ============================================
const chatBody = document.getElementById('chatBody');
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const status = document.getElementById('status');
const nicknameInput = document.getElementById('nickname');
const roomsSelect = document.getElementById('rooms');
const newRoomInput = document.getElementById('newRoom');
const createRoomBtn = document.getElementById('createRoom');
const usersDiv = document.getElementById('users');

const APP_PREFIX = 'skymingle_demo_v1';
const roomsKey = `${APP_PREFIX}:rooms`;
const clearBtn = document.getElementById('clearRoom');
const exportBtn = document.getElementById('exportRoom');

const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('skymingle_channel') : null;
let socket = null;
const signalUrlInput = document.getElementById('signalUrl');
const connectSignalBtn = document.getElementById('connectSignal');
const signalStatusSpan = document.getElementById('signalStatus');
const copySignalBtn = document.getElementById('copySignal');
const remoteCountSpan = document.getElementById('remoteCount');

// ============================================
// 3. USER MANAGEMENT FUNCTIONS
// ============================================
function getUserId() {
    let id = localStorage.getItem(`${APP_PREFIX}:userId`);
    if (!id) {
        id = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem(`${APP_PREFIX}:userId`, id);
    }
    return id;
}

function getNickname() {
    return nicknameInput.value.trim() || 'Anonymous';
}

// ============================================
// 4. ROOM MANAGEMENT FUNCTIONS
// ============================================
function loadRooms() {
    try {
        const rooms = JSON.parse(localStorage.getItem(roomsKey) || '{}');
        const roomNames = Object.keys(rooms);
        
        roomsSelect.innerHTML = '';
        if (roomNames.length === 0) {
            // Create default room
            const defaultRoom = 'General';
            rooms[defaultRoom] = [];
            localStorage.setItem(roomsKey, JSON.stringify(rooms));
            roomNames.push(defaultRoom);
        }
        
        roomNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            roomsSelect.appendChild(option);
        });
        
        // Select first room
        if (roomsSelect.options.length > 0) {
            roomsSelect.selectedIndex = 0;
            loadMessages(roomsSelect.value);
        }
    } catch (e) {
        console.error('Failed to load rooms:', e);
    }
}

function loadMessages(roomName) {
    try {
        const rooms = JSON.parse(localStorage.getItem(roomsKey) || '{}');
        const messages = rooms[roomName] || [];
        chatBody.innerHTML = '';
        messages.forEach(msg => addMessageToUI(msg));
        chatBody.scrollTop = chatBody.scrollHeight;
    } catch (e) {
        console.error('Failed to load messages:', e);
    }
}

function saveMessage(roomName, message) {
    try {
        const rooms = JSON.parse(localStorage.getItem(roomsKey) || '{}');
        if (!rooms[roomName]) rooms[roomName] = [];
        rooms[roomName].push(message);
        localStorage.setItem(roomsKey, JSON.stringify(rooms));
    } catch (e) {
        console.error('Failed to save message:', e);
    }
}

function addMessageToUI(message) {
    const div = document.createElement('div');
    div.className = `message ${message.type || 'user'}`;
    div.dataset.messageId = message.id;
    
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.innerHTML = `<strong>${message.nickname}</strong> ${new Date(message.timestamp).toLocaleTimeString()}`;
    
    const text = document.createElement('p');
    text.className = 'text';
    text.textContent = message.text;
    
    div.appendChild(meta);
    div.appendChild(text);
    chatBody.appendChild(div);
    chatBody.scrollTop = chatBody.scrollHeight;
}

// ============================================
// 5. CONNECT SIGNALING FUNCTION
// ============================================
function connectSignaling(url) {
    try {
        if (socket) {
            try { socket.disconnect(); } catch(e) {}
            socket = null;
        }
        if (!url) return;

        let cleanUrl = url.replace(/^ws:\/\//, 'http://').replace(/^wss:\/\//, 'https://');
        socket = io(cleanUrl);

        socket.on('connect', () => {
            console.log('Socket.IO signaling connected');
            setStatus('Signal: connected');
            
            // Join the current room
            const currentRoom = roomsSelect.value;
            if (currentRoom) {
                socket.emit('join-room', currentRoom);
                console.log(`Joined room: ${currentRoom}`);
            }
        });
        
        socket.on('disconnect', () => {
            console.log('Socket.IO signaling closed');
            setStatus('Signal: disconnected');
        });
        
        socket.on('connect_error', (e) => {
            console.warn('Socket.IO signaling error', e);
            setStatus('Signal: error', true);
        });
        
        socket.on('message', (data) => {
            try {
                const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
                if (bc) bc.postMessage(parsedData);
            } catch(e) {}
        });

        try { localStorage.setItem(`${APP_PREFIX}:signalUrl`, url); } catch(e) {}
    } catch(e) {
        console.warn('Could not connect signaling', e);
        socket = null;
        setStatus('Signaling connection failed', true);
    }
}

// ============================================
// 6. POST SIGNAL FUNCTION
// ============================================
function postSignal(obj) {
    if (bc) {
        try { bc.postMessage(obj); } catch(e) { console.warn('BC post failed (non-cloneable), continuing'); }
    }
    if (socket && socket.connected) {
        try { socket.send(obj); } catch(e) { console.warn('send failed', e); }
    }
}

// ============================================
// 7. UPDATE REMOTE COUNT
// ============================================
function updateRemoteCount() {
    try {
        // Check if webrtc is defined (from webrtc.js)
        if (typeof webrtc !== 'undefined' && webrtc) {
            const count = Object.keys(webrtc.peerConnections || {}).length;
            remoteCountSpan.textContent = count;
        } else {
            remoteCountSpan.textContent = '0';
        }
    } catch(e) {
        remoteCountSpan.textContent = '0';
    }
}

// ============================================
// 8. SIGNALING MESSAGE HANDLER
// ============================================
function handleSignal(data) {
    // For WebRTC signaling
    if (data.type === 'offer') {
        console.log('📞 Received offer from:', data.sender);
        if (typeof webrtc !== 'undefined' && webrtc) {
            webrtc.handleSignal(data);
        }
    } else if (data.type === 'answer') {
        console.log('📞 Received answer from:', data.sender);
        if (typeof webrtc !== 'undefined' && webrtc) {
            webrtc.handleSignal(data);
        }
    } else if (data.type === 'ice-candidate') {
        console.log('🧊 Received ICE candidate from:', data.sender);
        if (typeof webrtc !== 'undefined' && webrtc) {
            webrtc.handleSignal(data);
        }
    } else if (data.type === 'message') {
        // Handle chat messages from other tabs/devices
        if (data.room === roomsSelect.value) {
            // Check if we already have this message
            const existingMessages = chatBody.querySelectorAll('.message .text');
            let exists = false;
            existingMessages.forEach(el => {
                if (el.textContent === data.message.text) exists = true;
            });
            if (!exists) {
                addMessageToUI(data.message);
                saveMessage(data.room, data.message);
            }
        }
    } else if (data.event === 'user-joined') {
        setStatus(`👤 ${data.data.userId} joined`);
        updateRemoteCount();
    } else if (data.event === 'user-left') {
        setStatus(`👋 ${data.data.userId} left`);
        updateRemoteCount();
    } else if (data.signalData) {
        // Handle direct signaling from Socket.IO
        if (data.signalData.type === 'user-joined') {
            setStatus(`👤 User joined`);
            updateRemoteCount();
        } else if (data.signalData.type === 'user-left') {
            setStatus(`👋 User left`);
            updateRemoteCount();
        }
    }
}

// ============================================
// 9. BROADCAST CHANNEL MESSAGE RECEIVER
// ============================================
if (bc) {
    bc.onmessage = (event) => {
        const data = event.data;
        handleSignal(data);
    };
}

// ============================================
// 10. UI EVENT LISTENERS
// ============================================
if (connectSignalBtn) {
    connectSignalBtn.addEventListener('click', () => {
        const u = (signalUrlInput.value || '').trim();
        if (u) connectSignaling(u);
    });
}

if (copySignalBtn) {
    copySignalBtn.addEventListener('click', () => {
        const u = (signalUrlInput.value || '').trim();
        if (u) navigator.clipboard.writeText(u).catch(() => {});
    });
}

// ============================================
// 11. CHAT FORM HANDLER
// ============================================
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text) return;
    
    const currentRoom = roomsSelect.value;
    const nickname = getNickname();
    
    const message = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        nickname: nickname,
        text: text,
        timestamp: Date.now(),
        type: 'user'
    };
    
    // Save locally
    saveMessage(currentRoom, message);
    addMessageToUI(message);
    messageInput.value = '';
    chatBody.scrollTop = chatBody.scrollHeight;
    
    // Broadcast to others via BroadcastChannel
    postSignal({
        type: 'message',
        room: currentRoom,
        message: message
    });
    
    // Send via Socket.IO if connected
    if (socket && socket.connected) {
        socket.emit('signal', {
            roomId: currentRoom,
            signalData: {
                type: 'message',
                message: message
            }
        });
    }
});

// ============================================
// 12. ROOM SWITCH HANDLER
// ============================================
roomsSelect.addEventListener('change', () => {
    const room = roomsSelect.value;
    if (room) {
        loadMessages(room);
        if (socket && socket.connected) {
            socket.emit('join-room', room);
            console.log(`Switched to room: ${room}`);
        }
    }
});

// ============================================
// 13. CREATE ROOM HANDLER
// ============================================
createRoomBtn.addEventListener('click', () => {
    const name = newRoomInput.value.trim();
    if (!name) {
        setStatus('⚠️ Please enter a room name', true);
        return;
    }
    
    try {
        const rooms = JSON.parse(localStorage.getItem(roomsKey) || '{}');
        if (rooms[name]) {
            setStatus('⚠️ Room already exists', true);
            return;
        }
        
        rooms[name] = [];
        localStorage.setItem(roomsKey, JSON.stringify(rooms));
        
        // Add to dropdown
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        roomsSelect.appendChild(option);
        roomsSelect.value = name;
        newRoomInput.value = '';
        
        loadMessages(name);
        setStatus(`✅ Room "${name}" created`);
        
        // Join room via Socket.IO
        if (socket && socket.connected) {
            socket.emit('join-room', name);
        }
    } catch (e) {
        console.error('Failed to create room:', e);
        setStatus('❌ Failed to create room', true);
    }
});

// ============================================
// 14. CLEAR ROOM HANDLER
// ============================================
clearBtn.addEventListener('click', () => {
    if (!confirm('Clear all messages in this room?')) return;
    const room = roomsSelect.value;
    try {
        const rooms = JSON.parse(localStorage.getItem(roomsKey) || '{}');
        if (rooms[room]) {
            rooms[room] = [];
            localStorage.setItem(roomsKey, JSON.stringify(rooms));
            loadMessages(room);
            setStatus(`🗑️ Room "${room}" cleared`);
        }
    } catch (e) {
        console.error('Failed to clear room:', e);
        setStatus('❌ Failed to clear room', true);
    }
});

// ============================================
// 15. EXPORT ROOM HANDLER
// ============================================
exportBtn.addEventListener('click', () => {
    const room = roomsSelect.value;
    try {
        const rooms = JSON.parse(localStorage.getItem(roomsKey) || '{}');
        const messages = rooms[room] || [];
        const data = JSON.stringify({ 
            room, 
            messages, 
            exported: new Date().toISOString(),
            version: APP_PREFIX
        }, null, 2);
        
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `skymingle-${room}-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setStatus(`📤 Room "${room}" exported`);
    } catch (e) {
        console.error('Failed to export room:', e);
        setStatus('❌ Failed to export room', true);
    }
});

// ============================================
// 16. VIDEO CALL HANDLERS
// ============================================
const startVideoBtn = document.getElementById('startVideo');
const stopVideoBtn = document.getElementById('stopVideo');

if (startVideoBtn) {
    startVideoBtn.addEventListener('click', async () => {
        const room = roomsSelect.value;
        if (!room) {
            setStatus('⚠️ Please select a room first', true);
            return;
        }
        
        // Check if webrtc is defined
        if (typeof webrtc === 'undefined') {
            setStatus('❌ WebRTC not loaded. Check your script tags.', true);
            console.error('webrtc is not defined. Make sure webrtc.js is loaded before app.js');
            return;
        }
        
        const success = await webrtc.startVideo(room);
        if (success) {
            startVideoBtn.style.display = 'none';
            stopVideoBtn.style.display = 'inline-block';
            document.getElementById('videoArea').style.display = 'block';
        }
    });
}

if (stopVideoBtn) {
    stopVideoBtn.addEventListener('click', () => {
        if (typeof webrtc !== 'undefined' && webrtc) {
            webrtc.stopVideo();
        }
        startVideoBtn.style.display = 'inline-block';
        stopVideoBtn.style.display = 'none';
        document.getElementById('videoArea').style.display = 'none';
    });
}

// ============================================
// 17. AUTO-CONNECT TO SIGNALING SERVER
// ============================================
const savedSignal = localStorage.getItem(`${APP_PREFIX}:signalUrl`);
const defaultSignal = (location.protocol === 'https:' ? 'https://' : 'http://') + location.host;
if (signalUrlInput) {
    signalUrlInput.value = savedSignal || defaultSignal;
}

setTimeout(() => {
    try {
        if (signalUrlInput && signalUrlInput.value) {
            connectSignaling(signalUrlInput.value);
        }
    } catch(e) {}
}, 3000);

// ============================================
// 18. INITIALIZE APP
// ============================================
// Load rooms and initialize
loadRooms();
setStatus('🚀 Skymingle ready!');

// Log app info
console.log(`✅ Skymingle v${APP_PREFIX} initialized`);
console.log(`👤 User ID: ${getUserId()}`);
console.log(`📡 BroadcastChannel: ${bc ? '✅ Available' : '❌ Not available'}`);
console.log(`📹 WebRTC: ${typeof webrtc !== 'undefined' ? '✅ Loaded' : '❌ Not loaded'}`);