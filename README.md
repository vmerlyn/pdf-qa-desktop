# Tauri + Vanilla TS

This template should help get you started developing with Tauri in vanilla HTML, CSS and Typescript.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)


## Building the App
### Pre-requisites (Windows)
#### Rust toolchain
Install via rustup (if you haven’t already):  
Download from: https://rustup.rs  
Run the installer, accept defaults (stable toolchain, add to PATH).
Verify in a new terminal (PowerShell or cmd):  
```
rustc --version
cargo --version
```

#### Node.js + npm

Install Node LTS for Windows:  
Download from: https://nodejs.org (LTS).  
Install with defaults.  
```
node -v
npm -v
```
#### Visual Studio Build Tools (C++)

Tauri (Rust) needs the MSVC toolchain and Windows SDK.  
Install “Visual Studio 2022 Build Tools” (or full VS 2022) from Microsoft.  
In the installer, make sure you check the “Desktop development with C++” workload, which pulls in:  
* MSVC v143 build tools  
* Windows 10 or 11 SDK  
* C++ CMake tools for Windows

After install, restart your terminal.  

#### Ollama for Windows

Since your app talks to tinyllama via Ollama:  
Install Ollama for Windows from https://ollama.com  
After install, either:  
Start Ollama from the Start menu, or Run ollama serve in a terminal.  
Pull your model:  
``ollama pull tinyllama:latest   # or whatever name you used in Rust``

Quick sanity check:  
``curl http://127.0.0.1:11434/api/tags``  
If you see JSON with your model listed, the API is working.  

### Project Setup
```
cd C:\path\to\pdf-qa-desktop
npm install
```
Rust dependencies will be handled automatically on first build.

### 3. Run in dev (debug build)
