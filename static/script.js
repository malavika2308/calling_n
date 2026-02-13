const myId = Math.floor(Math.random() * 9000) + 1000;
document.getElementById('my-id').innerText = myId;

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${window.location.host}/ws/${myId}`);

let peerConnection, localStream, remoteId;

const rtcConfig = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
    ]
};

// --- Actions ---

function sendCallRequest() {
    remoteId = document.getElementById('target-id').value;
    if (!remoteId) return alert("Enter an ID first!");
    ws.send(JSON.stringify({ type: 'request', target_id: remoteId }));
    alert("Calling user " + remoteId + "...");
}

async function startLocalStream() {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('localVideo').srcObject = localStream;
    document.getElementById('setup').classList.add('hidden');
    document.getElementById('calling-area').classList.remove('hidden');
}

function createPeer(target) {
    peerConnection = new RTCPeerConnection(rtcConfig);
    
    // Add local tracks to the peer connection
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    // Listen for remote tracks
    peerConnection.ontrack = (event) => {
        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo.srcObject !== event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
            remoteVideo.play(); // Force play
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
    await startLocalStream();
    ws.send(JSON.stringify({ type: 'accepted', target_id: remoteId }));
}

// --- Signaling Logic ---

ws.onmessage = async (msg) => {
    const data = JSON.parse(msg.data);
    
    if (data.type === 'request') {
        remoteId = data.from;
        document.getElementById('caller-display').innerText = remoteId;
        document.getElementById('incoming-overlay').classList.remove('hidden');
    } 
    
    else if (data.type === 'accepted') {
        await startLocalStream();
        createPeer(remoteId);
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        ws.send(JSON.stringify({ type: 'offer', target_id: remoteId, payload: offer }));
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
        if (peerConnection) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.payload));
        }
    }

    else if (data.type === 'end') {
        location.reload();
    }
};

function terminateCall() {
    ws.send(JSON.stringify({ type: 'end', target_id: remoteId }));
    location.reload();
}

function declineCall() {
    document.getElementById('incoming-overlay').classList.add('hidden');
}