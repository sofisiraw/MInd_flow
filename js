/* MindFlow — app.js
 *
 * AI COACH SETUP:
 * To enable the AI Coach tab, paste your Gemini API key below.
 * Get one free at https://aistudio.google.com/app/apikey
 *
 * IMPORTANT: This is a local prototype. In a real deployed app you should
 * NEVER expose your API key in frontend code — use a backend proxy instead.
 */
const GEMINI_API_KEY = "";

/* ─────────────────────────────────────────
   Tab navigation
───────────────────────────────────────── */
function showTab(id) {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  const tabs = ["today", "insights", "habits", "ai", "profile"];
  document.querySelectorAll(".tab")[tabs.indexOf(id)].classList.add("active");
}

/* ─────────────────────────────────────────
   Greeting based on time of day
───────────────────────────────────────── */
(function setGreeting() {
  const h = new Date().getHours();
  const el = document.getElementById("greeting-text");
  if (!el) return;
  if (h < 12) el.textContent = "Good morning";
  else if (h < 17) el.textContent = "Good afternoon";
  else el.textContent = "Good evening";
})();

/* ─────────────────────────────────────────
   Mood selection
───────────────────────────────────────── */
function selectMood(btn, val, label) {
  document.querySelectorAll(".mood-btn").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
  updateScore();
}

/* ─────────────────────────────────────────
   Checklist toggle
───────────────────────────────────────── */
function toggleCheck(el) {
  el.classList.toggle("done");
  updateScore();
}

