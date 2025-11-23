use crate::models::*;
use anyhow::{Context, Result, bail, ensure};
use chrono::Utc;
use fernet::Fernet;
use rusqlite::{Connection, OptionalExtension, params};
use serde_json::Value;
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
    time::Duration,
};

pub struct Store {
    pub(crate) db: Connection,
    pub directory: PathBuf,
    cipher: Fernet,
}

impl Store {
    pub fn fork(&self) -> Result<Self> {
        let db = Connection::open_with_flags(
            self.directory.join("gitnexus.db"),
            rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )?;
        db.busy_timeout(Duration::from_secs(10))?;
        db.execute_batch("PRAGMA foreign_keys=ON")?;
        let key = fs::read_to_string(self.directory.join("secret.key"))
            .context("Cannot read the retained application encryption key")?;
        let cipher =
            Fernet::new(key.trim()).context("The application encryption key is invalid")?;
        Ok(Self {
            db,
            directory: self.directory.clone(),
            cipher,
        })
    }

    pub fn default_directory() -> Result<PathBuf> {
        if let Some(path) = std::env::var_os("GIT_NEXUS_DATA_DIR") {
            return Ok(path.into());
        }
        Ok(
            directories::ProjectDirs::from("dev", "qtremors", "GitNexus")
                .context("Cannot determine the application data directory")?
                .data_local_dir()
                .to_path_buf(),
        )
    }

