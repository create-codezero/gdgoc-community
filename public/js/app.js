import { db, auth } from './auth.js'; 
import { 
    collection, 
    doc,        
    setDoc, 
    addDoc, 
    query, 
    orderBy, 
    onSnapshot,
    getDoc,
    where,
    getDocs,
    updateDoc,
    increment 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// --- DOM REFERENCES ---
const chatBox = document.getElementById('chatBox');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const aiInput = document.getElementById('aiInput');
const askAiBtn = document.getElementById('askAiBtn');
const aiResponse = document.getElementById('aiResponse');
const rsvpBtn = document.getElementById('rsvpBtn');
const ticketArea = document.getElementById('ticketArea');
const qrCodeImg = document.getElementById('qrCodeImg');
const ticketId = document.getElementById('ticketId');

// Profile DOM Elements
const profileName = document.getElementById('profileName');
const profileEmail = document.getElementById('profileEmail');
const profileTrack = document.getElementById('profileTrack');
const profileGithub = document.getElementById('profileGithub');
const profileSkills = document.getElementById('profileSkills');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const profilePoints = document.getElementById('profilePoints');

// Discussion DOM Elements
const createProblemBtn = document.getElementById('createProblemBtn');
const problemTitleInput = document.getElementById('problemTitleInput');
const problemCodeInput = document.getElementById('problemCodeInput');
const problemCategorySelect = document.getElementById('problemCategorySelect'); // Category dropdown
const searchProblemInput = document.getElementById('searchProblemInput'); // Filter input
const filterCategorySelect = document.getElementById('filterCategorySelect'); // Filter dropdown
const problemsList = document.getElementById('problemsList');
const leaderboardList = document.getElementById('leaderboardList');

const eventID = "solution-challenge-2026";

// Store problems locally for instant search/filtering without extra Firestore reads
let allProblemsCache = [];

onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    const profileDocRef = doc(db, "users", user.uid);

    try {
        const profileSnap = await getDoc(profileDocRef);
        if (!profileSnap.exists()) {
            await setDoc(profileDocRef, {
                uid: user.uid,
                name: user.displayName || "Developer",
                email: user.email,
                points: 0,
                createdAt: new Date()
            });
        } else {
            const profData = profileSnap.data();
            if (profData.points === undefined) {
                await updateDoc(profileDocRef, { points: 0 });
            }
        }
    } catch (err) {
        console.error("Error initializing user profile points:", err);
    }

    if (profileEmail) {
        profileEmail.value = user.email;
        if (profileName) profileName.value = user.displayName || "";
    }
    
    try {
        const profileSnap = await getDoc(profileDocRef);
        if (profileSnap.exists()) {
            const profData = profileSnap.data();
            if (profileTrack) profileTrack.value = profData.track || "";
            if (profileGithub) profileGithub.value = profData.github || "";
            if (profileSkills) profileSkills.value = profData.skills || "";
            if (profilePoints) profilePoints.innerText = profData.points || 0;
        }
    } catch (err) {
        console.error("Error loading user profile:", err);
    }

    const rsvpRecordId = `${user.uid}_${eventID}`;
    const rsvpDocRef = doc(db, "rsvps", rsvpRecordId);
    try {
        const rsvpSnap = await getDoc(rsvpDocRef);
        if (rsvpSnap.exists() && rsvpBtn) {
            rsvpBtn.innerText = "✓ Already RSVP'd";
            rsvpBtn.disabled = true;
            rsvpBtn.classList.replace('bg-amber-600', 'bg-gray-400');
            if (ticketArea && qrCodeImg && ticketId) {
                const qrPayloadString = `GDGOC-TICKET:${rsvpRecordId}`;
                qrCodeImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrPayloadString)}`;
                ticketId.innerText = `PASS ID: ${rsvpRecordId.substring(0, 12).toUpperCase()}...`;
                ticketArea.classList.remove('hidden');
            }
        }
    } catch (err) { console.error(err); }

    onSnapshot(collection(db, "mentorship_bookings"), (snapshot) => {
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const slotBtn = document.querySelector(`[data-mentor="${data.mentorName}"][data-slot="${data.scheduledTime}"]`);
            if (slotBtn) {
                if (data.studentUid === user.uid) {
                    slotBtn.innerText = "✓ Your Session";
                    slotBtn.classList.remove('bg-emerald-600', 'bg-red-600');
                    slotBtn.classList.add('bg-gray-500');
                } else {
                    slotBtn.innerText = "🚫 Slot Taken";
                    slotBtn.classList.remove('bg-emerald-600');
                    slotBtn.classList.add('bg-red-600', 'cursor-not-allowed');
                }
                slotBtn.disabled = true;
            }
        });
    });
});

if (saveProfileBtn) {
    saveProfileBtn.onclick = async () => {
        const user = auth.currentUser;
        if (!user) return alert("Please log in first!");

        saveProfileBtn.innerText = "Saving Profile...";
        saveProfileBtn.disabled = true;

        try {
            await updateDoc(doc(db, "users", user.uid), {
                name: profileName ? profileName.value.trim() : (user.displayName || "Developer"),
                track: profileTrack ? profileTrack.value : "",
                github: profileGithub ? profileGithub.value.trim() : "",
                skills: profileSkills ? profileSkills.value.trim() : "",
                updatedAt: new Date()
            });

            alert("Profile successfully updated!");
        } catch (error) {
            console.error("Profile Save Error: ", error);
            alert("Failed to update profile records.");
        } finally {
            saveProfileBtn.innerText = "Update GDGOC Profile";
            saveProfileBtn.disabled = false;
        }
    };
}

// --- GLOBAL CHAT ---
if (chatBox) {
    const q = query(collection(db, "global_chat"), orderBy("timestamp", "asc"));
    onSnapshot(q, (snapshot) => {
        chatBox.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const msgEl = document.createElement('div');

            if(data.email == auth.currentUser.email){
                msgEl.className = "mb-1 chat self";
                msgEl.innerHTML = `<div class="text"> ${data.text} </div>`;
            }else{
                
                msgEl.className = "mb-1 chat";
                msgEl.innerHTML = `<div class="chatUser">${data.user}:</div> <div class="text"> ${data.text} </div>`;
            }

            
            chatBox.appendChild(msgEl);
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });

    if (sendChatBtn) {
        sendChatBtn.onclick = async () => {
            const messageText = chatInput.value.trim();
            if (!messageText || !auth.currentUser) return;
            try {
                await addDoc(collection(db, "global_chat"), {
                    user: auth.currentUser.displayName || "Anonymous",
                    email: auth.currentUser.email,
                    text: messageText,
                    timestamp: new Date()
                });
                chatInput.value = '';
            } catch (e) { console.error(e); }
        };
    }
}

if (askAiBtn) {
    askAiBtn.onclick = async () => {
        const queryText = aiInput.value.trim();
        const user = auth.currentUser;
        if (!queryText) return;
        if (!user) return alert("Log in to consult the AI assistant!");

        aiResponse.classList.remove('hidden');
        aiResponse.innerText = "Thinking...";

        try {
            const response = await fetch('/api/ai-buddy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: queryText })
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error(`Backend Error (${response.status}):`, errText);
                throw new Error(`Server returned status ${response.status}. Check API Key quotas.`);
            }

            const data = await response.json();
            let reply = "";
            if (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
                reply = data.candidates[0].content.parts[0].text;
            } else if (data && data.reply) {
                reply = data.reply; 
            } else {
                throw new Error("Unexpected response structure from AI proxy.");
            }

            aiResponse.innerText = reply;

            await addDoc(collection(db, "users", user.uid, "ai_chats"), {
                prompt: queryText,
                response: reply,
                timestamp: new Date()
            });

        } catch (e) {
            console.error("AI Error:", e);
            aiResponse.innerText = "Error fetching AI response. Please check your network connection or try again later.";
        }
    };
}

if (rsvpBtn) {
    rsvpBtn.onclick = async () => {
        const user = auth.currentUser;
        if (!user) return;
        rsvpBtn.innerText = "Processing Ticket...";
        rsvpBtn.disabled = true;
        const rsvpRecordId = `${user.uid}_${eventID}`;
        try {
            await setDoc(doc(db, "rsvps", rsvpRecordId), {
                userId: user.uid, userName: user.displayName, userEmail: user.email, eventId: eventID, timestamp: new Date()
            });
            window.location.reload();
        } catch (error) { console.error(error); rsvpBtn.disabled = false; }
    };
}

document.addEventListener('click', async (e) => {
    if (e.target && e.target.classList.contains('book-mentor-btn')) {
        const user = auth.currentUser;
        if (!user) return alert("Please sign in before booking slots!");

        const btn = e.target;
        const mentorName = btn.getAttribute('data-mentor');
        const timeSlot = btn.getAttribute('data-slot');

        btn.innerText = "Checking availability...";
        btn.disabled = true;

        try {
            const doubleCheckQuery = query(
                collection(db, "mentorship_bookings"),
                where("mentorName", "==", mentorName),
                where("scheduledTime", "==", timeSlot)
            );
            const checkSnap = await getDocs(doubleCheckQuery);

            if (!checkSnap.empty) {
                alert("Sorry! This slot was just booked by another student.");
                btn.innerText = "🚫 Slot Taken";
                btn.classList.replace('bg-emerald-600', 'bg-red-600');
                return;
            }

            await addDoc(collection(db, "mentorship_bookings"), {
                studentUid: user.uid,
                studentName: user.displayName || "GDGOC Member",
                studentEmail: user.email,
                mentorName: mentorName,
                scheduledTime: timeSlot,
                timestamp: new Date()
            });

            alert(`Success! 15-min call confirmed with ${mentorName} at ${timeSlot}.`);
        } catch (error) {
            console.error("Mentorship Booking Fail: ", error);
            btn.innerText = "Book Session";
            btn.disabled = false;
        }
    }
});

function parseVideoAndText(inputStr) {
    const regExp = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = inputStr.match(regExp);
    
    if (match) {
        const videoId = match[1];
        const descriptionText = inputStr.replace(match[0], '').trim();
        return { isVideo: true, videoId, text: descriptionText };
    }
    
    return { isVideo: false, videoId: null, text: inputStr.trim() };
}

if (createProblemBtn) {
    createProblemBtn.onclick = async () => {
        const user = auth.currentUser;
        if (!user) return alert("Please log in to post a problem.");
        
        const title = problemTitleInput.value.trim();
        const code = problemCodeInput.value.trim();
        const category = problemCategorySelect ? problemCategorySelect.value : "General";

        if (!title || !code) return alert("Please fill out both the title and code/description.");

        try {
            await addDoc(collection(db, "problems"), {
                creatorUid: user.uid,
                creatorName: user.displayName || user.email || "Developer",
                title: title,
                code: code,
                category: category,
                status: "open",
                timestamp: new Date()
            });
            problemTitleInput.value = '';
            problemCodeInput.value = '';
            alert("Problem posted successfully!");
        } catch (error) {
            console.error("Error creating problem:", error);
            alert("Failed to post problem.");
        }
    };
}

function renderProblemsUI(problems) {
    if (!problemsList) return;
    problemsList.innerHTML = '';

    if (problems.length === 0) {
        problemsList.innerHTML = `<p class="text-gray-500 text-center py-4">No matching problems found.</p>`;
        return;
    }

    problems.forEach((problemData) => {
        const { id: problemId, ...problem } = problemData;
        const problemEl = document.createElement('div');
        problemEl.className = "problem-card p-4 border rounded-lg mb-4 bg-white shadow-sm hover:shadow transition-shadow";
        
        let htmlStr = `
            <div class="flex justify-between items-start mb-2">
                <div>
                    <span class="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800 mr-2">${problem.category || 'General'}</span>
                    <h3 class="font-bold text-xl inline text-gray-800">${problem.title}</h3>
                </div>
                <span class="text-xs font-bold px-2 py-1 rounded ${problem.status === 'solved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}">
                    ${problem.status.toUpperCase()}
                </span>
            </div>
            <p class="text-xs text-gray-500 mb-2">Posted by: <strong>${problem.creatorName}</strong></p>
            <pre class="bg-gray-900 text-gray-100 p-3 rounded text-sm overflow-x-auto"><code>${problem.code}</code></pre>
            
            <div class="mt-4 border-t pt-3">
                <h4 class="font-bold text-sm text-gray-700 mb-2">Discussion & Solutions:</h4>
                <div id="responses-${problemId}" class="mb-4 space-y-3"></div>
        `;

        if (problem.status === "open") {
            htmlStr += `
                <textarea id="replyText-${problemId}" placeholder="Write a solution or paste a YouTube video link + description..." class="w-full border p-2 text-sm rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"></textarea>
                <div class="mt-2 flex space-x-2">
                    <button class="submit-reply-btn bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-4 py-2 rounded transition-colors" data-id="${problemId}">Submit Response</button>
            `;
            
            if (auth.currentUser && auth.currentUser.uid === problem.creatorUid) {
                htmlStr += `
                    <button class="mark-solved-btn bg-green-600 hover:bg-green-700 text-white font-semibold text-sm px-4 py-2 rounded transition-colors" data-id="${problemId}">Mark as Solved</button>
                `;
            }
            htmlStr += `</div>`;
        }
        
        htmlStr += `</div>`;
        problemEl.innerHTML = htmlStr;
        problemsList.appendChild(problemEl);

        const responsesRef = query(collection(db, "problems", problemId, "responses"), orderBy("timestamp", "asc"));
        onSnapshot(responsesRef, (resSnap) => {
            const responseContainer = document.getElementById(`responses-${problemId}`);
            if (!responseContainer) return;
            responseContainer.innerHTML = '';
            
            if (resSnap.empty) {
                responseContainer.innerHTML = `<p class="text-xs text-gray-400 italic">No responses added yet.</p>`;
                return;
            }

            resSnap.forEach((resDoc) => {
                const response = resDoc.data();
                const responseId = resDoc.id;
                const upvotes = response.upvotes || 0;

                const resEl = document.createElement('div');
                resEl.className = "p-3 bg-gray-50 border border-gray-100 rounded-lg text-sm";
                
                let resHtml = `<div class="flex justify-between items-start mb-1">
                    <strong class="text-gray-800">${response.userName}:</strong>
                    <button class="upvote-btn text-xs bg-gray-200 hover:bg-blue-100 text-gray-700 hover:text-blue-700 px-2 py-0.5 rounded flex items-center gap-1 transition-colors" data-problem="${problemId}" data-response="${responseId}" data-author="${response.uid}">
                        👍 ${upvotes}
                    </button>
                </div>`;

                if (response.type === "video") {
                    resHtml += `
                        <div class="aspect-w-16 aspect-h-9 mb-2">
                            <iframe width="100%" height="280" src="https://www.youtube.com/embed/${response.videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen class="rounded"></iframe>
                        </div>`;
                }

                if (response.content) {
                    resHtml += `<p class="text-gray-700 mt-1">${response.content}</p>`;
                }

                resEl.innerHTML = resHtml;
                responseContainer.appendChild(resEl);
            });
        });
    });
}

if (problemsList) {
    const problemsQuery = query(collection(db, "problems"), orderBy("timestamp", "desc"));
    onSnapshot(problemsQuery, (snapshot) => {
        allProblemsCache = [];
        snapshot.forEach((docSnap) => {
            allProblemsCache.push({ id: docSnap.id, ...docSnap.data() });
        });
        filterAndRenderProblems();
    });
}

function filterAndRenderProblems() {
    const keyword = searchProblemInput ? searchProblemInput.value.toLowerCase().trim() : "";
    const selectedCategory = filterCategorySelect ? filterCategorySelect.value : "All";

    const filtered = allProblemsCache.filter((item) => {
        const matchesCategory = (selectedCategory === "All") || (item.category === selectedCategory);
        const matchesKeyword = item.title.toLowerCase().includes(keyword) || item.code.toLowerCase().includes(keyword);
        return matchesCategory && matchesKeyword;
    });

    renderProblemsUI(filtered);
}

if (searchProblemInput) searchProblemInput.oninput = filterAndRenderProblems;
if (filterCategorySelect) filterCategorySelect.onchange = filterAndRenderProblems;

document.addEventListener('click', async (e) => {
    const user = auth.currentUser;
    
    if (e.target && e.target.classList.contains('submit-reply-btn')) {
        if (!user) return alert("Please log in to respond!");
        
        const problemId = e.target.getAttribute('data-id');
        const replyInput = document.getElementById(`replyText-${problemId}`);
        const rawInput = replyInput.value.trim();
        
        if (!rawInput) return alert("Please enter a response or video link.");

        const parsed = parseVideoAndText(rawInput);
        const pointsEarned = parsed.isVideo ? 5 : 1;

        e.target.disabled = true;
        e.target.innerText = "Submitting...";

        try {
            await addDoc(collection(db, "problems", problemId, "responses"), {
                uid: user.uid,
                userName: user.displayName || user.email || "Developer",
                type: parsed.isVideo ? "video" : "text",
                content: parsed.text,
                videoId: parsed.videoId,
                upvotes: 0,
                timestamp: new Date()
            });

            await updateDoc(doc(doc(db, "users", user.uid)), {
                points: increment(pointsEarned)
            });

            replyInput.value = '';
            alert(`Response posted! You earned ${pointsEarned} point(s).`);
        } catch (error) {
            console.error("Reply Submission Error:", error);
            alert("Failed to submit response.");
        } finally {
            e.target.disabled = false;
            e.target.innerText = "Submit Response";
        }
    }

    if (e.target && e.target.classList.contains('upvote-btn')) {
        if (!user) return alert("Log in to upvote responses!");
        
        const problemId = e.target.getAttribute('data-problem');
        const responseId = e.target.getAttribute('data-response');
        const authorUid = e.target.getAttribute('data-author');

        if (user.uid === authorUid) return alert("You cannot upvote your own response.");

        e.target.disabled = true;

        try {
            const likeDocRef = doc(db, "problems", problemId, "responses", responseId, "likes", user.uid);
            const likeSnap = await getDoc(likeDocRef);

            if (likeSnap.exists()) {
                alert("You have already upvoted this response!");
                e.target.disabled = false;
                return;
            }

            await setDoc(likeDocRef, {
                likedAt: new Date()
            });

            await updateDoc(doc(db, "problems", problemId, "responses", responseId), {
                upvotes: increment(1)
            });

            await updateDoc(doc(db, "users", authorUid), {
                points: increment(2)
            });

            alert("Upvoted successfully!");

        } catch (err) {
            console.error("Upvote error:", err);
            alert("Failed to register upvote. Please try again.");
            e.target.disabled = false;
        }
    }

    if (e.target && e.target.classList.contains('mark-solved-btn')) {
        const problemId = e.target.getAttribute('data-id');
        e.target.disabled = true;
        e.target.innerText = "Processing...";

        try {
            const responsesRef = query(collection(db, "problems", problemId, "responses"), orderBy("timestamp", "asc"));
            const resSnap = await getDocs(responsesRef);
            
            let lastResponderUid = null;
            const participants = new Set();

            resSnap.forEach((docSnap) => {
                const data = docSnap.data();
                lastResponderUid = data.uid;
                participants.add(data.uid);
            });

            await updateDoc(doc(db, "problems", problemId), { status: "solved" });

            if (lastResponderUid) {
                await updateDoc(doc(db, "users", lastResponderUid), { points: increment(10) });
            }

            for (const uid of participants) {
                await updateDoc(doc(db, "users", uid), { points: increment(2) });
            }

            alert("Problem marked as solved! Points distributed.");
        } catch (error) {
            console.error("Error solving problem:", error);
            e.target.disabled = false;
            e.target.innerText = "Mark as Solved";
        }
    }
});

if (leaderboardList) {
    const boardQuery = query(collection(db, "users"), orderBy("points", "desc"));
    
    onSnapshot(boardQuery, (snapshot) => {
        leaderboardList.innerHTML = '';
        let rank = 1;

        if (snapshot.empty) {
            leaderboardList.innerHTML = `<p class="text-gray-400 text-sm text-center italic">No rankings available yet.</p>`;
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const pts = data.points || 0;

            let badge = `#${rank}`;
            if (rank === 1) badge = "🥇";
            if (rank === 2) badge = "🥈";
            if (rank === 3) badge = "🥉";

            const row = document.createElement('div');
            row.className = "flex justify-between items-center border-b p-2 text-sm";
            row.innerHTML = `
                <span class="truncate pr-2">
                    <strong class="text-gray-700 mr-1">${badge}</strong> 
                    ${data.name || data.email}
                </span>
                <span class="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">${pts} pts</span>
            `;
            leaderboardList.appendChild(row);
            rank++;
        });
    }, (error) => {
        console.error("Leaderboard Snapshot Error:", error);
    });
}
