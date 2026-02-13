const myId = Math.floor(Math.random() * 9000) + 1000;
document.getElementById('my-id').innerText = myId;

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//${window.location.host}/ws/${myId}`);

let peerConnection;
let localStream;
let remoteUserId = null;

const iceConfig = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }]
};

// 1. Prepare Local Media
async function prepareMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: { echoCancellation: true, noiseSuppression: true } 
        });
        document.getElementById('localVideo').srcObject = localStream;
        return true;
    } catch (e) {
        alert("Camera/Mic access is required for calling.");
        return false;
    }
}

// 2. Initialize Peer Connection
function initPeer(targetId) {
    peerConnection = new RTCPeerConnection(iceConfig);
    
    // Add tracks to connection
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    // Handle incoming stream from peer
    peerConnection.ontrack = (event) => {
        const remoteVid = document.getElementById('remoteVideo');
        if (remoteVid.srcObject !== event.streams[0]) {
            remoteVid.srcObject = event.streams[0];
        }
    };

    // Send local network "candidates" to the other person
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            ws.send(JSON.stringify({ type: 'candidate', target_id: targetId, payload: event.candidate }));
        }
    };
}

// 3. User A clicks "Call"
async function initiateCall() {
    const targetId = document.getElementById('target-id').value;
    if (!targetId) return alert("Enter Peer ID");
    
    const ready = await prepareMedia();
    if (!ready) return;

    remoteUserId = targetId;
    // Just send a request first, don't start the peer connection yet
    ws.send(JSON.stringify({ type: 'call-request', target_id: targetId }));
    alert("Calling " + targetId + "...");
}

// 4. User B clicks "Accept"
async function acceptCall() {
    document.getElementById('incoming-overlay').classList.add('hidden');
    const ready = await prepareMedia();
    if (!ready) return;

    initPeer(remoteUserId);
    
    // Receiver creates the OFFER to start the handshake
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: 'offer', target_id: remoteUserId, payload: offer }));
    
    showCallUI();
}

// 5. Signal Handling (The Brain)
ws.onmessage = async (msg) => {
    const data = JSON.parse(msg.data);

    switch (data.type) {
        case 'call-request':
            remoteUserId = data.from;
            document.getElementById('caller-id').innerText = remoteUserId;
            document.getElementById('incoming-overlay').classList.remove('hidden');
            break;

        case 'offer':
            if (!peerConnection) initPeer(data.from);
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.payload));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: 'answer', target_id: data.from, payload: answer }));
            showCallUI();
            break;

        case 'answer':
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.payload));
            showCallUI();
            break;

        case 'candidate':
            if (peerConnection) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(data.payload));
            }
            break;

        case 'end-call':
            window.location.reload(); // Simplest way to clean up
            break;
    }
};

function showCallUI() {
    document.getElementById('setup-area').classList.add('hidden');
    document.getElementById('call-area').classList.remove('hidden');
}

function endCall() {
    ws.send(JSON.stringify({ type: 'end-call', target_id: remoteUserId }));
    window.location.reload();
}

function declineCall() {
    document.getElementById('incoming-overlay').classList.add('hidden');
}