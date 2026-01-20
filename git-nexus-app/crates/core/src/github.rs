use crate::{Store, models::*};
use anyhow::{Context, Result, bail, ensure};
use reqwest::{
    blocking::{Client, Response},
    header::{ACCEPT, USER_AGENT},
    redirect::Policy,
};
use serde::de::DeserializeOwned;
use serde_json::Value;
use std::{fs, io::Write, path::PathBuf, time::Duration};
use url::Url;

pub const COMMIT_PAGE_SIZE: usize = 100;

#[derive(Debug)]
struct EmptyRepository;
impl std::fmt::Display for EmptyRepository {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("GitHub repository is empty")
    }
}
impl std::error::Error for EmptyRepository {}

#[derive(Clone)]
pub struct GitHub {
    client: Client,
    base: String,
    pub rate_remaining: Option<u64>,
}

impl GitHub {
    pub fn new() -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .redirect(Policy::custom(|attempt| {
                if attempt.previous().len() >= 5 {
                    return attempt.error("Too many redirects");
                }
                if validate_download_url(attempt.url().as_str()).is_ok() {
                    attempt.follow()
                } else {
                    attempt.error("Redirect to an untrusted download destination")
                }
            }))
            .build()?;
        Ok(Self {
            client,
            base: "https://api.github.com".into(),
            rate_remaining: None,
        })
    }

    fn response(&mut self, endpoint: &str, token: Option<&str>, accept: &str) -> Result<Response> {
        let mut request = self
            .client
            .get(format!("{}{endpoint}", self.base))
            .header(USER_AGENT, concat!("GitNexus/", env!("CARGO_PKG_VERSION"), " native"))
            .header(ACCEPT, accept);
        if let Some(token) = token {
            request = request.bearer_auth(token);
        }
        let response = request
            .send()
            .context("GitHub request failed; check network access and proxy CA trust")?;
        self.rate_remaining = response
            .headers()
            .get("x-ratelimit-remaining")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse().ok());
        let status = response.status();
        if !status.is_success() {
            if status.as_u16() == 409 && endpoint.contains("/commits?") {
                let body: Value = response.json()?;
                if body["message"]
                    .as_str()
                    .is_some_and(|message| message.to_lowercase().contains("empty"))
                {
                    return Err(EmptyRepository.into());
                }
                bail!("GitHub returned a repository conflict (409)");
            }
            if status.as_u16() == 404 {
                bail!("GitHub resource not found (404)");
            }
            if status.as_u16() == 401 {
                bail!("GitHub rejected the configured token (401)");
            }
            if status.as_u16() == 403 || status.as_u16() == 429 {
                bail!(
                    "GitHub access denied or rate limit reached ({status}); check network access and token permissions"
                );
            }
            bail!("GitHub returned {status}");
        }
        Ok(response)
    }

    fn cached<T: DeserializeOwned>(
        &mut self,
        store: &Store,
        endpoint: &str,
        refresh: bool,
    ) -> Result<T> {
        let key = format!("github:{endpoint}");
        if !refresh && let Some(value) = store.cache_get(&key)? {
            return Ok(serde_json::from_value(value)?);
        }
        let token = store.token()?;
        let value: Value =
            match self.response(endpoint, token.as_deref(), "application/vnd.github+json") {
                Ok(response) => response.json()?,
                Err(error) if error.is::<EmptyRepository>() => serde_json::json!([]),
                Err(error) => return Err(error),
            };
        store.cache_put(&key, &value, 1800)?;
        Ok(serde_json::from_value(value)?)
    }

    pub fn discover(
        &mut self,
        store: &Store,
        username: &str,
        refresh: bool,
    ) -> Result<(Profile, Vec<GitHubRepo>)> {
        validate_identity(username, "placeholder")?;
        let profile = self.cached(store, &format!("/users/{username}"), refresh)?;
        let mut repos = Vec::new();
        for page in 1..=100 {
            let batch: Vec<GitHubRepo> = self.cached(
                store,
                &format!("/users/{username}/repos?per_page=100&sort=updated&page={page}"),
                refresh,
            )?;
            let done = batch.len() < 100;
            repos.extend(batch);
            if done {
                store.record_search(username)?;
                return Ok((profile, repos));
            }
        }
        bail!("Repository pagination exceeded the supported limit")
    }

    pub fn repository(&mut self, store: &Store, owner: &str, name: &str) -> Result<GitHubRepo> {
        validate_identity(owner, name)?;
        self.cached(store, &format!("/repos/{owner}/{name}"), false)
    }

    pub fn releases(
        &mut self,
        store: &Store,
        owner: &str,
        name: &str,
        refresh: bool,
    ) -> Result<Vec<Release>> {
        validate_identity(owner, name)?;
        self.cached(
            store,
            &format!("/repos/{owner}/{name}/releases?per_page=30"),
            refresh,
        )
    }

    pub fn readme(&mut self, store: &Store, owner: &str, name: &str) -> Result<String> {
        self.readme_refreshed(store, owner, name, false)
    }

    pub fn readme_refreshed(
        &mut self,
        store: &Store,
        owner: &str,
        name: &str,
        refresh: bool,
    ) -> Result<String> {
        validate_identity(owner, name)?;
        let key = format!("readme:{owner}/{name}");
        if !refresh
            && let Some(value) = store.cache_get(&key)?
            && let Some(text) = value.as_str()
        {
            return Ok(text.to_string());
        }
        let token = store.token()?;
        let text = self
            .response(
                &format!("/repos/{owner}/{name}/readme"),
                token.as_deref(),
                "application/vnd.github.raw+json",
            )?
            .text()?;
        store.cache_put(&key, &Value::String(text.clone()), 1800)?;
        Ok(text)
    }

    pub fn commits(
        &mut self,
        store: &Store,
        owner: &str,
        name: &str,
        page: usize,
    ) -> Result<Vec<Value>> {
        self.commits_refreshed(store, owner, name, page, false)
    }

    pub fn commits_refreshed(
        &mut self,
        store: &Store,
        owner: &str,
        name: &str,
        page: usize,
        refresh: bool,
    ) -> Result<Vec<Value>> {
        validate_identity(owner, name)?;
        ensure!(page > 0, "Invalid page");
        self.cached(
            store,
            &format!("/repos/{owner}/{name}/commits?per_page={COMMIT_PAGE_SIZE}&page={page}"),
            refresh,
        )
    }

    pub fn rate_limit(&mut self, store: &Store) -> Result<Value> {
        self.cached(store, "/rate_limit", true)
    }

    pub fn commit_count(
        &mut self,
        store: &Store,
        owner: &str,
        name: &str,
        refresh: bool,
    ) -> Result<u64> {
        validate_identity(owner, name)?;
        let key = format!("count:{owner}/{name}");
        if !refresh
            && let Some(value) = store.cache_get(&key)?
            && let Some(count) = value.as_u64()
        {
            return Ok(count);
        }
        let token = store.token()?;
        let response = match self.response(
            &format!("/repos/{owner}/{name}/commits?per_page=1"),
            token.as_deref(),
            "application/vnd.github+json",
        ) {
            Ok(response) => response,
            Err(error) if error.is::<EmptyRepository>() => {
                store.cache_put(&key, &Value::from(0), 1800)?;
                return Ok(0);
            }
            Err(error) => return Err(error),
        };
        let last = response
            .headers()
            .get("link")
            .and_then(|v| v.to_str().ok())
            .and_then(|links| links.split(',').find(|link| link.contains("rel=\"last\"")))
            .and_then(|link| link.split('<').nth(1)?.split('>').next())
            .and_then(|url| Url::parse(url).ok())
            .and_then(|url| {
                url.query_pairs()
                    .find(|(key, _)| key == "page")
                    .and_then(|(_, value)| value.parse::<u64>().ok())
            });
        let count = match last {
            Some(count) => count,
            None => response.json::<Vec<Value>>()?.len() as u64,
        };
        store.cache_put(&key, &Value::from(count), 1800)?;
        Ok(count)
    }

    pub fn contributions(
        &mut self,
        store: &Store,
        username: &str,
        repos: &[GitHubRepo],
        refresh: bool,
    ) -> Result<(Vec<Contribution>, Vec<String>)> {
        validate_identity(username, "placeholder")?;
        let since = format!(
            "{}T00:00:00Z",
            (chrono::Utc::now() - chrono::Duration::days(365)).format("%Y-%m-%d")
        );
        let since =
            percent_encoding::utf8_percent_encode(&since, percent_encoding::NON_ALPHANUMERIC)
                .to_string();
        let mut contributions = Vec::new();
        let mut failures = Vec::new();
        for repo in repos {
            let result = (|| -> Result<Vec<Contribution>> {
                validate_identity(username, &repo.name)?;
                let mut result = Vec::new();
                for page in 1..=100 {
                    let commits: Vec<Value> = self.cached(
                        store,
                        &format!(
                            "/repos/{username}/{}/commits?since={since}&per_page=100&page={page}",
                            repo.name
                        ),
                        refresh,
                    )?;
                    let done = commits.len() < 100;
                    for commit in commits {
                        result.push(Contribution {
                            sha: commit["sha"].as_str().unwrap_or_default().into(),
                            date: commit["commit"]["author"]["date"]
                                .as_str()
                                .unwrap_or_default()
                                .into(),
                            message: commit["commit"]["message"]
                                .as_str()
                                .unwrap_or_default()
                                .into(),
                            repo: repo.name.clone(),
                            url: commit["html_url"].as_str().unwrap_or_default().into(),
                        });
                    }
                    if done {
                        return Ok(result);
                    }
                }
                bail!("Commit pagination exceeded supported limit")
            })();
            match result {
                Ok(result) => contributions.extend(result),
                Err(error) => failures.push(format!("{}: {error}", repo.name)),
            }
        }
        Ok((contributions, failures))
    }

    pub fn add_watch(&mut self, store: &Store, identity: &str) -> Result<()> {
        let (owner, name) = parse_identity(identity)?;
        let repo = self.repository(store, &owner, &name)?;
        let releases = self.releases(store, &owner, &name, false)?;
        let latest = releases
            .iter()
            .find(|r| !r.prerelease && !r.draft)
            .map(|r| r.tag_name.as_str());
        store.watch(&owner, &name, &repo, latest)
    }

    pub fn prepare_watchlist_import(
        &mut self,
        store: &Store,
        entries: &mut [WatchlistEntry],
    ) -> Result<()> {
        for entry in entries.iter() {
            validate_identity(&entry.owner, &entry.name)?;
        }
        let existing = store.watchlist()?;
        for entry in entries {
            if existing.iter().any(|repo| {
                repo.owner.eq_ignore_ascii_case(&entry.owner)
                    && repo.name.eq_ignore_ascii_case(&entry.name)
            }) {
                continue;
            }
            let identity = format!("{}/{}", entry.owner, entry.name);
            let metadata = self
                .repository(store, &entry.owner, &entry.name)
                .with_context(|| format!("Cannot import {identity}: repository lookup failed"))?;
            let releases = self
                .releases(store, &entry.owner, &entry.name, false)
                .with_context(|| format!("Cannot import {identity}: release lookup failed"))?;
            let latest = releases
                .iter()
                .find(|release| !release.prerelease && !release.draft)
                .map(|release| release.tag_name.clone());
            entry.description = metadata.description;
            entry.html_url = Some(metadata.html_url);
            entry.latest_version = latest.clone();
            if entry.current_version.is_none() {
                entry.current_version = Some(latest.unwrap_or_else(|| "Unknown".into()));
            }
        }
        Ok(())
    }

    /// Returns failures separately so a partial refresh is never presented as complete.

    pub fn check_updates(&mut self, store: &Store) -> Result<(usize, Vec<String>)> {
        let mut updated = 0;
        let mut failures = Vec::new();
        for repo in store.watchlist()? {
            match self.releases(store, &repo.owner, &repo.name, true) {
                Ok(releases) => {
                    store.update_version(
                        repo.id,
                        releases
                            .iter()
                            .find(|r| !r.prerelease && !r.draft)
                            .map(|r| r.tag_name.as_str()),
                    )?;
                    updated += 1;
                }
                Err(error) => failures.push(format!("{}/{}: {error}", repo.owner, repo.name)),
            }
        }
        Ok((updated, failures))
    }

    pub fn download(&self, store: &Store, url: &str, name: &str) -> Result<PathBuf> {
        self.download_into(store, url, name, None)
    }

    pub fn download_into(
        &self,
        store: &Store,
        url: &str,
        name: &str,
        folder: Option<&str>,
    ) -> Result<PathBuf> {
        validate_download_url(url)?;
        let directory = download_directory(store, folder)?;
        let mut request = self
            .client
            .get(url)
            .header(USER_AGENT, concat!("GitNexus/", env!("CARGO_PKG_VERSION"), " native"))
            .header(ACCEPT, "application/octet-stream")
            .timeout(Duration::from_secs(300));
        if Url::parse(url)?.host_str() == Some("api.github.com")
            && let Some(token) = store.token()?
        {
            request = request.bearer_auth(token);
        }
        let response = request.send()?.error_for_status()?;
        save_download(response, &directory, name)
    }
}

