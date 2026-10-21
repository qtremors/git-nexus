use super::*;
impl Nexus {
    pub fn new(
        services: Arc<Mutex<Services>>,
        screen: Screen,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) -> Self {
        let mut view = Self {
            focus_handle: cx.focus_handle(),
            services,
            snapshot: Snapshot::default(),
            screen,
            username: input(window, cx, "Search users...", false, false),
            filter: input(window, cx, "Filter repositories…", false, false),
            identity: input(window, cx, "owner/repository or GitHub URL", false, false),
            local_path: input(
                window,
                cx,
                "Absolute path to an existing Git repository",
                false,
                false,
            ),
            clone_url: input(window, cx, "GitHub repository URL", false, false),
            clone_path: input(window, cx, "Clone destination", false, false),
            json_path: input(window, cx, "Watchlist JSON file path", false, false),
            token: input(window, cx, "Enter a new GitHub token", true, false),
            clear_token_input: false,
            download_path: input(window, cx, "Download directory", false, false),
            port: input(window, cx, "Port (optional)", false, false),
            env_rows: Vec::new(),
            next_env_row: 0,
            env_dirty: false,
            env_revision: 0,
            min_commits: input(window, cx, "Min", false, false),
            max_commits: input(window, cx, "Max", false, false),
            topic: input(window, cx, "Topic", false, false),
            profile: None,
            repos: Vec::new(),
            selected_downloads: BTreeSet::new(),
            sort: 1,
            ascending: false,
            columns: 1,
            language: "All".into(),
            counts: BTreeMap::new(),
            detail: None,
            readme: String::new(),
            remote_history: Default::default(),
            remote_commit: None,
            contributions: Vec::new(),
            contributions_fetched: false,
            selected_day: None,
            releases: Vec::new(),
            release_repo: None,
            local_repo: None,
            commits: Vec::new(),
            commit_page: 1,
            local_commit_count: 0,
            selected_commit: None,
            files: Vec::new(),
            file_filter: input(window, cx, "Filter files by path", false, false),
            viewer: None,
            env_scope: None,
            api_status: None,
            confirm: None,
            initial_settings: true,
            pending_env: None,
            show_env: false,
            overview: false,
            profile_readme: String::new(),
            watch_filter: input(window, cx, "Filter repositories...", false, false),
            commit_filter: input(window, cx, "Search commits...", false, false),
            watch_grid: true,
            show_prereleases: true,
            dialog: None,
            expanded_folders: BTreeSet::new(),
            expanded_assets: BTreeSet::new(),
            asset_filters: BTreeMap::new(),
            cached_releases: BTreeMap::new(),
            downloaded_assets: BTreeMap::new(),
            release_errors: BTreeMap::new(),
            jobs: Default::default(),
            navigation_generation: 0,
            notices: Vec::new(),
            next_notice: 0,
            show_search_history: false,
        };
        cx.observe(&view.filter, |_, _, cx| cx.notify()).detach();
        cx.observe(&view.token, |_, _, cx| cx.notify()).detach();
        cx.observe(&view.file_filter, |_, _, cx| cx.notify())
            .detach();
        for field in [&view.min_commits, &view.max_commits, &view.topic] {
            cx.observe(field, |_, _, cx| cx.notify()).detach();
        }
        cx.observe(&view.watch_filter, |_, _, cx| cx.notify())
            .detach();
        cx.observe(&view.commit_filter, |_, _, cx| cx.notify())
            .detach();
        cx.subscribe(&view.username, |view, _, event, cx| {
            if matches!(event, InputEvent::Change | InputEvent::Focus) {
                view.show_search_history = true;
                cx.notify();
            }

            if matches!(event, InputEvent::PressEnter { .. }) {
                view.run(
                    Job::Discover(view.username.read(cx).value().trim().into(), false),
                    cx,
                );
            }
        })
        .detach();
        for (field, dialog) in [
            (&view.local_path, "add-repository"),
            (&view.clone_path, "clone"),
            (&view.identity, "add-watch"),
        ] {
            cx.subscribe(field, move |view, _, event, cx| {
                if matches!(event, InputEvent::PressEnter { .. }) && view.dialog == Some(dialog) {
                    let job = match dialog {
                        "add-repository" => {
                            Job::AddLocal(PathBuf::from(view.local_path.read(cx).value().as_str()))
                        }
                        "clone" => Job::Clone(
                            view.clone_url.read(cx).value().to_string(),
                            PathBuf::from(view.clone_path.read(cx).value().as_str()),
                        ),
                        _ => Job::Watch(view.identity.read(cx).value().trim().into()),
                    };
                    view.dialog = None;
                    view.run(job, cx);
                }
            })
            .detach();
        }
        view.focus_handle.focus(window);
        view.run(Job::Load, cx);
        view
    }

