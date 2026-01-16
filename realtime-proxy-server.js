/**
 * WebSocket Proxy Server for OpenAI Realtime API
 * 
 * This Node.js server acts as a proxy between your browser and OpenAI's Realtime API.
 * It handles the Authorization header that browsers cannot send directly.
 * 
 * To run:
 * 1. Install dependencies: npm install ws dotenv
 * 2. Create a .env file with: OPENAI_API_KEY=your-key-here
 * 3. Run: node realtime-proxy-server.js
 * 4. Update chat-voice.html to connect to: ws://localhost:8080
 * 
 * For production, deploy this to a server and use wss:// (secure WebSocket)
 */

const WebSocket = require('ws');
const http = require('http');
require('dotenv').config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// Render and other cloud services provide PORT, fallback to PROXY_PORT or 8080
const PROXY_PORT = process.env.PORT || process.env.PROXY_PORT || 8080;

if (!OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY not found in environment variables');
    console.error('Please create a .env file with: OPENAI_API_KEY=your-key-here');
    process.exit(1);
}

const server = http.createServer();
const wss = new WebSocket.Server({ server });

wss.on('connection', (clientWs, req) => {
    console.log('Client connected');
    
    // Connect to OpenAI Realtime API
    const model = 'gpt-4o-realtime-preview-2024-12-17';
    const openaiUrl = `wss://api.openai.com/v1/realtime?model=${model}`;
    
    const openaiWs = new WebSocket(openaiUrl, {
        headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'OpenAI-Beta': 'realtime=v1'
        }
    });
    
    // Forward messages from client to OpenAI
    clientWs.on('message', (data) => {
        if (openaiWs.readyState === WebSocket.OPEN) {
            openaiWs.send(data);
        }
    });
    
    // Forward messages from OpenAI to client
    openaiWs.on('message', (data) => {
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(data);
        }
    });
    
    // Handle connection events
    openaiWs.on('open', () => {
        console.log('Connected to OpenAI Realtime API');
    });
    
    openaiWs.on('error', (error) => {
        console.error('OpenAI WebSocket error:', error);
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.close();
        }
    });
    
    openaiWs.on('close', () => {
        console.log('Disconnected from OpenAI Realtime API');
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.close();
        }
    });
    
    clientWs.on('error', (error) => {
        console.error('Client WebSocket error:', error);
    });
    
    clientWs.on('close', () => {
        console.log('Client disconnected');
        if (openaiWs.readyState === WebSocket.OPEN) {
            openaiWs.close();
        }
    });
});

server.listen(PROXY_PORT, () => {
    console.log(`WebSocket proxy server running on ws://localhost:${PROXY_PORT}`);
    console.log('Update chat-voice.html to connect to this proxy');
});
