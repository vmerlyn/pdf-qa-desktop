import "./styles.css";
import { invoke } from "@tauri-apps/api/core";
const pdfjsLib = await import("pdfjs-dist/build/pdf.mjs");

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
      <button id="load-doc-button" class="toolbar-button">Load Document (.txt or .pdf)</button>
      <input type="file" id="file-input" accept=".txt,.pdf" style="display: none" />
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
const loadDocBtn = document.getElementById("load-doc-button") as HTMLButtonElement;
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

function triggerFilePicker() {
  fileInput.value = "";
  fileInput.click();
}

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  const name = file.name.toLowerCase();
  currentDocName = file.name;

  try {
    if (name.endsWith(".txt")) {
      await loadTextFile(file);
    } else if (name.endsWith(".pdf")) {
      await loadPdfFile(file);
    } else {
      setDocStatus("Unsupported file type. Use .txt or .pdf", false);
      return;
    }
  } catch (err) {
    console.error("Error loading document:", err);
    setDocStatus(`Error loading document ${currentDocName}`, false);
    messages.push({
      role: "assistant",
      text:
        "Error reading that document:\n" +
      (err instanceof Error ? err.message : String(err)),
    });
    renderMessages();
  }
});

async function loadTextFile(file: File) {
  setDocStatus(`Loading text file...`, true);
  const text = await file.text();

  if (!text.trim()) {
    setDocStatus("Text file appears empty", false);
    return;
  }

  currentDocText = text;
  currentDocName = file.name;
  setDocStatus(`Loaded: ${currentDocName}`, true);

  messages.push({
    role: "assistant",
    text: `Loaded text document "${currentDocName}". You can now ask questions about its contents.`,
  });
  renderMessages();
}

async function loadPdfFile(file: File) {
  setDocStatus(`Loading PDF...`, true);

  const arrayBuffer = await file.arrayBuffer();
  const typedArray = new Uint8Array(arrayBuffer);

  const loadingTask = getDocument({ data: typedArray });
  const pdf = await loadingTask.promise;

  let fullText = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const strings = (content.items as any[]).map(
      (item) => (item as any).str as string
    );
    fullText += strings.join(" ") + "\n\n";
  }

  if (!fullText.trim()) {
    setDocStatus("PDF loaded but appears to have no extractable text", false);
    return;
  }

  currentDocText = fullText;
  currentDocName = file.name;
  setDocStatus(`Loaded PDF: ${file.name}`, true);

  messages.push({
    role: "assistant",
    text: `Loaded PDF document "${file.name}". You can now ask questions about its contents.`,
  });
  renderMessages();
} 



async function sendMessage() {
  if (isSending) return;

  const text = inputEl.value.trim();
  if (!text) return;

  if (!currentDocText) {
    messages.push({
      role: "assistant",
      text: "Please load a .txt or .pdf document first.",
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

loadDocBtn.addEventListener("click", () => {
  triggerFilePicker();
});

// On load, check Ollama
checkOllama();