    pub(super) fn run(&mut self, job: Job, cx: &mut Context<Self>) {
        match &job {
            Job::Discover(username, _) => {
                if username.trim().is_empty() {
                    return;
                }
                if self
                    .profile
                    .as_ref()
                    .is_some_and(|profile| !profile.login.eq_ignore_ascii_case(username))
                {
                    self.profile = None;
                    self.repos.clear();
                    self.detail = None;
                    self.counts.clear();
                    self.contributions.clear();
                    self.profile_readme.clear();
                }
                if self.screen != Screen::Discovery {
                    self.navigate(Screen::Discovery, cx);
                }
                self.jobs.retain_profile(username);
            }
            Job::Commits(repo, _) => {
                if self
                    .local_repo
                    .as_ref()
                    .is_none_or(|current| current.id != repo.id)
                {
                    self.local_repo = Some(repo.clone());
                    self.selected_commit = None;
                    self.commits.clear();
                    self.commit_page = 0;
                    self.files.clear();
                    self.local_commit_count = 0;
                }
            }
            Job::Files(..) => self.files.clear(),
            Job::Detail(repo) => {
                self.detail = Some(repo.clone());
                self.readme = "Loading README…".into();
                self.remote_history.begin(repo.full_name.clone());
                self.remote_commit = None;
                self.enqueue(Job::RemoteCommits(repo.clone(), 1, false));
            }
            Job::RemoteCommits(_, 1, refresh) => {
                self.remote_history.refresh = *refresh;
                self.remote_history.error = None;
            }
            Job::Releases(owner, name, _) => {
                if self.release_repo.as_ref() != Some(&(owner.clone(), name.clone())) {
                    self.navigation_generation += 1;
                    self.downloaded_assets.clear();
                }
                self.release_repo = Some((owner.clone(), name.clone()));
                self.releases.clear();
            }
            _ => {}
        }
        self.enqueue(job);
        self.start_next(cx);
        cx.notify();
    }

    pub(super) fn enqueue(&mut self, job: Job) {
        self.jobs.push_back(job, self.navigation_generation);
    }

    pub(super) fn start_next(&mut self, cx: &mut Context<Self>) {
        while let Some(request) = self.jobs.pop_ready() {
            if matches!(request.job, Job::WatchlistReleases) {
                self.jobs.finish(&request);
                for repo in self.snapshot.watchlist.clone() {
                    self.enqueue(Job::WatchlistRelease(repo.owner, repo.name, false));
                }
            } else {
                self.start_request(request, cx);
            }
        }
    }

    pub(super) fn working(&self, key: &str) -> bool {
        self.jobs.working(key)
    }

