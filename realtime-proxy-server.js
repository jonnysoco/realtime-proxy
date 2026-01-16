/**
 * WebSocket Proxy Server for OpenAI Realtime API (FIXED)
 * - Converts OpenAI JSON buffers into text so browser receives strings (not Blobs)
 * - Forwards true binary frames as binary (just in case)
 */

const WebSocket = require("ws");
const http = require("http");
require("dotenv").config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PROXY_PORT = process.env.PORT || process.env.PROXY_PORT || 8080;

if (!OPENAI_API_KEY) {
  console.error("Error: OPENAI_API_KEY not found in environment variables");
  process.exit(1);
}

const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "realtime-proxy" }));
    return;
  }
  res.writeHead(404);
  res.end("Not found");
});

const wss = new WebSocket.Server({ server });

wss.on("connection", (clientWs, req) => {
  console.log("Client connected:", req.url);

  const model = "gpt-4o-realtime-preview-2024-12-17";
  const openaiUrl = `wss://api.openai.com/v1/realtime?model=${model}`;

  const openaiWs = new WebSocket(openaiUrl, {
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "OpenAI-Beta": "realtime=v1",
    },
  });

  // Client -> OpenAI (forward as-is)
  clientWs.on("message", (data, isBinary) => {
    if (openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.send(data, { binary: isBinary });
    }
  });

  // OpenAI -> Client (FIX: send JSON as text, not Buffer/Blob)
  openaiWs.on("message", (data, isBinary) => {
    if (clientWs.readyState !== WebSocket.OPEN) return;

    // If OpenAI ever sends real binary, forward it as binary
    if (isBinary) {
      clientWs.send(data, { binary: true });
      return;
    }

    // Most OpenAI events are JSON text but arrive as Buffer. Convert to string.
    const text =
      typeof data === "string"
        ? data
        : Buffer.isBuffer(data)
        ? data.toString("utf8")
        : String(data);

    // Optional sanity check (helps debugging)
    // if (!text.trim().startsWith("{")) console.log("Non-JSON text from OpenAI:", text.slice(0, 80));

    clientWs.send(text);
  });

  openaiWs.on("open", () => {
    console.log("Connected to OpenAI Realtime API");
  });

  openaiWs.on("error", (error) => {
    console.error("OpenAI WebSocket error:", error);
    try { clientWs.close(); } catch {}
  });

  openaiWs.on("close", (code, reason) => {
    console.log("OpenAI closed:", code, reason?.toString?.() || reason);
    try { clientWs.close(); } catch {}
  });

  clientWs.on("close", () => {
    console.log("Client disconnected");
    try { openaiWs.close(); } catch {}
  });

  clientWs.on("error", (error) => {
    console.error("Client WebSocket error:", error);
  });
});

server.listen(PROXY_PORT, () => {
  console.log(`WebSocket proxy server running on port ${PROXY_PORT}`);
});
