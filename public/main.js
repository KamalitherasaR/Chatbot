const messagesEl = document.getElementById("messages");
const formEl = document.getElementById("chat-form");
const inputEl = document.getElementById("user-input");
const sendBtnLabel = document.getElementById("send-btn-label");
const clearBtn = document.getElementById("clear-btn");
const modelLabelEl = document.getElementById("model-label");
const modelSelect = document.getElementById("model-select");

const newChatBtn = document.getElementById("new-chat-btn");
const chatHistoryList = document.getElementById("chat-history-list");
const welcomeScreen = document.getElementById("welcome-screen");
const suggestionButtons = document.querySelectorAll(".suggestion-btn");

const exportChatBtn = document.getElementById("export-chat-btn");
const sidebarToggle = document.getElementById("sidebar-toggle");
const sidebarOverlay = document.getElementById("sidebar-overlay");
const sidebar = document.querySelector(".sidebar");

const STORAGE_KEY = "qwenConversations";
const DEFAULT_MODEL = "qwen2.5:1.5b";

let conversations = loadConversations();
let activeChatId = conversations[0]?.id || null;
let isStreaming = false;
let abortController = null;

// =====================================
// LOAD CONVERSATIONS
// =====================================

function loadConversations() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );

    if (saved.length > 0) return saved;

    const oldHistory = JSON.parse(
      localStorage.getItem("qwenChatHistory") || "[]"
    );

    if (oldHistory.length > 0) {
      return [{
        id: String(Date.now()),
        title: "Previous conversation",
        messages: oldHistory
      }];
    }

  } catch (error) {
    console.error("Storage error:", error);
  }

  return [];
}

// =====================================
// GET ACTIVE CHAT
// =====================================

function getActiveConversation() {
  return conversations.find(
    chat => chat.id === activeChatId
  );
}

// =====================================
// SAVE CHATS
// =====================================

function saveConversations() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(conversations)
  );
}

// =====================================
// WELCOME SCREEN
// =====================================

function updateWelcomeScreen() {
  const chat = getActiveConversation();
  const empty = !chat || chat.messages.length === 0;

  welcomeScreen.hidden = !empty;
  messagesEl.hidden = empty;
}

// =====================================
// CREATE NEW CHAT
// =====================================

function createNewChat() {
  if (isStreaming) return;

  const chat = {
    id: String(Date.now()),
    title: "New Chat",
    messages: []
  };

  conversations.unshift(chat);
  activeChatId = chat.id;

  saveConversations();

  renderMessages();
  renderChatHistory();

  inputEl.value = "";
  inputEl.style.height = "auto";

  closeSidebar();
  inputEl.focus();
}
// =====================================
// RENDER MARKDOWN
// =====================================

function renderMarkdown(element, content) {
  const html = window.marked
    ? marked.parse(content || "")
    : content || "";

  element.innerHTML = window.DOMPurify
    ? DOMPurify.sanitize(html)
    : html;
}

// =====================================
// APPEND MESSAGE
// =====================================

function appendMessage(role, content) {
  const element = document.createElement("div");

  element.classList.add("message", role);

  if (role === "assistant") {
    renderMarkdown(element, content);
  } else {
    element.textContent = content;
  }

  messagesEl.appendChild(element);

  messagesEl.scrollTop = messagesEl.scrollHeight;

  return element;
}

// =====================================
// COPY TEXT
// =====================================

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);

    const oldText = button.textContent;
    button.textContent = "Copied!";

    setTimeout(() => {
      button.textContent = oldText;
    }, 1500);

  } catch (error) {
    console.error("Copy failed:", error);
    button.textContent = "Copy failed";
  }
}

// =====================================
// COPY CODE BUTTONS
// =====================================

function addCodeCopyButtons(messageEl) {
  messageEl.querySelectorAll("pre").forEach(pre => {
    if (pre.querySelector(".copy-code-btn")) return;

    const code = pre.querySelector("code");

    if (!code) return;

    const button = document.createElement("button");

    button.type = "button";
    button.className = "copy-code-btn";
    button.textContent = "Copy Code";

    button.addEventListener("click", () => {
      copyText(code.textContent, button);
    });

    pre.insertBefore(button, pre.firstChild);
  });
}

// =====================================
// RESPONSE ACTIONS
// =====================================

function addResponseActions(messageEl, content) {
  messageEl.querySelector(".message-actions")?.remove();

  const actions = document.createElement("div");
  actions.className = "message-actions";

  const copyButton = document.createElement("button");

  copyButton.type = "button";
  copyButton.textContent = "Copy response";

  copyButton.addEventListener("click", () => {
    copyText(content, copyButton);
  });

  const regenerateButton = document.createElement("button");

  regenerateButton.type = "button";
  regenerateButton.textContent = "↻ Regenerate";

  regenerateButton.addEventListener(
    "click",
    regenerateResponse
  );

  actions.append(copyButton, regenerateButton);

  messageEl.appendChild(actions);
}

