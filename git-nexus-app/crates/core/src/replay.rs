use crate::{
    git,
    models::{LocalRepo, ServerInfo},
};
use anyhow::{Context, Result, ensure};
use percent_encoding::percent_decode_str;
use std::{
    collections::{BTreeMap, VecDeque},
    fs,
    io::{self, Read, Write},
    net::{TcpListener, TcpStream},
    path::{Path, PathBuf},
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
    thread::{self, JoinHandle},
    time::{Duration, Instant},
};

struct Running {
    info: ServerInfo,
    stop: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
    directory: PathBuf,
}
pub struct Replay {
    root: PathBuf,
    servers: BTreeMap<String, Running>,
    diagnostics: Arc<Mutex<VecDeque<String>>>,
}

impl Replay {
    pub fn new(root: PathBuf) -> Result<Self> {
        fs::create_dir_all(&root)?;
        Ok(Self {
            root: root.canonicalize()?,
            servers: BTreeMap::new(),
            diagnostics: Arc::new(Mutex::new(VecDeque::new())),
        })
    }
    pub fn list(&self) -> Vec<ServerInfo> {
        let mut servers: Vec<_> = self
            .servers
            .values()
            .map(|server| {
                let mut info = server.info.clone();
                if info.status == "running"
                    && server
                        .thread
                        .as_ref()
                        .is_some_and(|thread| thread.is_finished())
                {
                    info.status = "failed".into();
                }
                info
            })
            .collect();
        servers.sort_by(|a, b| a.started_at.cmp(&b.started_at).then(a.id.cmp(&b.id)));
        servers
    }

    pub fn take_diagnostics(&self) -> Vec<String> {
        self.diagnostics
            .lock()
            .map(|mut messages| messages.drain(..).collect())
            .unwrap_or_default()
    }

    pub fn start(&mut self, repo: &LocalRepo, hash: &str, port: Option<u16>) -> Result<ServerInfo> {
        let hash = git::resolve_commit(Path::new(&repo.path), hash)?;
        if let Some(existing) = self.servers.values().find(|s| {
            s.info.status == "running" && s.info.repo_id == repo.id && s.info.commit_hash == hash
        }) {
            return Ok(existing.info.clone());
        }
        if let Some(port) = port {
            ensure!(port >= 1024, "Replay ports must be at least 1024");
        }
        let previous = self
            .servers
            .values()
            .find(|s| {
                s.info.status == "stopped"
                    && s.info.repo_id == repo.id
                    && s.info.commit_hash == hash
            })
            .map(|s| s.info.clone());
        let port = port.or_else(|| previous.as_ref().map(|server| server.port));
        let id = previous
            .map(|server| server.id)
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        let directory = self.root.join(&id);
        git::export_snapshot(Path::new(&repo.path), &hash, &directory)?;
        let result = (|| -> Result<ServerInfo> {
            ensure!(
                directory.join("index.html").is_file(),
                "Replay supports static HTML commits containing index.html"
            );
            let listener = TcpListener::bind(("127.0.0.1", port.unwrap_or(0)))
                .context("Cannot bind Replay server")?;
            listener.set_nonblocking(true)?;
            let port = listener.local_addr()?.port();
            let info = ServerInfo {
                id: id.clone(),
                repo_id: repo.id,
                repo_name: repo.name.clone(),
                commit_hash: hash,
                port,
                url: format!("http://127.0.0.1:{port}"),
                status: "running".into(),
                started_at: chrono::Utc::now().to_rfc3339(),
            };
            let stop = Arc::new(AtomicBool::new(false));
            let thread_stop = stop.clone();
            let root = directory.clone();
            let diagnostics = self.diagnostics.clone();
            let server_id = id.clone();
            let thread = thread::spawn(move || {
                let mut workers: Vec<JoinHandle<()>> = Vec::new();
                while !thread_stop.load(Ordering::Relaxed) {
                    let mut index = 0;
                    while index < workers.len() {
                        if workers[index].is_finished() {
                            let _ = workers.swap_remove(index).join();
                        } else {
                            index += 1;
                        }
                    }
                    match listener.accept() {
                        Ok((stream, _)) => {
                            // Keep idle browser connections from blocking other assets, while
                            // bounding thread/socket use for a snapshot.
                            if workers.len() >= 32 {
                                continue;
                            }
                            let root = root.clone();
                            let stop = thread_stop.clone();
                            let diagnostics = diagnostics.clone();
                            let server_id = server_id.clone();
                            workers.push(thread::spawn(move || {
                                if let Err(error) = serve(stream, &root, &stop) {
                                    diagnostic(
                                        &diagnostics,
                                        format!("Replay {server_id}: request failed ({error})"),
                                    );
                                }
                            }));
                        }
                        Err(error) if error.kind() == io::ErrorKind::WouldBlock => {
                            thread::sleep(Duration::from_millis(10))
                        }
                        Err(error) => {
                            diagnostic(
                                &diagnostics,
                                format!("Replay {server_id}: listener failed ({error})"),
                            );
                            break;
                        }
                    }
                }
                for worker in workers {
                    let _ = worker.join();
                }
            });
            self.servers.insert(
                id.clone(),
                Running {
                    info: info.clone(),
                    stop,
                    thread: Some(thread),
                    directory: directory.clone(),
                },
            );
            Ok(info)
        })();
        if result.is_err() {
            let _ = fs::remove_dir_all(directory);
        }
        result
    }

