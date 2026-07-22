import { db, auth } from './auth.js';
import { 
    collection, doc, setDoc, getDoc, addDoc, onSnapshot, updateDoc 
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
let isHost = false;

// STUN + TURN configurations
let servers = {
    iceServers: [
        { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
        // Fallback TURN servers (UDP, TCP, and TLS)
        {
            urls: [
                'turn:openrelay.metered.ca:80',
                'turn:openrelay.metered.ca:443',
                'turn:openrelay.metered.ca:443?transport=tcp'
            ],
            username: 'openrelayproject',
            credential: 'openrelayproject'
        }
    ]
};

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
        // Attempt fetching custom TURN credentials from Go backend if available
        try {
            const res = await fetch('/turn-credentials');
            if (res.ok) {
                const data = await res.json();
                if (data.iceServers && data.iceServers.length > 0) {
                    servers = { iceServers: data.iceServers };
                    console.log("Loaded custom TURN credentials from backend");
                }
            }
        } catch (e) {
            console.warn("Go TURN backend offline, using default ICE servers.");
        }

        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;

        remoteStream = new MediaStream();
        remoteVideo.srcObject = remoteStream;

        await handleSignaling(roomId);

    } catch (error) {
        console.error("WebRTC Initialization Error:", error);
        alert("Camera/Mic access error: " + error.message);
    }
}

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(servers);

    peerConnection.oniceconnectionstatechange = () => {
        console.log("ICE Connection State:", peerConnection.iceConnectionState);
        if (remoteLabel) remoteLabel.innerText = `Status: ${peerConnection.iceConnectionState}`;
        
        if (peerConnection.iceConnectionState === 'failed') {
            console.warn("ICE Connection Failed. Network couldn't negotiate peer path.");
            peerConnection.restartIce();
        }
    };

    peerConnection.ontrack = (event) => {
        console.log("Received remote track:", event.track.kind);
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track);
        });
        if (remoteLabel) remoteLabel.innerText = "Connected Peer";
    };

    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
    });

    // Gather ICE Candidates
    peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            console.log(`Gathered Local Candidate (${event.candidate.type}):`, event.candidate.candidate);
            const roomRef = doc(db, "rooms", roomId);
            const candidateType = isHost ? "offerCandidates" : "answerCandidates";
            try {
                await addDoc(collection(roomRef, candidateType), event.candidate.toJSON());
            } catch (e) {
                console.error("Error writing ICE candidate to Firestore:", e);
            }
        } else {
            console.log("ICE Candidate gathering complete.");
        }
    };
}

// Safe helper to add candidate
async function safeAddIceCandidate(candidateData) {
    try {
        const candidate = new RTCIceCandidate(candidateData);
        await peerConnection.addIceCandidate(candidate);
        console.log(`Added Remote Candidate (${candidateData.type || 'unknown'})`);
    } catch (e) {
        console.warn("Skipped candidate addition:", e.message);
    }
}

async function handleSignaling(roomID) {
    const roomRef = doc(db, "rooms", roomID);
    const roomSnapshot = await getDoc(roomRef);

    let pendingCandidates = [];
    const roomExists = roomSnapshot.exists();
    const roomData = roomExists ? roomSnapshot.data() : null;

    if (!roomExists || !roomData.offer) {
        isHost = true;
        console.log("Creating Meeting Room Offer as Host...");

        createPeerConnection();

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        await setDoc(roomRef, { offer: { type: offer.type, sdp: offer.sdp } });

        onSnapshot(roomRef, async (snapshot) => {
            const data = snapshot.data();
            if (data && data.answer && !peerConnection.currentRemoteDescription) {
                console.log("Received Answer from Callee");
                const answer = new RTCSessionDescription(data.answer);
                await peerConnection.setRemoteDescription(answer);

                for (const candidateData of pendingCandidates) {
                    await safeAddIceCandidate(candidateData);
                }
                pendingCandidates = [];
            }
        });

        onSnapshot(collection(roomRef, "answerCandidates"), (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                    const candidateData = change.doc.data();
                    if (peerConnection.currentRemoteDescription) {
                        await safeAddIceCandidate(candidateData);
                    } else {
                        pendingCandidates.push(candidateData);
                    }
                }
            });
        });

    } else {
        isHost = false;
        console.log("Joining Existing Meeting Room as Peer...");

        createPeerConnection();

        const offer = new RTCSessionDescription(roomData.offer);
        await peerConnection.setRemoteDescription(offer);

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        await updateDoc(roomRef, { answer: { type: answer.type, sdp: answer.sdp } });

        onSnapshot(collection(roomRef, "offerCandidates"), (snapshot) => {
            snapshot.docChanges().forEach(async (change) => {
                if (change.type === 'added') {
                    const candidateData = change.doc.data();
                    if (peerConnection.currentRemoteDescription) {
                        await safeAddIceCandidate(candidateData);
                    } else {
                        pendingCandidates.push(candidateData);
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