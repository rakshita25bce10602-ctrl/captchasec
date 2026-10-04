# CAPTCHASEC – Intelligent Human Verification

CAPTCHASEC is a browser-based demonstration of layered human-versus-bot verification.

Instead of relying only on a traditional CAPTCHA, the system combines a dynamically generated CAPTCHA with behavioural signals, honeypot detection, interaction analysis, and risk scoring to estimate whether a verification attempt is likely to come from a human or an automated client.

The project is implemented as a static frontend using HTML, CSS, and vanilla JavaScript.

> **Project type:** Educational / security demonstration  
> **Architecture:** Client-side static web application  
> **Data processing:** Local browser processing  
> **Frameworks:** None  
> **Build tools:** None  

---

## Features

### Dynamic CAPTCHA

* Random CAPTCHA generation
* Canvas-based rendering
* Character rotation and variation
* Noise and interference
* CAPTCHA refresh
* Case-insensitive validation
* Expiration timer
* Failed-attempt handling
* Audio CAPTCHA playback (Web Speech API)
* Success and failure states

### Behaviour Analysis

The application observes interaction signals during the verification process, including:

* Time taken to solve
* Mouse movement
* Mouse movement before submission
* Keyboard interaction
* Keystroke timing
* Paste events
* Focus and blur events
* Tab visibility
* CAPTCHA refresh behaviour
* Failed attempts
* Browser automation indicators where supported

These signals are used as indicators rather than proof of malicious activity.

### Honeypot Detection

CAPTCHASEC includes a hidden form field designed to detect automated form completion.

Normal users should leave the field untouched.

If the field is populated, the event contributes to the verification risk score.

The honeypot is only one detection layer and does not independently determine whether an attempt is a bot.

### Risk Scoring

The system combines multiple signals into a 0–100 risk score.

| Risk Score | Classification |
| ---------- | -------------- |
| 0–30       | Human          |
| 31–70      | Suspicious     |
| 71–100     | Bot            |

The analytics interface displays the resulting score and relevant detection signals.

### Bot Simulation

The project includes demonstration modes that simulate different automated behaviours:

* Instant Bot
* Slow Bot
* Pasting Bot
* Human-like Bot

The simulations allow users to observe how different interaction patterns affect the risk score.

### Live Verification Analytics

The dashboard displays information such as:

* Response time
* Attempts
* Paste events
* Honeypot status
* Risk score
* Risk classification
* Detection signals
* Event timeline

### Verification History

Recent verification attempts are stored locally in the browser.

The history records information such as:

* Timestamp
* Verification result
* Risk score
* Origin mode
* Solve time
* Visual risk trend sparkline

The interface provides history management and clearing functionality.

### Settings

The project includes configurable verification behaviour, including:

* Detection strictness
* Detection-layer controls
* Theme preferences

---

## How It Works

The verification process follows a layered pipeline:

```text
CAPTCHA Challenge
       ↓
User Interaction
       ↓
Behaviour Capture
       ↓
Honeypot / Automation Signals
       ↓
Risk Scoring
       ↓
Human / Suspicious / Bot
       ↓
Verification Decision
```

The system does not depend on a single signal. Multiple observations are combined to produce an overall risk estimate.

---

## Risk Signals

Examples of signals used by the system include:

| Signal             | Example indication             |
| ------------------ | ------------------------------ |
| Solve time         | Extremely fast completion      |
| Mouse behaviour    | Limited or unnatural movement  |
| Keyboard behaviour | Unusual typing pattern         |
| Paste event        | CAPTCHA pasted directly        |
| Honeypot           | Hidden field populated         |
| Failed attempts    | Repeated incorrect submissions |
| Refresh frequency  | Excessive CAPTCHA refreshes    |
| Visibility         | Suspicious tab/focus behaviour |
| WebDriver          | Browser automation indicator   |

The exact contribution of each signal is determined by the scoring implementation in `js/scoring.js`.

---

## Technology Stack

* HTML5
* CSS3
* Vanilla JavaScript
* HTML Canvas API
* Web Speech API (Audio CAPTCHA)
* Browser LocalStorage
* Web APIs for interaction and environment signals

No frontend framework or build system is required.

---

## Project Structure

```text
captchasec/
├── index.html
├── css/
│   ├── tokens.css
│   ├── base.css
│   └── components.css
├── js/
│   ├── main.js
│   ├── captcha.js
│   ├── behaviour.js
│   ├── scoring.js
│   ├── simulation.js
│   ├── history.js
│   ├── storage.js
│   └── ui.js
├── assets/
└── README.md
```

### JavaScript modules

**main.js**  
Application entry point and module coordination.

**captcha.js**  
CAPTCHA generation, rendering, validation, expiration, audio playback, and refresh behaviour.

**behaviour.js**  
Collects browser interaction signals during verification.

**scoring.js**  
Combines detection signals into the final risk score.

**simulation.js**  
Provides automated bot-behaviour demonstrations.

**history.js**  
Manages verification history records, data table rendering, and the SVG risk trend chart.

**storage.js**  
Handles local verification history, settings, and persistent browser data.

**ui.js**  
Handles interface state, theme behaviour, detection settings drawer, event timeline logging, and DOM-related helpers.

---

## Running Locally

No installation or build process is required.

### Option 1 — Open directly

Open:

```text
index.html
```

in a modern browser.

### Option 2 — Local development server

A simple local server can also be used:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

---

## Browser Compatibility

CAPTCHASEC is designed for modern browsers that support:

* HTML5 Canvas
* ES6+ JavaScript
* LocalStorage
* Pointer / Mouse Events
* Keyboard Events
* Page Visibility API

Some environment-detection signals may behave differently between browsers.

---

## Privacy

CAPTCHASEC is designed as a client-side demonstration.

Behaviour signals and verification history are processed/stored locally by the browser unless the implementation is later extended with a backend.

The project does not intentionally collect passwords, authentication credentials, or unnecessary personal information.

---

## Security Limitations

This project is an educational demonstration and should **not** be treated as a production-grade security system.

Client-side CAPTCHA and behaviour detection can be inspected, modified, or bypassed by a sufficiently capable attacker.

Browser signals such as `navigator.webdriver` are indicators, not definitive proof of automation.

Similarly, honeypot detection is only one layer and can be bypassed by bots that understand the page structure.

A production implementation would require server-side validation, rate limiting, abuse monitoring, secure session handling, telemetry controls, and additional anti-automation techniques.

---

## Future Improvements

Potential future improvements include:

* Server-side verification
* Adaptive CAPTCHA difficulty
* Machine-learning-based behavioural classification
* Stronger browser and automation fingerprint analysis
* Rate limiting
* IP / session reputation
* Device-risk analysis
* Alternative accessible challenge types
* Secure backend telemetry
* Real-time security monitoring
* Advanced anomaly detection

---

## Educational Objective

CAPTCHASEC demonstrates how multiple weak signals can be combined into a layered verification system instead of relying solely on a traditional CAPTCHA.

The project is intended to help demonstrate concepts related to:

* Web security
* Human-computer interaction
* Bot detection
* Behavioural analysis
* Risk scoring
* Frontend security
* Client-side JavaScript

---

## License

This project is intended for educational and demonstration purposes.

There is currently no standalone LICENSE file in this repository.

---

## Project Status

**Status:** Active educational prototype

The system is continuously being improved with additional CAPTCHA, behavioural-analysis, anti-bot, analytics, and demonstration features.
