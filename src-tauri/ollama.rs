// src-tauri/src/ollama.rs

use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct OllamaStatus {
    pub reachable: bool,
    pub message: String,
}

#[tauri::command]
pub async fn check_ollama() -> Result<OllamaStatus, String> {
    let url = "http://127.0.0.1:11434/api/tags";

    If you don't have Ollama installed yet, you can short-circuit here:
    return Ok(OllamaStatus {
        reachable: false,
        message: "Ollama check stubbed: not actually calling HTTP yet".into(),
    });

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

// Response from /api/generate when stream=false (simplified)
#[derive(Deserialize)]
struct GenerateResponse {
    response: String,
    // there are other fields, but we only care about this one
}

#[tauri::command]
pub async fn chat_with_ollama(prompt: String) -> Result<String, String> {
    // 🔧 Switch this to a real model you have locally, e.g. "phi3:mini" or similar.
    let model = "llama3.1:8b-instruct";

    // If you just want a stub for now, uncomment this and return:
    // return Ok(format!("(stubbed) LLM echo: {}", prompt));

    let url = "http://127.0.0.1:11434/api/generate";

    let body = serde_json::json!({
        "model": model,
        "prompt": prompt,
        "stream": false
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

    // For stream=false, Ollama returns a single JSON object.
    let text = resp.text().await.map_err(|e| format!("Read error: {}", e))?;
    let parsed: GenerateResponse =
        serde_json::from_str(&text).map_err(|e| format!("JSON parse error: {}", e))?;

    Ok(parsed.response)
}