    pub(super) fn start_request(
        &mut self,
        mut request: crate::jobs::Request,
        cx: &mut Context<Self>,
    ) {
        let job = std::mem::replace(&mut request.job, Job::Load);
        let adding_repository = matches!(&job, Job::AddLocal(..) | Job::Clone(..));
        let reload_watchlist = matches!(
            &job,
            Job::Watch(..) | Job::CheckUpdates | Job::ImportWatchlist(..)
        );
        let repository_before = self.local_repo.as_ref().map(|repo| repo.id);
        let file_context = if let Job::File(repo, hash, _) = &job {
            Some((repo.id, hash.clone()))
        } else {
            None
        };
        let remote_context = if let Job::RemoteCommits(repo, ..) = &job {
            Some(repo.full_name.clone())
        } else {
            None
        };
        let release_context = match &job {
            Job::WatchlistRelease(owner, name, _) | Job::Releases(owner, name, _) => {
                Some(format!("{owner}/{name}"))
            }
            _ => None,
        };
        if let Some(repo) = &release_context {
            self.release_errors.remove(repo);
        }
        let notify_success = !matches!(
            &job,
            Job::Load
                | Job::Counts(..)
                | Job::ProfileReadme(..)
                | Job::WatchlistReleases
                | Job::WatchlistRelease(..)
                | Job::Commits(..)
                | Job::Files(..)
                | Job::RemoteCommits(..)
                | Job::Detail(..)
        );
        let saving_env = if let Job::SaveEnv(scope, id, hash, _) = &job {
            Some(((scope.clone(), *id, hash.clone()), self.env_revision))
        } else {
            None
        };
        let retry_dialog = match &job {
            Job::AddLocal(..) => Some("add-repository"),
            Job::Clone(..) => Some("clone"),
            Job::Watch(..) => Some("add-watch"),
            _ => None,
        };
        self.show_search_history = false;
        cx.notify();
        let services = self.services.clone();
        let task = cx.background_executor().spawn(async move {
            let mut worker = {
                let services = services
                    .lock()
                    .map_err(|_| anyhow::anyhow!("Native service worker failed"))?;
                services.fork()?
            };
            worker.execute(job)
        });
        cx.spawn(async move |this, cx| {
            let result = task.await;
            let _ = this.update(cx, |view, cx| {
                view.jobs.finish(&request);
                match result {
                    Ok(mut outcome) => {
                        let current = view.jobs.is_current(&request)
                            && (!adding_repository
                                || view.local_repo.as_ref().map(|repo| repo.id)
                                    == repository_before)
                            && file_context.as_ref().is_none_or(|(repo, hash)| {
                                view.local_repo
                                    .as_ref()
                                    .is_some_and(|current| current.id == *repo)
                                    && view
                                        .selected_commit
                                        .as_ref()
                                        .is_some_and(|commit| &commit.hash == hash)
                            });
                        if !current
                            || (request.navigation != view.navigation_generation
                                && matches!(
                                    outcome.change,
                                    Change::Text(..)
                                        | Change::Env(..)
                                        | Change::Detail(..)
                                        | Change::DownloadedAsset(..)
                                ))
                        {
                            outcome.change = Change::None;
                        }
                        if current
                            && notify_success
                            && !matches!(outcome.message.as_str(), "Done" | "Ready")
                        {
                            view.notify_user(outcome.message.clone(), false, cx);
                        }
                        if matches!(&outcome.change, Change::Counts(_, counts) if counts.is_empty())
                        {
                            view.notify_user(outcome.message.clone(), true, cx);
                        }
                        view.apply(outcome, cx);
                        if reload_watchlist {
                            view.enqueue(Job::WatchlistReleases);
                        }
                        if let Some((scope, revision)) = &saving_env
                            && view.env_scope.as_ref() == Some(scope)
                            && view.env_revision == *revision
                        {
                            view.close_environment(cx);
                        }
                    }
                    Err(error) => {
                        if view.jobs.is_current(&request) {
                            if let Some(repo) = &remote_context {
                                view.remote_history.fail(repo, format!("{error:#}"));
                            }
                            if let Some(repo) = &release_context {
                                view.release_errors
                                    .insert(repo.clone(), format!("{error:#}"));
                            }
                            if request.navigation == view.navigation_generation {
                                view.dialog = retry_dialog;
                            }
                            view.notify_user(format!("{error:#}"), true, cx);
                        }
                    }
                }
                view.start_next(cx);
                cx.notify();
            });
        })
        .detach();
    }

