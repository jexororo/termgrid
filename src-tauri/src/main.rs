#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};

struct PtyEntry {
    master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
}

struct AppState {
    ptys: Mutex<HashMap<String, PtyEntry>>,
}

#[derive(Clone, Serialize)]
struct PtyData {
    id: String,
    data: String,
}

#[derive(Clone, Serialize)]
struct PtyExit {
    id: String,
    code: i32,
}

#[tauri::command]
fn create_pty(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    id: String,
    shell_type: String,
) -> Result<String, String> {
    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let mut cmd = if shell_type == "cmd" {
        CommandBuilder::new("cmd.exe")
    } else {
        let mut c = CommandBuilder::new("powershell.exe");
        c.arg("-NoLogo");
        c
    };

    let home = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\".to_string());
    cmd.cwd(&home);

    let mut child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    // Drop slave so reads on master don't hang after child exits
    drop(pair.slave);

    let master = Arc::new(Mutex::new(pair.master));

    // Get a reader and writer from master before storing
    let mut reader = {
        let m = master.lock().unwrap();
        m.try_clone_reader().map_err(|e: anyhow::Error| e.to_string())?
    };
    let writer: Box<dyn Write + Send> = {
        let m = master.lock().unwrap();
        m.take_writer().map_err(|e: anyhow::Error| e.to_string())?
    };
    let writer = Arc::new(Mutex::new(writer));

    // Store the pty
    {
        let mut ptys = state.ptys.lock().unwrap();
        ptys.insert(id.clone(), PtyEntry { master: master.clone(), writer: writer.clone() });
    }

    // Reader thread - sends data to frontend
    let reader_id = id.clone();
    let app_handle = app.clone();

    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_handle.emit("pty:data", PtyData {
                        id: reader_id.clone(),
                        data,
                    });
                }
                Err(_) => break,
            }
        }
    });

    // Wait for exit thread
    let exit_id = id.clone();
    let app_handle2 = app.clone();
    thread::spawn(move || {
        let status = child.wait();
        let code = match status {
            Ok(s) => if s.success() { 0 } else { 1 },
            Err(_) => 1,
        };
        let _ = app_handle2.emit("pty:exit", PtyExit { id: exit_id, code });
    });

    Ok(id)
}

#[tauri::command]
fn write_pty(state: tauri::State<'_, AppState>, id: String, data: String) -> Result<(), String> {
    let ptys = state.ptys.lock().unwrap();
    if let Some(entry) = ptys.get(&id) {
        let mut w = entry.writer.lock().unwrap();
        w.write_all(data.as_bytes()).map_err(|e: std::io::Error| e.to_string())?;
        w.flush().map_err(|e: std::io::Error| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn resize_pty(state: tauri::State<'_, AppState>, id: String, cols: u16, rows: u16) -> Result<(), String> {
    let ptys = state.ptys.lock().unwrap();
    if let Some(entry) = ptys.get(&id) {
        let master = entry.master.lock().unwrap();
        master.resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
            .map_err(|e: anyhow::Error| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn destroy_pty(state: tauri::State<'_, AppState>, id: String) -> Result<(), String> {
    let mut ptys = state.ptys.lock().unwrap();
    ptys.remove(&id);
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .manage(AppState {
            ptys: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            create_pty,
            write_pty,
            resize_pty,
            destroy_pty,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TermGrid");
}
