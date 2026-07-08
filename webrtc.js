// ============================================
// WebRTC Manager - COMPLETE FILE
// ============================================
class WebRTCManager {
    constructor() {
        this.peerConnections = {};
        this.localStream = null;
        this.roomId = null;
        this.isCallActive = false;
        
        this.config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        
        console.log('📹 WebRTC Manager initialized');
    }

    async startVideo(roomId) {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.srcObject = this.localStream;
                localVideo.style.display = 'block';
            }
            
            this.roomId = roomId;
            this.isCallActive = true;
            
            this.broadcast('user-joined', { 
                userId: getUserId(),
                nickname: getNickname()
            });
            
            console.log('📹 Video call started in room:', roomId);
            setStatus('📹 Video call started');
            return true;
            
        } catch (error) {
            console.error('Failed to start video:', error);
            setStatus('❌ Camera access denied', true);
            return false;
        }
    }

    stopVideo() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        const localVideo = document.getElementById('localVideo');
        if (localVideo) {
            localVideo.style.display = 'none';
            localVideo.srcObject = null;
        }
        
        Object.keys(this.peerConnections).forEach(id => {
            this.peerConnections[id].close();
            delete this.peerConnections[id];
        });
        
        const remotes = document.getElementById('remotes');
        if (remotes) {
            remotes.innerHTML = '';
        }
        
        this.isCallActive = false;
        this.broadcast('user-left', { 
            userId: getUserId(),
            nickname: getNickname()
        });
        
        updateRemoteCount();
        console.log('📹 Video call stopped');
        setStatus('📹 Video call ended');
    }

    createPeerConnection(remoteUserId) {
        const pc = new RTCPeerConnection(this.config);
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                pc.addTrack(track, this.localStream);
            });
        }
        
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignal(remoteUserId, {
                    type: 'ice-candidate',
                    candidate: event.candidate
                });
            }
        };
        
        pc.ontrack = (event) => {
            this.displayRemoteVideo(remoteUserId, event.streams[0]);
        };
        
        pc.onconnectionstatechange = () => {
            console.log(`Connection state for ${remoteUserId}: ${pc.connectionState}`);
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                this.removeRemoteVideo(remoteUserId);
            }
        };
        
        this.peerConnections[remoteUserId] = pc;
        return pc;
    }

    displayRemoteVideo(userId, stream) {
        const container = document.getElementById('remotes');
        if (!container) return;
        
        let video = document.getElementById(`remote-${userId}`);
        if (!video) {
            video = document.createElement('video');
            video.id = `remote-${userId}`;
            video.autoplay = true;
            video.playsinline = true;
            video.style.width = '220px';
            video.style.borderRadius = '12px';
            video.style.background = '#000';
            video.style.border = '2px solid #38bdf8';
            
            const wrapper = document.createElement('div');
            wrapper.style.position = 'relative';
            wrapper.style.display = 'inline-block';
            
            const label = document.createElement('div');
            label.textContent = `User ${userId.substring(0, 6)}`;
            label.style.position = 'absolute';
            label.style.bottom = '8px';
            label.style.left = '8px';
            label.style.background = 'rgba(0,0,0,0.7)';
            label.style.color = 'white';
            label.style.padding = '4px 8px';
            label.style.borderRadius = '4px';
            label.style.fontSize = '12px';
            
            wrapper.appendChild(video);
            wrapper.appendChild(label);
            container.appendChild(wrapper);
        }
        
        video.srcObject = stream;
        updateRemoteCount();
    }

    removeRemoteVideo(userId) {
        const container = document.getElementById('remotes');
        if (!container) return;
        
        const video = document.getElementById(`remote-${userId}`);
        if (video && video.parentElement) {
            video.parentElement.remove();
        }
        delete this.peerConnections[userId];
        updateRemoteCount();
    }

    sendSignal(targetUserId, signalData) {
        if (socket && socket.connected) {
            socket.emit('signal', {
                roomId: this.roomId,
                targetUserId: targetUserId,
                signalData: signalData
            });
        }
        postSignal({
            type: 'signal',
            targetUserId: targetUserId,
            signalData: signalData
        });
    }

    broadcast(event, data) {
        postSignal({ 
            event, 
            data: { ...data, senderId: getUserId() }
        });
    }

    handleSignal(data) {
        const { sender, signalData } = data;
        
        if (signalData.type === 'offer') {
            this.handleOffer(sender, signalData.offer);
        } else if (signalData.type === 'answer') {
            this.handleAnswer(sender, signalData.answer);
        } else if (signalData.type === 'ice-candidate') {
            this.handleIceCandidate(sender, signalData.candidate);
        }
    }

    async handleOffer(userId, offer) {
        try {
            const pc = this.createPeerConnection(userId);
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            
            this.sendSignal(userId, {
                type: 'answer',
                answer: answer
            });
            
            console.log('📤 Sent answer to:', userId);
        } catch (error) {
            console.error('Error handling offer:', error);
        }
    }

    async handleAnswer(userId, answer) {
        try {
            const pc = this.peerConnections[userId];
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
                console.log('✅ Answer set for:', userId);
            }
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    }

    async handleIceCandidate(userId, candidate) {
        try {
            const pc = this.peerConnections[userId];
            if (pc) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
                console.log('🧊 ICE candidate added for:', userId);
            }
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
        }
    }

    async callUser(userId) {
        try {
            const pc = this.createPeerConnection(userId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            this.sendSignal(userId, {
                type: 'offer',
                offer: offer
            });
            
            console.log('📞 Called user:', userId);
        } catch (error) {
            console.error('Error calling user:', error);
        }
    }
}

// Initialize WebRTC
const webrtc = new WebRTCManager();
window.webrtc = webrtc;
console.log('✅ WebRTC loaded successfully!');