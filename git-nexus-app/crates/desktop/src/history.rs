use git_nexus_core::github::COMMIT_PAGE_SIZE;
use git_nexus_core::models::Commit;
use serde_json::Value;

pub fn accept_local_page(
    loaded: &mut Vec<Commit>,
    current: &mut usize,
    page: usize,
    incoming: Vec<Commit>,
) -> bool {
    if page == 0 || page > 1 && page != *current + 1 {
        return false;
    }
    if page == 1 {
        loaded.clear();
    }
    let mut hashes: std::collections::BTreeSet<_> =
        loaded.iter().map(|commit| commit.hash.clone()).collect();
    loaded.extend(
        incoming
            .into_iter()
            .filter(|commit| hashes.insert(commit.hash.clone())),
    );
    *current = page;
    true
}

/// GitHub pages are bounded requests; the app presents one continuous
/// list of up to 1,000 commits rather than replacing the visible page.
#[derive(Default)]
pub struct RemoteHistory {
    repo: String,
    page: usize,
    pub commits: Vec<Value>,
    pub error: Option<String>,
    pub refresh: bool,
}

impl RemoteHistory {
    pub fn begin(&mut self, repo: String) {
        *self = Self {
            repo,
            ..Default::default()
        };
    }

    pub fn accept_page(&mut self, repo: &str, page: usize, commits: Vec<Value>) -> Option<usize> {
        if self.repo != repo || page == 0 || page > 1 && page != self.page + 1 {
            return None;
        }
        if page == 1 {
            self.commits.clear();
        }
        let full_page = commits.len() == COMMIT_PAGE_SIZE;
        self.commits
            .extend(commits.into_iter().take(1000 - self.commits.len()));
        self.page = page;
        self.error = None;
        (full_page && self.commits.len() < 1000).then_some(page + 1)
    }

    pub fn fail(&mut self, repo: &str, error: String) {
        if self.repo == repo {
            self.error = Some(error);
        }
    }
}

