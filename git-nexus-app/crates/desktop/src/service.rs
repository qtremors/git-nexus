use anyhow::{Context, Result, ensure};
use git_nexus_core::{GitHub, Replay, Store, git, models::*};
use serde_json::Value;
use std::{
    path::{Path, PathBuf},
    sync::{
        Arc, Mutex,
        atomic::{AtomicU64, Ordering},
    },
};

pub struct Services {
    pub store: Store,
    pub github: GitHub,
    pub replay: Arc<Mutex<Replay>>,
    snapshot_sequence: Arc<AtomicU64>,
}

#[derive(Clone, Default)]
pub struct Snapshot {
    pub revision: u64,
    pub watchlist: Vec<WatchedRepo>,
    pub repositories: Vec<LocalRepo>,
    pub servers: Vec<ServerInfo>,
    pub history: Vec<String>,
    pub theme: String,
    pub download_path: String,
    pub token_active: bool,
    pub token_from_env: bool,
    pub logs: Vec<LogEntry>,
    pub last_repo_id: Option<i64>,
}

#[derive(Clone)]
pub struct AssetDownload {
    pub repo: WatchedRepo,
    pub asset: ReleaseAsset,
}

impl AssetDownload {
    pub fn url(&self) -> String {
        if self.asset.id > 0 {
            format!(
                "https://api.github.com/repos/{}/{}/releases/assets/{}",
                self.repo.owner, self.repo.name, self.asset.id
            )
        } else {
            self.asset.browser_download_url.clone()
        }
    }

    pub fn filename(&self) -> String {
        let name = &self.asset.name;
        if name.contains("Source Code (zip)") && !name.ends_with(".zip") {
            format!("{name}.zip")
        } else if name.contains("Source Code (tar") && !name.ends_with(".tar.gz") {
            format!("{name}.tar.gz")
        } else {
            name.clone()
        }
    }
}

pub enum Job {
    Load,
    Discover(String, bool),
    ProfileReadme(String, bool),
    Detail(GitHubRepo),
    RemoteCommits(GitHubRepo, usize, bool),
    Counts(String, Vec<GitHubRepo>, bool),
    Contributions(String, Vec<GitHubRepo>, bool),
    Watch(String),
    Unwatch(i64),
    CheckUpdates,
    MarkCurrent(i64),
    Reorder(Vec<i64>),
    Releases(String, String, bool),
    WatchlistReleases,
    WatchlistRelease(String, String, bool),
    Download(String, String),
    DownloadRepos(Vec<GitHubRepo>),
    DownloadRelease(AssetDownload),
    ImportWatchlist(PathBuf),
    ExportWatchlist(PathBuf),
    AddLocal(PathBuf),
    Clone(String, PathBuf),
    RemoveLocal(i64),
    Commits(LocalRepo, usize),
    Files(LocalRepo, String),
    File(LocalRepo, String, String),
    Start(LocalRepo, String, Option<u16>),
    Stop(String),
    RemoveServer(String),
    StopAll,
    SaveToken(String),
    SavePath(String),
    Theme(String),
    ClearCache,
    ClearLogs,
    RateLimit,
    Env(String, i64, String),
    SaveEnv(String, i64, String, Vec<EnvVar>),
    MergedEnv(i64, String),
}

pub enum Change {
    None,
    TokenSaved,
    DownloadedAsset(i64, String),
    Discovery(Profile, Vec<GitHubRepo>, bool),
    Text(String, String, bool),
    ProfileReadme(String, String),
    Detail(GitHubRepo, String),
    RemoteCommits(String, Vec<Value>, usize),
    Counts(String, Vec<(String, u64)>),
    Contributions(String, Vec<Contribution>),
    Releases(String, String, Vec<Release>),
    WatchlistReleases(Vec<(String, Vec<Release>)>),
    Commits(LocalRepo, Vec<Commit>, usize, usize),
    Files(i64, String, Vec<FileEntry>),
    Env(String, i64, String, Vec<EnvVar>),
    RateLimit(Value),
}

pub struct Outcome {
    pub snapshot: Snapshot,
    pub change: Change,
    pub message: String,
}