    pub fn stop(&mut self, id: &str) -> Result<()> {
        if let Some(server) = self.servers.get_mut(id) {
            if server.info.status == "stopped" {
                return Ok(());
            }
            server.stop.store(true, Ordering::Relaxed);
            if let Some(thread) = server.thread.take() {
                thread
                    .join()
                    .map_err(|_| anyhow::anyhow!("Replay server thread failed"))?;
            }
            fs::remove_dir_all(&server.directory)?;
            server.info.status = "stopped".into();
        }
        Ok(())
    }
    pub fn remove(&mut self, id: &str) -> Result<()> {
        self.stop(id)?;
        self.servers.remove(id);
        Ok(())
    }
    pub fn stop_all(&mut self) -> Result<()> {
        for id in self.servers.keys().cloned().collect::<Vec<_>>() {
            self.stop(&id)?;
        }
        Ok(())
    }
}

fn diagnostic(messages: &Mutex<VecDeque<String>>, message: String) {
    if let Ok(mut messages) = messages.lock() {
        if messages.len() >= 100 {
            messages.pop_front();
        }
        messages.push_back(message);
    }
}

impl Drop for Replay {
    fn drop(&mut self) {
        let _ = self.stop_all();
    }
}

// Each connection has a bounded lifetime and streams files instead of loading them
// into memory. Stop also interrupts active transfers between chunks.
fn serve(mut stream: TcpStream, root: &Path, stop: &AtomicBool) -> io::Result<()> {
    // Accepted sockets inherit the listener's nonblocking mode on Windows.
    stream.set_nonblocking(false)?;
    stream.set_read_timeout(Some(Duration::from_millis(200)))?;
    stream.set_write_timeout(Some(Duration::from_millis(200)))?;
    let deadline = Instant::now() + Duration::from_secs(5);
    let mut header = Vec::new();
    let mut buffer = [0u8; 8192];
    while !header.windows(4).any(|v| v == b"\r\n\r\n") {
        if stop.load(Ordering::Relaxed) {
            return Ok(());
        }
        if Instant::now() > deadline {
            return Err(io::Error::new(
                io::ErrorKind::TimedOut,
                "request headers timed out",
            ));
        }
        let size = match stream.read(&mut buffer) {
            Ok(size) => size,
            Err(error)
                if matches!(
                    error.kind(),
                    io::ErrorKind::WouldBlock
                        | io::ErrorKind::TimedOut
                        | io::ErrorKind::Interrupted
                ) =>
            {
                continue;
            }
            Err(error) => return Err(error),
        };
        if size == 0 {
            return Ok(());
        }
        header.extend_from_slice(&buffer[..size]);
        if header.len() > 16 * 1024 {
            return reply(
                &mut stream,
                431,
                "Request Header Fields Too Large",
                None,
                false,
                stop,
                deadline,
            );
        }
    }
    let line = std::str::from_utf8(&header)
        .ok()
        .and_then(|s| s.lines().next())
        .unwrap_or("");
    let parts: Vec<_> = line.split_whitespace().collect();
    if parts.len() != 3 || !matches!(parts[2], "HTTP/1.0" | "HTTP/1.1") {
        return reply(&mut stream, 400, "Bad Request", None, false, stop, deadline);
    }
    if !matches!(parts[0], "GET" | "HEAD") {
        return reply(
            &mut stream,
            405,
            "Method Not Allowed",
            None,
            false,
            stop,
            deadline,
        );
    }
    let (url, query) = parts[1]
        .split_once('?')
        .map_or((parts[1], None), |(path, query)| (path, Some(query)));
    let decoded = percent_decode_str(url).decode_utf8().ok();
    let file = decoded.as_ref().and_then(|url| safe_file(root, url));
    if file.is_some()
        && !url.ends_with('/')
        && decoded
            .as_ref()
            .is_some_and(|url| root.join(url.trim_start_matches('/')).is_dir())
    {
        let query = query.map(|value| format!("?{value}")).unwrap_or_default();
        write!(
            stream,
            "HTTP/1.1 301 Moved Permanently\r\nLocation: {url}/{query}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
        )?;
        return Ok(());
    }
    match file.and_then(|path| fs::File::open(&path).ok().map(|file| (path, file))) {
        Some(file) => reply(
            &mut stream,
            200,
            "OK",
            Some(file),
            parts[0] == "HEAD",
            stop,
            deadline,
        ),
        None => reply(
            &mut stream,
            404,
            "Not Found",
            None,
            parts[0] == "HEAD",
            stop,
            deadline,
        ),
    }
}

