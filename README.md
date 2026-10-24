# ClearDoc 📄✨

> **Turn confusing letters, bills, and medical notes into plain words you can easily understand.**

ClearDoc is a simple, beginner-friendly web application powered by **Gemma 4**. It takes difficult documents—like a clinic discharge sheet, hospital bill, utility disconnection notice, or government letter—from **text or photos** and translates them into simple, everyday language.

You can:
- **Paste text** from an email or portal
- **Snap a photo** using your phone camera
- **Upload an image** (JPG, PNG) or drag-and-drop a file
- **Paste a screenshot** directly with `Ctrl+V` / `Cmd+V`
- **Click "📸 Test with Sample Bill Photo"** to immediately test photo recognition without a camera

It supports **8 languages**:
- English
- Hausa (Harshen Hausa)
- French (Français)
- Spanish (Español)
- Arabic (العربية)
- Portuguese (Português)
- Swahili (Kiswahili)
- Hindi (हिन्दी)

---

## What It Gives You

Every document is broken down into **5 clear sections**:

1. **WHAT IT SAYS** — A quick, simple summary of what the document is about and why you received it.
2. **WHAT YOU NEED TO DO** — An action checklist or daily medicine schedule so you know your next step.
3. **DEADLINES, AMOUNTS, AND DOSAGES** — Exact dollar amounts (e.g., `$184.50`), payment due dates (e.g., `November 3`), and medication doses (e.g., `Amoxicillin 500mg`).
4. **WHAT TO WATCH OUT FOR** — Late fees, interest penalties, or medical warning signs.
5. **QUESTIONS TO ASK** — 2 to 3 good questions you can ask your doctor, clinic, or billing office.

---

## Zero Extra Installs (No NPM Packages Needed)

ClearDoc runs on **pure standard Node.js** (Node 18 or newer). 
You **do not** need to install any external npm packages (`npm install` is not required).

---

## Quick Start

### 1. Copy the Settings File
Make a copy of `.env.example` named `.env`:

```bash
cp .env.example .env
```

### 2. Run with Google AI Studio (Cloud Gemma 4)
This is the default mode. It uses Google's Gemma 4 model (`gemma-4-26b-a4b-it`).

1. Put your Google AI Studio API key in `.env`:
   ```env
   PROVIDER=api
   GEMINI_API_KEY="your-gemini-api-key"
   GEMMA_MODEL=gemma-4-26b-a4b-it
   ```
2. Start the server:
   ```bash
   node server.js
   ```
3. Open your browser at:
   ```
   http://localhost:3000
   ```

*(Note: When running inside Google AI Studio Build, the API key is automatically provided for you!)*

---

### 3. Run Locally with Ollama (Offline / No Key Needed)
If you prefer running everything locally on your own computer:

1. Download and install [Ollama](https://ollama.com).
2. Pull the Gemma 4 model:
   ```bash
   ollama run gemma4:e2b
   ```
3. Set your `.env` to:
   ```env
   PROVIDER=local
   OLLAMA_HOST=http://localhost:11434
   OLLAMA_MODEL=gemma4:e2b
   ```
4. Start the server:
   ```bash
   node server.js
   ```
5. Open `http://localhost:3000`.

---

## Running the Smoke Test

ClearDoc comes with an automated test that checks if the AI accurately extracts all 5 sections and keeps the exact figures:
- `$184.50` (the bill amount)
- `November 3` (the deadline)
- `Amoxicillin` (the prescription)

Run it with:
```bash
node smoke-test.js
```
or:
```bash
npm test
```

If everything works, it prints:
```
======================================================
🎉 RESULT: PASS
All 5 sections and critical items ($184.50, November 3, Amoxicillin) verified!
======================================================
```

---

## Project Files

- **`index.html`** — The clean, accessible web page where you paste text and read the 5-part summary. Includes text-to-speech, print/PDF, and language picker.
- **`server.js`** — The lightweight Node.js server. Handles both Google AI Studio API and local Ollama. Zero external dependencies.
- **`sample-document.txt`** — A realistic clinic discharge and billing notice used for testing.
- **`smoke-test.js`** — The test script that confirms all 5 sections and key numbers appear in the answer.
- **`.env.example`** — Example configuration file.
- **`.gitignore`** — Keeps your private API keys and `.env` safe from being shared.