    pub fn open(directory: impl AsRef<Path>) -> Result<Self> {
        let directory = directory.as_ref().to_path_buf();
        fs::create_dir_all(&directory)?;
        let key_path = directory.join("secret.key");
        let database_path = directory.join("gitnexus.db");
        let populated = database_path.is_file() && fs::metadata(&database_path)?.len() > 0;
        ensure!(
            !populated || key_path.is_file(),
            "The existing database requires its original secret.key; restore a backup instead of generating a replacement"
        );
        if !key_path.exists() {
            write_private_new(&key_path, Fernet::generate_key().as_bytes())?;
        }
        let key = fs::read_to_string(&key_path)
            .context("Cannot read the retained application encryption key")?;
        let cipher = Fernet::new(key.trim()).context(
            "The application encryption key is invalid; preserve it and restore a valid backup",
        )?;
        if !database_path.exists() {
            write_private_new(&database_path, b"")?;
        }
        let db = Connection::open(&database_path)?;
        if populated {
            let native: bool = db.query_row("SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='native_schema')", [], |r| r.get(0))?;
            ensure!(
                native,
                "Unsupported database format; choose a separate application data directory"
            );
            let version: i64 =
                db.query_row("SELECT version FROM native_schema", [], |r| r.get(0))?;
            ensure!(
                version == 1,
                "Unsupported native database version; use the matching app version"
            );
        }
        db.busy_timeout(Duration::from_secs(10))?;
        db.execute_batch("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS native_schema(version INTEGER NOT NULL);
            INSERT INTO native_schema SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM native_schema);
            CREATE TABLE IF NOT EXISTS app_config(key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS tracked_repos(
                id INTEGER PRIMARY KEY, owner TEXT NOT NULL COLLATE NOCASE, repo_name TEXT NOT NULL COLLATE NOCASE,
                current_version TEXT NOT NULL DEFAULT 'Unknown', latest_version TEXT, description TEXT,
                html_url TEXT, sort_order INTEGER NOT NULL DEFAULT 0, UNIQUE(owner,repo_name));
            CREATE TABLE IF NOT EXISTS repositories(id INTEGER PRIMARY KEY, name TEXT NOT NULL, path TEXT NOT NULL UNIQUE);
            CREATE TABLE IF NOT EXISTS env_vars(key TEXT NOT NULL, value TEXT NOT NULL, scope TEXT NOT NULL,
                repository_id INTEGER NOT NULL DEFAULT 0, commit_hash TEXT NOT NULL DEFAULT '',
                PRIMARY KEY(key,scope,repository_id,commit_hash));
            CREATE TABLE IF NOT EXISTS cache(key TEXT PRIMARY KEY,value TEXT NOT NULL,expires_at INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS search_history(username TEXT PRIMARY KEY,visited_at INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS system_logs(id INTEGER PRIMARY KEY,timestamp TEXT NOT NULL,level TEXT NOT NULL,message TEXT NOT NULL);")?;
        Ok(Self {
            db,
            directory,
            cipher,
        })
    }

    pub fn setting(&self, key: &str) -> Result<Option<String>> {
        ensure!(
            key != "github_token",
            "Use the token accessor for encrypted credentials"
        );
        Ok(self
            .db
            .query_row("SELECT value FROM app_config WHERE key=?", [key], |r| {
                r.get(0)
            })
            .optional()?)
    }

    pub fn save_setting(&self, key: &str, value: &str) -> Result<()> {
        ensure!(
            matches!(key, "theme" | "download_path" | "last_repo_id"),
            "Unknown setting"
        );
        if key == "theme" {
            ensure!(
                matches!(
                    value,
                    "default" | "dracula" | "dark" | "light" | "midnight" | "aurora" | "sunset"
                ),
                "Invalid theme"
            );
        }
        self.put_config(key, value)
    }

    fn put_config(&self, key: &str, value: &str) -> Result<()> {
        self.db.execute("INSERT INTO app_config(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", params![key, value])?;
        Ok(())
    }

    pub fn token(&self) -> Result<Option<String>> {
        if let Ok(token) = std::env::var("GITHUB_TOKEN")
            && !token.trim().is_empty()
        {
            return Ok(Some(token.trim().to_string()));
        }
        let encrypted: Option<String> = self
            .db
            .query_row(
                "SELECT value FROM app_config WHERE key='github_token'",
                [],
                |r| r.get(0),
            )
            .optional()?;
        Ok(encrypted
            .filter(|v| !v.is_empty())
            .map(|v| self.decrypt(&v))
            .transpose()?
            .filter(|v| !v.is_empty()))
    }

    pub fn save_token(&self, token: &str) -> Result<()> {
        self.put_config(
            "github_token",
            &self.cipher.encrypt(token.trim().as_bytes()),
        )?;
        self.clear_cache()
    }

    fn decrypt(&self, value: &str) -> Result<String> {
        let bytes = self.cipher.decrypt(value).map_err(|_| {
            anyhow::anyhow!("Unable to decrypt stored data; restore the matching encryption key")
        })?;
        Ok(String::from_utf8(bytes)?)
    }

    pub fn cache_get(&self, key: &str) -> Result<Option<Value>> {
        let value: Option<String> = self
            .db
            .query_row(
                "SELECT value FROM cache WHERE key=? AND expires_at>?",
                params![key, Utc::now().timestamp()],
                |r| r.get(0),
            )
            .optional()?;
        value
            .map(|v| serde_json::from_str(&v).map_err(Into::into))
            .transpose()
    }

    pub fn cache_put(&self, key: &str, value: &Value, seconds: i64) -> Result<()> {
        self.db.execute("INSERT INTO cache VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,expires_at=excluded.expires_at", params![key,serde_json::to_string(value)?,Utc::now().timestamp()+seconds])?;
        Ok(())
    }

    pub fn clear_cache(&self) -> Result<()> {
        self.db.execute("DELETE FROM cache", [])?;
        Ok(())
    }

    pub fn log(&self, level: &str, message: &str) -> Result<()> {
        self.db.execute(
            "INSERT INTO system_logs(timestamp,level,message) VALUES(?,?,?)",
            params![Utc::now().to_rfc3339(), level, message],
        )?;
        self.db.execute("DELETE FROM system_logs WHERE id NOT IN(SELECT id FROM system_logs ORDER BY id DESC LIMIT 1000)",[])?;
        Ok(())
    }

    pub fn logs(&self) -> Result<Vec<LogEntry>> {
        let mut statement = self.db.prepare(
            "SELECT timestamp,level,message FROM system_logs ORDER BY id DESC LIMIT 100",
        )?;
        Ok(statement
            .query_map([], |r| {
                Ok(LogEntry {
                    timestamp: r.get(0)?,
                    level: r.get(1)?,
                    message: r.get(2)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?)
    }

    pub fn clear_logs(&self) -> Result<()> {
        self.db.execute("DELETE FROM system_logs", [])?;
        Ok(())
    }

    pub fn record_search(&self, username: &str) -> Result<()> {
        self.db.execute("INSERT INTO search_history VALUES(?,?) ON CONFLICT(username) DO UPDATE SET visited_at=excluded.visited_at", params![username,Utc::now().timestamp()])?;
        Ok(())
    }

    pub fn search_history(&self) -> Result<Vec<String>> {
        let mut statement = self.db.prepare(
            "SELECT username FROM search_history ORDER BY visited_at DESC,rowid DESC LIMIT 10",
        )?;
        Ok(statement
            .query_map([], |r| r.get(0))?
            .collect::<rusqlite::Result<Vec<_>>>()?)
    }
}

fn write_private_new(path: &Path, content: &[u8]) -> Result<()> {
    use std::io::Write;
    let mut options = fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    options.open(path)?.write_all(content)?;
    Ok(())
}

fn validate_scope(scope: &str, repo: i64, hash: &str) -> Result<()> {
    match scope {
        "global" => ensure!(repo == 0 && hash.is_empty(), "Invalid global scope"),
        "project" => ensure!(repo > 0 && hash.is_empty(), "Invalid project scope"),
        "commit" => {
            ensure!(repo > 0, "Invalid repository scope");
            crate::git::validate_hash(hash)?;
        }
        _ => bail!("Unknown environment variable scope"),
    }
    Ok(())
}

pub fn validate_env_key(key: &str) -> Result<()> {
    ensure!(
        !key.is_empty()
            && key.len() <= 100
            && key.bytes().enumerate().all(|(index, c)| c == b'_'
                || c.is_ascii_alphabetic()
                || (index > 0 && c.is_ascii_digit())),
        "Invalid environment variable name"
    );
    Ok(())
}
