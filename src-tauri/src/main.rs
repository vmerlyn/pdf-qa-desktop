#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ollama;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            ollama::check_ollama,
            ollama::chat_with_ollama
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