fn download_directory(store: &Store, folder: Option<&str>) -> Result<PathBuf> {
    let root = store
        .setting("download_path")?
        .map(PathBuf::from)
        .unwrap_or_else(|| store.directory.join("downloads"));
    fs::create_dir_all(&root)?;
    let root = root.canonicalize()?;
    ensure!(
        root.parent().is_some(),
        "Cannot download into filesystem root"
    );
    let Some(folder) = folder else {
        return Ok(root);
    };
    let directory = root.join(sanitize_filename(folder));
    fs::create_dir_all(&directory)?;
    let directory = directory.canonicalize()?;
    ensure!(
        directory.starts_with(&root) && directory != root,
        "Download directory must remain below the configured folder"
    );
    Ok(directory)
}

fn save_download(
    mut response: Response,
    directory: &std::path::Path,
    name: &str,
) -> Result<PathBuf> {
    let destination = directory.join(sanitize_filename(name));
    ensure!(
        !destination.exists(),
        "Download already exists; choose another directory or remove it explicitly"
    );
    let temporary = directory.join(format!(".{}.part", uuid::Uuid::new_v4()));
    let result = (|| -> Result<()> {
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)?;
        response.copy_to(&mut file)?;
        file.flush()?;
        file.sync_all()?;
        // A hard link atomically fails if another download claimed the destination.
        fs::hard_link(&temporary, &destination)?;
        Ok(())
    })();
    let _ = fs::remove_file(&temporary);
    result?;
    Ok(destination)
}