/* ─────────────────────────────────────────
   Wellbeing score calculator
───────────────────────────────────────── */
function updateScore() {
  const moodBtn = document.querySelector(".mood-btn.selected");
  const moodVal = moodBtn
    ? parseInt(moodBtn.getAttribute("onclick").match(/selectMood\(this,(\d)/)[1])
    : 3;
  const energy = parseInt(document.getElementById("energy-sl").value);
  const stress = parseInt(document.getElementById("stress-sl").value);
  const doneCount = document.querySelectorAll(".check-item.done").length;

  const score = Math.round(
    (moodVal / 5) * 30 +
    (energy / 10) * 25 +
    ((10 - stress) / 10) * 25 +
    (doneCount / 6) * 20
  );

  document.getElementById("score-display").textContent = score;

  // Update SVG arc (circumference = 2π × 34 ≈ 213.6)
  const circ = 213.6;
  const offset = (circ - circ * score / 100).toFixed(1);
  document.getElementById("score-arc").setAttribute("stroke-dashoffset", offset);

  // Update label
  const label = document.getElementById("score-label");
  if (label) {
    if (score >= 75) label.textContent = "Doing well today";
    else if (score >= 55) label.textContent = "Steady progress";
    else if (score >= 35) label.textContent = "Needs some attention";
    else label.textContent = "Tough day — be kind to yourself";
  }
}

/* ─────────────────────────────────────────
   Habit toggle
───────────────────────────────────────── */
function toggleHabit(btn) {
  btn.classList.toggle("on");
  btn.classList.toggle("off");
}

/* ─────────────────────────────────────────
   Save journal entry
───────────────────────────────────────── */
function saveEntry() {
  const txt = document.getElementById("journal-entry").value.trim();
  if (!txt) {
    alert("Write something before saving!");
    return;
  }

  // Persist to localStorage
  const entries = JSON.parse(localStorage.getItem("mf_journal") || "[]");
  entries.unshift({ date: new Date().toISOString(), text: txt });
  localStorage.setItem("mf_journal", JSON.stringify(entries.slice(0, 90)));

  const btn = document.querySelector(".save-btn");
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="ti ti-check"></i> Saved!';
  btn.style.background = "var(--green)";
  setTimeout(() => {
    btn.innerHTML = orig;
    btn.style.background = "";
  }, 2200);
}

/* ─────────────────────────────────────────
   Add recommended habit
───────────────────────────────────────── */
function addHabit() {
  alert(
    "✅ Weekly intention-setting habit added!\n\n" +
    "You'll be reminded every Sunday at 4:00 PM to set intentions for the coming week.\n\n" +
    "Research shows this can reduce anticipatory anxiety by up to 35%."
  );
}

/* ─────────────────────────────────────────
   AI Coach — Gemini API
───────────────────────────────────────── */
const AI_SYSTEM_PROMPT = `You are a compassionate, evidence-based AI mental wellbeing coach integrated into MindFlow.

User profile:
- Primary goal: reduce anxiety
- Key stressors: work and sleep
- Streak: 7-day meditation streak
- Notable pattern: Sunday evening anxiety spikes (+40%)
- Late-night screen time correlates with poor sleep (-2.1 pts)
- Morning meditation strongly boosts mood (+45% on meditation days)
- Current wellbeing score: 75/100 with upward trend over 14 days
- Habit completion: mornings 83%, evenings 41%

Your role:
- Provide personalized, actionable, empathetic advice rooted in behavioral science, CBT, and positive psychology
- Acknowledge the user's specific patterns when relevant
- Keep responses concise (3-5 sentences or a short list) and warm
- Never diagnose medical or psychiatric conditions
- Gently recommend professional support when appropriate
- Celebrate wins and streaks when mentioned`;

// Conversation history for multi-turn context
const conversationHistory = [];

function askAI(question) {
  document.getElementById("ai-input").value = question;
  sendAIMsg();
}

async function sendAIMsg() {
  const input = document.getElementById("ai-input");
  const question = input.value.trim();
  if (!question) return;
  input.value = "";

  const box = document.getElementById("ai-chat-box");

  // User bubble
  const userDiv = document.createElement("div");
  userDiv.className = "ai-user-msg";
  userDiv.innerHTML = `<span class="ai-user-bubble">${escapeHtml(question)}</span>`;
  box.appendChild(userDiv);

  // Typing indicator
  const typDiv = document.createElement("div");
  typDiv.className = "ai-msg ai-typing";
  typDiv.innerHTML = '<div class="dot-anim"></div><div class="dot-anim"></div><div class="dot-anim"></div>';
  box.appendChild(typDiv);
  box.scrollTop = box.scrollHeight;

  // Fall back to demo if no key
  if (!GEMINI_API_KEY) {
    typDiv.remove();
    appendAIMsg(box, getDemoResponse(question));
    box.scrollTop = box.scrollHeight;
    return;
  }

  // Add user turn to history
  conversationHistory.push({ role: "user", parts: [{ text: question }] });

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: AI_SYSTEM_PROMPT }] },
          contents: conversationHistory,
          generationConfig: {
            maxOutputTokens: 600,
            temperature: 0.7
          }
        })
      }
    );

    const data = await res.json();
    typDiv.remove();

    if (data.error) {
      appendAIMsg(box, `Error: ${data.error.message}`);
      conversationHistory.pop(); // remove failed user turn
      box.scrollTop = box.scrollHeight;
      return;
    }

    const reply =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I'm here to help. Could you tell me a bit more about what you're experiencing?";

    // Add assistant turn to history for multi-turn context
    conversationHistory.push({ role: "model", parts: [{ text: reply }] });

    // Keep history from growing too long (last 20 turns)
    if (conversationHistory.length > 20) conversationHistory.splice(0, 2);

    appendAIMsg(box, reply);
  } catch (err) {
    typDiv.remove();
    conversationHistory.pop();
    appendAIMsg(box, "I'm having trouble connecting right now. Please check your API key and internet connection.");
    console.error("Gemini API error:", err);
  }

  box.scrollTop = box.scrollHeight;
}