impl Services {
    pub fn open(path: PathBuf) -> Result<Self> {
        let store = Store::open(&path)?;
        let github = GitHub::new()?;
        let replay = Replay::new(path.join("workspaces"))?;
        Ok(Self {
            store,
            github,
            replay: Arc::new(Mutex::new(replay)),
            snapshot_sequence: Arc::new(AtomicU64::new(0)),
        })
    }

    pub fn fork(&self) -> Result<Self> {
        Ok(Self {
            store: self.store.fork()?,
            github: self.github.clone(),
            replay: self.replay.clone(),
            snapshot_sequence: self.snapshot_sequence.clone(),
        })
    }

    fn replay(&self) -> Result<std::sync::MutexGuard<'_, Replay>> {
        self.replay
            .lock()
            .map_err(|_| anyhow::anyhow!("Replay worker failed"))
    }

    pub fn snapshot(&self) -> Result<Snapshot> {
        let revision = self.snapshot_sequence.fetch_add(1, Ordering::Relaxed) + 1;
        let replay = self.replay()?;
        let servers = replay.list();
        let diagnostics = replay.take_diagnostics();
        drop(replay);
        for message in diagnostics {
            self.store.log("ERROR", &message)?;
        }
        Ok(Snapshot {
            revision,
            watchlist: self.store.watchlist()?,
            repositories: self.store.repositories()?,
            servers,
            history: self.store.search_history()?,
            theme: self
                .store
                .setting("theme")?
                .unwrap_or_else(|| "default".into()),
            download_path: self.store.setting("download_path")?.unwrap_or_else(|| {
                self.store
                    .directory
                    .join("downloads")
                    .to_string_lossy()
                    .into()
            }),
            token_active: self.store.token()?.is_some(),
            token_from_env: std::env::var("GITHUB_TOKEN").is_ok_and(|v| !v.trim().is_empty()),
            logs: self.store.logs()?,
            last_repo_id: self
                .store
                .setting("last_repo_id")?
                .and_then(|v| v.parse().ok()),
        })
    }

    pub fn execute(&mut self, job: Job) -> Result<Outcome> {
        let result = self.execute_inner(job);
        if result.is_err() {
            let _ = self.store.log(
                "ERROR",
                "Operation failed; see the notification for details",
            );
        }
        result
    }

    fn execute_inner(&mut self, job: Job) -> Result<Outcome> {
        let mut change = Change::None;
        let mut message = String::from("Done");
        match job {
            Job::Load => message = "Ready".into(),
            Job::Discover(username, refresh) => {
                let (profile, repos) = self.github.discover(&self.store, &username, refresh)?;
                message = format!("Loaded {} repositories", repos.len());
                change = Change::Discovery(profile, repos, refresh);
            }
            Job::ProfileReadme(username, refresh) => {
                change = Change::ProfileReadme(
                    username.clone(),
                    self.github
                        .readme_refreshed(&self.store, &username, &username, refresh)
                        .unwrap_or_else(|_| "No profile README available.".into()),
                )
            }
            Job::Detail(repo) => {
                let (owner, name) = git_nexus_core::github::parse_identity(&repo.full_name)?;
                let readme = self
                    .github
                    .readme(&self.store, &owner, &name)
                    .unwrap_or_else(|error| format!("README unavailable: {error}"));
                change = Change::Detail(repo, readme);
            }
            Job::RemoteCommits(repo, page, refresh) => {
                let (owner, name) = git_nexus_core::github::parse_identity(&repo.full_name)?;
                change = Change::RemoteCommits(
                    repo.full_name.clone(),
                    self.github
                        .commits_refreshed(&self.store, &owner, &name, page, refresh)?,
                    page,
                );
            }
            Job::Counts(owner, repos, refresh) => {
                let mut counts = Vec::new();
                let mut failures = Vec::new();
                for repo in repos {
                    match self
                        .github
                        .commit_count(&self.store, &owner, &repo.name, refresh)
                    {
                        Ok(count) => counts.push((repo.name, count)),
                        Err(error) => failures.push(format!("{}: {error}", repo.name)),
                    }
                }
                message = format!(
                    "Loaded {} commit counts. {}",
                    counts.len(),
                    failures.join("; ")
                );
                change = Change::Counts(owner, counts);
            }
            Job::Contributions(owner, repos, refresh) => {
                let (commits, failures) =
                    self.github
                        .contributions(&self.store, &owner, &repos, refresh)?;
                message = format!(
                    "Loaded {} contributions. {}",
                    commits.len(),
                    failures.join("; ")
                );
                change = Change::Contributions(owner, commits);
            }
            Job::Watch(identity) => {
                self.github.add_watch(&self.store, &identity)?;
                message = "Repository added to watchlist".into();
            }
            Job::Unwatch(id) => {
                self.store.unwatch(id)?;
                message = "Repository removed from watchlist".into();
            }
            Job::CheckUpdates => {
                let (checked, failures) = self.github.check_updates(&self.store)?;
                message = format!("Checked {checked} repositories. {}", failures.join("; "));
            }
            Job::MarkCurrent(id) => self.store.mark_current(id)?,
            Job::Reorder(ids) => self.store.reorder(&ids)?,
            Job::Releases(owner, name, refresh) => {
                change = Change::Releases(
                    owner.clone(),
                    name.clone(),
                    self.github.releases(&self.store, &owner, &name, refresh)?,
                )
            }
            Job::WatchlistReleases => {
                let mut releases = Vec::new();
                for repo in self.store.watchlist()? {
                    let items = self
                        .github
                        .releases(&self.store, &repo.owner, &repo.name, false)
                        .unwrap_or_default();
                    releases.push((format!("{}/{}", repo.owner, repo.name), items));
                }
                change = Change::WatchlistReleases(releases);
            }
            Job::WatchlistRelease(owner, name, refresh) => {
                let releases = self.github.releases(&self.store, &owner, &name, refresh)?;
                change = Change::WatchlistReleases(vec![(format!("{owner}/{name}"), releases)]);
            }
            Job::Download(url, name) => {
                message = format!(
                    "Downloaded {}",
                    self.github.download(&self.store, &url, &name)?.display()
                )
            }
            Job::DownloadRelease(download) => {
                ensure!(
                    self.store
                        .watchlist()?
                        .iter()
                        .any(|repo| repo.id == download.repo.id
                            && repo.owner.eq_ignore_ascii_case(&download.repo.owner)
                            && repo.name.eq_ignore_ascii_case(&download.repo.name)),
                    "Repository is no longer tracked"
                );
                self.github.download_into(
                    &self.store,
                    &download.url(),
                    &download.filename(),
                    Some(&download.repo.name),
                )?;
                change = Change::DownloadedAsset(download.repo.id, download.filename());
                message = format!("Downloaded: {}", download.asset.name);
            }
            Job::DownloadRepos(repos) => {
                let mut downloaded = 0;
                let mut failures = Vec::new();
                for repo in repos {
                    let (owner, name) = git_nexus_core::github::parse_identity(&repo.full_name)?;
                    let url = format!("https://api.github.com/repos/{owner}/{name}/zipball");
                    match self.github.download_into(
                        &self.store,
                        &url,
                        &format!("{owner}-{name}.zip"),
                        Some("repos"),
                    ) {
                        Ok(_) => downloaded += 1,
                        Err(error) => failures.push(format!("{name}: {error}")),
                    }
                }
                message = format!(
                    "Downloaded {downloaded} repositories. {}",
                    failures.join("; ")
                );
            }
            Job::ImportWatchlist(path) => {
                let mut entries = Store::read_watchlist_import(&path)?;
                self.github
                    .prepare_watchlist_import(&self.store, &mut entries)?;
                message = format!(
                    "Imported {} repositories",
                    self.store.import_watchlist_entries(&entries)?
                )
            }
            Job::ExportWatchlist(path) => {
                self.store.export_watchlist_config(&path)?;
                message = format!("Exported watchlist to {}", path.display());
            }
            Job::AddLocal(path) => {
                let repo = self.store.add_repository(&path)?;
                self.store
                    .save_setting("last_repo_id", &repo.id.to_string())?;
                change = Change::Commits(
                    repo.clone(),
                    git::commits(Path::new(&repo.path), 1, 50)?,
                    1,
                    git::total_commits(Path::new(&repo.path))?,
                );
            }
            Job::Clone(identity, destination) => {
                let path = git::clone_repository(&identity, &destination)?;
                let repo = self.store.add_repository(&path)?;
                self.store
                    .save_setting("last_repo_id", &repo.id.to_string())?;
                change = Change::Commits(
                    repo.clone(),
                    git::commits(&path, 1, 50)?,
                    1,
                    git::total_commits(&path)?,
                );
            }
            Job::RemoveLocal(id) => {
                let mut replay = self.replay()?;
                for server in replay.list().into_iter().filter(|s| s.repo_id == id) {
                    replay.remove(&server.id)?;
                }
                drop(replay);
                self.store.remove_repository(id)?;
                if self.store.setting("last_repo_id")?.as_deref() == Some(&id.to_string()) {
                    self.store.save_setting("last_repo_id", "")?;
                }
                message = "Registration removed; repository files preserved".into();
            }
            Job::Commits(repo, page) => {
                self.store
                    .save_setting("last_repo_id", &repo.id.to_string())?;
                change = Change::Commits(
                    repo.clone(),
                    git::commits(Path::new(&repo.path), page, 50)?,
                    page,
                    git::total_commits(Path::new(&repo.path))?,
                );
            }
            Job::Files(repo, hash) => {
                change = Change::Files(
                    repo.id,
                    hash.clone(),
                    git::file_entries(Path::new(&repo.path), &hash)?,
                )
            }
            Job::File(repo, hash, path) => {
                let code = !path.to_ascii_lowercase().ends_with(".md");
                change = Change::Text(
                    path.clone(),
                    git::file_content(Path::new(&repo.path), &hash, &path)?,
                    code,
                )
            }
            Job::Start(repo, hash, port) => {
                let server = self.replay()?.start(&repo, &hash, port)?;
                message = format!("Replay running on port {}", server.port);
            }
            Job::Stop(id) => self.replay()?.stop(&id)?,
            Job::RemoveServer(id) => {
                let mut replay = self.replay()?;
                anyhow::ensure!(
                    replay
                        .list()
                        .iter()
                        .all(|server| server.id != id || server.status != "running"),
                    "Stop the server before removing it"
                );
                replay.remove(&id)?;
            }
            Job::StopAll => self.replay()?.stop_all()?,
            Job::SaveToken(token) => {
                ensure!(
                    !std::env::var("GITHUB_TOKEN").is_ok_and(|v| !v.trim().is_empty()),
                    "GITHUB_TOKEN is environment-managed; change it in environment settings"
                );
                self.store.save_token(&token)?;
                change = Change::TokenSaved;
                message = if token.trim().is_empty() {
                    "Saved GitHub token removed"
                } else {
                    "Encrypted GitHub token saved"
                }
                .into();
            }
            Job::SavePath(path) => {
                let path = PathBuf::from(path);
                ensure!(
                    path.is_absolute() && path.parent().is_some(),
                    "Choose an absolute download directory below filesystem root"
                );
                std::fs::create_dir_all(&path)?;
                let path = path.canonicalize()?;
                ensure!(
                    path.parent().is_some(),
                    "Cannot download into filesystem root"
                );
                self.store.save_setting(
                    "download_path",
                    path.to_str().context("Path must be UTF-8")?,
                )?;
                message = "Download directory saved".into();
            }
            Job::Theme(theme) => self.store.save_setting("theme", &theme)?,
            Job::ClearCache => {
                self.store.clear_cache()?;
                message = "Cached GitHub responses cleared".into();
            }
            Job::ClearLogs => self.store.clear_logs()?,
            Job::RateLimit => change = Change::RateLimit(self.github.rate_limit(&self.store)?),
            Job::Env(scope, id, hash) => {
                change = Change::Env(
                    scope.clone(),
                    id,
                    hash.clone(),
                    self.store.env_vars(&scope, id, &hash)?,
                )
            }
            Job::SaveEnv(scope, id, hash, values) => {
                self.store.save_env(&scope, id, &hash, &values)?;
                message = "Environment variables encrypted and saved".into();
            }
            Job::MergedEnv(id, hash) => {
                change = Change::Env(
                    "merged".into(),
                    id,
                    hash.clone(),
                    self.store
                        .merged_env(id, &hash)?
                        .into_iter()
                        .map(|(key, value)| EnvVar { key, value })
                        .collect(),
                )
            }
        }
        // Do not log the inputs of jobs: token/environment editors can contain secrets.
        if !matches!(message.as_str(), "Ready" | "Done") {
            self.store.log("INFO", &message)?;
        }
        Ok(Outcome {
            snapshot: self.snapshot()?,
            change,
            message,
        })
    }
}

