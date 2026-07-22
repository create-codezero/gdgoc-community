# GDGOC Community Hub 🚀

A full-stack, real-time web application built for Google Developer Groups On Campus (GDGOC) members[cite: 1, 3]. It brings community events, global real-time chat, AI study assistance, structured Q&A discussion forums, gamified leaderboards, and 1-on-1 mentorship bookings under a single roof[cite: 1, 3, 5].

**Live Demo:** [https://gdgoc-community.onrender.com/dashboard](https://gdgoc-community.onrender.com/dashboard)[cite: 3]

---

## 🌟 Key Features

### 1. 📅 Event Registration & Digital Passes
* **RSVP Workflow:** View featured events and reserve spots with a single click[cite: 1, 5].
* **Dynamic QR Pass Generation:** Generates a real-time QR ticket pass containing a unique user ticket string[cite: 1, 5].

### 2. 💬 Communication & AI Integration
* **Gemini AI Study Buddy:** Direct proxy integration with `gemini-1.5-flash` for answering technical questions, debugging code, and explaining algorithms[cite: 1, 3, 5].
* **Live Community Chat:** Real-time global messaging for instant interactions using Firebase Firestore sync[cite: 1, 5].

### 3. 🐛 Discussion Forum & Gamification
* **Categorized Posts:** Filter and search discussion threads by category (*Bug, Question, Showcase, General*) and keywords[cite: 1, 5].
* **YouTube Video Parsing:** Automatically detects YouTube URLs inside reply threads and embeds video solution frames[cite: 5].
* **Gamified Points & Leaderboard:**
  * 💬 **Text Solution:** `+1 pt`[cite: 1, 5]
  * 🎥 **YouTube Video Solution:** `+5 pts`[cite: 1, 5]
  * 👍 **Upvoting Answers:** `+2 pts` to answer author[cite: 1, 5]
  * ✅ **Marking as Solved:** `+10 pts` to verified solution, plus bonus points for participants[cite: 1, 5]
* **Real-time Rankings:** Live community leaderboard ranking developers by earned contribution points[cite: 1, 5].

### 4. 🧠 1-on-1 Technical Mentorship Hub
* **Slot Locking:** Prevents double-booking by locking 15-minute mentorship call slots in real-time across users[cite: 1, 5].

### 5. 🔐 Auth & Profiles
* **Google Authentication:** Secure popup-based login via Firebase Auth.
* **Developer Profiles:** Customizable tech domain tracks, GitHub profile integration, skills tags, and profile points display[cite: 1, 5].

---

## 🛠️ Tech Stack & Architecture

### Backend
* **Language:** Go (Golang)
* **Framework:** [Fiber v2](https://gofiber.io/) (High-performance Web Framework)
* **Templates:** Fiber HTML engine[cite: 3]
* **APIs:** 
  * Google Gemini Generative AI REST API (`gemini-1.5-flash`)[cite: 3]
  * Metered TURN credentials API endpoint[cite: 3]

### Frontend
* **Core:** HTML5, Modern Vanilla JS (ES6 Modules)[cite: 1, 4, 5]
* **Styling:** CSS3, FontAwesome icons, Custom standard UI design system[cite: 1, 2]
* **Services:** 
  * Firebase SDK v10 (Authentication & Firestore Realtime Database)[cite: 4, 5]
  * QRServer API for instant ticket pass generation[cite: 5]

---

## 📁 Project Structure

```text
├── main.go               # Fiber backend router, Gemini AI proxy & TURN credentials endpoints
├── public/
│   ├── css/
│   │   └── style.css     # Global UI styling & component theme definitions
│   └── js/
│       ├── app.js        # Firestore listeners, UI logic, gamification & video parser
│       └── auth.js       # Firebase Auth initializers & Google Provider handlers
└── views/
    ├── index.html        # Landing page with Google Login trigger
    └── dashboard.html    # Single-Page App layout (Events, Chat, Discussions, Mentorship, Profile)
```[cite: 1, 2, 3, 4, 5]

---

## 🚀 Getting Started

### Prerequisites
* **Go** (v1.18 or higher installed)
* **Firebase Project** with Authentication (Google Provider enabled) and Firestore Database
* **Gemini API Key** from Google AI Studio

### Environment Variables
Create a `.env` file in the root directory:

```env
GEMINI_API_KEY=your_gemini_api_key_here
METERED_API_KEY=your_metered_api_key_here
```[cite: 3]

### Local Setup & Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/your-username/gdgoc-community-hub.git](https://github.com/your-username/gdgoc-community-hub.git)
   cd gdgoc-community-hub