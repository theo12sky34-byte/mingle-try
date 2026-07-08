# Skymingle Signaling Server

Minimal WebSocket broadcast signaling server used by Skymingle for cross-device WebRTC signaling.

## Requirements
- Node.js (14+)
- npm

## Install
From the `skymingle-signaling-server` folder run:

```powershell
npm.cmd install
```

> Note: On Windows PowerShell, running `npm` may be blocked by script execution policy. Use `npm.cmd` as shown, or open Command Prompt (cmd.exe) and run `npm install`.

## Run
```powershell
npm.cmd start
```

The server listens on port 3000 by default and will log:

```
Signaling server listening on ws://localhost:3000
```

## Notes
- This server simply broadcasts JSON messages from one client to all others. It is not production hardened.
- For production use: secure with TLS/WSS, add authentication/authorization, rate-limiting, and consider a TURN server for NAT traversal.
 
## TURN server guidance

For reliable media across restrictive NATs and corporate networks, Skymingle clients should use a TURN server. A TURN server relays media when direct peer-to-peer connectivity fails.

Quick options:
- Use a hosted TURN provider (e.g., Twilio, Xirsys, Coturn-as-a-service) and supply the `urls`, `username`, and `credential` in the RTCPeerConnection `iceServers` config.
- Self-host Coturn (open-source) on a public IP, enable TLS, and configure long-term credentials.

Example `iceServers` entry (client-side):

```js
const pc = new RTCPeerConnection({
	iceServers: [
		{ urls: ['stun:stun.l.google.com:19302'] },
		{ urls: ['turn:YOUR_TURN_HOST:3478'], username: 'user', credential: 'pass' }
	]
});
```

Security note: Do not hardcode TURN credentials in public repositories. Use environment-based secrets on your server or short-lived credentials from your TURN provider.