// =====================================
// DISPLAY MESSAGES
// =====================================

function renderMessages() {
  messagesEl.innerHTML = "";

  const chat = getActiveConversation();

  if (chat && chat.messages.length > 0) {
    chat.messages.forEach(message => {
      const element = appendMessage(
        message.role,
        message.content
      );

      if (message.role === "assistant") {
        addCodeCopyButtons(element);
        addResponseActions(element, message.content);
      }
    });
  }

  updateWelcomeScreen();

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// =====================================
// CHAT HISTORY
// =====================================

function renderChatHistory() {
  chatHistoryList.innerHTML = "";

  conversations.forEach(chat => {
    const item = document.createElement("div");

    item.className = "chat-history-item";

    if (chat.id === activeChatId) {
      item.classList.add("active");
    }

    const title = document.createElement("span");

    title.className = "chat-title";
    title.textContent = chat.title;

    const actions = document.createElement("div");
    actions.className = "chat-actions";

    // Rename

    const renameButton = document.createElement("button");

    renameButton.type = "button";
    renameButton.textContent = "✏️";
    renameButton.title = "Rename chat";

    renameButton.addEventListener("click", event => {
      event.stopPropagation();

      const newTitle = prompt(
        "Enter a new chat name:",
        chat.title
      );

      if (newTitle && newTitle.trim()) {
        chat.title = newTitle.trim().slice(0, 40);

        saveConversations();
        renderChatHistory();
      }
    });

    // Delete

    const deleteButton = document.createElement("button");

    deleteButton.type = "button";
    deleteButton.textContent = "🗑️";
    deleteButton.title = "Delete chat";

    deleteButton.addEventListener("click", event => {
      event.stopPropagation();

      if (!confirm("Delete this conversation?")) return;

      conversations = conversations.filter(
        entry => entry.id !== chat.id
      );

      if (activeChatId === chat.id) {
        activeChatId = conversations[0]?.id || null;
      }

      if (!activeChatId) {
        createNewChat();
      } else {
        saveConversations();
        renderMessages();
        renderChatHistory();
      }
    });

    actions.append(renameButton, deleteButton);

    item.append(title, actions);

    // Switch chat

    item.addEventListener("click", () => {
      if (isStreaming) return;

      activeChatId = chat.id;

      renderMessages();
      renderChatHistory();

      closeSidebar();
    });
    chatHistoryList.appendChild(item);
  });
}

// =====================================
// STREAMING STATE
// =====================================

function setStreamingState(streaming) {
  isStreaming = streaming;

  sendBtnLabel.textContent = streaming
    ? "Stop"
    : "Send";

  newChatBtn.disabled = streaming;

  suggestionButtons.forEach(button => {
    button.disabled = streaming;
  });

  renderChatHistory();
}

// =====================================
// TYPING INDICATOR
// =====================================

function showTypingIndicator() {
  const indicator = document.createElement("div");

  indicator.className = "typing-indicator";

  indicator.innerHTML = `
    <span></span>
    <span></span>
    <span></span>
    <small>Qwen is typing...</small>
  `;

  messagesEl.appendChild(indicator);

  messagesEl.scrollTop = messagesEl.scrollHeight;

  return indicator;
}

// =====================================
// REQUEST AI RESPONSE
// =====================================

async function requestAssistantReply(chat, assistantElement) {
  const model = modelSelect.value || DEFAULT_MODEL;

  modelLabelEl.textContent = `Model: ${model}`;

  let answer = "";

  const typing = showTypingIndicator();

  abortController = new AbortController();

  setStreamingState(true);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        messages: chat.messages,
        model
      }),

      signal: abortController.signal
    });

    if (!response.ok || !response.body) {
      const data = await response.json().catch(() => ({}));

      throw new Error(
        data.error || `Request failed (${response.status})`
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();

      if (done) break;

      answer += decoder.decode(value, {
        stream: true
      });

      if (answer) {
        typing.remove();

        renderMarkdown(assistantElement, answer);
        addCodeCopyButtons(assistantElement);

        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    }

    answer += decoder.decode();

    typing.remove();

    if (!answer.trim()) {
      throw new Error("The model returned an empty response.");
    }

    renderMarkdown(assistantElement, answer);

    addCodeCopyButtons(assistantElement);

    chat.messages.push({
      role: "assistant",
      content: answer
    });

    addResponseActions(assistantElement, answer);

    saveConversations();

  } catch (error) {
    typing.remove();

    if (error.name === "AbortError") {
      if (answer.trim()) {
        renderMarkdown(assistantElement, answer);

        addCodeCopyButtons(assistantElement);

        chat.messages.push({
          role: "assistant",
          content: answer
        });

        addResponseActions(assistantElement, answer);

        saveConversations();

      } else {
        assistantElement.remove();
      }

    } else {
      console.error("Chat request failed:", error);

      assistantElement.textContent =
        "⚠️ " + error.message;
    }

  } finally {
    typing.remove();

    abortController = null;

    setStreamingState(false);
    updateWelcomeScreen();
  }
}

