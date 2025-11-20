import "./styles.css";
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
      <div class="header-right">
        <span id="ollama-status" class="status-badge">Checking Ollama...</span>
      </div>
    </header>

    <section class="toolbar">
      <button id="load-file-button" class="toolbar-button">Load Text File</button>
      <input type="file" id="file-input" accept=".txt" style="display: none" />
      <span id="doc-status" class="status-badge doc-badge">No document loaded</span>
    </section>

    <section id="chat" class="chat-container">
      <div id="chat-messages" class="chat-messages"></div>
    </section>

    <section class="chat-input-section">
      <textarea
        id="chat-input"
        class="chat-input"
        rows="2"
        placeholder="Type a question about the loaded document..."
      ></textarea>
      <button id="send-button" class="send-button">Send</button>
    </section>
  </div>
`;

const statusEl = document.getElementById("ollama-status") as HTMLSpanElement;
const docStatusEl = document.getElementById("doc-status") as HTMLSpanElement;
const messagesEl = document.getElementById("chat-messages") as HTMLDivElement;
const inputEl = document.getElementById("chat-input") as HTMLTextAreaElement;
const sendBtn = document.getElementById("send-button") as HTMLButtonElement;
const loadFileBtn = document.getElementById("load-file-button") as HTMLButtonElement;
const fileInput = document.getElementById("file-input") as HTMLInputElement;

let isSending = false;
const messages: ChatMessage[] = [];

let currentDocText: string | null = null;
let currentDocName: string | null = null;

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

function setDocStatus(text: string, ok: boolean) {
  docStatusEl.textContent = text;
  docStatusEl.classList.toggle("status-ok", ok);
  docStatusEl.classList.toggle("status-error", !ok);
}

function loadTextFile() {
  fileInput.value = ""; // reset
  fileInput.click();
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  if (!file.name.toLowerCase().endsWith(".txt")) {
    setDocStatus("Please select a .txt file", false);
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    currentDocText = reader.result as string;
    currentDocName = file.name;
    setDocStatus(`Loaded: ${file.name}`, true);

    // Optional: system message in chat
    messages.push({
      role: "assistant",
      text: `Loaded document "${file.name}". You can now ask questions about its contents.`,
    });
    renderMessages();
  };
  reader.onerror = () => {
    console.error("Error reading file", reader.error);
    setDocStatus("Error reading file", false);
  };

  reader.readAsText(file);
});

async function sendMessage() {
  if (isSending) return;

  const text = inputEl.value.trim();
  if (!text) return;

  if (!currentDocText) {
    messages.push({
      role: "assistant",
      text: "Please load a text file first using the 'Load Text File' button.",
    });
    renderMessages();
    return;
  }

  inputEl.value = "";

  // Add user message
  messages.push({ role: "user", text });
  renderMessages();

  isSending = true;
  sendBtn.disabled = true;
  sendBtn.textContent = "Thinking...";

  try {
    const answer = (await invoke("chat_with_ollama", {
      prompt: text,
      doc: currentDocText,
    })) as string;

    messages.push({ role: "assistant", text: answer });
    renderMessages();
  } catch (err) {
    console.error("Error calling chat_with_ollama:", err);
    messages.push({
      role: "assistant",
      text:
        "Error talking to local LLM. Check if Ollama is installed and running, and that the tinyllama model is available.",
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

loadFileBtn.addEventListener("click", () => {
  loadTextFile();
});

// On load, check Ollama
checkOllama();
