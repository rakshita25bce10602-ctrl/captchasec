# CAPTCHASEC – Intelligent Human Verification

A zero-dependency, client-side demonstration prototype of an advanced, layered CAPTCHA and anti-bot verification system built with vanilla HTML5, CSS3, and JavaScript (ES6+). Zero external frameworks, zero build steps, zero external telemetry transmission.

---

## 📌 Project Overview

**CAPTCHASEC** is an intelligent human-vs-bot verification system designed to evaluate real-time biometric kinematics, environmental attributes, typing cadences, and anti-scraping traps. Rather than relying on rigid binary puzzle checks, CAPTCHASEC employs a multi-tiered defense-in-depth model that computes an explainable 0–100 composite risk score in under 10 milliseconds.

---

## 🚨 Problem Statement

Traditional CAPTCHA mechanisms often suffer from two critical flaws:
1. **Poor User Experience:** Complex OCR puzzles, ambiguous image classifications, and repetitive challenges frustrate legitimate human users.
2. **Vulnerability to Automated Bypass:** Scripted bots, headless browser automation (Puppeteer, Selenium), and OCR models can easily solve static text or simple checkboxes when no behavioural telemetry is evaluated.

CAPTCHASEC solves this by analyzing **how** a user interacts with the challenge (pointer trajectory curvature, keystroke cadence standard deviation, response latency, clipboard paste events, and hidden honeypot fields) rather than relying solely on the final answer.

---

## ✨ Key Features

* **Dynamic Procedural Challenge:** Canvas-based rendering with sine-wave warping, glyph rotation, font permutation, interference noise, and audio playback (Web Speech API).
* **Multi-Signal Behavioural Telemetry:** Real-time tracking of cursor curvature ratios, velocity standard deviations, inter-keystroke variance, clipboard paste events, and focus/blur anomalies.
* **Invisible Honeypot Anti-Bot Layer:** Accessible off-screen decoy trap field (`name="website"`, `tabindex="-1"`, `aria-hidden="true"`, non-`display:none`) that catches automated crawlers.
* **Explainable Composite Risk Scoring:** Transparent 0–100 risk calculation with 10 weighted signals and configurable strictness thresholds (Low, Medium, High).
* **Interactive Bot Simulations:** Four simulation profiles (Instant Bot, Slow Bot, Pasting Bot, and Human-like Bot) with an animated virtual cursor and Bézier curve kinematics.
* **Live Verification Analytics & Event Log:** Real-time metrics panel, animated SVG risk ring, detailed signal breakdown, and timestamped event timeline.
* **Verification Audit History & Sparkline:** Persistent `localStorage` table recording the last 10 verification attempts paired with an inline SVG trend chart.
* **100% Client-Side Privacy:** All biometric kinematics and evaluations execute purely inside the browser sandbox; zero personal data or telemetry is transmitted over the network.
* **Responsive & Accessible UI:** Full dark/light theme toggle, accessible ARIA attributes, semantic keyboard navigation, and mobile-first responsive layout.

---

## 🏗️ Architecture & Verification Pipeline

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            CAPTCHASEC PIPELINE                               │
├──────────────────────────────────────────────────────────────────────────────┤
│ 1. Dynamic Challenge    ──> Canvas procedural noise, wave warp & rotation   │
│ 2. Telemetry Capture    ──> Pointer kinematics, inter-key cadence, focus    │
│ 3. Form-Abuse Traps     ──> Decoy honeypot, rapid refresh bursts, paste     │
│ 4. Composite Scoring    ──> Multi-weighted 0-100 risk index evaluation      │
│ 5. Frictionless Outcome ──> Human (≤30), Suspicious (31–70), Bot (>70)      │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎨 CAPTCHA Generation

* **Procedural Glyphs:** Random 5–6 alphanumeric character generation avoiding ambiguous characters (`0`, `O`, `I`, `l`, `1`).
* **Wave Distortion:** Horizontal sine-wave pixel displacement algorithms distort glyph contours without compromising human readability.
* **Noise & Interference:** Multi-layered canvas noise dots and Bézier interference lines prevent trivial OCR extraction.
* **Expiry & Lifecycle:** 2-minute countdown timer with automatic regeneration on expiry, 5-attempt limit, and 30-second cooldown lockouts.
* **Audio Synthesis:** Built-in accessibility speech synthesizer using the Web Speech API with spaced character enunciation.

