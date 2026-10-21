use crate::service::Job;
use std::collections::{BTreeMap, VecDeque};

pub struct Request {
    pub job: Job,
    pub navigation: u64,
    generation: u64,
    key: Option<String>,
    progress: String,
    lane: Lane,
    barrier: bool,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Lane {
    Local,
    Remote,
    Background,
    Mutation,
}

struct Active {
    progress: String,
    lane: Lane,
    barrier: bool,
}

#[derive(Default)]
pub struct JobQueue {
    pending: VecDeque<Request>,
    latest: BTreeMap<String, u64>,
    generation: u64,
    active: BTreeMap<u64, Active>,
}

impl Job {
    fn lane(&self) -> Lane {
        match self {
            Self::Load
            | Self::Commits(..)
            | Self::Files(..)
            | Self::File(..)
            | Self::Env(..)
            | Self::MergedEnv(..) => Lane::Local,
            Self::Counts(..)
            | Self::ProfileReadme(..)
            | Self::WatchlistReleases
            | Self::WatchlistRelease(..) => Lane::Background,
            Self::Discover(..)
            | Self::Detail(..)
            | Self::RemoteCommits(..)
            | Self::Contributions(..)
            | Self::Releases(..)
            | Self::RateLimit => Lane::Remote,
            _ => Lane::Mutation,
        }
    }

    fn cache_barrier(&self) -> bool {
        matches!(self, Self::SaveToken(..) | Self::ClearCache)
    }

    fn progress_key(&self) -> String {
        self.request_key().unwrap_or_else(|| match self {
            Self::SaveToken(..) => "save-token".into(),
            Self::SavePath(..) => "save-path".into(),
            Self::SaveEnv(..) => "save-env".into(),
            Self::Download(url, _) => format!("download:{url}"),
            Self::DownloadRelease(download) => format!("download:{}", download.url()),
            Self::DownloadRepos(..) => "download-repos".into(),
            Self::Start(repo, hash, _) => format!("start:{}:{hash}", repo.id),
            Self::Stop(id) => format!("stop:{id}"),
            Self::RemoveServer(id) => format!("remove-server:{id}"),
            Self::Watch(..) => "add-watch".into(),
            Self::CheckUpdates => "check-updates".into(),
            Self::Unwatch(id) => format!("unwatch:{id}"),
            Self::AddLocal(..) | Self::Clone(..) => "add-local".into(),
            Self::RemoveLocal(id) => format!("remove-local:{id}"),
            Self::ClearCache => "clear-cache".into(),
            Self::ClearLogs => "clear-logs".into(),
            Self::ImportWatchlist(..) => "import-watchlist".into(),
            Self::ExportWatchlist(..) => "export-watchlist".into(),
            Self::Theme(..) => "theme".into(),
            Self::Reorder(..) => "reorder".into(),
            Self::MarkCurrent(id) => format!("mark-current:{id}"),
            Self::StopAll => "stop-all".into(),
            _ => unreachable!("Reads have request keys"),
        })
    }

    fn request_key(&self) -> Option<String> {
        Some(match self {
            Self::Load => "snapshot".into(),
            Self::Discover(..) => "discovery".into(),
            Self::ProfileReadme(..) => "profile-readme".into(),
            Self::Detail(..) => "detail".into(),
            Self::RemoteCommits(..) => "remote-commits".into(),
            Self::Counts(owner, repos, _) => format!(
                "count:{owner}/{}",
                repos.first().map(|repo| repo.name.as_str()).unwrap_or("")
            ),
            Self::Contributions(..) => "contributions".into(),
            Self::Releases(owner, name, _) => format!("releases:{owner}/{name}"),
            Self::WatchlistReleases => "watchlist-releases".into(),
            Self::WatchlistRelease(owner, name, _) => format!("releases:{owner}/{name}"),
            Self::Commits(..) => "commits".into(),
            Self::Files(..) => "files".into(),
            Self::File(..) => "file".into(),
            Self::Env(..) | Self::MergedEnv(..) => "environment".into(),
            Self::RateLimit => "rate-limit".into(),
            _ => return None,
        })
    }

    fn background(&self) -> bool {
        matches!(
            self,
            Self::Counts(..)
                | Self::ProfileReadme(..)
                | Self::WatchlistReleases
                | Self::WatchlistRelease(..)
        )
    }
}

impl JobQueue {
    pub fn push_back(&mut self, job: Job, navigation: u64) {
        // One count per task keeps long profiles from monopolizing the worker.
        if let Job::Counts(owner, repos, refresh) = job {
            for repo in repos {
                self.push(Job::Counts(owner.clone(), vec![repo], refresh), navigation);
            }
        } else {
            self.push(job, navigation);
        }
    }

