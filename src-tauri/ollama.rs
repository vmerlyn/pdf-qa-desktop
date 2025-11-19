// src-tauri/src/ollama.rs
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct OllamaStatus {
    pub reachable: bool,
    pub message: String,
}

#[tauri::command]
pub async fn check_ollama() -> Result<OllamaStatus, String> {
    let url = "http://127.0.0.1:11434/api/tags";

    let resp = reqwest::get(url).await;

    match resp {
        Ok(r) => {
            if r.status().is_success() {
                Ok(OllamaStatus {
                    reachable: true,
                    message: "Ollama is running on localhost:11434".into(),
                })
            } else {
                Ok(OllamaStatus {
                    reachable: false,
                    message: format!("Ollama HTTP status: {}", r.status()),
                })
            }
        }
        Err(e) => Ok(OllamaStatus {
            reachable: false,
            message: format!("Error reaching Ollama: {}", e),
        }),
    }
}

// Streaming chunk from /api/generate when stream=true
#[derive(Deserialize)]
struct GenerateStreamChunk {
    response: String,
    done: bool,
}

// Payload we emit to the frontend
#[derive(Serialize)]
pub struct OllamaTokenEvent {
    pub request_id: String,
    pub token: String,
    pub done: bool,
}

/// Start a streaming chat with Ollama.
/// Frontend passes in a `request_id` so it can correlate tokens to a specific message.
#[tauri::command]
pub async fn chat_with_ollama_stream(
    window: tauri::Window,
    prompt: String,
    request_id: String,
) -> Result<(), String> {
    let url = "http://127.0.0.1:11434/api/generate";

    // TODO: set this to a model you actually have pulled locally, e.g. "phi3:mini"
    let model = "tinyllama";

    let body = serde_json::json!({
        "model": model,
        "prompt": prompt,
        "stream": true
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("HTTP error: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Ollama returned HTTP {}", resp.status()));
    }

    let mut stream = resp.bytes_stream();

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Stream error: {}", e))?;
        let text = String::from_utf8_lossy(&chunk);

        for line in text.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            // Each line should be a JSON object like { "response": "text", "done": false }
            let parsed: GenerateStreamChunk = match serde_json::from_str(line) {
                Ok(p) => p,
                Err(e) => {
                    eprintln!("Failed to parse chunk line as JSON: {e}, line: {line}");
                    continue;
                }
            };

            let event = OllamaTokenEvent {
                request_id: request_id.clone(),
                token: parsed.response.clone(),
                done: parsed.done,
            };

            if let Err(e) = window.emit("ollama-token", event) {
                eprintln!("Failed to emit ollama-token event: {e}");
            }

            // You can optionally break when done == true
            if parsed.done {
                break;
            }
        }
    }

    Ok(())
}
