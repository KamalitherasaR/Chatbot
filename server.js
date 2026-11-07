const express = require("express");
const cors = require("cors");
const path = require("path");

const { Ollama } = require("ollama");

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to local Ollama
const ollama = new Ollama({
  host: "http://localhost:11434",
});

app.use(cors());
app.use(express.json());

// Serve frontend files
app.use(express.static(path.join(__dirname, "public")));

// Chat API
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, model } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Messages must be a non-empty array",
      });
    }

    const response = await ollama.chat({
      model: model || "qwen2.5:1.5b",
      messages,
      stream: true,
    });

    res.setHeader("Content-Type", "text/plain; charset=utf-8");

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
      res.status(500).json({
        error: "Something went wrong with the local Ollama server.",
      });
    } else {
      res.end();
    }
  }
});

app.listen(PORT, () => {
  console.log(`Chatbot running at http://localhost:${PORT}`);
});