// =====================================
// SEND MESSAGE
// =====================================

async function sendMessage(event) {
  event.preventDefault();

  // Stop generation

  if (isStreaming) {
    abortController?.abort();
    return;
  }

  const text = inputEl.value.trim();

  if (!text) return;

  if (!activeChatId) {
    createNewChat();
  }

  const chat = getActiveConversation();

  if (!chat) return;

  chat.messages.push({
    role: "user",
    content: text
  });

  if (chat.title === "New Chat") {
    chat.title = text.slice(0, 32);
  }

  inputEl.value = "";
  inputEl.style.height = "auto";

  appendMessage("user", text);

  updateWelcomeScreen();

  saveConversations();
  renderChatHistory();

  const assistantElement = appendMessage("assistant", "");

  await requestAssistantReply(chat, assistantElement);
}

// =====================================
// REGENERATE RESPONSE
// =====================================

async function regenerateResponse() {
  if (isStreaming) return;

  const chat = getActiveConversation();

  if (!chat || !chat.messages.length) return;

  const lastAssistantIndex = chat.messages
    .map(message => message.role)
    .lastIndexOf("assistant");

  if (lastAssistantIndex === -1) return;

  // Remove the previous assistant response.

  chat.messages = chat.messages.slice(
    0,
    lastAssistantIndex
  );

  saveConversations();

  renderMessages();

  const assistantElement = appendMessage("assistant", "");

  updateWelcomeScreen();

  await requestAssistantReply(chat, assistantElement);
}

// =====================================
// CLEAR CHAT
// =====================================

function clearChat() {
  if (isStreaming) return;

  const chat = getActiveConversation();

  if (!chat) return;

  if (!confirm("Clear all messages in this chat?")) return;

  chat.messages = [];
  chat.title = "New Chat";

  saveConversations();

  renderMessages();
  renderChatHistory();
}

// =====================================
// EXPORT CHAT
// =====================================

function exportChat() {
  const chat = getActiveConversation();

  if (!chat || chat.messages.length === 0) {
    alert("There is no conversation to export.");
    return;
  }

  let content = `Chat: ${chat.title}\n`;
  content += `Date: ${new Date().toLocaleString()}\n\n`;

  chat.messages.forEach(message => {
    const role = message.role === "user" ? "You" : "Qwen";

    content += `${role}:\n${message.content}\n\n`;
    content += "--------------------------------\n\n";
  });

  const blob = new Blob([content], {
    type: "text/plain;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = `${chat.title.replace(/[^a-z0-9]/gi, "_")}.txt`;

  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);
}

// =====================================
// MOBILE SIDEBAR
// =====================================

function openSidebar() {
  sidebar.classList.add("sidebar-open");
  sidebarOverlay.classList.add("overlay-visible");

  sidebarToggle.setAttribute("aria-expanded", "true");
}

function closeSidebar() {
  sidebar.classList.remove("sidebar-open");
  sidebarOverlay.classList.remove("overlay-visible");

  sidebarToggle.setAttribute("aria-expanded", "false");
}

sidebarToggle.addEventListener("click", () => {
  if (sidebar.classList.contains("sidebar-open")) {
    closeSidebar();
  } else {
    openSidebar();
  }
});

sidebarOverlay.addEventListener("click", closeSidebar);

// =====================================
// SUGGESTED PROMPTS
// =====================================

suggestionButtons.forEach(button => {
  button.addEventListener("click", () => {
    if (isStreaming) return;

    inputEl.value = button.dataset.prompt || "";

    formEl.requestSubmit();
  });
});

// =====================================
// AUTO GROW TEXTAREA
// =====================================

inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";

  inputEl.style.height =
    Math.min(inputEl.scrollHeight, 150) + "px";
});

// =====================================
// ENTER TO SEND
// SHIFT + ENTER FOR NEW LINE
// =====================================

inputEl.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();

    formEl.requestSubmit();
  }
});

// =====================================
// EVENT LISTENERS
// =====================================

newChatBtn.addEventListener("click", createNewChat);

formEl.addEventListener("submit", sendMessage);

clearBtn.addEventListener("click", clearChat);

exportChatBtn.addEventListener("click", exportChat);

// =====================================
// INITIALIZE
// =====================================

function initializeChatbot() {
  if (!activeChatId) {
    const chat = {
      id: String(Date.now()),
      title: "New Chat",
      messages: []
    };

    conversations.unshift(chat);
    activeChatId = chat.id;
  }

  saveConversations();

  renderMessages();
  renderChatHistory();
}

initializeChatbot();