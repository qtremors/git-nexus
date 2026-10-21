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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn replay_pages_preserve_searchable_history_and_reject_duplicates_or_gaps() {
        let commit = |hash: &str| Commit {
            hash: hash.into(),
            short_hash: hash.into(),
            message: hash.into(),
            author: "Fixture".into(),
            date: String::new(),
        };
        let mut loaded = Vec::new();
        let mut page = 0;
        assert!(!accept_local_page(
            &mut loaded,
            &mut page,
            2,
            vec![commit("stale")]
        ));
        assert!(accept_local_page(
            &mut loaded,
            &mut page,
            1,
            vec![commit("new"), commit("middle")]
        ));
        assert!(accept_local_page(
            &mut loaded,
            &mut page,
            2,
            vec![commit("middle"), commit("old")]
        ));
        assert_eq!(
            loaded
                .iter()
                .map(|commit| commit.hash.as_str())
                .collect::<Vec<_>>(),
            ["new", "middle", "old"]
        );
        assert!(!accept_local_page(
            &mut loaded,
            &mut page,
            2,
            vec![commit("duplicate-page")]
        ));
        assert!(!accept_local_page(
            &mut loaded,
            &mut page,
            4,
            vec![commit("gap")]
        ));
        assert_eq!(loaded.len(), 3);
        assert!(accept_local_page(
            &mut loaded,
            &mut page,
            1,
            vec![commit("refreshed")]
        ));
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].hash, "refreshed");
        assert_eq!(page, 1);
    }

    fn commits(start: usize, count: usize) -> Vec<Value> {
        (start..start + count)
            .map(|number| serde_json::json!({"sha": number}))
            .collect()
    }

    #[test]
    fn pages_append_and_errors_preserve_loaded_commits() {
        let mut history = RemoteHistory::default();
        history.begin("owner/project".into());
        assert_eq!(
            history.accept_page("owner/project", 1, commits(0, 100)),
            Some(2)
        );
        history.fail("owner/project", "offline".into());
        assert_eq!(history.commits.len(), 100);
        assert_eq!(history.error.as_deref(), Some("offline"));
        assert_eq!(
            history.accept_page("owner/project", 2, commits(100, 25)),
            None
        );
        assert_eq!(history.commits.len(), 125);
        assert_eq!(history.commits[0]["sha"], 0);
        assert_eq!(history.commits[124]["sha"], 124);
        assert!(history.error.is_none());
    }

    #[test]
    fn old_repository_and_out_of_order_pages_cannot_replace_results() {
        let mut history = RemoteHistory::default();
        history.begin("owner/new".into());
        assert_eq!(history.accept_page("owner/old", 1, commits(0, 100)), None);
        assert_eq!(history.accept_page("owner/new", 2, commits(0, 100)), None);
        assert!(history.commits.is_empty());
        history.accept_page("owner/new", 1, commits(100, 100));
        assert_eq!(history.accept_page("owner/new", 3, commits(200, 100)), None);
        history.fail("owner/old", "stale error".into());
        assert!(history.error.is_none());
        history.accept_page("owner/new", 1, commits(300, 1));
        assert_eq!(history.commits.len(), 1);
        assert_eq!(history.commits[0]["sha"], 300);
    }

    #[test]
    fn history_respects_the_commit_limit() {
        let mut history = RemoteHistory::default();
        history.begin("owner/project".into());
        for page in 1..=10 {
            let next = history.accept_page("owner/project", page, commits((page - 1) * 100, 100));
            assert_eq!(next, if page < 10 { Some(page + 1) } else { None });
        }
        assert_eq!(history.commits.len(), 1000);
        assert_eq!(history.commits[999]["sha"], 999);
    }
}