function appendAIMsg(box, text) {
  const div = document.createElement("div");
  div.className = "ai-msg";
  div.innerHTML = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");
  div.innerHTML = "<p>" + div.innerHTML + "</p>";
  box.appendChild(div);
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* Demo responses when no API key is set */
function getDemoResponse(question) {
  const q = question.toLowerCase();
  if (q.includes("sunday") || q.includes("anxi")) {
    return "**Sunday anxiety is a very common pattern** — often called the \"Sunday Scaries.\" Your data shows a consistent 40% stress spike on Sunday evenings, likely tied to anticipating the week ahead.\n\nA powerful intervention is a short \"weekly preview\" ritual at 4pm Sunday: spend 10 minutes writing down your top 3 priorities and one thing you're looking forward to. This shifts your brain from worry mode into planning mode, which is much calmer. Your meditation habit would pair beautifully with this.";
  }
  if (q.includes("habit") || q.includes("helping")) {
    return "Your data tells a clear story: **morning meditation is your highest-impact habit**. On days you meditate your mood averages 4.2 vs 2.9 — a 45% lift. Your hydration habit (12-day streak!) is also building strong momentum.\n\nThe area with the most growth potential is your evening routine, currently at 41% completion. Even improving that to 60% could meaningfully raise your overall wellbeing score.";
  }
  if (q.includes("breath") || q.includes("stress")) {
    return "Here's **box breathing** — clinically shown to calm the nervous system within 2 minutes:\n\n1. Inhale slowly for 4 counts\n2. Hold for 4 counts\n3. Exhale for 4 counts\n4. Hold for 4 counts\n\nRepeat 4–6 cycles. It activates your parasympathetic nervous system, directly counteracting the stress response. Try it next Sunday evening when your stress typically peaks.";
  }
  if (q.includes("sleep")) {
    return "Your data shows a clear link: **phone use after 10pm drops your sleep quality score by 2.1 points** on average. Blue light suppresses melatonin, but the bigger culprit is often the cognitive stimulation of scrolling.\n\nThe highest-leverage change: set a phone curfew at 9:45pm and replace the last 30 minutes with something analog — reading, light stretching, or your gratitude practice. You already have that habit at 71% — stacking them together would reinforce both.";
  }
  return "That's a great question to reflect on. Based on your recent patterns, I'd suggest focusing on the connection between your morning habits and your overall mood — your data shows a strong positive correlation there. What specific aspect of your wellbeing would you most like to improve this week?";
}

/* ─────────────────────────────────────────
   Init
───────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  updateScore();
});


/* =========================
   BEHAVIORAL INTELLIGENCE LAYER
   ========================= */

function loadState() {
  return JSON.parse(localStorage.getItem("bh_system") || JSON.stringify({
    moods: [],
    habits: [],
    journal: [],
    sessions: []
  }));
}

function saveState(state) {
  localStorage.setItem("bh_system", JSON.stringify(state));
}

/* Capture mood */
function logMood(value) {
  const state = loadState();
  state.moods.push(value);
  saveState(state);
}

/* Capture habit completion */
function logHabit(done) {
  const state = loadState();
  state.habits.push({ done, time: Date.now() });
  saveState(state);
}

/* Analyze behavior */
function analyzeBehavior() {
  const state = loadState();
  const insights = [];

  const avgMood =
    state.moods.reduce((a,b)=>a+b,0) / (state.moods.length || 1);

  if (avgMood < 3) insights.push("Low mood trend detected");

  const failures = state.habits.filter(h => !h.done).length;
  if (failures > 3) insights.push("Habit inconsistency detected");

  const late = state.sessions.filter(s => s.hour >= 23).length;
  if (late > 3) insights.push("Late-night activity pattern detected");

  return insights;
}

/* Recommendations */
function generateRecommendations(insights) {
  const recs = [];

  insights.forEach(i => {
    if (i.includes("mood")) recs.push("Take a short walk or rest break today.");
    if (i.includes("Habit")) recs.push("Reduce habits to 1 key focus.");
    if (i.includes("Late-night")) recs.push("Avoid screen use before sleep.");
  });

  return recs;
}

/* Render insights into UI if element exists */
function renderBehavior() {
  const box = document.getElementById("behavior-insights");
  if (!box) return;

  const insights = analyzeBehavior();
  const recs = generateRecommendations(insights);

  box.innerHTML = `
    <h3>Behavioral Insights</h3>
    <ul>${insights.map(i=>`<li>${i}</li>`).join("")}</ul>
    <h3>Recommendations</h3>
    <ul>${recs.map(r=>`<li>${r}</li>`).join("")}</ul>
  `;
}

document.addEventListener("DOMContentLoaded", renderBehavior);
