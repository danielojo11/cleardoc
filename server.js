/**
 * ClearDoc Server
 * Plain-language document explainer powered by Gemma 4.
 * Built with ZERO external npm dependencies (pure standard Node.js).
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple .env loader for zero-dependency execution
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      });
    } catch {
      // Ignore reading errors if .env is not readable
    }
  }
}
loadEnv();

// Configuration
const PORT = Number(process.env.PORT) || 3000;
const PROVIDER = (process.env.PROVIDER || 'api').toLowerCase(); // 'api' or 'local'
const GEMMA_MODEL = process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma4:e2b';

// Supported Languages
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'ha', name: 'Hausa', native: 'Harshen Hausa' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'ar', name: 'Arabic', native: 'العربية', rtl: true },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'sw', name: 'Swahili', native: 'Kiswahili' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
];

/**
 * Builds the plain-language prompt for Gemma 4.
 */
export function buildPrompt(documentText, language = 'English', hasImage = false) {
  let docContext = '';
  if (hasImage && documentText && documentText.trim()) {
    docContext = `DOCUMENT IMAGE ATTACHED. Carefully read all text, handwriting, numbers, dates, diagnoses, and tables in the attached image, along with the user's additional notes below:\n"""\n${documentText}\n"""`;
  } else if (hasImage) {
    docContext = `DOCUMENT IMAGE ATTACHED. Carefully inspect and read all printed text, handwritten notes, billing amounts, due dates, medication names, and instructions shown in the attached image.`;
  } else {
    docContext = `DOCUMENT TO EXPLAIN:\n"""\n${documentText}\n"""`;
  }

  return `You are ClearDoc, an expert, compassionate assistant that explains confusing official letters, utility bills, government notices, and doctor's prescriptions or discharge notes in simple, everyday words.

Target Audience: Everyday people, patients, and family caregivers who need clear instructions without legal or medical jargon.

Target Language: ${language}
Explain the document in ${language}.

You MUST structure your response into these exact 5 sections with these exact headers:

1. WHAT IT SAYS
(A short, easy-to-understand summary of what this document is about and why the person received it)

2. WHAT YOU NEED TO DO
(A clear, step-by-step checklist or daily medication schedule of what action to take)

3. DEADLINES, AMOUNTS, AND DOSAGES
(List every exact dollar amount, payment due date, administrative fee, and medicine dosage found in the document or image)

4. WHAT TO WATCH OUT FOR
(Important warnings such as late fees, interest, collection escalation, or medical side effects and warning signs)

5. QUESTIONS TO ASK
(2 to 3 good, practical questions the person can ask the sender, billing office, or doctor if they need help)

CRITICAL RULES:
- Never lose or round numbers, dates, or drug names. ALWAYS keep exact amounts (like $184.50), exact dates (like November 3), and exact medication names/doses (like Amoxicillin 500mg).
- Use warm, simple, 6th-grade reading level language. Explain any technical or medical term in parentheses.
- Do NOT output your internal chain-of-thought, reasoning steps, or scratchpad notes. Start directly with section 1.

${docContext}`;
}

/**
 * Parses the raw AI output into the 5 structured sections.
 */
