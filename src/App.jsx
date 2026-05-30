import { useState, useRef, useEffect } from "react";

const API_URL = "/api/openrouter/api/v1/chat/completions"

async function callClaude(messages, systemPrompt) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "poolside/laguna-m.1:free",
      max_tokens: 1000,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages
      ],
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices[0].message.content ?? "";
}

const SAFETY_PROMPT = `You are a safety filter for a task planning assistant.
Determine if the user's goal is safe and constructive.
Reply ONLY with JSON: {"safe": true/false, "reason": "brief reason if unsafe"}`;

async function safetyCheck(goal) {
  const text = await callClaude(
    [{ role: "user", content: `Is this goal safe? "${goal}"` }],
    SAFETY_PROMPT
  );
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return { safe: true };
  }
}

const PLANNER_PROMPT = `You are a smart personal task planning agent.
When given a goal, break it into 3-6 concrete, actionable steps.
Each step should be a single clear task a person can do.
Reply ONLY with a JSON array of step objects:
[{"id":1,"title":"...","description":"...","duration":"...","priority":"high|medium|low","status":"pending"}]
No preamble, no markdown fences.`;

async function generatePlan(goal, memory) {
  const contextMsg = memory.length
    ? `Previous plans for context:\n${memory.map((m) => `- Goal: "${m.goal}", steps: ${m.stepCount}`).join("\n")}\n\nNew goal: ${goal}`
    : goal;
  const text = await callClaude(
    [{ role: "user", content: contextMsg }],
    PLANNER_PROMPT
  );
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

const EVALUATOR_PROMPT = `You are an intelligent plan evaluator.
Given a goal and its current steps with statuses, provide:
1. A brief progress summary (1-2 sentences)
2. One concrete suggestion to improve or adapt the plan
Reply ONLY with JSON: {"summary":"...","suggestion":"..."}`;

async function evaluatePlan(goal, steps) {
  const stepsSummary = steps
    .map((s) => `${s.status === "done" ? "done" : "pending"} - ${s.title}`)
    .join(", ");
  const text = await callClaude(
    [{ role: "user", content: `Goal: "${goal}"\nSteps: ${stepsSummary}` }],
    EVALUATOR_PROMPT
  );
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; }
  .agent-root { min-height: 100vh; background: #f7f5f0; padding: 32px 16px 64px; color: #1a1917; }
  .agent-header { text-align: center; margin-bottom: 40px; }
  .agent-header h1 { font-family: 'DM Serif Display', serif; font-size: 2.6rem; font-weight: 400; color: #1a1917; line-height: 1.1; }
  .agent-header h1 em { font-style: italic; color: #7c5cbb; }
  .agent-header p { margin-top: 8px; font-size: 0.9rem; font-weight: 300; color: #6b6860; }
  .card { background: #fff; border: 1px solid #e8e5de; border-radius: 16px; padding: 28px; max-width: 680px; margin: 0 auto 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); }
  .card-label { font-size: 0.7rem; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: #9c9589; margin-bottom: 12px; }
  .goal-input { width: 100%; border: 1.5px solid #e8e5de; border-radius: 10px; padding: 14px 16px; font-family: 'DM Sans', sans-serif; font-size: 1rem; font-weight: 300; color: #1a1917; background: #fafaf8; resize: none; outline: none; transition: border-color 0.2s; min-height: 80px; }
  .goal-input:focus { border-color: #7c5cbb; background: #fff; }
  .goal-input::placeholder { color: #b8b4ac; }
  .btn-row { display: flex; gap: 10px; margin-top: 14px; }
  .btn-primary { background: #1a1917; color: #f7f5f0; border: none; border-radius: 8px; padding: 12px 24px; font-family: 'DM Sans', sans-serif; font-size: 0.85rem; font-weight: 500; cursor: pointer; transition: background 0.15s; display: flex; align-items: center; gap: 8px; }
  .btn-primary:hover { background: #2e2c29; }
  .btn-primary:disabled { background: #c8c4bc; cursor: not-allowed; }
  .btn-secondary { background: transparent; color: #6b6860; border: 1.5px solid #e8e5de; border-radius: 8px; padding: 12px 20px; font-family: 'DM Sans', sans-serif; font-size: 0.85rem; cursor: pointer; transition: border-color 0.15s; }
  .btn-secondary:hover { border-color: #9c9589; color: #1a1917; }
  .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
  .status-badge { display: inline-flex; align-items: center; gap: 6px; font-size: 0.75rem; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; padding: 4px 12px; border-radius: 20px; margin-top: 12px; }
  .badge-loading { background: #f0ecff; color: #7c5cbb; }
  .step-list { display: flex; flex-direction: column; gap: 10px; }
  .step-item { display: flex; align-items: flex-start; gap: 14px; padding: 14px 16px; border: 1.5px solid #e8e5de; border-radius: 10px; background: #fafaf8; cursor: pointer; transition: border-color 0.15s, background 0.15s; text-align: left; width: 100%; }
  .step-item:hover { border-color: #c8c4bc; background: #f7f5f0; }
  .step-item.done { border-color: #b8e6cf; background: #f4fdf8; }
  .step-checkbox { width: 22px; height: 22px; border: 2px solid #c8c4bc; border-radius: 6px; flex-shrink: 0; margin-top: 2px; display: flex; align-items: center; justify-content: center; font-size: 13px; color: #fff; transition: background 0.15s, border-color 0.15s; }
  .step-item.done .step-checkbox { background: #2ecc71; border-color: #2ecc71; }
  .step-title { font-size: 0.9rem; font-weight: 500; color: #1a1917; margin-bottom: 3px; }
  .step-item.done .step-title { color: #9c9589; text-decoration: line-through; }
  .step-desc { font-size: 0.8rem; font-weight: 300; color: #6b6860; line-height: 1.5; }
  .step-meta { display: flex; gap: 8px; margin-top: 6px; align-items: center; }
  .priority-dot { width: 6px; height: 6px; border-radius: 50%; }
  .priority-high { background: #e74c3c; }
  .priority-medium { background: #f39c12; }
  .priority-low { background: #2ecc71; }
  .step-duration { font-size: 0.72rem; font-weight: 300; color: #9c9589; }
  .progress-bar-wrap { background: #ece9e2; border-radius: 6px; height: 6px; overflow: hidden; margin: 16px 0 8px; }
  .progress-bar-fill { height: 100%; background: #7c5cbb; border-radius: 6px; transition: width 0.5s ease; }
  .progress-label { display: flex; justify-content: space-between; font-size: 0.75rem; color: #9c9589; font-weight: 300; }
  .eval-card { background: #faf8ff; border: 1.5px solid #e0d8f4; border-radius: 10px; padding: 16px; margin-top: 16px; }
  .eval-summary { font-size: 0.85rem; font-weight: 300; color: #2e2c29; line-height: 1.6; margin-bottom: 10px; }
  .eval-suggestion { font-size: 0.8rem; color: #7c5cbb; font-weight: 400; line-height: 1.5; }
  .memory-list { display: flex; flex-direction: column; gap: 8px; }
  .memory-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #fafaf8; border: 1px solid #e8e5de; border-radius: 8px; cursor: pointer; transition: border-color 0.15s; font-size: 0.82rem; width: 100%; }
  .memory-item:hover { border-color: #7c5cbb; }
  .memory-goal { color: #2e2c29; font-weight: 400; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60%; }
  .memory-meta { font-size: 0.72rem; color: #9c9589; font-weight: 300; }
  .error-msg { background: #fff0f0; border: 1.5px solid #f5c6c6; border-radius: 8px; padding: 12px 16px; font-size: 0.82rem; color: #c0392b; margin-top: 12px; }
  .spinner { display: inline-block; width: 13px; height: 13px; border: 2px solid rgba(124,92,187,0.3); border-top-color: #7c5cbb; border-radius: 50%; animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .goal-display { font-family: 'DM Serif Display', serif; font-size: 1.3rem; font-weight: 400; color: #1a1917; margin-bottom: 4px; font-style: italic; }
  .info-card { font-size: 0.8rem; font-weight: 300; color: #6b6860; line-height: 1.7; }
  .info-card strong { font-weight: 500; color: #2e2c29; }
`;

export default function TaskPlanningAgent() {
  const [goal, setGoal] = useState("");
  const [phase, setPhase] = useState("input");
  const [safetyResult, setSafetyResult] = useState(null);
  const [steps, setSteps] = useState([]);
  const [evaluation, setEvaluation] = useState(null);
  const [memory, setMemory] = useState([]);
  const [error, setError] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    const existing = document.getElementById("tpa-style");
    if (!existing) {
      const el = document.createElement("style");
      el.id = "tpa-style";
      el.textContent = css;
      document.head.appendChild(el);
    }
  }, []);

  const completedCount = steps.filter((s) => s.status === "done").length;
  const progress = steps.length ? Math.round((completedCount / steps.length) * 100) : 0;

  async function handlePlan() {
    if (!goal.trim()) return;
    setError("");
    setSafetyResult(null);
    setEvaluation(null);
    setPhase("checking");
    try {
      const safety = await safetyCheck(goal.trim());
      setSafetyResult(safety);
      if (!safety.safe) {
        setPhase("input");
        return;
      }
    } catch (e) {
      setError("Safety check failed: " + e.message);
      setPhase("input");
      return;
    }
    setPhase("planning");
    try {
      const newSteps = await generatePlan(goal.trim(), memory);
      setSteps(newSteps);
      setPhase("ready");
    } catch (e) {
      setError("Planning failed: " + e.message);
      setPhase("input");
    }
  }

  function toggleStep(id) {
    setSteps((prev) =>
      prev.map((s) => s.id === id ? { ...s, status: s.status === "done" ? "pending" : "done" } : s)
    );
    setEvaluation(null);
  }

  async function handleEvaluate() {
    if (!steps.length) return;
    setPhase("evaluating");
    try {
      const ev = await evaluatePlan(goal.trim(), steps);
      setEvaluation(ev);
    } catch (e) {
      setError("Evaluation failed: " + e.message);
    }
    setPhase("ready");
  }

  function handleReset() {
    if (goal.trim() && steps.length) {
      setMemory((prev) => [
        { goal: goal.trim(), stepCount: steps.length, completedCount, date: new Date().toLocaleDateString() },
        ...prev.slice(0, 4),
      ]);
    }
    setGoal("");
    setSteps([]);
    setSafetyResult(null);
    setEvaluation(null);
    setError("");
    setPhase("input");
  }

  function loadMemory(item) {
    setGoal(item.goal);
    setSteps([]);
    setSafetyResult(null);
    setEvaluation(null);
    setError("");
    setPhase("input");
  }

  const isLoading = phase === "checking" || phase === "planning" || phase === "evaluating";

  return (
    <div className="agent-root">
      <div className="agent-header">
        <h1>Task <em>Planning</em> Agent</h1>
        <p>Intelligent goal decomposition · Adaptive planning · Safety-aware</p>
      </div>

      <div className="card">
        <div className="card-label">Your goal</div>
        {phase === "ready" || phase === "evaluating" ? (
          <div className="goal-display">"{goal}"</div>
        ) : (
          <textarea
            ref={textareaRef}
            className="goal-input"
            placeholder="e.g. Prepare for a job interview at a tech company next week"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            disabled={isLoading}
          />
        )}
        {safetyResult && !safetyResult.safe && (
          <div className="error-msg">This goal was flagged: {safetyResult.reason}. Please revise your goal.</div>
        )}
        {error && <div className="error-msg">{error}</div>}
        {phase === "checking" && (
          <div className="status-badge badge-loading"><span className="spinner" /> Safety check…</div>
        )}
        {phase === "planning" && (
          <div className="status-badge badge-loading"><span className="spinner" /> Building your plan…</div>
        )}
        <div className="btn-row">
          {phase === "input" && (
            <button className="btn-primary" onClick={handlePlan} disabled={!goal.trim()}>
              Generate plan
            </button>
          )}
          {(phase === "ready" || phase === "evaluating") && (
            <>
              <button className="btn-primary" onClick={handleEvaluate} disabled={phase === "evaluating"}>
                {phase === "evaluating" ? <><span className="spinner" style={{borderTopColor:"#fff",borderColor:"rgba(255,255,255,0.3)"}} /> Evaluating…</> : "Evaluate progress"}
              </button>
              <button className="btn-secondary" onClick={handleReset}>New goal</button>
            </>
          )}
          {(phase === "checking" || phase === "planning") && (
            <button className="btn-secondary" disabled>Working…</button>
          )}
        </div>
      </div>

      {steps.length > 0 && (
        <div className="card">
          <div className="card-label">Action plan</div>
          <div className="progress-bar-wrap">
            <div className="progress-bar-fill" style={{ width: progress + "%" }} />
          </div>
          <div className="progress-label">
            <span>{completedCount} of {steps.length} done</span>
            <span>{progress}%</span>
          </div>
          <div className="step-list" style={{ marginTop: 16 }}>
            {steps.map((step) => (
              <button
                key={step.id}
                className={`step-item${step.status === "done" ? " done" : ""}`}
                onClick={() => toggleStep(step.id)}
              >
                <div className="step-checkbox">{step.status === "done" && "✓"}</div>
                <div style={{ flex: 1 }}>
                  <div className="step-title">{step.title}</div>
                  <div className="step-desc">{step.description}</div>
                  <div className="step-meta">
                    <div className={`priority-dot priority-${step.priority}`} />
                    <span className="step-duration">{step.duration} · {step.priority} priority</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {evaluation && (
            <div className="eval-card">
              <div className="card-label" style={{ marginBottom: 8 }}>Agent evaluation</div>
              <div className="eval-summary">{evaluation.summary}</div>
              <div className="eval-suggestion">→ {evaluation.suggestion}</div>
            </div>
          )}
        </div>
      )}

      {memory.length > 0 && (
        <div className="card">
          <div className="card-label">Recent goals (memory)</div>
          <div className="memory-list">
            {memory.map((m, i) => (
              <button key={i} className="memory-item" onClick={() => loadMemory(m)}>
                <span className="memory-goal">{m.goal}</span>
                <span className="memory-meta">{m.completedCount}/{m.stepCount} · {m.date}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ borderStyle: "dashed", boxShadow: "none" }}>
        <div className="card-label">How this agent works</div>
        <div className="info-card">
          <strong>Perception</strong> — reads your natural language goal ·{" "}
          <strong>Safety guard</strong> — screens goals before planning ·{" "}
          <strong>Planning (LLM)</strong> — AI decomposes the goal into steps ·{" "}
          <strong>Action</strong> — you mark steps complete ·{" "}
          <strong>Evaluation</strong> — agent reviews progress and suggests adaptations ·{" "}
          <strong>Memory</strong> — past goals inform future plans
        </div>
      </div>
    </div>
  );
}