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

    pub fn watchlist(&self) -> Result<Vec<WatchedRepo>> {
        let mut statement=self.db.prepare("SELECT id,owner,repo_name,current_version,latest_version,description,html_url,sort_order FROM tracked_repos ORDER BY sort_order,id")?;
        Ok(statement
            .query_map([], |r| {
                Ok(WatchedRepo {
                    id: r.get(0)?,
                    owner: r.get(1)?,
                    name: r.get(2)?,
                    current_version: r.get(3)?,
                    latest_version: r.get(4)?,
                    description: r.get(5)?,
                    html_url: r.get(6)?,
                    sort_order: r.get(7)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?)
    }

    pub fn watch(
        &self,
        owner: &str,
        name: &str,
        repo: &GitHubRepo,
        latest: Option<&str>,
    ) -> Result<()> {
        crate::github::validate_identity(owner, name)?;
        self.db.execute("INSERT INTO tracked_repos(owner,repo_name,current_version,latest_version,description,html_url,sort_order) VALUES(?,?,?,?,?,?,(SELECT COALESCE(MAX(sort_order),-1)+1 FROM tracked_repos))", params![owner,name,latest.unwrap_or("Unknown"),latest,repo.description,repo.html_url])
            .context("Repository is already tracked or could not be saved")?;
        Ok(())
    }

    pub fn unwatch(&self, id: i64) -> Result<()> {
        self.db
            .execute("DELETE FROM tracked_repos WHERE id=?", [id])?;
        Ok(())
    }

    pub fn update_version(&self, id: i64, latest: Option<&str>) -> Result<()> {
        self.db.execute(
            "UPDATE tracked_repos SET latest_version=? WHERE id=?",
            params![latest, id],
        )?;
        Ok(())
    }

    pub fn mark_current(&self, id: i64) -> Result<()> {
        self.db.execute("UPDATE tracked_repos SET current_version=COALESCE(latest_version,current_version) WHERE id=?", [id])?;
        Ok(())
    }

    pub fn set_current_version(&self, id: i64, version: &str) -> Result<()> {
        self.db.execute(
            "UPDATE tracked_repos SET current_version=? WHERE id=?",
            params![version, id],
        )?;
        Ok(())
    }

    pub fn reorder(&mut self, ids: &[i64]) -> Result<()> {
        let tx = self.db.transaction()?;
        for (order, id) in ids.iter().enumerate() {
            tx.execute(
                "UPDATE tracked_repos SET sort_order=? WHERE id=?",
                params![order as i64, id],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    pub fn export_watchlist(&self, path: &Path) -> Result<()> {
        fs::write(path, serde_json::to_vec_pretty(&self.watchlist()?)?)?;
        Ok(())
    }

    pub fn export_watchlist_config(&self, path: &Path) -> Result<()> {
        ensure!(
            path.extension()
                .is_some_and(|extension| extension.eq_ignore_ascii_case("json")),
            "Choose a .json configuration filename"
        );
        let entries: Vec<_> = self
            .watchlist()?
            .into_iter()
            .map(|repo| serde_json::json!({"owner":repo.owner,"name":repo.name}))
            .collect();
        fs::write(path, serde_json::to_vec_pretty(&entries)?)?;
        Ok(())
    }

    pub fn import_watchlist(&mut self, path: &Path) -> Result<usize> {
        self.import_watchlist_entries(&Self::read_watchlist_import(path)?)
    }

    pub fn read_watchlist_import(path: &Path) -> Result<Vec<WatchlistEntry>> {
        let value: Value = serde_json::from_slice(&fs::read(path)?)?;
        let rows = value
            .as_array()
            .or_else(|| value.get("repos").and_then(Value::as_array))
            .context("Expected a watchlist array or an object with repos")?;
        let entries: Vec<WatchlistEntry> = serde_json::from_value(Value::Array(rows.clone()))?;
        for entry in &entries {
            crate::github::validate_identity(&entry.owner, &entry.name)?;
        }
        Ok(entries)
    }

    pub fn import_watchlist_entries(&mut self, entries: &[WatchlistEntry]) -> Result<usize> {
        let tx = self.db.transaction()?;
        let next_order: i64 = tx.query_row(
            "SELECT COALESCE(MAX(sort_order),-1)+1 FROM tracked_repos",
            [],
            |row| row.get(0),
        )?;
        let mut count = 0;
        for (index, row) in entries.iter().enumerate() {
            crate::github::validate_identity(&row.owner, &row.name)?;
            count+=tx.execute("INSERT OR IGNORE INTO tracked_repos(owner,repo_name,current_version,latest_version,description,html_url,sort_order) VALUES(?,?,?,?,?,?,?)",params![row.owner,row.name,row.current_version.as_deref().unwrap_or("Unknown"),row.latest_version,row.description,row.html_url,row.sort_order.unwrap_or(next_order+index as i64)])?;
        }
        tx.commit()?;
        Ok(count)
    }

    pub fn repositories(&self) -> Result<Vec<LocalRepo>> {
        let mut statement = self
            .db
            .prepare("SELECT id,name,path FROM repositories ORDER BY name")?;
        Ok(statement
            .query_map([], |r| {
                Ok(LocalRepo {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    path: r.get(2)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?)
    }

    pub fn add_repository(&self, path: &Path) -> Result<LocalRepo> {
        let root = crate::git::repository_root(path)?;
        let path = root.to_string_lossy().into_owned();
        let name = root
            .file_name()
            .context("Invalid repository root")?
            .to_string_lossy()
            .into_owned();
        self.db.execute(
            "INSERT OR IGNORE INTO repositories(name,path) VALUES(?,?)",
            params![name, path],
        )?;
        Ok(self.db.query_row(
            "SELECT id,name,path FROM repositories WHERE path=?",
            [path],
            |r| {
                Ok(LocalRepo {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    path: r.get(2)?,
                })
            },
        )?)
    }

    pub fn remove_repository(&mut self, id: i64) -> Result<()> {
        let tx = self.db.transaction()?;
        tx.execute("DELETE FROM env_vars WHERE repository_id=?", [id])?;
        tx.execute("DELETE FROM repositories WHERE id=?", [id])?;
        tx.commit()?;
        Ok(())
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