export function parseSections(rawText) {
  if (!rawText) return null;

  // Strip leading thinking or scratchpad notes if the model emitted any
  let cleaned = rawText;
  const firstSectionIdx = cleaned.search(/(?:^|\n)(?:#+\s*|\*+\s*|)1\.\s*WHAT IT SAYS/i);
  if (firstSectionIdx !== -1) {
    cleaned = cleaned.slice(firstSectionIdx).trim();
  }

  const sectionRegexes = [
    { key: 'whatItSays', title: '1. WHAT IT SAYS', re: /(?:^|\n)(?:#+\s*|\*+\s*|)1\.\s*WHAT IT SAYS[:\s\*\#]*(.*?)(?=(?:^|\n)(?:#+\s*|\*+\s*|)2\.\s*WHAT YOU NEED TO DO|$)/is },
    { key: 'whatYouNeedToDo', title: '2. WHAT YOU NEED TO DO', re: /(?:^|\n)(?:#+\s*|\*+\s*|)2\.\s*WHAT YOU NEED TO DO[:\s\*\#]*(.*?)(?=(?:^|\n)(?:#+\s*|\*+\s*|)3\.\s*DEADLINES[,\s]+AMOUNTS|$)/is },
    { key: 'deadlinesAmountsDosages', title: '3. DEADLINES, AMOUNTS, AND DOSAGES', re: /(?:^|\n)(?:#+\s*|\*+\s*|)3\.\s*DEADLINES[,\s]+AMOUNTS[,\s]+AND\s+DOSAGES[:\s\*\#]*(.*?)(?=(?:^|\n)(?:#+\s*|\*+\s*|)4\.\s*WHAT TO WATCH OUT FOR|$)/is },
    { key: 'whatToWatchOutFor', title: '4. WHAT TO WATCH OUT FOR', re: /(?:^|\n)(?:#+\s*|\*+\s*|)4\.\s*WHAT TO WATCH OUT FOR[:\s\*\#]*(.*?)(?=(?:^|\n)(?:#+\s*|\*+\s*|)5\.\s*QUESTIONS TO ASK|$)/is },
    { key: 'questionsToAsk', title: '5. QUESTIONS TO ASK', re: /(?:^|\n)(?:#+\s*|\*+\s*|)5\.\s*QUESTIONS TO ASK[:\s\*\#]*(.*)$/is },
  ];

  const sections = {};
  for (const item of sectionRegexes) {
    const match = cleaned.match(item.re);
    sections[item.key] = match && match[1] ? match[1].trim() : '';
  }

  return {
    raw: cleaned,
    ...sections,
  };
}

/**
 * Unified explain function supporting Google AI Studio (Gemini API) and local Ollama.
 * Supports both text and document photos/images.
 */
export async function explainDocument({ text = '', image = null, language = 'English', provider = PROVIDER }) {
  const hasText = Boolean(text && text.trim());
  const hasImage = Boolean(image && (image.data || typeof image === 'string'));

  if (!hasText && !hasImage) {
    throw new Error('Please provide text or upload a photo of a document to explain.');
  }

  // Normalize image data
  let imageData = null;
  let imageMime = 'image/jpeg';
  if (hasImage) {
    if (typeof image === 'string') {
      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        imageMime = match[1];
        imageData = match[2];
      } else {
        imageData = image;
      }
    } else if (image.data) {
      imageMime = image.mimeType || 'image/jpeg';
      imageData = image.data.replace(/^data:[^;]+;base64,/, '');
    }
  }

  const prompt = buildPrompt(text, language, hasImage);
  const activeProvider = (provider || PROVIDER).toLowerCase();

  if (activeProvider === 'local') {
    // Local Ollama fallback
    const targetModel = process.env.OLLAMA_MODEL || OLLAMA_MODEL;
    const targetHost = process.env.OLLAMA_HOST || OLLAMA_HOST;
    const endpoint = `${targetHost.replace(/\/$/, '')}/api/generate`;

    const requestBody = {
      model: targetModel,
      prompt,
      stream: false,
    };
    if (imageData) {
      requestBody.images = [imageData];
    }

    let res;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
    } catch (err) {
      throw new Error(`Failed to connect to local Ollama at ${targetHost}. Please ensure Ollama is running ('ollama serve') and model '${targetModel}' is downloaded. Details: ${err.message}`);
    }

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Ollama returned error ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    const rawOutput = data.response || '';
    return {
      provider: 'local',
      model: targetModel,
      language,
      output: rawOutput,
      sections: parseSections(rawOutput),
    };
  }

  // Default: Google AI Studio Gemini API with Gemma 4
  const targetModel = process.env.GEMMA_MODEL || GEMMA_MODEL;
  const apiKey = process.env.GEMINI_API_KEY || GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Please set the GEMINI_API_KEY environment variable or switch to PROVIDER=local in .env.');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

  const parts = [];
  if (imageData) {
    parts.push({
      inlineData: {
        mimeType: imageMime,
        data: imageData,
      },
    });
  }
  parts.push({ text: prompt });

  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'aistudio-build',
      },
      body: JSON.stringify({
        contents: [{ parts }],
      }),
    });
  } catch (err) {
    throw new Error(`Failed to reach Google AI Studio API: ${err.message}`);
  }

  if (!res.ok) {
    const errorText = await res.text();
    let message = errorText;
    try {
      const errObj = JSON.parse(errorText);
      message = errObj.error?.message || errorText;
    } catch {
      // Keep raw message
    }
    throw new Error(`Google AI Studio API error (${res.status}): ${message}`);
  }

  const data = await res.json();
  const resParts = data.candidates?.[0]?.content?.parts || [];
  // Gemma 4 returns thought parts with thought: true; find the user-facing answer part
  const contentPart = resParts.find((p) => !p.thought && p.text) || resParts.find((p) => p.text);
  const rawOutput = contentPart ? contentPart.text : (resParts.map((p) => p.text).filter(Boolean).join('\n'));

  return {
    provider: 'api',
    model: targetModel,
    language,
    output: rawOutput,
    sections: parseSections(rawOutput),
  };
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  // CORS & headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // Endpoint: Health check & configuration info (never returns the secret key)
  if (url.pathname === '/api/config' && req.method === 'GET') {
    const activeProvider = (process.env.PROVIDER || PROVIDER).toLowerCase();
    const activeModel = activeProvider === 'local' ? (process.env.OLLAMA_MODEL || OLLAMA_MODEL) : (process.env.GEMMA_MODEL || GEMMA_MODEL);
    const hasKey = Boolean(process.env.GEMINI_API_KEY);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      provider: activeProvider,
      model: activeModel,
      hasApiKey: hasKey,
      languages: SUPPORTED_LANGUAGES,
    }));
    return;
  }

  // Endpoint: Load sample document
  if (url.pathname === '/api/sample' && req.method === 'GET') {
    try {
      const samplePath = path.join(__dirname, 'sample-document.txt');
      const sampleText = fs.readFileSync(samplePath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ text: sampleText }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Could not load sample document: ${err.message}` }));
    }
    return;
  }

  // Endpoint: Explain document
  if (url.pathname === '/api/explain' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      // 15MB size limit protection for photo uploads
      if (body.length > 15 * 1024 * 1024) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Upload is too large. Please limit photos and documents to under 15MB.' }));
        req.destroy();
      }
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { text, image, language, provider } = payload;

        const hasText = Boolean(text && text.trim());
        const hasImage = Boolean(image && (image.data || typeof image === 'string'));

        if (!hasText && !hasImage) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Please paste text or upload a photo of a document to explain.' }));
          return;
        }

        const result = await explainDocument({
          text: text || '',
          image: image || null,
          language: language || 'English',
          provider: provider || process.env.PROVIDER || PROVIDER,
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          ...result,
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: err.message,
        }));
      }
    });
    return;
  }

  // Serve static files (index.html, sample-document.txt, favicon)
  if (req.method === 'GET') {
    let filePath = path.join(__dirname, url.pathname === '/' ? 'index.html' : url.pathname);

    // Security: prevent directory traversal
    if (!filePath.startsWith(__dirname)) {
      res.writeHead(403);
      res.end('Access Denied');
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentTypes = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.json': 'application/json',
        '.txt': 'text/plain; charset=utf-8',
        '.svg': 'image/svg+xml',
      };
      const contentType = contentTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // Default fallback to index.html for SPA routes
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(indexPath).pipe(res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  res.writeHead(405, { 'Content-Type': 'text/plain' });
  res.end('Method Not Allowed');
});

// Start server if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(` ClearDoc is running at http://localhost:${PORT}`);
    console.log(` Provider : ${PROVIDER.toUpperCase()}`);
    console.log(` Model    : ${PROVIDER === 'local' ? OLLAMA_MODEL : GEMMA_MODEL}`);
    console.log(`====================================================`);
  });
}

export default server;
