const express = require("express");
const cors = require("cors");
const path = require("path");
const { Ollama } = require("ollama");

const app = express();
const PORT = process.env.PORT || 3000;

const isCloud = Boolean(process.env.OLLAMA_API_KEY);

const ollama = new Ollama({
  host: isCloud
    ? "https://ollama.com"
    : "http://localhost:11434",

  headers: isCloud
    ? {
        Authorization: `Bearer ${process.env.OLLAMA_API_KEY}`,
      }
    : {},
});

app.use(cors());
app.use(express.json());


app.use(express.static(path.join(__dirname, "public")));


app.post("/api/chat", async (req, res) => {
  try {
    const { messages, model } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Messages must be a non-empty array.",
      });
    }

    const selectedModel =
      model ||
      (isCloud ? "gpt-oss:20b" : "qwen2.5:1.5b");

    const response = await ollama.chat({
      model: selectedModel,
      messages,
      stream: true,
    });

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");

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
        error: "Unable to generate a response. Please check your Ollama connection and model configuration.",
      });
    } else {
      res.end();
    }
  }
});

app.listen(PORT, () => {
  console.log(`Chatbot running on port ${PORT}`);
});
