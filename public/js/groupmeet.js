import { db, auth } from './auth.js';
import { 
    collection, doc, setDoc, getDoc, addDoc, onSnapshot, updateDoc, getDocs, deleteDoc 
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

// Default ICE servers to ensure localhost works even if Go server isn't running
let servers = {
    iceServers: [
        { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        }
    ]
};

// Use URL parameter if available (e.g., index.html?room=room1), fallback to default
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room') || "gdgoc-main-room"; 

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "/";
        return;
    }
    await initWebRTC();
});

async function initWebRTC() {
    try {
        // 1. Try fetching secure ICE servers from Go Backend, fallback silently if offline
        try {
            const res = await fetch('/turn-credentials');
            if (res.ok) {
                const data = await res.json();
                if (data.iceServers) servers = { iceServers: data.iceServers };
            }
        } catch (e) {
            console.warn("Could not reach Go TURN endpoint, using default ICE servers.");
        }

        // 2. Access Camera and Microphone
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;

        remoteStream = new MediaStream();
        remoteVideo.srcObject = remoteStream;

        createPeerConnection();

        localStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, localStream);
        });

        await handleSignaling(roomId);

    } catch (error) {
        console.error("Initialization Error:", error);
        alert("Failed to initialize WebRTC: " + error.message);
    }
}

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(servers);

    // Connection state logger to help debug
    peerConnection.oniceconnectionstatechange = () => {
        console.log("ICE Connection State:", peerConnection.iceConnectionState);
        if (remoteLabel) remoteLabel.innerText = `Status: ${peerConnection.iceConnectionState}`;
    };

    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track);
        });
        if (remoteLabel) remoteLabel.innerText = "Connected Peer";
    };

    peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            const roomRef = doc(db, "rooms", roomId);
            const candidateType = peerConnection.localDescription.type === "offer" ? "offerCandidates" : "answerCandidates";
            await addDoc(collection(roomRef, candidateType), event.candidate.toJSON());
        }
    };
}

// Helper function to wipe old Firestore documents from previous runs
async function cleanUpRoom(roomRef) {
    try {
        const answerCandidates = await getDocs(collection(roomRef, "answerCandidates"));
        answerCandidates.forEach(async (d) => await deleteDoc(d.ref));

        const offerCandidates = await getDocs(collection(roomRef, "offerCandidates"));
        offerCandidates.forEach(async (d) => await deleteDoc(d.ref));

        await deleteDoc(roomRef);
        console.log("Cleaned up stale room data.");
    } catch (e) {
        console.log("Room cleanup skipped or not needed:", e.message);
    }
}

async function handleSignaling(roomID) {
    const roomRef = doc(db, "rooms", roomID);
    const roomSnapshot = await getDoc(roomRef);

    let pendingCandidates = [];

    // Check if room exists AND has an active offer from less than 1 minute ago
    const isRoomActive = roomSnapshot.exists() && roomSnapshot.data().offer;

    if (!isRoomActive) {
        // --- CALLER / HOST FLOW ---
        console.log("Creating Meeting Room Offer as Host...");
        await cleanUpRoom(roomRef); // Clear any old leftover candidates

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        await setDoc(roomRef, { offer: { type: offer.type, sdp: offer.sdp } });

        // Listen for incoming Answer
        onSnapshot(roomRef, async (snapshot) => {
            const data = snapshot.data();
            if (!peerConnection.currentRemoteDescription && data && data.answer) {
                console.log("Received Answer from Callee");
                const answer = new RTCSessionDescription(data.answer);
                await peerConnection.setRemoteDescription(answer);
                
                // Drain candidate queue
                pendingCandidates.forEach(c => peerConnection.addIceCandidate(c));
                pendingCandidates = [];
            }
        });

        // Listen for Callee ICE Candidates
        onSnapshot(collection(roomRef, "answerCandidates"), (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                    const candidate = new RTCIceCandidate(change.doc.data());
                    if (peerConnection.currentRemoteDescription) {
                        await peerConnection.addIceCandidate(candidate);
                    } else {
                        pendingCandidates.push(candidate);
                    }
                }
            });
        });

    } else {
        // --- CALLEE / PEER JOIN FLOW ---
        console.log("Joining Existing Meeting Room as Callee...");
        const roomData = roomSnapshot.data();
        
        const offer = new RTCSessionDescription(roomData.offer);
        await peerConnection.setRemoteDescription(offer);

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        await updateDoc(roomRef, { answer: { type: answer.type, sdp: answer.sdp } });

        // Listen for Host ICE Candidates
        onSnapshot(collection(roomRef, "offerCandidates"), (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                    const candidate = new RTCIceCandidate(change.doc.data());
                    if (peerConnection.currentRemoteDescription) {
                        await peerConnection.addIceCandidate(candidate);
                    } else {
                        pendingCandidates.push(candidate);
                    }
                }
            });
        });
    }
}

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