    fn push(&mut self, job: Job, navigation: u64) {
        let key = job.request_key();
        // A routine card refresh must not supersede an explicit history load or
        // force refresh for the same repository.
        if job.background()
            && key.as_ref().is_some_and(|key| {
                self.active
                    .values()
                    .any(|active| active.lane == Lane::Remote && active.progress == *key)
                    || self.pending.iter().any(|request| {
                        request.lane == Lane::Remote && request.key.as_ref() == Some(key)
                    })
            })
        {
            return;
        }
        self.generation += 1;
        if let Some(key) = &key
            && self.latest.insert(key.clone(), self.generation).is_some()
        {
            self.pending
                .retain(|request| request.key.as_ref() != Some(key));
        }
        let index = if job.background() {
            self.pending.len()
        } else {
            self.pending
                .iter()
                .position(|request| request.job.background())
                .unwrap_or(self.pending.len())
        };
        self.pending.insert(
            index,
            Request {
                progress: job.progress_key(),
                lane: job.lane(),
                barrier: job.cache_barrier(),
                job,
                navigation,
                generation: self.generation,
                key,
            },
        );
    }

    pub fn pop_ready(&mut self) -> Option<Request> {
        let remote = self
            .active
            .values()
            .filter(|active| active.lane == Lane::Remote)
            .count();
        let background = self
            .active
            .values()
            .filter(|active| active.lane == Lane::Background)
            .count();
        let local = self
            .active
            .values()
            .any(|active| active.lane == Lane::Local);
        let mutation = self
            .active
            .values()
            .any(|active| active.lane == Lane::Mutation);
        let barrier = self.active.values().any(|active| active.barrier);
        let barrier_waiting = self.pending.iter().any(|request| request.barrier);
        let first_mutation = self
            .pending
            .iter()
            .position(|request| request.lane == Lane::Mutation);
        let index = self
            .pending
            .iter()
            .enumerate()
            .find(|(index, request)| match request.lane {
                Lane::Local => !local,
                Lane::Remote => !barrier && !barrier_waiting && remote < 2,
                Lane::Background => !barrier && !barrier_waiting && background < 1,
                Lane::Mutation => {
                    !mutation
                        && first_mutation == Some(*index)
                        && (!request.barrier || remote + background == 0)
                }
            })
            .map(|(index, _)| index)?;
        let request = self.pending.remove(index)?;
        self.active.insert(
            request.generation,
            Active {
                progress: request.progress.clone(),
                lane: request.lane,
                barrier: request.barrier,
            },
        );
        Some(request)
    }

    pub fn finish(&mut self, request: &Request) {
        self.active.remove(&request.generation);
    }

    pub fn working(&self, key: &str) -> bool {
        let matches =
            |progress: &str| progress == key || key.ends_with(':') && progress.starts_with(key);
        self.pending
            .iter()
            .any(|request| matches(&request.progress))
            || self.active.values().any(|active| matches(&active.progress))
    }

    pub fn is_current(&self, request: &Request) -> bool {
        request
            .key
            .as_ref()
            .is_none_or(|key| self.latest.get(key) == Some(&request.generation))
    }

