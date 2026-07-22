import { db, auth } from './auth.js';
import { 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    addDoc, 
    onSnapshot, 
    updateDoc,  // <-- Changed from updateCode to updateDoc
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

// Public STUN servers for NAT traversal
const servers = {
    iceServers: [
        { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
    ]
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
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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
        alert("Could not access camera or microphone. Please check permissions.");
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
    };

    // Gather ICE candidates and sync through Firestore
    peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            const roomRef = doc(db, "rooms", roomId);
            const candidateType = peerConnection.localDescription.type === "offer" ? "offerCandidates" : "answerCandidates";
            await addDoc(collection(roomRef, candidateType), event.candidate.toJSON());
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
                    const candidate = new RTCIceCandidate(change.doc.data());
                    await peerConnection.addIceCandidate(candidate);
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
                    const candidate = new RTCIceCandidate(change.doc.data());
                    await peerConnection.addIceCandidate(candidate);
                }
            });
        });
    }
}

// --- CONTROLS TOGGLE ---
if (camBtn) {
    camBtn.onclick = () => {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            camBtn.classList.toggle('bg-red-600', !videoTrack.enabled);
        }
    };
}

if (micBtn) {
    micBtn.onclick = () => {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            micBtn.classList.toggle('bg-red-600', !audioTrack.enabled);
        }
    };
}