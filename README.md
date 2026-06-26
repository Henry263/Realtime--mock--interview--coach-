# Real-Time Mock Interview Coach

**Real-Time Mock Interview Coach** is an AI-powered interview assistant that listens to interview questions in real-time and provides instant, confident answers you can say out loud. Perfect for live interviews on Teams, Zoom, or any video call platform.

---

## 🎯 Features

### Core Coaching Features
* **🎤 Real-Time Voice Recognition**: Captures interviewer questions via microphone
* **⚡ Instant AI Answers**: Get 2-12 sentence responses based on your length preference
* **🔄 Follow-Up Points**: Additional talking points if they dig deeper
* **🤖 Auto Question Detection**: AI filters your answers from interviewer questions

### Capture Modes
* **Auto Mode**: AI automatically detects questions vs your own answers
* **Push-to-Talk**: Hold SPACE when interviewer asks, release when done
* **Manual Mode**: Type questions directly for noisy environments

### Customization
* **📏 Answer Length**: Short (30-50 words) to Extra Long (200-300 words)
* **📄 Answer Format**: Conversational, Bullet Points, or Structured
* **🎯 Tone Detection**: Auto-detects Technical, Behavioral, System Design, or Coding questions
* **📋 Job Context**: Paste job requirements and CV for tailored answers

### Keyboard Shortcuts
* `ENTER` - Grab & submit buffered speech instantly
* `P` - Pause/Resume listening
* `SPACE` - Push-to-talk capture
* `M` - Cycle capture modes
* `X` - Clear buffer

---

## 🚀 Use Cases

* **Live Interview Coaching**: Get real-time help during actual interviews
* **Mock Interview Practice**: Practice with AI-generated responses
* **Interview Preparation**: Learn how to structure answers

---

## 🛠️ Tech Stack

* **Frontend**: Next.js 15, React 19, Tailwind CSS 4
* **Voice**: Web Speech API (Speech Recognition)
* **AI**: OpenAI GPT-4o-mini or Ollama (local)
* **Deployment**: Vercel / Localhost

---

## ⚙️ Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/buddha2042/ai-interview-agent.git
cd ai-interview-agent
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Create a `.env` file:

```bash
# AI Provider: 'openai' or 'ollama'
AI_PROVIDER=openai

# OpenAI Configuration
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4o-mini

# Ollama Configuration (if using local AI)
OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=mistral
```

### 4. Start the Development Server

```bash
npm run dev
```

### 5. Open the Coach

```
http://localhost:3040/coach
```

---

## 📖 How to Use

1. **Configure Settings** (optional): Add job requirements and CV for tailored answers
2. **Select Audio Source**: Microphone (for desktop apps) or Tab Audio (for browser calls)
3. **Click "Start Coaching"**: Allow microphone access
4. **Interview begins**: When interviewer asks a question, AI generates an answer
5. **Speak the answer**: Read the suggested response out loud
6. **Use follow-up**: If they ask more, use the follow-up point

### Tips for Best Results
* Use **speakers** (not headphones) so mic can hear the interviewer
* Press **P** to pause while you're answering
* Press **ENTER** to instantly grab buffered speech
* Select **Long** or **Extra Long** for detailed answers

---

## 🔌 API Routes

### `/api/coach` - Generate Coaching Response
```ts
POST /api/coach
{
  question: "Tell me about yourself",
  jobRequirements: "...",
  cv: "...",
  tone: "auto" | "technical" | "behavioral" | "system-design" | "coding",
  format: "prose" | "bullets" | "structured",
  answerLength: "short" | "medium" | "long" | "extra-long"
}
```

### `/api/coach/check-question` - Detect if Text is a Question
```ts
POST /api/coach/check-question
{
  text: "What is your experience with React?"
}
// Returns: { isQuestion: true }
```

---

## 📁 Project Structure

```
/app
  /coach
    page.tsx          # Real-time coaching interface
  /api
    /coach
      route.ts        # AI answer generation
      /check-question
        route.ts      # Question vs statement detection
  /lib
    ai-client.ts      # OpenAI/Ollama client
```
```

---


## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

---

##  License

MIT License. Feel free to use and modify this project.
