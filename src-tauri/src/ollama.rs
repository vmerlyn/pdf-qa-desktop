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

// Response shape for /api/generate when stream=false
#[derive(Deserialize)]
struct GenerateResponse {
    response: String,
    // other fields ignored
}

/// Simple non-streaming chat:
/// If `doc` is provided, answer based ONLY on that document.
#[tauri::command]
pub async fn chat_with_ollama(prompt: String, doc: Option<String>) -> Result<String, String> {
    let url = "http://127.0.0.1:11434/api/generate";

    // Use the model name you confirmed works, e.g. "tinyllama:latest"
    let model = "tinyllama:latest";

    // Build final prompt with document context if available
    let final_prompt = if let Some(d) = doc {
        // (Optional) truncate document to avoid blowing up context size
        let max_len = 8000;
        let trimmed_doc = if d.len() > max_len { &d[..max_len] } else { &d };

        format!(
            "You are an assistant that answers questions using ONLY the information in the given document.\n\
             If the answer is not clearly contained in the document, say you don't know.\n\n\
             DOCUMENT:\n{}\n\n\
             QUESTION:\n{}\n\n\
             ANSWER:",
            trimmed_doc, prompt
        )
    } else {
        // Fall back to plain chat if no document is loaded (should not happen in Pass 3, but safe)
        prompt
    };

    let body = serde_json::json!({
        "model": model,
        "prompt": final_prompt,
        "stream": false
    });

    let client = reqwest::Client::new();
    let resp = client.post(url).json(&body).send().await.map_err(|e| {
        eprintln!("HTTP error calling Ollama: {}", e);
        format!("HTTP error: {}", e)
    })?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        eprintln!("Ollama non-success status: {}, body: {}", status, text);
        return Err(format!("Ollama returned HTTP {}", status));
    }

    let text = resp.text().await.map_err(|e| {
        eprintln!("Read error from Ollama: {}", e);
        format!("Read error: {}", e)
    })?;

    let parsed: GenerateResponse = serde_json::from_str(&text).map_err(|e| {
        eprintln!("JSON parse error from Ollama: {} \nRaw text: {}", e, text);
        format!("JSON parse error: {}", e)
    })?;

    Ok(parsed.response)
}
