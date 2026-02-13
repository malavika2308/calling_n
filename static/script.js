let myId = Math.floor(Math.random() * 9000) + 1000;
document.getElementById('my-id').innerText = myId;

let ws;
let peerConnection, localStream, remoteId;
const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// --- WebSocket Connection with Auto-Reconnect ---
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws/${myId}`);

    ws.onopen = () => {
        console.log("Connected to Server");
        // Start Heartbeat (Ping every 30s to stay alive on Render)
        setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
        }, 30000);
    };

    ws.onmessage = async (msg) => {
        const data = JSON.parse(msg.data);
        if (data.type === 'request') {
            remoteId = data.from;
            document.getElementById('caller-display').innerText = remoteId;
            document.getElementById('incoming-overlay').classList.remove('hidden');
        } else if (data.type === 'accepted') {
            await startCallFlow();
        } else if (data.type === 'offer') {
            await handleOffer(data);
        } else if (data.type === 'answer') {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.payload));
        } else if (data.type === 'candidate') {
            if (peerConnection) await peerConnection.addIceCandidate(new RTCIceCandidate(data.payload));
        } else if (data.type === 'end') {
            location.reload();
        }
    };

    ws.onclose = () => {
        console.log("Socket closed. Retrying in 2s...");
        setTimeout(connectWebSocket, 2000);
    };
}

connectWebSocket();

// --- Production WebRTC Functions ---

async function sendCallRequest() {
    remoteId = document.getElementById('target-id').value;
    if (!remoteId) return alert("Enter an ID!");
    
    if (ws.readyState !== WebSocket.OPEN) {
        return alert("Connection lost. Please wait 2 seconds and try again.");
    }

    ws.send(JSON.stringify({ type: 'request', target_id: remoteId }));
    alert("Calling...");
}

async function startCallFlow() {
    await setupLocalMedia();
    createPeerConnection(remoteId);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: 'offer', target_id: remoteId, payload: offer }));
}

async function handleOffer(data) {
    if (!localStream) await setupLocalMedia();
    createPeerConnection(data.from);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.payload));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    ws.send(JSON.stringify({ type: 'answer', target_id: data.from, payload: answer }));
}

async function setupLocalMedia() {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('localVideo').srcObject = localStream;
    document.getElementById('setup').classList.add('hidden');
    document.getElementById('calling-area').classList.remove('hidden');
}

function createPeerConnection(target) {
    peerConnection = new RTCPeerConnection(rtcConfig);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = (event) => {
        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo.srcObject !== event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
        }
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            ws.send(JSON.stringify({ type: 'candidate', target_id: target, payload: event.candidate }));
        }
    };
}

async function acceptCall() {
    document.getElementById('incoming-overlay').classList.add('hidden');
    ws.send(JSON.stringify({ type: 'accepted', target_id: remoteId }));
}

function terminateCall() {
    ws.send(JSON.stringify({ type: 'end', target_id: remoteId }));
    location.reload();
}

function declineCall() { document.getElementById('incoming-overlay').classList.add('hidden'); }