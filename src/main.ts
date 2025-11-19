//import "./style.css";
import { invoke } from "@tauri-apps/api/core";

interface OllamaStatus {
  reachable: boolean;
  message: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

const app = document.querySelector("#app") as HTMLElement;

if (!app) {
  throw new Error("Missing #app element");
}

app.innerHTML = `
  <div class="app-root">
    <header class="app-header">
      <h1>Local PDF LLM</h1>
      <span id="ollama-status" class="status-badge">Checking Ollama...</span>
    </header>

    <section id="chat" class="chat-container">
      <div id="chat-messages" class="chat-messages"></div>
    </section>

    <section class="chat-input-section">
      <textarea
        id="chat-input"
        class="chat-input"
        rows="2"
        placeholder="Type a message to the local LLM..."
      ></textarea>
      <button id="send-button" class="send-button">Send</button>
    </section>
  </div>
`;

const statusEl = document.getElementById("ollama-status") as HTMLSpanElement;
const messagesEl = document.getElementById("chat-messages") as HTMLDivElement;
const inputEl = document.getElementById("chat-input") as HTMLTextAreaElement;
const sendBtn = document.getElementById("send-button") as HTMLButtonElement;

let isSending = false;
const messages: ChatMessage[] = [];

function renderMessages() {
  messagesEl.innerHTML = messages
    .map((m) => {
      const roleClass = m.role === "user" ? "msg-user" : "msg-assistant";
      const label = m.role === "user" ? "You" : "Assistant";
      return `
        <div class="msg ${roleClass}">
          <div class="msg-meta">${label}</div>
          <div class="msg-text">${escapeHtml(m.text)}</div>
        </div>
      `;
    })
    .join("");
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function checkOllama() {
  try {
    const status = (await invoke("check_ollama")) as OllamaStatus;
    if (status.reachable) {
      statusEl.textContent = "Ollama: running";
      statusEl.classList.remove("status-error");
      statusEl.classList.add("status-ok");
    } else {
      statusEl.textContent = "Ollama: not reachable";
      statusEl.classList.remove("status-ok");
      statusEl.classList.add("status-error");
      console.warn(status.message);
    }
  } catch (err) {
    console.error("Error checking Ollama:", err);
    statusEl.textContent = "Ollama check error";
    statusEl.classList.remove("status-ok");
    statusEl.classList.add("status-error");
  }
}

async function sendMessage() {
  if (isSending) return;

  const text = inputEl.value.trim();
  if (!text) return;

  // clear input
  inputEl.value = "";
  messages.push({ role: "user", text });
  renderMessages();

  isSending = true;
  sendBtn.disabled = true;
  sendBtn.textContent = "Sending...";

  try {
    const answer = (await invoke("chat_with_ollama", {
      prompt: text,
    })) as string;

    messages.push({ role: "assistant", text: answer });
    renderMessages();
  } catch (err) {
    console.error("Error calling chat_with_ollama:", err);
    messages.push({
      role: "assistant",
      text: "Error talking to local LLM. Check if Ollama is installed and running.",
    });
    renderMessages();
  } finally {
    isSending = false;
    sendBtn.disabled = false;
    sendBtn.textContent = "Send";
  }
}

// Wire up events
sendBtn.addEventListener("click", () => {
  sendMessage();
});

inputEl.addEventListener("keydown", (ev: KeyboardEvent) => {
  if (ev.key === "Enter" && !ev.shiftKey) {
    ev.preventDefault();
    sendMessage();
  }
});

// On load, check Ollama
checkOllama();