    pub(super) fn apply(&mut self, outcome: Outcome, _cx: &mut Context<Self>) {
        if outcome.snapshot.revision >= self.snapshot.revision {
            self.snapshot = outcome.snapshot;
        }
        if self.local_repo.as_ref().is_some_and(|r| {
            !self
                .snapshot
                .repositories
                .iter()
                .any(|saved| saved.id == r.id)
        }) {
            self.local_repo = None;
            self.commits.clear();
            self.files.clear();
            self.selected_commit = None;
            self.local_commit_count = 0;
        }
        if self.release_repo.as_ref().is_some_and(|(owner, name)| {
            !self
                .snapshot
                .watchlist
                .iter()
                .any(|r| &r.owner == owner && &r.name == name)
        }) {
            self.release_repo = None;
            self.releases.clear();
        }
        match outcome.change {
            Change::None => {}
            Change::TokenSaved => {
                self.api_status = None;
                self.clear_token_input = true;
            }
            Change::DownloadedAsset(id, filename) => {
                if self.screen == Screen::Watchlist && self.release_repo.is_none() {
                    self.downloaded_assets.insert(id, filename);
                }
            }
            Change::Discovery(profile, repos, refresh) => {
                self.enqueue(Job::ProfileReadme(profile.login.clone(), refresh));
                self.enqueue(Job::Counts(profile.login.clone(), repos.clone(), refresh));
                self.profile_readme.clear();
                self.profile = Some(profile);
                self.repos = repos;
                self.detail = None;
                self.selected_downloads.clear();
                self.counts.clear();
                self.contributions.clear();
                self.contributions_fetched = false;
            }
            Change::ProfileReadme(owner, content) => {
                if self
                    .profile
                    .as_ref()
                    .is_some_and(|profile| profile.login == owner)
                {
                    self.profile_readme = content;
                }
            }
            Change::Text(title, content, code) => self.viewer = Some((title, content, code)),
            Change::Detail(repo, readme) => {
                if self
                    .detail
                    .as_ref()
                    .is_some_and(|current| current.full_name == repo.full_name)
                {
                    self.readme = readme;
                }
            }
            Change::RemoteCommits(repo, commits, page) => {
                if self
                    .detail
                    .as_ref()
                    .is_some_and(|current| current.full_name == repo)
                    && let Some(next) = self.remote_history.accept_page(&repo, page, commits)
                {
                    self.enqueue(Job::RemoteCommits(
                        self.detail.as_ref().unwrap().clone(),
                        next,
                        self.remote_history.refresh,
                    ));
                }
            }
            Change::Counts(owner, counts) => {
                if self
                    .profile
                    .as_ref()
                    .is_some_and(|profile| profile.login == owner)
                {
                    self.counts.extend(counts);
                }
            }
            Change::Contributions(owner, commits) => {
                if self
                    .profile
                    .as_ref()
                    .is_some_and(|profile| profile.login == owner)
                {
                    self.contributions = commits;
                    self.contributions_fetched = true;
                }
            }
            Change::WatchlistReleases(releases) => {
                for (repo, releases) in releases {
                    self.release_errors.remove(&repo);
                    if self
                        .release_repo
                        .as_ref()
                        .is_some_and(|(owner, name)| format!("{owner}/{name}") == repo)
                    {
                        self.releases = releases.clone();
                    }
                    self.cached_releases.insert(repo, releases);
                }
            }
            Change::Releases(owner, name, releases) => {
                self.release_errors.remove(&format!("{owner}/{name}"));
                self.cached_releases
                    .insert(format!("{owner}/{name}"), releases.clone());
                if self.release_repo.as_ref() == Some(&(owner, name)) {
                    self.releases = releases;
                }
            }
            Change::Commits(repo, commits, page, total) => {
                if !self
                    .snapshot
                    .repositories
                    .iter()
                    .any(|saved| saved.id == repo.id)
                {
                    return;
                }
                if self.local_repo.as_ref().is_none_or(|r| r.id != repo.id) {
                    self.selected_commit = None;
                    self.files.clear();
                }
                if !crate::history::accept_local_page(
                    &mut self.commits,
                    &mut self.commit_page,
                    page,
                    commits,
                ) {
                    return;
                }
                if self.selected_commit.is_none()
                    && let Some(commit) = self.commits.first()
                {
                    self.selected_commit = Some(commit.clone());
                }
                if page == 1
                    && let Some(commit) = &self.selected_commit
                {
                    self.enqueue(Job::Files(repo.clone(), commit.hash.clone()));
                }
                self.local_repo = Some(repo);
                self.local_commit_count = total;
            }
            Change::Files(repo, hash, files) => {
                if self
                    .local_repo
                    .as_ref()
                    .is_some_and(|current| current.id == repo)
                    && self
                        .selected_commit
                        .as_ref()
                        .is_some_and(|commit| commit.hash == hash)
                {
                    self.files = files;
                }
            }
            Change::Env(scope, id, hash, values) => {
                if scope == "merged" {
                    self.viewer = Some((
                        "Merged Environment".into(),
                        values
                            .iter()
                            .map(|value| format!("{}={}", value.key, value.value))
                            .collect::<Vec<_>>()
                            .join("\n"),
                        true,
                    ));
                } else {
                    self.env_scope = Some((scope, id, hash));
                    self.viewer = None;
                    self.pending_env = Some(values);
                }
            }
            Change::RateLimit(value) => self.api_status = Some(value),
        }
    }

    pub(super) fn notify_user(
        &mut self,
        message: impl Into<String>,
        error: bool,
        cx: &mut Context<Self>,
    ) {
        self.next_notice += 1;
        let id = self.next_notice;
        self.notices.push(Notice {
            id,
            message: message.into(),
            error,
        });
        cx.spawn(async move |this, cx| {
            cx.background_executor()
                .timer(std::time::Duration::from_secs(3))
                .await;
            let _ = this.update(cx, |view, cx| {
                view.notices.retain(|notice| notice.id != id);
                cx.notify();
            });
        })
        .detach();
        cx.notify();
    }
}
