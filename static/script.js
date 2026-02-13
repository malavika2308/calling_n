const myId = Math.floor(Math.random() * 9000) + 1000;
document.getElementById('my-id').innerText = myId;

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${window.location.host}/ws/${myId}`);

let peerConnection, localStream, remoteId;

const rtcConfig = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }]
};

// 1. Initiate Request
function requestCall() {
    remoteId = document.getElementById('target-id').value;
    if (!remoteId) return alert("Please enter an ID");
    ws.send(JSON.stringify({ type: 'call-request', target_id: remoteId }));
    alert("Calling " + remoteId + "...");
}

// 2. Setup Camera and Audio
async function startMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: { echoCancellation: true, noiseSuppression: true } 
        });
        document.getElementById('localVideo').srcObject = localStream;
        document.getElementById('setup-screen').classList.add('hidden');
        document.getElementById('call-screen').classList.remove('hidden');
    } catch (e) {
        alert("Could not access camera/mic. Please check permissions.");
    }
}

// 3. Handle Signaling
ws.onmessage = async (msg) => {
    const data = JSON.parse(msg.data);
    
    if (data.type === 'call-request') {
        remoteId = data.from;
        document.getElementById('caller-id').innerText = remoteId;
        document.getElementById('incoming-overlay').classList.remove('hidden');
    } 
    
    else if (data.type === 'accept-call') {
        // Initiator starts the actual handshake once the other person accepts
        await startMedia();
        createPeer();
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        ws.send(JSON.stringify({ type: 'offer', target_id: remoteId, payload: offer }));
    }

    else if (data.type === 'offer') {
        if (!peerConnection) createPeer();
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.payload));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: 'answer', target_id: data.from, payload: answer }));
    } 
    
    else if (data.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.payload));
    } 
    
    else if (data.type === 'candidate') {
        if (peerConnection) await peerConnection.addIceCandidate(new RTCIceCandidate(data.payload));
    }

    else if (data.type === 'end-call') {
        location.reload(); // Hard reset for production stability
    }
};

function createPeer() {
    peerConnection = new RTCPeerConnection(rtcConfig);
    
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = (e) => {
        document.getElementById('remoteVideo').srcObject = e.streams[0];
    };

    peerConnection.onicecandidate = (e) => {
        if (e.candidate) {
            ws.send(JSON.stringify({ type: 'candidate', target_id: remoteId, payload: e.candidate }));
        }
    };
}

async function acceptCall() {
    document.getElementById('incoming-overlay').classList.add('hidden');
    ws.send(JSON.stringify({ type: 'accept-call', target_id: remoteId }));
    await startMedia();
}

function declineCall() {
    document.getElementById('incoming-overlay').classList.add('hidden');
}

function hangUp() {
    ws.send(JSON.stringify({ type: 'end-call', target_id: remoteId }));
    location.reload();
}