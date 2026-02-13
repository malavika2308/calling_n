const myId = Math.floor(Math.random() * 9000) + 1000;
document.getElementById('my-id').innerText = myId;

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${window.location.host}/ws/${myId}`);

let peerConnection;
let localStream;
let remoteUserId = null;

const iceConfig = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
    ]
};

async function startMedia() {
    localStream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: { echoCancellation: true, noiseSuppression: true } 
    });
    document.getElementById('localVideo').srcObject = localStream;
}

function createPeer(targetId) {
    remoteUserId = targetId;
    peerConnection = new RTCPeerConnection(iceConfig);

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = (e) => {
        document.getElementById('remoteVideo').srcObject = e.streams[0];
    };

    peerConnection.onicecandidate = (e) => {
        if (e.candidate) ws.send(JSON.stringify({ type: 'candidate', target_id: targetId, payload: e.candidate }));
    };

    // UI Toggle
    document.getElementById('setup-area').classList.add('hidden');
    document.getElementById('call-area').classList.remove('hidden');
}

async function initiateCall() {
    const targetId = document.getElementById('target-id').value;
    if(!targetId) return;
    await startMedia();
    ws.send(JSON.stringify({ type: 'call-request', target_id: targetId }));
}

async function acceptCall() {
    document.getElementById('incoming-overlay').classList.add('hidden');
    await startMedia();
    createPeer(remoteUserId);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: 'offer', target_id: remoteUserId, payload: offer }));
}

function endCall(isRemote = false) {
    // 1. Send signal to peer if we are the ones who clicked 'End'
    if (!isRemote && remoteUserId) {
        ws.send(JSON.stringify({ type: 'end-call', target_id: remoteUserId }));
    }

    // 2. Stop all camera/mic tracks
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }

    // 3. Close WebRTC connection
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    // 4. Reset UI
    document.getElementById('setup-area').classList.remove('hidden');
    document.getElementById('call-area').classList.add('hidden');
    document.getElementById('remoteVideo').srcObject = null;
    remoteUserId = null;
}

ws.onmessage = async (msg) => {
    const data = JSON.parse(msg.data);
    if (data.type === 'call-request') {
        remoteUserId = data.from;
        document.getElementById('caller-id').innerText = data.from;
        document.getElementById('incoming-overlay').classList.remove('hidden');
    } 
    else if (data.type === 'offer') {
        if (!peerConnection) createPeer(data.from);
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
        endCall(true); // Remote ended the call
    }
};

function declineCall() {
    document.getElementById('incoming-overlay').classList.add('hidden');
}