---

## 🖱️ Behaviour Analysis

CAPTCHASEC continuously samples user interactions during challenge completion:
* **Pointer Kinematics:** Computes the path curvature ratio ($\text{Path Length} / \text{Direct Distance}$) and velocity standard deviation ($\sigma$). Straight lines ($\text{ratio} \approx 1.0$) and constant speeds indicate robotic automation.
* **Keystroke Cadence:** Measures inter-key intervals ($\mu$) and standard deviations ($\sigma$). Low variance ($\sigma < 20\text{ms}$) signals mechanical typing rhythms, while 0ms with zero key events indicates direct DOM injection.
* **Clipboard Interception:** Detects synthetic paste events into the challenge input.
* **Session & Focus Tracking:** Monitors window blur/focus anomalies and tab visibility duration.

---

## 🍯 Honeypot Detection Layer

Automated form-filling crawlers automatically scrape and populate all available `<input>` tags in the DOM. CAPTCHASEC deploys a realistic honeypot trap:

### 1. DOM Structure & Accessibility
* **Decoy Naming:** Uses `name="website"` and `id="form-website-field"` rather than obvious keywords like `"honeypot"`.
* **Keyboard Inaccessible:** `tabindex="-1"` ensures keyboard users tabbing through form controls bypass it completely.
* **Assistive Technology Hidden:** `aria-hidden="true"` prevents screen readers from announcing it.
* **Enabled:** The field is not disabled, ensuring automated scripts interact with it.

```html
<div class="hp-field" aria-hidden="true">
  <label for="form-website-field" tabindex="-1">Website</label>
  <input
    type="text"
    id="form-website-field"
    name="website"
    autocomplete="off"
    tabindex="-1"
    aria-hidden="true"
    placeholder="https://example.com"
  />
</div>
```

### 2. CSS Technique
The honeypot is rendered off-screen with zero clipping and zero opacity rather than using `display: none` or `visibility: hidden`:

```css
.hp-field {
  position: absolute !important;
  left: -9999px !important;
  top: -9999px !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
  opacity: 0 !important;
  pointer-events: none !important;
}
```

### 3. Risk-Scoring Integration
* **Empty Field:** Evaluates as a normal human signal (`0 risk points`, displays `PASS`).
* **Populated Field:** Triggers a strong bot signal (`+30 risk points`, displays `BOT SIGNAL`), compounds with timing and kinematics into the final risk score.

---

## 📊 Composite Risk Scoring

| Weight | Signal Category | Evaluation Rationale |
| :---: | :--- | :--- |
| **20 pts** | **Solve Time** | Impossibly fast ($<0.8\text{s}$) indicates automated execution; humans require 2.5–15s |
| **15 pts** | **Mouse Absence** | Submitting without any pointer movement is a strong bot signal |
| **5 pts** | **Path Curvature** | Bots move in straight lines ($\text{ratio} < 1.05$); humans produce organic curves |
| **5 pts** | **Speed Variance** | Robotic constant velocity ($\sigma < 0.05$) vs natural human acceleration |
| **10 pts** | **Typing Speed** | Sub-50ms inter-key speed or direct zero-keystroke value injection |
| **10 pts** | **Typing Rhythm** | Fixed mechanical rhythm intervals ($\sigma < 20\text{ms}$) indicate script timers |
| **10 pts** | **Paste Interception** | Pasting the challenge code directly indicates automated clipboard fill |
| **30 pts** | **Honeypot Trap** | Populating the hidden decoy input strongly indicates an automated scraper |
| **5 pts** | **Form Abuse / Failures** | Rapid challenge refreshes ($\ge 3$ in $<10\text{s}$) and repeated wrong attempts |
| **5 pts** | **Environment Flags** | `navigator.webdriver = true`, headless user agent strings, and automation APIs |
| **Total** | **115 pts raw (clamped 0–100)** | Multi-layer compounded risk index |

### Strictness Thresholds
* **Low (Lenient):** Human $\le 40$, Suspicious $41–75$, Bot $> 75$
* **Medium (Default):** Human $\le 30$, Suspicious $31–70$, Bot $> 70$
* **High (Strict):** Human $\le 20$, Suspicious $21–60$, Bot $> 60$

