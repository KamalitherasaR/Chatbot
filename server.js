const express = require("express");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");

// Load environment variables from .env.local if present
dotenv.config({ path: path.join(__dirname, ".env.local") });

const { Ollama } = require("ollama");

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.OLLAMA_API_KEY) {
  console.warn(
    "Warning: OLLAMA_API_KEY is not set. Create a .env.local file with OLLAMA_API_KEY=your_key_here"
  );
}

const ollama = new Ollama({
  host: "https://ollama.com",
  headers: {
    Authorization: "Bearer " + process.env.OLLAMA_API_KEY,
  },
});

app.use(cors());
app.use(express.json());

// Serve static frontend
app.use(express.static(path.join(__dirname, "public")));

// Chat API – streams back the response tokens
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, model } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res
        .status(400)
        .json({ error: "messages must be a non-empty array" });
    }

    const selectedModel = model || "gpt-oss:120b";

    // Set headers for streaming response
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    const response = await ollama.chat({
      model: selectedModel,
      messages,
      stream: true,
    });

    for await (const part of response) {
      const text = part?.message?.content || "";
      if (text) {
        res.write(text);
      }
    }

    res.end();
  } catch (err) {
    console.error("Chat error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    } else {
      res.end();
    }
  }
});

app.listen(PORT, () => {
  console.log(`Ollama chat UI running at http://localhost:${PORT}`);
});