pub fn validate_identity(owner: &str, name: &str) -> Result<()> {
    for value in [owner, name] {
        ensure!(
            !value.is_empty()
                && value.len() <= 100
                && value
                    .bytes()
                    .all(|c| c.is_ascii_alphanumeric() || b"._-".contains(&c))
                && value != "."
                && value != "..",
            "Invalid GitHub owner or repository name"
        );
    }
    Ok(())
}

pub fn parse_identity(input: &str) -> Result<(String, String)> {
    let input = input.trim();
    let identity = if input.contains("://") {
        let url = Url::parse(input)?;
        ensure!(
            url.scheme() == "https"
                && url.host_str() == Some("github.com")
                && url.username().is_empty()
                && url.password().is_none()
                && url.port().is_none(),
            "Expected an HTTPS github.com repository URL"
        );
        ensure!(
            url.query().is_none() && url.fragment().is_none(),
            "Repository URLs cannot contain queries or fragments"
        );
        url.path().trim_matches('/').to_string()
    } else {
        input.to_string()
    };
    let (owner, name) = identity
        .split_once('/')
        .context("Use owner/repository or a GitHub repository URL")?;
    let name = name.strip_suffix(".git").unwrap_or(name);
    validate_identity(owner, name)?;
    Ok((owner.to_string(), name.to_string()))
}

pub fn validate_download_url(input: &str) -> Result<()> {
    let url = Url::parse(input)?;
    ensure!(
        url.scheme() == "https"
            && url.username().is_empty()
            && url.password().is_none()
            && url.port().is_none(),
        "Only standard HTTPS downloads are supported"
    );
    ensure!(
        matches!(
            url.host_str(),
            Some(
                "github.com"
                    | "api.github.com"
                    | "raw.githubusercontent.com"
                    | "codeload.github.com"
                    | "objects.githubusercontent.com"
                    | "github-releases.githubusercontent.com"
                    | "release-assets.githubusercontent.com"
            )
        ),
        "Download destination is not a trusted GitHub host"
    );
    Ok(())
}

pub fn sanitize_filename(input: &str) -> String {
    let value: String = input
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || "._- ".contains(*c))
        .collect();
    let value = value.trim_matches(['.', ' ']);
    if value.is_empty() {
        "download".into()
    } else {
        value.to_string()
    }
}