    pub fn retain_profile(&mut self, owner: &str) {
        self.pending.retain(|request| match &request.job {
            Job::ProfileReadme(user, _) | Job::Counts(user, ..) | Job::Contributions(user, ..) => {
                user.eq_ignore_ascii_case(owner)
            }
            Job::Detail(repo) | Job::RemoteCommits(repo, ..) => repo
                .full_name
                .split('/')
                .next()
                .is_some_and(|user| user.eq_ignore_ascii_case(owner)),
            _ => true,
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn latest_read_wins_without_dropping_independent_work() {
        let mut jobs = JobQueue::default();
        jobs.push_back(Job::Discover("first".into(), false), 0);
        let first = jobs.pop_ready().unwrap();
        jobs.push_back(Job::ProfileReadme("first".into(), false), 0);
        jobs.push_back(Job::Discover("second".into(), false), 0);
        jobs.push_back(Job::Discover("third".into(), false), 1);
        assert!(!jobs.is_current(&first));
        let next = jobs.pop_ready().unwrap();
        assert!(matches!(&next.job, Job::Discover(name, _) if name == "third"));
        assert_eq!(next.navigation, 1);
        assert!(jobs.is_current(&next));
        assert!(matches!(
            jobs.pop_ready().unwrap().job,
            Job::ProfileReadme(..)
        ));
        assert!(jobs.pop_ready().is_none());
    }

    #[test]
    fn mutations_are_fifo_and_never_coalesced() {
        let mut jobs = JobQueue::default();
        jobs.push_back(Job::WatchlistReleases, 0);
        jobs.push_back(Job::SavePath("first".into()), 0);
        jobs.push_back(Job::SavePath("second".into()), 0);
        let first = jobs.pop_ready().unwrap();
        assert!(matches!(&first.job, Job::SavePath(path) if path == "first"));
        let background = jobs.pop_ready().unwrap();
        assert!(matches!(background.job, Job::WatchlistReleases));
        assert!(jobs.pop_ready().is_none());
        jobs.finish(&first);
        let second = jobs.pop_ready().unwrap();
        assert!(matches!(&second.job, Job::SavePath(path) if path == "second"));
        jobs.finish(&second);
        jobs.finish(&background);
        assert!(jobs.pop_ready().is_none());
    }

    #[test]
    fn selecting_another_commit_invalidates_in_flight_files() {
        let mut jobs = JobQueue::default();
        let repo = git_nexus_core::models::LocalRepo {
            id: 1,
            name: "fixture".into(),
            path: "unused".into(),
        };
        jobs.push_back(Job::Files(repo.clone(), "first".into()), 0);
        let first = jobs.pop_ready().unwrap();
        jobs.push_back(Job::Files(repo.clone(), "second".into()), 0);
        jobs.push_back(Job::Files(repo, "third".into()), 0);
        assert!(!jobs.is_current(&first));
        assert!(jobs.pop_ready().is_none());
        jobs.finish(&first);
        let next = jobs.pop_ready().unwrap();
        assert!(jobs.is_current(&next));
        assert!(matches!(next.job, Job::Files(_, hash) if hash == "third"));
        assert!(jobs.pop_ready().is_none());
    }

    #[test]
    fn network_load_does_not_block_local_actions_or_mutations() {
        let mut jobs = JobQueue::default();
        jobs.push_back(Job::ProfileReadme("fixture".into(), false), 0);
        let background = jobs.pop_ready().unwrap();
        jobs.push_back(Job::Discover("fixture".into(), false), 0);
        let discovery = jobs.pop_ready().unwrap();
        jobs.push_back(Job::Releases("fixture".into(), "project".into(), false), 0);
        let releases = jobs.pop_ready().unwrap();
        jobs.push_back(Job::Env("global".into(), 0, String::new()), 0);
        let environment = jobs.pop_ready().unwrap();
        assert!(matches!(environment.job, Job::Env(..)));
        jobs.push_back(Job::SavePath("fixture".into()), 0);
        let save = jobs.pop_ready().unwrap();
        assert!(matches!(save.job, Job::SavePath(..)));
        jobs.push_back(Job::RateLimit, 0);
        jobs.push_back(Job::ProfileReadme("other".into(), false), 0);
        jobs.push_back(Job::Load, 0);
        jobs.push_back(Job::SavePath("second".into()), 0);
        assert!(jobs.pop_ready().is_none());
        jobs.finish(&environment);
        assert!(matches!(jobs.pop_ready().unwrap().job, Job::Load));
        for request in [background, discovery, releases, save] {
            jobs.finish(&request);
        }
    }

    #[test]
    fn credential_changes_wait_for_reads_and_keep_mutation_order() {
        let mut jobs = JobQueue::default();
        jobs.push_back(Job::Discover("first".into(), false), 0);
        let first = jobs.pop_ready().unwrap();
        jobs.push_back(Job::SaveToken("fixture-credential".into()), 0);
        jobs.push_back(Job::Discover("second".into(), false), 0);
        jobs.push_back(Job::SavePath("fixture".into()), 0);
        jobs.push_back(Job::Load, 0);
        let load = jobs.pop_ready().unwrap();
        assert!(matches!(load.job, Job::Load));
        assert!(jobs.working("save-token"));
        assert!(jobs.pop_ready().is_none());
        jobs.finish(&first);
        let token = jobs.pop_ready().unwrap();
        assert!(matches!(token.job, Job::SaveToken(..)));
        assert!(jobs.pop_ready().is_none());
        jobs.finish(&token);
        assert!(!jobs.working("save-token"));
        assert!(
            matches!(jobs.pop_ready().unwrap().job, Job::Discover(name, _) if name == "second")
        );
        assert!(matches!(jobs.pop_ready().unwrap().job, Job::SavePath(..)));
    }

    #[test]
    fn background_release_load_cannot_cancel_an_explicit_refresh() {
        let mut jobs = JobQueue::default();
        jobs.push_back(
            Job::WatchlistRelease("owner".into(), "project".into(), false),
            0,
        );
        let background = jobs.pop_ready().unwrap();
        jobs.push_back(Job::Releases("owner".into(), "project".into(), true), 0);
        let refresh = jobs.pop_ready().unwrap();
        assert!(!jobs.is_current(&background));
        jobs.push_back(
            Job::WatchlistRelease("owner".into(), "project".into(), false),
            0,
        );
        assert!(jobs.is_current(&refresh));
        assert!(jobs.pop_ready().is_none());
    }
}
