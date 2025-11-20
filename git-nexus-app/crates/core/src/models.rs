use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct Profile {
    pub login: String,
    pub name: Option<String>,
    pub bio: Option<String>,
    pub avatar_url: String,
    pub html_url: String,
    pub followers: u64,
    pub following: u64,
    pub public_repos: u64,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct GitHubRepo {
    pub id: u64,
    pub name: String,
    pub full_name: String,
    pub description: Option<String>,
    pub language: Option<String>,
    pub html_url: String,
    pub clone_url: String,
    pub default_branch: String,
    pub stargazers_count: u64,
    pub forks_count: u64,
    #[serde(default)]
    pub topics: Vec<String>,
    #[serde(default)]
    pub archived: bool,
    #[serde(default)]
    pub updated_at: String,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub homepage: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct ReleaseAsset {
    pub id: u64,
    pub name: String,
    pub size: u64,
    pub browser_download_url: String,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct Release {
    pub id: u64,
    pub tag_name: String,
    pub name: Option<String>,
    pub body: Option<String>,
    pub html_url: String,
    pub published_at: Option<String>,
    #[serde(default)]
    pub zipball_url: String,
    #[serde(default)]
    pub tarball_url: String,
    #[serde(default)]
    pub assets: Vec<ReleaseAsset>,
    #[serde(default)]
    pub prerelease: bool,
    #[serde(default)]
    pub draft: bool,
}

impl Release {
    /// Include GitHub's source archives in the same list as uploaded assets,
    /// without changing the cached API payload or duplicating existing entries.
    pub fn display_assets(&self) -> Vec<ReleaseAsset> {
        let mut assets = self.assets.clone();
        for (name, url) in [
            ("Source Code (zip)", &self.zipball_url),
            ("Source Code (tar.gz)", &self.tarball_url),
        ] {
            if !url.is_empty()
                && !assets
                    .iter()
                    .any(|asset| asset.browser_download_url == *url)
            {
                assets.push(ReleaseAsset {
                    name: name.into(),
                    browser_download_url: url.clone(),
                    ..Default::default()
                });
            }
        }
        assets
    }
}


#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct WatchedRepo {
    pub id: i64,
    pub owner: String,
    pub name: String,
    pub current_version: String,
    pub latest_version: Option<String>,
    pub description: Option<String>,
    pub html_url: Option<String>,
    pub sort_order: i64,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct WatchlistEntry {
    pub owner: String,
    #[serde(alias = "repo_name")]
    pub name: String,
    pub current_version: Option<String>,
    pub latest_version: Option<String>,
    pub description: Option<String>,
    pub html_url: Option<String>,
    pub sort_order: Option<i64>,
}

impl WatchedRepo {
    pub fn has_update(&self) -> bool {
        self.latest_version
            .as_ref()
            .is_some_and(|latest| latest != &self.current_version)
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct LocalRepo {
    pub id: i64,
    pub name: String,
    pub path: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Commit {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub author: String,
    pub date: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct EnvVar {
    pub key: String,
    pub value: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FileEntry {
    pub path: String,
    pub size: u64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ServerInfo {
    pub id: String,
    pub repo_id: i64,
    pub repo_name: String,
    pub commit_hash: String,
    pub port: u16,
    pub url: String,
    pub status: String,
    pub started_at: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Contribution {
    pub sha: String,
    pub date: String,
    pub message: String,
    pub repo: String,
    pub url: String,
}

#[derive(Clone, Debug)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: String,
    pub message: String,
}
