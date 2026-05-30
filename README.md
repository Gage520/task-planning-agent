# Task Planning Agent

An intelligent personal task planning agent that perceives your goals, makes decisions, and creates actionable plans using LLM reasoning.

🎥 **Demo Video**: [Watch 2-minute demo]https://www.loom.com/share/c4d8dbeaf15540f1babc6eeb1e8cc2e8

🔗 **GitHub**: https://github.com/Gage520/task-planning-agent

---

## System Design

The agent follows a perception → reasoning → action → evaluation loop:

- **Perception** — reads natural language goal input from the user
- **Safety Guard** — LLM screens the goal before any planning begins
- **Planner (LLM)** — decomposes the goal into 3–6 concrete, prioritized steps
- **Action** — user marks steps complete; agent tracks progress
- **Evaluation** — LLM reviews progress and suggests plan adaptations
- **Memory** — past goals are stored and used to inform future plans

---

## Commit Checkpoints

| Version | Description |
|---------|-------------|
| v0.1 | init - basic goal input and React setup |
| v0.2 | feat - safety guard module added |
| v0.3 | feat - LLM planner generates step-by-step plan |
| v0.4 | feat - action module, user can mark steps complete |
| v0.5 | feat - evaluation and memory modules added |
| v1.0 | complete implementation with OpenRouter API |

---

## Tech Stack

- **Frontend**: React + Vite
- **LLM**: OpenRouter API (`poolside/laguna-m.1:free`)
- **Styling**: Inline CSS with DM Sans / DM Serif Display fonts

---

## Reproduction Instructions

### Prerequisites
- Node.js (v18 or above)
- An OpenRouter API key (free) — get one at https://openrouter.ai

### Setup

1. Clone the repository
```bash
git clone https://github.com/Gage520/task-planning-agent.git
cd task-planning-agent
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env` file in the root directory
```bash
VITE_OPENROUTER_API_KEY=your_openrouter_api_key_here
```

4. Start the development server
```bash
npm run dev
```

5. Open your browser at `http://localhost:5173`

---

## How to Use

1. Type a goal in the input box (e.g. *Prepare for a job interview next week*)
2. Click **Generate plan** — the agent safety-checks then breaks your goal into steps
3. Click each step to mark it complete
4. Click **Evaluate progress** to get AI feedback and suggestions
5. Click **New goal** to start over — previous goals are saved in memory

---

## Features

- 🛡️ **Safety mechanism** — unsafe goals are detected and blocked
- 🧠 **LLM reasoning** — goal decomposition with priority and time estimates
- ✅ **Action tracking** — interactive checklist with progress bar
- 🔄 **Adaptive evaluation** — agent reflects on progress and suggests next steps
- 💾 **Session memory** — past goals inform future planning