fn reply(
    stream: &mut TcpStream,
    status: u16,
    reason: &str,
    file: Option<(PathBuf, fs::File)>,
    head: bool,
    stop: &AtomicBool,
    _deadline: Instant,
) -> io::Result<()> {
    let error_body = format!("{status} {reason}\n");
    let length = file
        .as_ref()
        .map(|(_, file)| file.metadata().map(|m| m.len()))
        .transpose()?
        .unwrap_or(error_body.len() as u64);
    let mime = file
        .as_ref()
        .map(|(path, _)| content_type(path))
        .unwrap_or("text/plain; charset=utf-8");
    write!(
        stream,
        "HTTP/1.1 {status} {reason}\r\nContent-Length: {length}\r\nContent-Type: {mime}\r\nConnection: close\r\nX-Content-Type-Options: nosniff\r\nCache-Control: no-store\r\n\r\n"
    )?;
    if !head && let Some((_, mut file)) = file {
        let mut buffer = [0u8; 64 * 1024];
        loop {
            if stop.load(Ordering::Relaxed) {
                break;
            }
            let size = file.read(&mut buffer)?;
            if size == 0 {
                break;
            }
            stream.write_all(&buffer[..size])?;
        }
    }
    if !head && status != 200 {
        stream.write_all(error_body.as_bytes())?;
    }
    Ok(())
}

fn safe_file(root: &Path, url: &str) -> Option<PathBuf> {
    let relative = url.strip_prefix('/')?;
    let relative = if relative.is_empty() {
        "index.html"
    } else {
        relative
    };
    git::validate_relative(relative).ok()?;
    let mut path = root.join(relative);
    if path.is_dir() {
        path = path.join("index.html");
    }
    let path = path.canonicalize().ok()?;
    (path.starts_with(root) && path.is_file()).then_some(path)
}

fn content_type(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|v| v.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "html" | "htm" => "text/html; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "json" => "application/json",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ico" => "image/x-icon",
        "gif" => "image/gif",
        "wasm" => "application/wasm",
        "pdf" => "application/pdf",
        "txt" => "text/plain; charset=utf-8",
        "xml" => "application/xml",
        "csv" => "text/csv; charset=utf-8",
        "webmanifest" => "application/manifest+json",
        "avif" => "image/avif",
        "bmp" => "image/bmp",
        "apng" => "image/apng",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "ogg" => "audio/ogg",
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        "eot" => "application/vnd.ms-fontobject",
        _ => "application/octet-stream",
    }
}
