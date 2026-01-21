use super::*;
impl Nexus {
    pub(super) fn navigate(&mut self, screen: Screen, cx: &mut Context<Self>) {
        if self.screen != screen || self.release_repo.is_some() {
            self.downloaded_assets.clear();
        }
        if screen == Screen::Watchlist {
            self.release_repo = None;
            self.releases.clear();
        }
        self.navigation_generation += 1;
        self.screen = screen;
        self.viewer = None;
        self.remote_commit = None;
        self.env_scope = None;
        self.env_rows.clear();
        self.confirm = None;
        self.dialog = None;
        self.show_search_history = false;
        self.selected_day = None;
        if screen == Screen::Watchlist {
            self.run(Job::WatchlistReleases, cx);
        }
        if screen == Screen::Replay
            && self.local_repo.is_none()
            && let Some(repo) = self
                .snapshot
                .repositories
                .iter()
                .find(|r| Some(r.id) == self.snapshot.last_repo_id)
                .or(self.snapshot.repositories.first())
                .cloned()
        {
            self.run(Job::Commits(repo, 1), cx);
        }
        cx.notify();
    }

    pub(super) fn show_logs(&mut self, cx: &mut Context<Self>) {
        let body = self
            .snapshot
            .logs
            .iter()
            .map(|log| format!("{} [{}] {}", log.timestamp, log.level, log.message))
            .collect::<Vec<_>>()
            .join("\n");
        self.viewer = Some(("Activity log".into(), body, true));
        cx.notify();
    }
}
