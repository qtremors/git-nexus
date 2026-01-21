use super::*;
impl Nexus {
    pub(super) fn repository_commit_dialog(
        &self,
        commit: &serde_json::Value,
        window: &Window,
        cx: &mut Context<Self>,
    ) -> Div {
        let sha = commit["sha"].as_str().unwrap_or("").to_string();
        let message = commit["commit"]["message"].as_str().unwrap_or("");
        let author = commit["commit"]["author"]["name"]
            .as_str()
            .unwrap_or("")
            .to_string();
        let date = commit["commit"]["author"]["date"].as_str().unwrap_or("");
        let date = chrono::DateTime::parse_from_rfc3339(date)
            .map(|date| {
                date.with_timezone(&chrono::Local)
                    .format("%-m/%-d/%Y, %-I:%M:%S %p")
                    .to_string()
            })
            .unwrap_or_else(|_| date.to_string());
        let url = commit["html_url"].as_str().unwrap_or("").to_string();
        card(cx)
            .p_0()
            .gap_0()
            .overflow_hidden()
            .child(
                div()
                    .p_4()
                    .flex()
                    .items_center()
                    .gap_3()
                    .border_b_1()
                    .border_color(rgb(0x1e293b))
                    .child(glyph("history").text_color(rgb(0x60a5fa)))
                    .child(
                        div()
                            .flex_1()
                            .min_w_0()
                            .child(heading("Commit Details"))
                            .child(muted(cx, sha).text_xs().font_family(MONO_FONT)),
                    )
                    .child(
                        self.action("close-remote-commit", "", cx, |v, _, cx| {
                            v.remote_commit = None;
                            cx.notify();
                        })
                        .icon(icon("x"))
                        .ghost()
                        .tooltip("Close commit details"),
                    ),
            )
            .child(
                div()
                    .id("commit-detail-content")
                    .p_6()
                    .max_h((window.viewport_size().height * 0.85 - px(160.)).max(px(160.)))
                    .overflow_y_scroll()
                    .flex()
                    .flex_col()
                    .gap_6()
                    .child(
                        div()
                            .flex()
                            .flex_col()
                            .gap_2()
                            .child(muted(cx, "MESSAGE").text_sm())
                            .child(
                                div()
                                    .p_4()
                                    .rounded_lg()
                                    .border_1()
                                    .border_color(rgb(0x1e293b))
                                    .bg(rgba(0x0f172a80))
                                    .font_family(MONO_FONT)
                                    .text_sm()
                                    .children(
                                        message.split('\n').map(|line| {
                                            div().min_h(px(20.)).child(line.to_string())
                                        }),
                                    ),
                            ),
                    )
                    .child(
                        div().flex().gap_4().children(
                            [("user", "AUTHOR", author), ("calendar", "DATE", date)]
                                .into_iter()
                                .map(|(icon, title, value)| {
                                    div()
                                        .flex_1()
                                        .min_w_0()
                                        .p_3()
                                        .rounded_lg()
                                        .border_1()
                                        .border_color(rgba(0x1e293b80))
                                        .bg(rgba(0x0f172a4d))
                                        .flex()
                                        .items_start()
                                        .gap_3()
                                        .child(glyph(icon).text_color(rgb(0x94a3b8)))
                                        .child(
                                            div()
                                                .flex_1()
                                                .min_w_0()
                                                .child(muted(cx, title).text_xs())
                                                .child(value),
                                        )
                                }),
                        ),
                    ),
            )
            .child(
                div()
                    .p_4()
                    .border_t_1()
                    .border_color(rgb(0x1e293b))
                    .bg(rgba(0x0f172a80))
                    .flex()
                    .justify_end()
                    .gap_3()
                    .child(
                        self.action("remote-commit-close", "Close", cx, |v, _, cx| {
                            v.remote_commit = None;
                            cx.notify();
                        })
                        .ghost(),
                    )
                    .child(
                        self.action(
                            "remote-commit-github",
                            "View on GitHub",
                            cx,
                            move |_, _, cx| cx.open_url(&url),
                        )
                        .icon(icon("external-link"))
                        .primary(),
                    ),
            )
    }

