use super::*;
impl Render for Nexus {
    fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        if self.clear_token_input {
            self.clear_token_input = false;
            self.token
                .update(cx, |state, cx| state.set_value("", window, cx));
        }
        if let Some(values) = self.pending_env.take() {
            self.show_env = false;
            self.env_rows.clear();
            for value in values {
                self.add_env_row(value.key, value.value, window, cx);
            }
            self.env_dirty = false;
        }
        if self.initial_settings && self.snapshot.revision > 0 {
            self.initial_settings = false;
            let path = self.snapshot.download_path.clone();
            self.download_path
                .update(cx, |state, cx| state.set_value(path, window, cx));
            if let Some(repo) = self.snapshot.repositories.first() {
                let path = repo.path.clone();
                self.local_path
                    .update(cx, |state, cx| state.set_value(path, window, cx));
            }
            crate::theme::apply_theme(&self.snapshot.theme, window, cx);
            if self.screen == Screen::Watchlist {
                self.run(Job::WatchlistReleases, cx);
            }
            if self.screen == Screen::Replay {
                self.navigate(Screen::Replay, cx);
            }
        }
        // Keep the navigation centered independently of the brand and search field.
        let nav = div()
            .absolute()
            .top(px(5.))
            .left_1_2()
            .ml(px(-180.))
            .w(px(360.))
            .h(px(46.))
            .px_2()
            .flex()
            .items_center()
            .gap_1()
            .rounded_full()
            .border_1()
            .border_color(rgba(0xffffff0d))
            .bg(cx.theme().secondary.opacity(0.9))
            .shadow_lg()
            .children(
                [
                    (Screen::Discovery, "search", "Discovery"),
                    (Screen::Watchlist, "eye", "Watchlist"),
                    (Screen::Replay, "history", "Replay"),
                ]
                .into_iter()
                .enumerate()
                .map(|(index, (screen, name, label))| {
                    clickable(("nav", index), cx, move |v, _, cx| v.navigate(screen, cx))
                        .flex_1()
                        .h_8()
                        .flex()
                        .items_center()
                        .justify_center()
                        .gap_2()
                        .rounded_full()
                        .cursor_pointer()
                        .text_color(if self.screen == screen {
                            rgb(0xffffff).into()
                        } else {
                            cx.theme().muted_foreground
                        })
                        .when(self.screen == screen, |this| {
                            this.bg(cx.theme().primary.opacity(0.9)).shadow_md()
                        })
                        .hover(|s| {
                            s.bg(if self.screen == screen {
                                cx.theme().primary.opacity(0.9)
                            } else {
                                cx.theme().muted
                            })
                        })
                        .child(glyph(name).text_color(if self.screen == screen {
                            rgb(0xffffff).into()
                        } else {
                            cx.theme().muted_foreground
                        }))
                        .child(label)
                }),
            );
        let header = div()
            .relative()
            .h(px(56.))
            .flex_shrink_0()
            .px_6()
            .flex()
            .items_center()
            .justify_between()
            .child(
                clickable("home-link", cx, |v, _, cx| v.navigate(Screen::Home, cx))
                    .flex()
                    .items_center()
                    .gap_3()
                    .cursor_pointer()
                    .child(
                        div()
                            .size_8()
                            .rounded_lg()
                            .bg(rgb(0x2563eb))
                            .flex()
                            .items_center()
                            .justify_center()
                            .child(glyph("github").size(px(18.)).text_color(rgb(0xffffff))),
                    )
                    .child(
                        div()
                            .text_lg()
                            .line_height(px(28.))
                            .font_weight(FontWeight::BOLD)
                            .text_color(rgb(0xffffff))
                            .child("GitNexus"),
                    ),
            )
            .child(nav)
            .child(
                div()
                    .flex()
                    .items_center()
                    .gap_3()
                    .when(self.screen == Screen::Discovery, |this| {
                        this.child(
                            div().w(px(256.)).child(
                                Input::new(&self.username)
                                    .prefix(glyph("search").text_color(cx.theme().muted_foreground))
                                    .rounded_full()
                                    .small(),
                            ),
                        )
                    })
                    .child(
                        Button::new("settings-nav")
                            .icon(icon("settings"))
                            .ghost()
                            .tooltip("Settings")
                            .text_color(if self.screen == Screen::Settings {
                                cx.theme().primary
                            } else {
                                cx.theme().muted_foreground
                            })
                            .on_click(cx.listener(|v, _, _, cx| v.navigate(Screen::Settings, cx))),
                    ),
            );
        for repo in self.snapshot.watchlist.clone() {
            self.asset_filters.entry(repo.id).or_insert_with(|| {
                let field = input(window, cx, "Filter assets...", false, false);
                cx.observe(&field, |_, _, cx| cx.notify()).detach();
                field
            });
        }
        let content = match self.screen {
            Screen::Home => self.home(cx),
            Screen::Discovery => self.discovery(window, cx),
            Screen::Watchlist => self.watchlist(window, cx),
            Screen::Replay => self.replay(cx),
            Screen::Settings => self.settings(cx),
        };
        let page = div()
            .id("page-scroll")
            .flex_1()
            .min_h_0()
            .min_w_0()
            .when(self.screen != Screen::Replay, |this| {
                this.overflow_y_scroll()
            })
            .child(content);
        let mut modal = None;
        if let Some((title, body, code)) = &self.viewer {
            let rendered = if *code {
                let longest = body.split(|c| c != '`').map(str::len).max().unwrap_or(0);
                let fence = "`".repeat((longest + 1).max(3));
                format!("{fence}\n{body}\n{fence}")
            } else {
                body.clone()
            };
            modal = Some(
                card(cx)
                    .child(
                        div()
                            .flex()
                            .justify_between()
                            .child(heading(title.clone()))
                            .child(self.action("close-viewer", "Close", cx, |v, _, cx| {
                                v.viewer = None;
                                cx.notify();
                            })),
                    )
                    .child(self.action("copy-viewer", "Copy content", cx, {
                        let body = body.clone();
                        move |v, _, cx| {
                            cx.write_to_clipboard(ClipboardItem::new_string(body.clone()));
                            v.notify_user("Content copied", false, cx);
                        }
                    }))
                    .child(
                        markdown("viewer", rendered, window, cx)
                            .w_full()
                            .h_auto()
                            .flex_shrink_0()
                            .selectable(true),
                    ),
            );
        }
        if let Some((scope, id, hash)) = &self.env_scope
            && self.viewer.is_none()
        {
            modal = Some(self.environment_dialog(scope, *id, hash, cx));
        }
        if let Some(commit) = &self.remote_commit {
            modal = Some(self.repository_commit_dialog(commit, window, cx));
        }
        if let Some(day) = &self.selected_day {
            modal = Some(self.contribution_day(day, cx));
        }
        if let Some((question, _)) = &self.confirm {
            modal = Some(
                card(cx)
                    .border_color(rgb(0xd8a45c))
                    .child(question.clone())
                    .child(
                        div()
                            .flex()
                            .gap_2()
                            .child(
                                self.action("confirm-action", "Confirm", cx, |v, _, cx| {
                                    if let Some((_, job)) = v.confirm.take() {
                                        v.run(job, cx)
                                    }
                                })
                                .danger(),
                            )
                            .child(self.action("cancel-action", "Cancel", cx, |v, _, cx| {
                                v.confirm = None;
                                cx.notify();
                            })),
                    ),
            );
        }
        if let Some(dialog) = self.dialog {
            modal = Some(self.dialog_content(dialog, cx));
        }
        let notifications = div()
            .absolute()
            .bottom_6()
            .right_6()
            .w(px(384.))
            .flex()
            .flex_col()
            .gap_2()
            .children(self.notices.iter().map(|notice| {
                let id = notice.id;
                div()
                    .id(("notice", id))
                    .p_3()
                    .rounded_lg()
                    .shadow_lg()
                    .border_1()
                    .border_color(if notice.error {
                        rgba(0xef444480)
                    } else {
                        rgba(0x10b98180)
                    })
                    .bg(if notice.error {
                        rgba(0x450a0acc)
                    } else {
                        rgba(0x022c22cc)
                    })
                    .text_color(if notice.error {
                        rgb(0xfecaca)
                    } else {
                        rgb(0xa7f3d0)
                    })
                    .flex()
                    .items_center()
                    .gap_3()
                    .occlude()
                    .child(glyph(if notice.error {
                        "circle-alert"
                    } else {
                        "circle-check"
                    }))
                    .child(div().flex_1().min_w_0().child(notice.message.clone()))
                    .child(
                        Button::new(("dismiss-notice", id))
                            .icon(icon("x"))
                            .ghost()
                            .small()
                            .on_click(cx.listener(move |v, _, _, cx| {
                                v.notices.retain(|notice| notice.id != id);
                                cx.notify();
                            })),
                    )
            }));
        div()
            .relative()
            .size_full()
            .flex()
            .flex_col()
            .bg(cx.theme().background)
            .text_color(cx.theme().foreground)
            .text_sm()
            .font_family(cx.theme().font_family.clone())
            .line_height(px(20.))
            .track_focus(&self.focus_handle)
            .capture_key_down(cx.listener(|v, event: &KeyDownEvent, _window, cx| {
                if event.keystroke.key == "escape"
                    && (v.viewer.is_some()
                        || v.confirm.is_some()
                        || v.dialog.is_some()
                        || v.selected_day.is_some()
                        || v.env_scope.is_some()
                        || v.remote_commit.is_some()
                        || v.show_search_history)
                {
                    cx.stop_propagation();
                    if v.remote_commit.take().is_some() || v.viewer.take().is_some() {
                        cx.notify();
                        return;
                    }
                    v.viewer = None;
                    v.confirm = None;
                    v.dialog = None;
                    v.selected_day = None;
                    v.show_search_history = false;
                    v.env_scope = None;
                    v.show_env = false;
                    v.env_rows.clear();
                    cx.notify();
                }
            }))
            .child(header)
            .child(page)
            .when(
                self.screen == Screen::Discovery
                    && self.show_search_history
                    && !self.snapshot.history.is_empty(),
                |this| {
                    let query = self.username.read(cx).value().to_lowercase();
                    this.child(
                        div()
                            .absolute()
                            .right(px(72.))
                            .top(px(54.))
                            .w(px(256.))
                            .p_2()
                            .rounded_xl()
                            .border_1()
                            .border_color(cx.theme().border)
                            .bg(cx.theme().secondary)
                            .shadow_lg()
                            .occlude()
                            .on_mouse_down_out(cx.listener(|v, _, _, cx| {
                                v.show_search_history = false;
                                cx.notify();
                            }))
                            .child(
                                muted(cx, "RECENT")
                                    .text_xs()
                                    .line_height(px(16.))
                                    .px_2()
                                    .py_1(),
                            )
                            .children(
                                self.snapshot
                                    .history
                                    .iter()
                                    .filter(|u| u.to_lowercase().contains(&query))
                                    .take(5)
                                    .cloned()
                                    .map(|user| {
                                        self.action(
                                            SharedString::from(format!("suggestion:{user}")),
                                            user.clone(),
                                            cx,
                                            move |v, window, cx| {
                                                v.username.update(cx, |state, cx| {
                                                    state.set_value(user.clone(), window, cx)
                                                });
                                                v.run(Job::Discover(user.clone(), false), cx);
                                            },
                                        )
                                        .icon(icon("clock"))
                                        .ghost()
                                        .w_full()
                                    }),
                            ),
                    )
                },
            )
            .when_some(modal, |this, modal| {
                this.child(
                    div()
                        .id("modal-backdrop")
                        .occlude()
                        .absolute()
                        .inset_0()
                        .bg(rgba(0x00000099))
                        .on_mouse_down(
                            MouseButton::Left,
                            cx.listener(|v, _, _, cx| {
                                if v.remote_commit.take().is_some() || v.viewer.take().is_some() {
                                    cx.notify();
                                    return;
                                }
                                v.viewer = None;
                                v.confirm = None;
                                v.dialog = None;
                                v.selected_day = None;
                                v.close_environment(cx);
                            }),
                        )
                        .flex()
                        .items_center()
                        .justify_center()
                        .p_8()
                        .child(
                            div()
                                .id("modal-scroll")
                                .on_mouse_down(MouseButton::Left, |_, _, cx| cx.stop_propagation())
                                .w(px(if self.viewer.is_some() {
                                    896.
                                } else if self.selected_day.is_some()
                                    || self.remote_commit.is_some()
                                {
                                    672.
                                } else {
                                    448.
                                }))
                                .max_h(window.viewport_size().height * 0.9)
                                .overflow_y_scroll()
                                .child(modal),
                        ),
                )
            })
            .child(notifications)
    }
}