---

## 🤖 Bot Simulations

1. **⚡ Instant Bot:** Direct DOM/memory value assignment with 0ms latency, populates the honeypot field, synthetic submit $\rightarrow$ Score: `80 / 100` (`BOT`).
2. **🤖 Slow Bot:** Linear cursor movement with constant velocity, fixed mechanical 220ms typing cadence, leaves honeypot clean $\rightarrow$ Score: `20–25 / 100` (`SUSPICIOUS` / flagged kinematics).
3. **📋 Pasting Bot:** Scrapes input, populates honeypot trap, triggers clipboard paste event $\rightarrow$ Score: `75 / 100` (`BOT`).
4. **👤 Human-like Bot:** Cubic Bézier trajectory with micro-jitter tremor, variable typing cadence with micro-pauses, leaves honeypot clean $\rightarrow$ Score: `0 / 100` (`HUMAN`).

---

## 📈 Analytics & Verification History

* **Live Metrics:** Real-time cards for Response Time, Paste Events, Attempt Counter, and Honeypot Status (`PASS` / `BOT SIGNAL`).
* **Detection Timeline:** Timestamped audit log (`[HH:MM:SS]`) tracking interaction milestones and risk updates.
* **Audit History Table:** Local persistence of the last 10 verification records with mode badges, solve times, risk indices, and outcomes.
* **SVG Trend Chart:** Visual sparkline graphing risk score trajectories over time.

---

## 🛠️ Technology Stack

* **Markup:** Semantic HTML5 with WAI-ARIA compliance.
* **Styling:** Vanilla CSS3 (Custom Properties / CSS Variables, Grid, Flexbox, Animations).
* **Scripting:** Modular Vanilla JavaScript (ES6+ Closures / Revealing Module Pattern).
* **Storage:** `localStorage` for theme, strictness configuration, and audit history.
* **External Dependencies:** None (Zero NPM packages, zero frameworks, zero external CDNs required for runtime).

---

## 📁 Folder Structure

```
captchasec/
├── index.html          ← Single-page application markup & UI layout
├── css/
│   ├── tokens.css      ← Design tokens (color palette, spacing, typography)
│   ├── base.css        ← Reset, base typography, and dark/light modes
│   └── components.css  ← UI components, animations, honeypot styles
├── js/
│   ├── main.js         ← Application lifecycle bootstrap
│   ├── captcha.js      ← Canvas generator, wave distortion, and validation
│   ├── behaviour.js    ← Telemetry capture (mouse, cadence, honeypot, paste)
│   ├── scoring.js      ← Multi-signal composite risk evaluation engine
│   ├── simulation.js   ← Bot evasion simulation & virtual cursor engine
│   ├── history.js      ← LocalStorage audit log & SVG sparkline trend chart
│   ├── storage.js      ← Local persistence abstraction layer
│   └── ui.js           ← Theme manager, settings drawer, and timeline logger
├── assets/             ← Static assets, icons, and graphics
└── README.md           ← Complete technical documentation
```

---

## 💻 Local Setup & How to Run

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/rakshita25bce10602-ctrl/captchasec.git
   cd captchasec
   ```

2. **Open in Browser:**
   * Open `index.html` directly in Google Chrome, Mozilla Firefox, Microsoft Edge, or Safari.
   * Or use any local static server:
     ```bash
     npx serve .
     # or python -m http.server 8000
     ```

---

## ⚠️ Limitations

* **Client-Side Sandbox Nature:** Because all evaluations occur client-side for demonstration and privacy purposes, an adversary with full control over the local execution environment (e.g. reverse-engineering JavaScript variables) could manipulate local variables.
* **Production Recommendation:** Commercial production deployments should combine browser-side behavioral signals with backend cryptographic attestation (HMAC-signed session tokens and server-side verification).

---

## 🚀 Future Improvements

* **WebAssembly (WASM) Proof-of-Work:** Integrate optional client-side computational puzzle hashing for high-risk clients.
* **Device Gyroscope & Accelerometer Telemetry:** Add mobile device orientation dynamics for enhanced mobile verification.
* **Backend JWT Attestation:** Reference Node.js/Python server implementation for token signature validation.

---

## 📸 Screenshots

*(To capture and view live application screenshots, open `index.html` in your browser and run the interactive bot simulations).*
