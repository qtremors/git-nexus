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
            .header(
                USER_AGENT,
                concat!("GitNexus/", env!("CARGO_PKG_VERSION"), " native"),
            )
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
            .header(
                USER_AGENT,
                concat!("GitNexus/", env!("CARGO_PKG_VERSION"), " native"),
            )
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn configuration_import_resolves_metadata_before_committing() -> Result<()> {
        ensure!(
            !std::env::var("GITHUB_TOKEN").is_ok_and(|token| !token.trim().is_empty()),
            "Loopback fixtures must not receive an environment token"
        );
        let (mut github, worker) = fixture(vec![("/repos/owner/missing", 404, "missing", None)])?;
        let dir = tempfile::tempdir()?;
        let mut store = Store::open(dir.path())?;
        store.watch("owner", "existing", &GitHubRepo::default(), Some("v0.9"))?;
        for name in ["first", "second"] {
            let repo = GitHubRepo {
                name: name.into(),
                full_name: format!("owner/{name}"),
                description: Some(format!("Metadata for {name}")),
                html_url: format!("https://github.com/owner/{name}"),
                ..Default::default()
            };
            store.cache_put(
                &format!("github:/repos/owner/{name}"),
                &serde_json::to_value(repo)?,
                60,
            )?;
            store.cache_put(
                &format!("github:/repos/owner/{name}/releases?per_page=30"),
                &serde_json::to_value(vec![
                    Release {
                        tag_name: "v3-draft".into(),
                        draft: true,
                        ..Default::default()
                    },
                    Release {
                        tag_name: "v2-beta".into(),
                        prerelease: true,
                        ..Default::default()
                    },
                    Release {
                        tag_name: "v1.0".into(),
                        ..Default::default()
                    },
                ])?,
                60,
            )?;
        }
        let config = dir.path().join("config.json");
        fs::write(
            &config,
            r#"[{"owner":"OWNER","name":"existing"},{"owner":"owner","name":"first"}]"#,
        )?;
        let mut entries = Store::read_watchlist_import(&config)?;
        github.prepare_watchlist_import(&store, &mut entries)?;
        assert_eq!(store.watchlist()?.len(), 1);
        assert_eq!(store.import_watchlist_entries(&entries)?, 1);
        let repos = store.watchlist()?;
        assert_eq!(repos[0].current_version, "v0.9");
        assert_eq!(repos[1].description.as_deref(), Some("Metadata for first"));
        assert_eq!(
            repos[1].html_url.as_deref(),
            Some("https://github.com/owner/first")
        );
        assert_eq!(repos[1].current_version, "v1.0");
        assert_eq!(repos[1].latest_version.as_deref(), Some("v1.0"));
        assert_eq!(store.import_watchlist_entries(&entries)?, 0);

        fs::write(
            &config,
            r#"[{"owner":"owner","name":"second"},{"owner":"owner","name":"missing"}]"#,
        )?;
        let mut entries = Store::read_watchlist_import(&config)?;
        let error = github
            .prepare_watchlist_import(&store, &mut entries)
            .unwrap_err();
        assert!(error.to_string().contains("owner/missing"));
        assert_eq!(store.watchlist()?.len(), 2);
        worker.join().unwrap();
        Ok(())
    }

    #[test]
    fn forced_refresh_bypasses_independent_caches() -> Result<()> {
        ensure!(
            !std::env::var("GITHUB_TOKEN").is_ok_and(|token| !token.trim().is_empty()),
            "The loopback fixture must not receive an environment GitHub token"
        );
        let server =
            tiny_http::Server::http("127.0.0.1:0").map_err(|error| anyhow::anyhow!("{error}"))?;
        let address = format!("http://{}", server.server_addr());
        let worker = std::thread::spawn(move || {
            for (path, body) in [
                ("/repos/fixture/project/readme", "# Fresh README"),
                (
                    "/repos/fixture/project/commits?per_page=100&page=1",
                    r#"[{"sha":"fresh"}]"#,
                ),
                (
                    "/repos/fixture/project/commits?per_page=1",
                    r#"[{"sha":"fresh"}]"#,
                ),
            ] {
                let request = server
                    .recv_timeout(Duration::from_secs(5))
                    .unwrap()
                    .unwrap();
                assert_eq!(request.url(), path);
                request
                    .respond(tiny_http::Response::from_string(body))
                    .unwrap();
            }
        });
        let dir = tempfile::tempdir()?;
        let store = Store::open(dir.path())?;
        store.cache_put("readme:fixture/project", &Value::from("# Old README"), 60)?;
        store.cache_put(
            "github:/repos/fixture/project/commits?per_page=100&page=1",
            &serde_json::json!([{"sha":"old"}]),
            60,
        )?;
        store.cache_put("count:fixture/project", &Value::from(99), 60)?;
        let mut github = GitHub {
            client: Client::builder()
                .no_proxy()
                .timeout(Duration::from_secs(2))
                .build()?,
            base: address,
            rate_remaining: None,
        };
        assert_eq!(github.readme(&store, "fixture", "project")?, "# Old README");
        assert_eq!(
            github.commits(&store, "fixture", "project", 1)?[0]["sha"],
            "old"
        );
        assert_eq!(
            github.commit_count(&store, "fixture", "project", false)?,
            99
        );
        assert_eq!(
            github.readme_refreshed(&store, "fixture", "project", true)?,
            "# Fresh README"
        );
        assert_eq!(
            github.commits_refreshed(&store, "fixture", "project", 1, true)?[0]["sha"],
            "fresh"
        );
        assert_eq!(github.commit_count(&store, "fixture", "project", true)?, 1);
        worker.join().unwrap();
        // Once the fixture stops, ordinary reads must use the replaced caches.
        assert_eq!(
            github.readme(&store, "fixture", "project")?,
            "# Fresh README"
        );
        assert_eq!(
            github.commits(&store, "fixture", "project", 1)?[0]["sha"],
            "fresh"
        );
        assert_eq!(github.commit_count(&store, "fixture", "project", false)?, 1);
        Ok(())
    }
    #[test]
    fn identities_and_download_hosts_reject_traversal_and_ssrf() {
        assert_eq!(
            parse_identity("https://github.com/qtremors/git-nexus.git").unwrap(),
            ("qtremors".into(), "git-nexus".into())
        );
        for input in [
            "../repo",
            "owner/../../etc",
            "https://example.com/a/b",
            "https://github.com@evil.test/a/b",
            "https://github.com/a/b?token=secret",
        ] {
            assert!(parse_identity(input).is_err(), "{input}");
        }
        for input in [
            "http://github.com/a",
            "https://127.0.0.1/a",
            "https://github.com.evil.test/a",
            "https://github.com:444/a",
        ] {
            assert!(validate_download_url(input).is_err(), "{input}");
        }
        assert!(validate_download_url("https://release-assets.githubusercontent.com/a").is_ok());
        assert_eq!(sanitize_filename("../../etc/file.zip"), "etcfile.zip");
    }
    #[test]
    fn public_discovery_uses_real_http_and_cache() -> Result<()> {
        use tiny_http::{Response, Server};
        let server = Server::http("127.0.0.1:0").map_err(|e| anyhow::anyhow!("{e}"))?;
        let address = format!("http://{}", server.server_addr());
        let worker = std::thread::spawn(move || {
            for _ in 0..2 {
                let request = server
                    .recv_timeout(Duration::from_secs(5))
                    .unwrap()
                    .unwrap();
                let response = if request.url().contains("/repos?") {
                    "[]"
                } else {
                    r#"{"login":"qtremors","name":null,"bio":null,"avatar_url":"","html_url":"","followers":1,"following":0,"public_repos":0}"#
                };
                request.respond(Response::from_string(response)).unwrap();
            }
        });
        let directory = tempfile::tempdir()?;
        let store = Store::open(directory.path())?;
        let mut github = GitHub {
            client: Client::builder().no_proxy().build()?,
            base: address,
            rate_remaining: None,
        };
        assert_eq!(
            github.discover(&store, "qtremors", false)?.0.login,
            "qtremors"
        );
        worker.join().unwrap();
        // The server has exited: this only succeeds if both responses were cached.
        assert_eq!(github.discover(&store, "qtremors", false)?.0.followers, 1);
        assert_eq!(store.search_history()?, vec!["qtremors"]);
        Ok(())
    }
    fn fixture(
        responses: Vec<(&'static str, u16, &'static str, Option<&'static str>)>,
    ) -> Result<(GitHub, std::thread::JoinHandle<()>)> {
        let server = tiny_http::Server::http("127.0.0.1:0").map_err(|e| anyhow::anyhow!("{e}"))?;
        let address = format!("http://{}", server.server_addr());
        let worker = std::thread::spawn(move || {
            for (endpoint, status, body, link) in responses {
                let request = server
                    .recv_timeout(Duration::from_secs(5))
                    .unwrap()
                    .expect("Missing expected HTTP request");
                assert_eq!(request.url(), endpoint);
                let mut response = tiny_http::Response::from_string(body).with_status_code(status);
                if let Some(link) = link {
                    response.add_header(tiny_http::Header::from_bytes("Link", link).unwrap());
                }
                request.respond(response).unwrap();
            }
        });
        Ok((
            GitHub {
                client: Client::builder().no_proxy().build()?,
                base: address,
                rate_remaining: None,
            },
            worker,
        ))
    }

    #[test]
    fn commit_pagination_empty_repos_and_cached_counts() -> Result<()> {
        let (mut github, worker) = fixture(vec![
            (
                "/repos/owner/repo/commits?per_page=1",
                200,
                "[]",
                Some(
                    "<https://api.github.com/repos/owner/repo/commits?per_page=1&page=42>; rel=\"last\"",
                ),
            ),
            (
                "/repos/owner/repo/commits?per_page=100&page=2",
                200,
                "[{\"sha\":\"abc1234\"}]",
                None,
            ),
            (
                "/repos/owner/empty/commits?per_page=100&page=1",
                409,
                "{\"message\":\"Git Repository is empty.\"}",
                None,
            ),
            (
                "/repos/owner/empty/commits?per_page=1",
                409,
                "{\"message\":\"Git Repository is empty.\"}",
                None,
            ),
            (
                "/repos/owner/missing/commits?per_page=100&page=1",
                404,
                "{}",
                None,
            ),
        ])?;
        let dir = tempfile::tempdir()?;
        let store = Store::open(dir.path())?;
        assert_eq!(github.commit_count(&store, "owner", "repo", false)?, 42);
        assert_eq!(
            github.commits(&store, "owner", "repo", 2)?[0]["sha"],
            "abc1234"
        );
        assert!(github.commits(&store, "owner", "empty", 1)?.is_empty());
        assert_eq!(github.commit_count(&store, "owner", "empty", false)?, 0);
        assert!(github.commits(&store, "owner", "missing", 1).is_err());
        worker.join().unwrap();
        assert_eq!(github.commit_count(&store, "owner", "repo", false)?, 42);
        assert!(github.commits(&store, "owner", "empty", 1)?.is_empty());
        Ok(())
    }

    #[test]
    fn release_refresh_preserves_current_version_and_reports_partial_failure() -> Result<()> {
        let (mut github, worker) = fixture(vec![
            (
                "/repos/owner/repo/releases?per_page=30",
                200,
                r#"[{"id":1,"tag_name":"v3-beta","html_url":"","prerelease":true},{"id":2,"tag_name":"v4-draft","html_url":"","draft":true},{"id":3,"tag_name":"v2","html_url":""}]"#,
                None,
            ),
            ("/repos/owner/denied/releases?per_page=30", 403, "{}", None),
        ])?;
        let dir = tempfile::tempdir()?;
        let store = Store::open(dir.path())?;
        store.watch("owner", "repo", &GitHubRepo::default(), Some("v1"))?;
        store.watch("owner", "denied", &GitHubRepo::default(), Some("v1"))?;
        let (count, failures) = github.check_updates(&store)?;
        assert_eq!(count, 1);
        assert_eq!(failures.len(), 1);
        let repos = store.watchlist()?;
        assert_eq!(repos[0].current_version, "v1");
        assert_eq!(repos[0].latest_version.as_deref(), Some("v2"));
        assert!(repos[0].has_update());
        assert_eq!(repos[1].latest_version.as_deref(), Some("v1"));
        worker.join().unwrap();
        Ok(())
    }

    #[test]
    fn streamed_download_is_atomic_and_never_overwrites() -> Result<()> {
        let (github, worker) = fixture(vec![
            ("/asset", 200, "binary contents", None),
            ("/asset", 200, "replacement", None),
        ])?;
        let dir = tempfile::tempdir()?;
        let response = github.client.get(format!("{}/asset", github.base)).send()?;
        let store = Store::open(dir.path().join("state"))?;
        store.save_setting(
            "download_path",
            dir.path().join("downloads").to_str().unwrap(),
        )?;
        let destination = download_directory(&store, Some("project"))?;
        assert!(destination.ends_with("downloads/project"));
        let file = save_download(response, &destination, "../../asset.zip")?;
        assert_eq!(std::fs::read(&file)?, b"binary contents");
        let response = github.client.get(format!("{}/asset", github.base)).send()?;
        assert!(save_download(response, &destination, "asset.zip").is_err());
        assert_eq!(std::fs::read(file)?, b"binary contents");
        assert_eq!(std::fs::read_dir(&destination)?.count(), 1);
        assert!(
            download_directory(&store, Some("../../outside"))?
                .starts_with(dir.path().join("downloads").canonicalize()?)
        );
        worker.join().unwrap();
        Ok(())
    }
    #[test]
    fn discovery_fetches_more_than_one_hundred_repositories() -> Result<()> {
        let server = tiny_http::Server::http("127.0.0.1:0").map_err(|e| anyhow::anyhow!("{e}"))?;
        let address = format!("http://{}", server.server_addr());
        let worker = std::thread::spawn(move || {
            for page in 0..3 {
                let request = server
                    .recv_timeout(Duration::from_secs(5))
                    .unwrap()
                    .unwrap();
                let data = if page == 0 {
                    assert_eq!(request.url(), "/users/owner");
                    serde_json::to_value(Profile {
                        login: "owner".into(),
                        ..Default::default()
                    })
                    .unwrap()
                } else {
                    assert_eq!(
                        request.url(),
                        format!("/users/owner/repos?per_page=100&sort=updated&page={page}")
                    );
                    serde_json::to_value(
                        (0..if page == 1 { 100 } else { 1 })
                            .map(|i| GitHubRepo {
                                id: (page * 100 + i) as u64,
                                name: format!("repo-{page}-{i}"),
                                ..Default::default()
                            })
                            .collect::<Vec<_>>(),
                    )
                    .unwrap()
                };
                request
                    .respond(tiny_http::Response::from_string(data.to_string()))
                    .unwrap();
            }
        });
        let dir = tempfile::tempdir()?;
        let store = Store::open(dir.path())?;
        let mut github = GitHub {
            client: Client::builder().no_proxy().build()?,
            base: address,
            rate_remaining: None,
        };
        let (_, repos) = github.discover(&store, "owner", false)?;
        assert_eq!(repos.len(), 101);
        assert_eq!(repos[100].name, "repo-2-0");
        worker.join().unwrap();
        assert_eq!(github.discover(&store, "owner", false)?.1.len(), 101);
        Ok(())
    }

    #[test]
    fn interrupted_download_removes_partial_file() -> Result<()> {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0")?;
        let address = listener.local_addr()?;
        let worker = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = [0u8; 4096];
            let _ = stream.read(&mut request).unwrap();
            stream
                .write_all(
                    b"HTTP/1.1 200 OK\r\nContent-Length: 100\r\nConnection: close\r\n\r\nshort",
                )
                .unwrap();
        });
        let dir = tempfile::tempdir()?;
        let response = Client::builder()
            .no_proxy()
            .build()?
            .get(format!("http://{address}/asset"))
            .send()?;
        assert!(save_download(response, dir.path(), "asset.zip").is_err());
        assert_eq!(std::fs::read_dir(dir.path())?.count(), 0);
        worker.join().unwrap();
        Ok(())
    }
}