    pub(super) fn repository_detail(
        &self,
        repo: &GitHubRepo,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) -> AnyElement {
        let url = repo.html_url.clone();
        let clone = repo.clone_url.clone();
        let archive = format!("https://api.github.com/repos/{}/zipball", repo.full_name);
        let filename = format!("{}.zip", repo.name);
        let refresh = repo.clone();
        // A definite width also gives native text measurement its wrap constraint.
        let readme_width = (window.viewport_size().width.min(px(1072.)) - px(397.)).max(px(300.));
        let readme = div()
            .w(readme_width)
            .flex_shrink_0()
            .min_w_0()
            .flex()
            .flex_col()
            .rounded_xl()
            .border_1()
            .border_color(rgb(0x1e293b))
            .bg(rgba(0x0f172a80))
            .overflow_hidden()
            .child(
                div()
                    .w_full()
                    .min_w_0()
                    .flex_shrink_0()
                    .px_4()
                    .py_3()
                    .bg(rgba(0x1e293b80))
                    .border_b_1()
                    .border_color(rgb(0x334155))
                    .flex()
                    .items_center()
                    .gap_2()
                    .child(glyph("book-open").size_5().text_color(rgb(0x94a3b8)))
                    .child(
                        div()
                            .font_weight(FontWeight::SEMIBOLD)
                            .text_color(rgb(0xffffff))
                            .child(repo.name.clone()),
                    )
                    .child(
                        div()
                            .px_2()
                            .rounded_full()
                            .bg(rgb(0x1e293b))
                            .text_xs()
                            .line_height(px(16.))
                            .child("Public"),
                    )
                    .child(div().flex_1().min_w_0())
                    .child(
                        self.action("download-repository", "Download", cx, move |v, _, cx| {
                            v.run(Job::Download(archive.clone(), filename.clone()), cx)
                        })
                        .icon(icon("download"))
                        .flex_shrink_0()
                        .w(px(112.))
                        .primary(),
                    ),
            )
            .child(
                div()
                    .p_6()
                    .w_full()
                    .min_w_0()
                    .flex()
                    .flex_col()
                    .gap_0()
                    .child(
                        muted(
                            cx,
                            repo.description
                                .clone()
                                .unwrap_or_else(|| "No description".into()),
                        )
                        .flex()
                        .flex_col()
                        .mb_4()
                        .text_base()
                        .line_height(px(24.))
                        .whitespace_normal()
                        .w(readme_width - px(48.)),
                    )
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .gap_4()
                            .pb_6()
                            .border_b_1()
                            .border_color(rgb(0x334155))
                            .text_color(rgb(0x64748b))
                            .child(
                                div()
                                    .flex()
                                    .items_center()
                                    .gap_1()
                                    .child(glyph("star"))
                                    .child(format!("{} stars", repo.stargazers_count)),
                            )
                            .child(
                                div()
                                    .flex()
                                    .items_center()
                                    .gap_1()
                                    .child(glyph("git-fork"))
                                    .child(format!("{} forks", repo.forks_count)),
                            )
                            .when_some(repo.language.as_ref(), |this, lang| {
                                this.child(
                                    div()
                                        .flex()
                                        .items_center()
                                        .gap_2()
                                        .child(
                                            div()
                                                .size_3()
                                                .rounded_full()
                                                .bg(rgb(language_color(lang))),
                                        )
                                        .child(lang.clone()),
                                )
                            }),
                    )
                    .child(
                        markdown("repo-readme", self.readme.clone(), window, cx)
                            .w(readme_width - px(48.))
                            .h_auto()
                            .flex_shrink_0()
                            .selectable(true),
                    ),
            );
        let links = card(cx)
            .p_4()
            .bg(rgba(0x0f172a80))
            .border_color(rgb(0x1e293b))
            .child(
                muted(cx, "QUICK LINKS")
                    .text_xs()
                    .line_height(px(16.))
                    .font_weight(FontWeight::SEMIBOLD),
            )
            .child(
                self.action("open-remote", "View on GitHub", cx, move |_, _, cx| {
                    cx.open_url(&url)
                })
                .icon(icon("github"))
                .w_full()
                .h_12()
                .justify_start(),
            )
            .when_some(
                repo.homepage.as_ref().filter(|url| !url.is_empty()),
                |this, url| {
                    this.child(
                        self.action("repo-homepage", "Homepage", cx, {
                            let url = url.clone();
                            move |_, _, cx| cx.open_url(&url)
                        })
                        .icon(icon("globe"))
                        .w_full(),
                    )
                },
            )
            .child(
                self.action("copy-remote", "Clone URL", cx, move |v, _, cx| {
                    cx.write_to_clipboard(ClipboardItem::new_string(clone.clone()));
                    v.notify_user("Clone URL copied", false, cx);
                })
                .icon(icon("code"))
                .tooltip("Click to copy")
                .w_full()
                .h_12()
                .justify_start(),
            );
        let loading = self.working("remote-commits");
        let commits = card(cx)
            .p_4()
            .bg(rgba(0x0f172a80))
            .border_color(rgb(0x1e293b))
            .h(px(600.))
            .child(
                div()
                    .flex()
                    .items_center()
                    .gap_2()
                    .child(glyph("history").text_color(rgb(0x94a3b8)))
                    .child(
                        muted(cx, "RECENT COMMITS")
                            .text_xs()
                            .font_weight(FontWeight::SEMIBOLD),
                    )
                    .child(div().flex_1())
                    .child(
                        muted(cx, format!("{} loaded", self.remote_history.commits.len()))
                            .text_size(px(10.)),
                    )
                    .child(
                        self.action("refresh-remote-commits", "", cx, move |v, _, cx| {
                            v.run(Job::RemoteCommits(refresh.clone(), 1, true), cx);
                        })
                        .icon(icon("refresh-cw"))
                        .ghost()
                        .tooltip("Refresh Commits")
                        .disabled(loading),
                    ),
            )
            .when_some(self.remote_history.error.as_ref(), |this, error| {
                this.child(div().p_3().text_color(rgb(0xf87171)).child(error.clone()))
            })
            .child(
                div()
                    .id("remote-commits-scroll")
                    .flex_1()
                    .min_h_0()
                    .overflow_y_scroll()
                    .px_2()
                    .children(self.remote_history.commits.iter().enumerate().map(
                        |(index, commit)| {
                            let details = commit.clone();
                            let sha = commit["sha"].as_str().unwrap_or("");
                            let message = commit["commit"]["message"].as_str().unwrap_or("");
                            let author = commit["commit"]["author"]["name"].as_str().unwrap_or("");
                            let date = commit["commit"]["author"]["date"].as_str().unwrap_or("");
                            clickable(("remote-commit", index), cx, move |v, _, cx| {
                                v.remote_commit = Some(details.clone());
                                cx.notify();
                            })
                            .relative()
                            .pl_4()
                            .py_3()
                            .border_l_2()
                            .border_color(rgb(0x1e293b))
                            .cursor_pointer()
                            .hover(|style| style.border_color(rgb(0x3b82f6)))
                            .child(
                                div()
                                    .absolute()
                                    .left(px(-5.))
                                    .top_4()
                                    .size_2()
                                    .rounded_full()
                                    .bg(rgb(0x334155)),
                            )
                            .child(
                                div()
                                    .flex()
                                    .items_center()
                                    .gap_2()
                                    .child(
                                        div().flex_1().min_w_0().truncate().child(
                                            message.lines().next().unwrap_or("").to_string(),
                                        ),
                                    )
                                    .child(
                                        muted(cx, sha.get(..7).unwrap_or(sha).to_string())
                                            .px_2()
                                            .py(px(2.))
                                            .rounded_sm()
                                            .bg(rgba(0x33415580))
                                            .text_size(px(10.))
                                            .font_family(MONO_FONT),
                                    ),
                            )
                            .child(
                                div()
                                    .mt_1()
                                    .flex()
                                    .justify_between()
                                    .child(muted(cx, author.to_string()).text_xs())
                                    .child(muted(cx, display_date(date)).text_xs()),
                            )
                        },
                    ))
                    .when(self.remote_history.commits.is_empty(), |this| {
                        this.child(div().p_6().text_center().child(muted(
                            cx,
                            if loading {
                                "Loading commits…"
                            } else if self.remote_history.error.is_some() {
                                "Could not load commits. Use Refresh to try again."
                            } else {
                                "No commits available."
                            },
                        )))
                    }),
            )
            .when(loading && !self.remote_history.commits.is_empty(), |this| {
                this.child(
                    div()
                        .py_3()
                        .text_center()
                        .child(muted(cx, "Loading commits…")),
                )
            });
        div()
            .w_full()
            .flex()
            .flex_col()
            .child(
                div()
                    .p_4()
                    .flex()
                    .items_start()
                    .border_b_1()
                    .border_color(rgb(0x1e293b))
                    .bg(rgba(0x0f172a80))
                    .child(
                        self.action("back-repos", "Back to Search", cx, |v, _, cx| {
                            v.detail = None;
                            cx.notify();
                        })
                        .icon(icon("arrow-left"))
                        .ghost(),
                    ),
            )
            .child(
                div()
                    .p_6()
                    .w_full()
                    .max_w(px(1072.))
                    .mx_auto()
                    .flex()
                    .items_start()
                    .gap_6()
                    .child(readme)
                    .child(
                        div()
                            .w(px(325.))
                            .flex_shrink_0()
                            .flex()
                            .flex_col()
                            .gap_4()
                            .child(links)
                            .child(commits),
                    ),
            )
            .into_any_element()
    }
}
