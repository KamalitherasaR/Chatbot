const messagesEl = document.getElementById("messages");
const formEl = document.getElementById("chat-form");
const inputEl = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const sendBtnLabel = document.getElementById("send-btn-label");
const clearBtn = document.getElementById("clear-btn");
const modelSelectEl = document.getElementById("model-select");
const modelLabelEl = document.getElementById("model-label");

/** @type {{ role: "user" | "assistant"; content: string }[]} */
let conversation = [];
let isStreaming = false;

function appendMessage(role, content) {
  const div = document.createElement("div");
  div.classList.add("message", role);
  div.textContent = content;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

function setStreamingState(streaming) {
  isStreaming = streaming;
  sendBtn.disabled = streaming;
  sendBtnLabel.textContent = streaming ? "Streaming…" : "Send";
}

async function sendMessage(event) {
  event.preventDefault();
  if (isStreaming) return;

  const text = inputEl.value.trim();
  if (!text) return;

  const model = modelSelectEl.value || "gpt-oss:120b";
  modelLabelEl.textContent = `Model: ${model}`;

  // Add user message to UI and history
  appendMessage("user", text);
  conversation.push({ role: "user", content: text });

  // Prepare assistant bubble for streaming content
  const assistantEl = appendMessage("assistant", "");
  let assistantText = "";

  inputEl.value = "";
  setStreamingState(true);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: conversation,
        model,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (chunk) {
        assistantText += chunk;
        assistantEl.textContent = assistantText;
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    }

    conversation.push({ role: "assistant", content: assistantText });
  } catch (err) {
    console.error("Chat request failed", err);
    assistantEl.textContent =
      "Sorry, something went wrong talking to Ollama. Check the server logs.";
  } finally {
    setStreamingState(false);
  }
}

function clearChat() {
  conversation = [];
  messagesEl.innerHTML = "";
}

formEl.addEventListener("submit", sendMessage);
clearBtn.addEventListener("click", clearChat);

// Auto-grow textarea
inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height = inputEl.scrollHeight + "px";
});

// Submit on Enter (without Shift)
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    formEl.requestSubmit();
  }
});

