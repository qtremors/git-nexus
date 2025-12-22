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

    pub fn rate_limit(&mut self, store: &Store) -> Result<Value> {
        self.cached(store, "/rate_limit", true)
    }
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

