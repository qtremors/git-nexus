use super::*;

impl Nexus {
    fn start_commit(&mut self, repo: LocalRepo, hash: String, cx: &mut Context<Self>) {
        let value = self.port.read(cx).value();
        let port = if value.trim().is_empty() {
            None
        } else {
            match value.parse::<u16>() {
                Ok(port) if port >= 1024 => Some(port),
                _ => {
                    self.notify_user("Port must be a number from 1024 to 65535", true, cx);
                    return;
                }
            }
        };
        self.run(Job::Start(repo, hash, port), cx);
    }
    pub(super) fn replay(&self, cx: &mut Context<Self>) -> AnyElement {
        let repo_list = div().size_full().flex().flex_col().bg(cx.theme().secondary)
            .child(section_header(cx,"panels-top-left","Worktree Manager"))
            .child(div().h_9().px_4().flex().items_center().justify_between()
                .child(muted(cx,format!("WORKTREES ({})",self.snapshot.repositories.len())).text_xs().line_height(px(16.)))
                .child(Button::new("add-repo").icon(icon("plus")).ghost().small().tooltip("Add Worktree")
                    .on_click(cx.listener(|v,_,_,cx|{v.dialog=Some("add-repository");cx.notify();}))))
            .child(div().id("worktrees-scroll").flex_1().min_h_0().overflow_y_scroll().children(self.snapshot.repositories.iter().cloned().map(|repo|{
                let selected=self.local_repo.as_ref().is_some_and(|r|r.id==repo.id);let remove=repo.clone();let load=repo.clone();
                clickable(("worktree",repo.id as u64),cx,move|v,_,cx|{v.expanded_folders.clear();v.run(Job::Commits(load.clone(),1),cx);}).px_4().py_3().flex().items_center().gap_2().cursor_pointer()
                    .when(selected,|this|this.bg(cx.theme().primary.opacity(0.1)).border_l_2().border_color(cx.theme().primary))
                    .hover(|s|s.bg(cx.theme().muted)).child(glyph("folder").text_color(cx.theme().primary))
                    .child(div().flex_1().min_w_0().child(div().truncate().child(repo.name)).child(muted(cx,display_path(&repo.path)).text_xs().line_height(px(16.)).truncate()))
                    .child(self.action(("remove-repo",repo.id as u64),"",cx,move|v,_,cx|{v.confirm=Some((format!("Remove {} from the worktree manager? Files in the checkout will be preserved.",remove.name),Job::RemoveLocal(remove.id)));cx.notify();}).icon(icon("trash-2")).ghost().tooltip("Remove Worktree"))
                    .tooltip({let path=display_path(&repo.path);move |window,cx|gpui_component::tooltip::Tooltip::new(path.clone()).build(window,cx)})
            })).when(self.snapshot.repositories.is_empty(),|this|this.child(div().py_5().text_center().child(muted(cx,"No worktrees added yet").text_xs().line_height(px(16.))))));
        let mut files = div()
            .size_full()
            .flex()
            .flex_col()
            .bg(cx.theme().secondary)
            .child(
                div()
                    .h_10()
                    .px_4()
                    .flex()
                    .items_center()
                    .gap_2()
                    .child(muted(cx, "FILES").text_xs().line_height(px(16.)))
                    .when_some(self.selected_commit.as_ref(), |this, commit| {
                        this.child(
                            muted(cx, commit.short_hash.clone())
                                .text_xs()
                                .line_height(px(16.)),
                        )
                    }),
            );
        if let (Some(repo), Some(commit)) = (&self.local_repo, &self.selected_commit) {
            let query = self.file_filter.read(cx).value().to_lowercase();
            let mut entries = BTreeSet::new();
            for file in self
                .files
                .iter()
                .filter(|f| f.path.to_lowercase().contains(&query))
            {
                let parts: Vec<_> = file.path.split('/').collect();
                for depth in 1..=parts.len() {
                    entries.insert((parts[..depth].join("/"), depth < parts.len()));
                }
            }
            let mut entries: Vec<_> = entries.into_iter().collect();
            entries.sort_by_cached_key(|(path, folder)| {
                let parts: Vec<_> = path.split('/').collect();
                parts
                    .iter()
                    .enumerate()
                    .map(|(i, part)| (i + 1 == parts.len() && !folder, part.to_lowercase()))
                    .collect::<Vec<_>>()
            });
            files = files.child(
                div()
                    .id("file-tree")
                    .flex_1()
                    .min_h_0()
                    .overflow_y_scroll()
                    .children(
                        entries
                            .into_iter()
                            .filter(|(path, _)| {
                                if !query.is_empty() {
                                    return true;
                                }
                                let mut parent = std::path::Path::new(path).parent();
                                while let Some(p) = parent {
                                    let text = p.to_string_lossy();
                                    if text.is_empty() {
                                        break;
                                    }
                                    if !self.expanded_folders.contains(text.as_ref()) {
                                        return false;
                                    }
                                    parent = p.parent();
                                }
                                true
                            })
                            .map(|(path, folder)| {
                                let repo = repo.clone();
                                let hash = commit.hash.clone();
                                let depth = path.matches('/').count();
                                let label = path.rsplit('/').next().unwrap_or(&path).to_string();
                                let expanded = self.expanded_folders.contains(&path);
                                let size = self
                                    .files
                                    .iter()
                                    .find(|file| file.path == path)
                                    .map(|file| file.size);
                                let open_path = path.clone();
                                clickable(
                                    SharedString::from(format!("tree:{path}")),
                                    cx,
                                    move |v, _, cx| {
                                        if folder {
                                            if !v.expanded_folders.remove(&open_path) {
                                                v.expanded_folders.insert(open_path.clone());
                                            }
                                            cx.notify();
                                        } else {
                                            v.run(
                                                Job::File(
                                                    repo.clone(),
                                                    hash.clone(),
                                                    open_path.clone(),
                                                ),
                                                cx,
                                            );
                                        }
                                    },
                                )
                                .h_8()
                                .pl(px(8. + depth as f32 * 16.))
                                .pr_2()
                                .flex()
                                .items_center()
                                .gap_2()
                                .cursor_pointer()
                                .hover(|s| s.bg(cx.theme().muted))
                                .when(folder, |this| {
                                    this.child(
                                        glyph(if expanded {
                                            "chevron-down"
                                        } else {
                                            "chevron-right"
                                        })
                                        .size(px(14.))
                                        .flex_shrink_0()
                                        .text_color(rgb(0x64748b)),
                                    )
                                })
                                .child(
                                    glyph(if folder {
                                        if expanded { "folder-open" } else { "folder" }
                                    } else if label.ends_with(".ts") || label.ends_with(".tsx") {
                                        "file-code"
                                    } else if label.ends_with(".json") {
                                        "file-json"
                                    } else {
                                        "file-type"
                                    })
                                    .size_4()
                                    .flex_shrink_0()
                                    .text_color(rgb(
                                        if folder {
                                            0x60a5fa
                                        } else if label.ends_with(".ts") || label.ends_with(".tsx")
                                        {
                                            0x22d3ee
                                        } else if label.ends_with(".json") {
                                            0xfacc15
                                        } else if label.ends_with(".css")
                                            || label.ends_with(".scss")
                                        {
                                            0xc084fc
                                        } else {
                                            0x94a3b8
                                        },
                                    )),
                                )
                                .child(div().flex_1().min_w_0().text_sm().truncate().child(label))
                                .when_some(
                                    size.filter(|size| *size > 0),
                                    |this, size| {
                                        this.child(
                                            muted(cx, format!("{:.1}KB", size as f64 / 1024.))
                                                .text_xs(),
                                        )
                                    },
                                )
                            }),
                    ),
            );
            if self.working("files")
                || self.files.is_empty()
                || !self
                    .files
                    .iter()
                    .any(|file| file.path.to_lowercase().contains(&query))
            {
                files = files.child(
                    div()
                        .px_4()
                        .py_4()
                        .text_center()
                        .child(muted(
                            cx,
                            if self.working("files") {
                                "Loading files..."
                            } else {
                                "No files found"
                            },
                        ))
                        .text_xs(),
                );
            }
        } else {
            files = files.child(
                div().py_8().px_4().text_center().child(
                    muted(
                        cx,
                        if self.local_repo.is_some() {
                            "Select a commit to view files"
                        } else {
                            "Select a worktree to view files"
                        },
                    )
                    .text_xs()
                    .line_height(px(16.)),
                ),
            );
        }
        let active = self
            .snapshot
            .servers
            .iter()
            .filter(|s| s.status == "running")
            .count();
        let mut servers = div()
            .size_full()
            .flex()
            .flex_col()
            .child(
                section_header(cx, "power", "Active Servers")
                    .h_10()
                    .child(
                        div()
                            .rounded_full()
                            .px_2()
                            .bg(cx.theme().muted)
                            .text_xs()
                            .line_height(px(16.))
                            .child(active.to_string()),
                    )
                    .child(div().flex_1())
                    .child(
                        self.action("server-logs", "Logs", cx, |v, _, cx| v.show_logs(cx))
                            .icon(icon("file-text"))
                            .ghost(),
                    )
                    .child(
                        self.action("refresh-servers", "Refresh", cx, |v, _, cx| {
                            if let Some(repo) = v.local_repo.clone() {
                                v.run(Job::Commits(repo, 1), cx);
                            } else {
                                v.run(Job::Load, cx);
                            }
                        })
                        .icon(icon("refresh-cw"))
                        .ghost(),
                    )
                    .when(active > 0, |this| {
                        this.child(
                            self.action("stop-all", "Stop all", cx, |v, _, cx| {
                                v.run(Job::StopAll, cx)
                            })
                            .ghost(),
                        )
                    }),
            )
            .child(
                div()
                    .id("servers-scroll")
                    .flex_1()
                    .min_h_0()
                    .overflow_y_scroll()
                    .p_4()
                    .flex()
                    .flex_wrap()
                    .gap_2()
                    .children(self.snapshot.servers.iter().map(|server| {
                        let running = server.status == "running";
                        let failed = server.status == "failed";
                        let busy = self
                            .working(&format!("start:{}:{}", server.repo_id, server.commit_hash))
                            || self.working(&format!("stop:{}", server.id));
                        let stop = server.id.clone();
                        let remove = server.id.clone();
                        let url = server.url.clone();
                        let repo = self
                            .snapshot
                            .repositories
                            .iter()
                            .find(|r| r.id == server.repo_id)
                            .cloned();
                        let hash = server.commit_hash.clone();
                        card(cx)
                            .w(px(330.))
                            .p_2()
                            .gap_2()
                            .child(
                                div()
                                    .flex()
                                    .gap_2()
                                    .child(
                                        div()
                                            .w(px(90.))
                                            .p_2()
                                            .rounded_lg()
                                            .bg(cx.theme().background)
                                            .text_color(rgb(0x60a5fa))
                                            .text_xs()
                                            .line_height(px(16.))
                                            .font_family(MONO_FONT)
                                            .child(
                                                server
                                                    .commit_hash
                                                    .get(..7)
                                                    .unwrap_or(&server.commit_hash)
                                                    .to_string(),
                                            ),
                                    )
                                    .child(
                                        div()
                                            .flex_1()
                                            .p_2()
                                            .rounded_lg()
                                            .bg(cx.theme().background)
                                            .child(server.repo_name.clone()),
                                    ),
                            )
                            .child(
                                div()
                                    .flex()
                                    .gap_2()
                                    .child(
                                        self.action(
                                            SharedString::from(format!(
                                                "server-toggle:{}",
                                                server.id
                                            )),
                                            if running { "Stop" } else { "Start" },
                                            cx,
                                            move |v, _, cx| {
                                                if running {
                                                    v.run(Job::Stop(stop.clone()), cx);
                                                } else if let Some(repo) = &repo {
                                                    v.start_commit(repo.clone(), hash.clone(), cx);
                                                }
                                            },
                                        )
                                        .icon(icon(if running { "square" } else { "play" }))
                                        .loading(busy)
                                        .w(px(90.))
                                        .text_color(rgb(if running { 0xf87171 } else { 0x34d399 })),
                                    )
                                    .child(
                                        self.action(
                                            SharedString::from(format!(
                                                "server-open:{}",
                                                server.id
                                            )),
                                            if running {
                                                server.url.replace("http://", "")
                                            } else if failed {
                                                "Failed".into()
                                            } else {
                                                "Stopped".into()
                                            },
                                            cx,
                                            move |_, _, cx| cx.open_url(&url),
                                        )
                                        .icon(icon("external-link"))
                                        .disabled(!running)
                                        .ghost()
                                        .flex_1(),
                                    )
                                    .child(
                                        self.action(
                                            SharedString::from(format!(
                                                "server-remove:{}",
                                                server.id
                                            )),
                                            "",
                                            cx,
                                            move |v, _, cx| {
                                                v.run(Job::RemoveServer(remove.clone()), cx)
                                            },
                                        )
                                        .icon(icon("x"))
                                        .disabled(running || busy)
                                        .tooltip(if running {
                                            "Stop the server before removing it"
                                        } else {
                                            "Remove server"
                                        })
                                        .ghost(),
                                    ),
                            )
                    }))
                    .when(self.snapshot.servers.is_empty(), |this| {
                        this.child(
                            div()
                                .w_full()
                                .min_h(px(120.))
                                .rounded_lg()
                                .border_dashed()
                                .border_1()
                                .border_color(rgb(0x1e293b))
                                .flex()
                                .flex_col()
                                .items_center()
                                .justify_center()
                                .gap_2()
                                .child(glyph("power").size_6().text_color(rgb(0x475569)))
                                .child(muted(cx, "No active servers"))
                                .child(
                                    muted(cx, "Deploy a commit to start a server")
                                        .text_xs()
                                        .line_height(px(16.)),
                                ),
                        )
                    }),
            );
        // Keep the workspace panes independently scrollable and resizable.
        servers = servers.min_h_0();
        let header = section_header(cx, "git-commit-horizontal", "Commits")
            .child(
                div().text_color(rgb(0x60a5fa)).child(
                    self.local_repo
                        .as_ref()
                        .map(|r| r.name.clone())
                        .unwrap_or_else(|| "Select a repo".into()),
                ),
            )
            .when(self.local_commit_count > 0, |this| {
                this.child(
                    muted(cx, format!("{} total", self.local_commit_count))
                        .text_xs()
                        .line_height(px(16.))
                        .px_2()
                        .rounded_full()
                        .bg(cx.theme().muted),
                )
            })
            .when_some(self.local_repo.as_ref(), |this, repo| {
                this.child(
                    self.action("project-env", "ENV", cx, {
                        let id = repo.id;
                        move |v, _, cx| v.run(Job::Env("project".into(), id, String::new()), cx)
                    })
                    .icon(icon("box"))
                    .ghost()
                    .tooltip("Project Environment"),
                )
            })
            .child(div().flex_1())
            .child(
                div().w(px(220.)).child(
                    Input::new(&self.commit_filter)
                        .small()
                        .appearance(false)
                        .prefix(glyph("search")),
                ),
            );
        let mut commits = div()
            .size_full()
            .flex()
            .flex_col()
            .min_h_0()
            .child(header)
            .when(self.local_repo.is_some(), |this| {
                this.child(
                    div()
                        .h_10()
                        .flex_shrink_0()
                        .px_4()
                        .flex()
                        .items_center()
                        .bg(cx.theme().secondary)
                        .text_xs()
                        .line_height(px(16.))
                        .font_weight(FontWeight::SEMIBOLD)
                        .text_color(rgb(0x64748b))
                        .child(div().w(px(66.)).child("#"))
                        .child(div().w(px(110.)).child("COMMIT"))
                        .child(div().flex_1().child("MESSAGE"))
                        .child(div().w(px(150.)).child("AUTHOR"))
                        .child(div().w(px(120.)).child("DATE"))
                        .child(div().w(px(180.)).child("ACTIONS")),
                )
            })
            .child(
                div()
                    .id("commit-history")
                    .flex_1()
                    .min_h_0()
                    .overflow_y_scroll()
                    .children(
                        self.commits
                            .iter()
                            .enumerate()
                            .filter(|(_, c)| {
                                let q = self.commit_filter.read(cx).value().to_lowercase();
                                q.is_empty()
                                    || c.message.to_lowercase().contains(&q)
                                    || c.hash.contains(&q)
                            })
                            .map(|(index, commit)| {
                                let repo = self.local_repo.clone();
                                let clicked = commit.clone();
                                let hash = commit.hash.clone();
                                let env_hash = hash.clone();
                                let env_repo = repo.clone();
                                let start_repo = repo.clone();
                                let open_url = self
                                    .snapshot
                                    .servers
                                    .iter()
                                    .find(|server| {
                                        server.repo_id
                                            == repo.as_ref().map(|repo| repo.id).unwrap_or(0)
                                            && server.commit_hash == hash
                                            && server.status == "running"
                                    })
                                    .map(|server| server.url.clone());
                                let selected = self
                                    .selected_commit
                                    .as_ref()
                                    .is_some_and(|c| c.hash == hash);
                                let running = self
                                    .snapshot
                                    .servers
                                    .iter()
                                    .find(|s| {
                                        s.repo_id == repo.as_ref().map(|repo| repo.id).unwrap_or(0)
                                            && s.commit_hash == hash
                                            && s.status == "running"
                                    })
                                    .map(|s| s.id.clone());
                                let is_running = running.is_some();
                                let number = self.local_commit_count.saturating_sub(index);
                                let busy = self.working(&format!(
                                    "start:{}:{hash}",
                                    repo.as_ref().map(|repo| repo.id).unwrap_or(0)
                                )) || running
                                    .as_ref()
                                    .is_some_and(|id| self.working(&format!("stop:{id}")));
                                clickable(
                                    SharedString::from(format!("commit:{hash}")),
                                    cx,
                                    move |v, _, cx| {
                                        if let Some(repo) = &repo {
                                            v.selected_commit = Some(clicked.clone());
                                            v.run(
                                                Job::Files(repo.clone(), clicked.hash.clone()),
                                                cx,
                                            );
                                        }
                                    },
                                )
                                .h(px(53.))
                                .px_4()
                                .border_b_1()
                                .border_color(rgb(0x1e293b))
                                .flex()
                                .items_center()
                                .cursor_pointer()
                                .when(is_running, |this| {
                                    this.bg(cx.theme().success.opacity(0.1))
                                        .border_l_2()
                                        .border_color(cx.theme().success)
                                })
                                .when(selected && !is_running, |this| {
                                    this.bg(rgba(0x2563eb14))
                                        .border_l_2()
                                        .border_color(rgb(0x3b82f6))
                                })
                                .hover(|s| s.bg(cx.theme().secondary))
                                .child(
                                    muted(cx, format!("# {number}"))
                                        .w(px(66.))
                                        .text_xs()
                                        .line_height(px(16.)),
                                )
                                .child(
                                    div()
                                        .w(px(110.))
                                        .font_family(MONO_FONT)
                                        .text_color(rgb(0x60a5fa))
                                        .child(commit.short_hash.clone()),
                                )
                                .child(div().flex_1().min_w_0().pr_5().child(
                                    div().w_full().truncate().child(
                                        commit.message.lines().next().unwrap_or("").to_string(),
                                    ),
                                ))
                                .child(
                                    div()
                                        .w(px(150.))
                                        .flex_shrink_0()
                                        .flex()
                                        .items_center()
                                        .gap_2()
                                        .child(
                                            div()
                                                .size_6()
                                                .rounded_full()
                                                .bg(rgb(0xc942cf))
                                                .flex()
                                                .items_center()
                                                .justify_center()
                                                .text_xs()
                                                .line_height(px(16.))
                                                .text_color(rgb(0xffffff))
                                                .child(
                                                    commit
                                                        .author
                                                        .chars()
                                                        .next()
                                                        .unwrap_or('?')
                                                        .to_uppercase()
                                                        .to_string(),
                                                ),
                                        )
                                        .child(muted(cx, commit.author.clone()).truncate()),
                                )
                                .child(
                                    muted(cx, display_date(&commit.date))
                                        .w(px(120.))
                                        .text_xs()
                                        .line_height(px(16.)),
                                )
                                .child(
                                    div()
                                        .w(px(180.))
                                        .flex()
                                        .items_center()
                                        .gap_1()
                                        .child(
                                            self.action(
                                                SharedString::from(format!("deploy:{hash}")),
                                                if is_running { "Stop" } else { "Start" },
                                                cx,
                                                move |v, _, cx| {
                                                    if let Some(id) = &running {
                                                        v.run(Job::Stop(id.clone()), cx);
                                                    } else if let Some(repo) = &start_repo {
                                                        v.start_commit(
                                                            repo.clone(),
                                                            hash.clone(),
                                                            cx,
                                                        );
                                                    }
                                                },
                                            )
                                            .icon(icon(if is_running { "square" } else { "play" }))
                                            .ghost()
                                            .loading(busy)
                                            .bg(if is_running {
                                                cx.theme().danger.opacity(0.15)
                                            } else {
                                                cx.theme().success.opacity(0.1)
                                            })
                                            .text_color(if is_running {
                                                cx.theme().danger
                                            } else {
                                                cx.theme().success
                                            }),
                                        )
                                        .when_some(open_url, |this, url| {
                                            this.child(
                                                self.action(
                                                    SharedString::from(format!(
                                                        "open-commit:{env_hash}"
                                                    )),
                                                    "Open",
                                                    cx,
                                                    move |_, _, cx| cx.open_url(&url),
                                                )
                                                .icon(icon("external-link"))
                                                .primary(),
                                            )
                                        })
                                        .child(
                                            self.action(
                                                SharedString::from(format!(
                                                    "commit-env:{env_hash}"
                                                )),
                                                "",
                                                cx,
                                                move |v, _, cx| {
                                                    if let Some(repo) = &env_repo {
                                                        v.run(
                                                            Job::Env(
                                                                "commit".into(),
                                                                repo.id,
                                                                env_hash.clone(),
                                                            ),
                                                            cx,
                                                        );
                                                    }
                                                },
                                            )
                                            .icon(icon("variable"))
                                            .ghost()
                                            .tooltip("Commit Environment"),
                                        ),
                                )
                            }),
                    )
                    .when(
                        !self.commits.iter().any(|commit| {
                            let query = self.commit_filter.read(cx).value().to_lowercase();
                            query.is_empty()
                                || commit.hash.contains(&query)
                                || commit.message.to_lowercase().contains(&query)
                        }),
                        |this| {
                            this.child(div().p_12().text_center().child(muted(
                                cx,
                                if self.working("commits") {
                                    "Loading commits...".to_string()
                                } else if !self.commit_filter.read(cx).value().is_empty() {
                                    format!(
                                        "No commits found matching \"{}\"",
                                        self.commit_filter.read(cx).value()
                                    )
                                } else if self.local_repo.is_some() {
                                    "No commits found".to_string()
                                } else {
                                    "Select a worktree to view commits".to_string()
                                },
                            )))
                        },
                    ),
            );
        if let Some(repo) = &self.local_repo
            && self.commits.len() < self.local_commit_count
        {
            let next = repo.clone();
            commits = commits.child(
                div()
                    .h_10()
                    .px_6()
                    .flex()
                    .items_center()
                    .justify_center()
                    .border_t_1()
                    .border_color(cx.theme().border)
                    .child(
                        self.action("next-page", "Load More Commits", cx, move |v, _, cx| {
                            v.run(Job::Commits(next.clone(), v.commit_page + 1), cx)
                        })
                        .ghost()
                        .loading(self.working("commits")),
                    ),
            );
        }
        div()
            .size_full()
            .pt_2()
            .child(
                h_resizable("replay-columns")
                    .child(
                        resizable_panel()
                            .size(px(280.))
                            .size_range(px(210.)..px(560.))
                            .child(
                                v_resizable("replay-sidebar")
                                    .child(
                                        resizable_panel()
                                            .size(px(148.))
                                            .size_range(px(100.)..px(560.))
                                            .child(repo_list),
                                    )
                                    .child(resizable_panel().child(files)),
                            ),
                    )
                    .child(
                        resizable_panel().child(
                            v_resizable("replay-main")
                                .child(
                                    resizable_panel()
                                        .size(px(194.))
                                        .size_range(px(140.)..px(600.))
                                        .child(servers),
                                )
                                .child(resizable_panel().child(commits)),
                        ),
                    ),
            )
            .into_any_element()
    }
}
