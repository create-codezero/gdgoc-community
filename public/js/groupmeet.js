import { db, auth } from './auth.js';
import { 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    addDoc, 
    onSnapshot, 
    updateDoc, 
    deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const remoteLabel = document.getElementById('remoteLabel');
const camBtn = document.getElementById('camBtn');
const micBtn = document.getElementById('micBtn');

let localStream = null;
let remoteStream = null;
let peerConnection = null;

// Advanced ICE Server Configuration (STUN + UDP/TCP 443 TURN Fallback for Cloud Hosting)
const servers = {
    iceServers: [
        { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        }
    ],
    iceCandidatePoolSize: 10,
};

// Hardcoded default room for demonstration (can be parameterized via URL search params)
const roomId = "gdgoc-main-room"; 

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "/";
        return;
    }
    await initWebRTC();
});

async function initWebRTC() {
    try {
        // 1. Get local user media (Camera & Microphone)
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: { ideal: 1280 }, height: { ideal: 720 } }, 
            audio: true 
        });
        localVideo.srcObject = localStream;

        remoteStream = new MediaStream();
        remoteVideo.srcObject = remoteStream;

        createPeerConnection();

        // Add local tracks to peer connection
        localStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, localStream);
        });

        // Setup Signaling channel in Firestore
        await handleSignaling(roomId);

    } catch (error) {
        console.error("Error accessing media devices or initializing WebRTC:", error);
        alert("Could not access camera or microphone. Please check browser permissions and ensure you are using HTTPS.");
    }
}

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(servers);

    // Listen for remote track arrivals
    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track);
        });
        remoteLabel.innerText = "Connected Peer";
        remoteLabel.classList.replace('bg-black/60', 'bg-emerald-600/80');
    };

    // Gather ICE candidates and sync through Firestore
    peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            const roomRef = doc(db, "rooms", roomId);
            const candidateType = peerConnection.localDescription && peerConnection.localDescription.type === "offer" ? "offerCandidates" : "answerCandidates";
            try {
                await addDoc(collection(roomRef, candidateType), event.candidate.toJSON());
            } catch (err) {
                console.error("Error writing ICE candidate to Firestore:", err);
            }
        }
    };

    peerConnection.onconnectionstatechange = () => {
        console.log("WebRTC Connection State:", peerConnection.connectionState);
        if (peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'failed') {
            remoteLabel.innerText = "Peer Disconnected";
            remoteLabel.classList.replace('bg-emerald-600/80', 'bg-red-600/80');
        }
    };
}

async function handleSignaling(roomID) {
    const roomRef = doc(db, "rooms", roomID);
    const roomSnapshot = await getDoc(roomRef);

    if (!roomSnapshot.exists() || !roomSnapshot.data().offer) {
        // --- CALLER / HOST FLOW ---
        console.log("Creating Meeting Room Offer...");
        const roomData = {};
        
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        roomData.offer = { type: offer.type, sdp: offer.sdp };
        await setDoc(roomRef, roomData);

        // Listen for remote Answer creation
        onSnapshot(roomRef, async (snapshot) => {
            const data = snapshot.data();
            if (!peerConnection.currentRemoteDescription && data && data.answer) {
                const answer = new RTCSessionDescription(data.answer);
                await peerConnection.setRemoteDescription(answer);
            }
        });

        // Listen for remote ICE candidates
        onSnapshot(collection(roomRef, "answerCandidates"), (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                    try {
                        const candidate = new RTCIceCandidate(change.doc.data());
                        await peerConnection.addIceCandidate(candidate);
                    } catch (e) {
                        console.error("Error adding received answer ICE candidate", e);
                    }
                }
            });
        });

    } else {
        // --- CALLEE / PEER JOIN FLOW ---
        console.log("Joining Existing Meeting Room...");
        const roomData = roomSnapshot.data();
        
        const offer = new RTCSessionDescription(roomData.offer);
        await peerConnection.setRemoteDescription(offer);

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        await updateDoc(roomRef, { answer: { type: answer.type, sdp: answer.sdp } });

        // Listen for caller ICE candidates
        onSnapshot(collection(roomRef, "offerCandidates"), (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                    try {
                        const candidate = new RTCIceCandidate(change.doc.data());
                        await peerConnection.addIceCandidate(candidate);
                    } catch (e) {
                        console.error("Error adding received offer ICE candidate", e);
                    }
                }
            });
        });
    }
}

// --- CONTROLS TOGGLE ---
if (camBtn) {
    camBtn.onclick = () => {
        if (!localStream) return;
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            camBtn.classList.toggle('bg-red-600', !videoTrack.enabled);
            camBtn.innerText = videoTrack.enabled ? "Toggle Camera" : "Camera Off";
        }
    };
}

if (micBtn) {
    micBtn.onclick = () => {
        if (!localStream) return;
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            micBtn.classList.toggle('bg-red-600', !audioTrack.enabled);
            micBtn.innerText = audioTrack.enabled ? "Toggle Mute" : "Unmute";
        }
    };
}