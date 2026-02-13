const myId = Math.floor(Math.random() * 9000) + 1000;
document.getElementById('my-id').innerText = myId;

const ws = new WebSocket(`wss://${window.location.host}/ws/${myId}`);
let peerConnection;
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

async function startCall() {
    const targetId = document.getElementById('target-id').value;
    setupPeer(targetId);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: 'offer', target_id: targetId, payload: offer }));
}

function setupPeer(targetId) {
    peerConnection = new RTCPeerConnection(config);
    
    // Add local stream
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            document.getElementById('localVideo').srcObject = stream;
            stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
        });

    // Handle remote stream
    peerConnection.ontrack = event => {
        document.getElementById('remoteVideo').srcObject = event.streams[0];
    };

    // Handle ICE Candidates
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            ws.send(JSON.stringify({ type: 'candidate', target_id: targetId, payload: event.candidate }));
        }
    };
}

ws.onmessage = async (msg) => {
    const data = JSON.parse(msg.data);
    if (!peerConnection) setupPeer(data.from);

    if (data.type === 'offer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.payload));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: 'answer', target_id: data.from, payload: answer }));
    } else if (data.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.payload));
    } else if (data.type === 'candidate') {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.payload));
    }
};