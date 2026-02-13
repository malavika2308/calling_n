const myId = Math.floor(Math.random() * 9000) + 1000;
document.getElementById('my-id').innerText = myId;

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${window.location.host}/ws/${myId}`);

let peerConnection;
let localStream;
let incomingCallerId = null;

const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

// Step 1: Initialize Camera
async function initCamera() {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('localVideo').srcObject = localStream;
}

// Step 2: Set up WebRTC Connection
function setupPeer(targetId) {
    peerConnection = new RTCPeerConnection(config);
    
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = event => {
        document.getElementById('remoteVideo').srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            ws.send(JSON.stringify({ type: 'candidate', target_id: targetId, payload: event.candidate }));
        }
    };
}

// Step 3: Call Actions
async function initiateCall() {
    const targetId = document.getElementById('target-id').value;
    if (!targetId) return alert("Enter an ID");
    
    await initCamera();
    ws.send(JSON.stringify({ type: 'call-request', target_id: targetId }));
}

async function acceptCall() {
    document.getElementById('incoming-call-overlay').classList.add('hidden');
    await initCamera();
    setupPeer(incomingCallerId);
    
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: 'offer', target_id: incomingCallerId, payload: offer }));
}

function declineCall() {
    document.getElementById('incoming-call-overlay').classList.add('hidden');
}

// Step 4: Handle Signaling Messages
ws.onmessage = async (msg) => {
    const data = JSON.parse(msg.data);

    if (data.type === 'call-request') {
        incomingCallerId = data.from;
        document.getElementById('caller-id-display').innerText = incomingCallerId;
        document.getElementById('incoming-call-overlay').classList.remove('hidden');
    } 
    else if (data.type === 'offer') {
        if (!peerConnection) setupPeer(data.from);
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
};