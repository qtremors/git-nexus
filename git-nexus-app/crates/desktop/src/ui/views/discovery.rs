use super::*;
use gpui_component::menu::{DropdownMenu, PopupMenuItem};

impl Nexus {
    fn sort_menu(&self, cx: &Context<Self>) -> AnyElement {
        let view = cx.entity().downgrade();
        let selected = self.sort;
        Button::new("sort")
            .label(["Stars", "Updated", "Created", "Commits", "Name"][self.sort])
            .small()
            .ghost()
            .rounded_full()
            .dropdown_menu(move |mut menu, _, _| {
                for (i, label) in ["Stars", "Updated", "Created", "Commits", "Name"]
                    .into_iter()
                    .enumerate()
                {
                    let view = view.clone();
                    menu = menu.item(PopupMenuItem::new(label).checked(i == selected).on_click(
                        move |_, _, cx| {
                            let _ = view.update(cx, |v, cx| {
                                v.sort = i;
                                cx.notify();
                            });
                        },
                    ));
                }
                menu
            })
            .into_any_element()
    }
    fn topic_menu(&self, cx: &Context<Self>) -> AnyElement {
        let mut topics: BTreeSet<String> =
            self.repos.iter().flat_map(|r| r.topics.clone()).collect();
        topics.insert(String::new());
        let view = cx.entity().downgrade();
        let selected = self.topic.read(cx).value().to_string();
        Button::new("topic-menu")
            .label(if selected.is_empty() {
                "All Topics".to_string()
            } else {
                selected.clone()
            })
            .icon(icon("chevron-down"))
            .small()
            .outline()
            .rounded_full()
            .dropdown_menu(move |mut menu, _, _| {
                for topic in &topics {
                    let view = view.clone();
                    let topic = topic.clone();
                    menu = menu.item(
                        PopupMenuItem::new(if topic.is_empty() {
                            "All Topics".to_string()
                        } else {
                            topic.clone()
                        })
                        .checked(topic == selected)
                        .on_click(move |_, window, cx| {
                            let _ = view.update(cx, |v, cx| {
                                v.topic.update(cx, |state, cx| {
                                    state.set_value(topic.clone(), window, cx)
                                });
                                cx.notify();
                            });
                        }),
                    );
                }
                menu
            })
            .into_any_element()
    }
    pub(super) fn discovery(&self, window: &mut Window, cx: &mut Context<Self>) -> AnyElement {
        if let Some(repo) = &self.detail {
            return self.repository_detail(repo, window, cx);
        }
        let Some(profile) = &self.profile else {
            let suggestions = if self.snapshot.history.is_empty() {
                vec!["vercel".into(), "facebook".into(), "microsoft".into()]
            } else {
                self.snapshot.history.clone()
            };
            return div()
                .w_full()
                .h_full()
                .min_h(px(600.))
                .flex()
                .flex_col()
                .items_center()
                .justify_center()
                .text_color(cx.theme().muted_foreground)
                .child(
                    glyph(if self.working("discovery") { "refresh-cw" } else { "github" })
                        .size_16()
                        .mb_4()
                        .opacity(0.2),
                )
                .child(
                    div()
                        .text_xl().line_height(px(28.))
                        .font_weight(FontWeight::SEMIBOLD)
                        .mb_2()
                        .child(if self.working("discovery") {
                            "Searching GitHub..."
                        } else {
                            "Search for a GitHub User"
                        }),
                )
                .child(div().text_center().max_w(px(448.)).text_base().line_height(px(24.)).child(
                    "Use the search bar in the header to explore profiles and repositories.",
                ))
                .child(
                    div()
                        .flex()
                        .gap_2()
                        .mt_8()
                        .children(suggestions.into_iter().map(|user| {
                            self.action(
                                SharedString::from(format!("history:{user}")),
                                user.clone(),
                                cx,
                                move |v, window, cx| {
                                    v.username.update(cx, |state, cx| {
                                        state.set_value(user.clone(), window, cx)
                                    });
                                    v.run(Job::Discover(user.clone(), false), cx);
                                },
                            )
                            .bg(cx.theme().secondary)
                        })),
                )
                .into_any_element();
        };
        let owner = profile.login.clone();
        let refresh_owner = owner.clone();
        let total_commits: u64 = self.counts.values().sum();
        let profile_header = div()
            .min_h(px(200.))
            .relative()
            .p_6()
            .rounded_xl()
            .border_1()
            .border_color(rgb(0x1e293b))
            .bg(rgb(0x0d1117))
            .flex()
            .items_start()
            .gap_6()
            .child(if profile.avatar_url.is_empty() {
                div()
                    .size_24()
                    .rounded_full()
                    .bg(cx.theme().secondary)
                    .flex()
                    .items_center()
                    .justify_center()
                    .child(glyph("github").size_12())
                    .into_any_element()
            } else {
                div()
                    .size_24()
                    .flex_shrink_0()
                    .rounded_full()
                    .border_2()
                    .border_color(rgb(0x3b82f6))
                    .shadow_lg()
                    .child(
                        img(profile.avatar_url.clone())
                            .size_full()
                            .rounded_full()
                            .with_fallback(|| glyph("github").size_24().into_any_element()),
                    )
                    .into_any_element()
            })
            .child(
                div()
                    .flex_1()
                    .min_w_0()
                    .pt_1()
                    .flex()
                    .flex_col()
                    .child(
                        div()
                            .id("profile-link")
                            .cursor_pointer()
                            .text_2xl()
                            .line_height(px(32.))
                            .font_weight(FontWeight::BOLD)
                            .text_color(rgb(0x3b82f6))
                            .child(profile.name.clone().unwrap_or_else(|| owner.clone()))
                            .on_click(cx.listener({
                                let url = profile.html_url.clone();
                                move |_, _, _, cx| cx.open_url(&url)
                            })),
                    )
                    .child(muted(cx, format!("@{owner}")).mb_3())
                    .child(
                        div()
                            .text_color(rgb(0xcbd5e1))
                            .max_w(px(672.))
                            .mb_4()
                            .child(
                                profile
                                    .bio
                                    .clone()
                                    .unwrap_or_else(|| "No bio available.".into()),
                            ),
                    )
                    .child(
                        div()
                            .flex()
                            .flex_wrap()
                            .gap_6()
                            .mt_1()
                            .text_color(rgb(0x94a3b8))
                            .children(
                                [
                                    ("users", format!("{} followers", profile.followers)),
                                    ("user", format!("{} following", profile.following)),
                                    ("book", format!("{} public repos", profile.public_repos)),
                                ]
                                .into_iter()
                                .map(|(name, value)| {
                                    div()
                                        .flex()
                                        .items_center()
                                        .gap_2()
                                        .child(glyph(name))
                                        .child(value)
                                }),
                            )
                            .when(total_commits > 0, |this| {
                                this.child(
                                    div()
                                        .flex()
                                        .items_center()
                                        .gap_2()
                                        .pl_6()
                                        .border_l_1()
                                        .border_color(rgb(0x334155))
                                        .child(glyph("git-commit-horizontal"))
                                        .child(format!("{total_commits} commits (public)")),
                                )
                            }),
                    ),
            )
            .child(
                self.action("refresh-profile", "", cx, move |v, _, cx| {
                    v.run(Job::Discover(refresh_owner.clone(), true), cx)
                })
                .icon(icon("refresh-cw"))
                .outline()
                .tooltip("Refresh Profile")
                .absolute()
                .top_0()
                .right_0(),
            );
        let mut tabs = div()
            .flex()
            .items_center()
            .gap_4()
            .pb_2()
            .border_b_1()
            .border_color(cx.theme().border);
        for (is_overview, title) in [(true, "Overview"), (false, "Repositories")] {
            tabs = tabs.child(
                clickable(title, cx, move |v, _, cx| {
                    v.overview = is_overview;
                    if is_overview
                        && !v.contributions_fetched
                        && let Some(profile) = &v.profile
                    {
                        v.run(
                            Job::Contributions(profile.login.clone(), v.repos.clone(), false),
                            cx,
                        );
                    }
                    cx.notify();
                })
                .px_1()
                .py_2()
                .cursor_pointer()
                .text_color(if self.overview == is_overview {
                    cx.theme().primary
                } else {
                    cx.theme().muted_foreground
                })
                .when(self.overview == is_overview, |this| {
                    this.border_b_2().border_color(cx.theme().primary)
                })
                .child(title),
            );
        }
        if !self.overview {
            tabs = tabs
                .child(
                    div().w(px(240.)).child(
                        Input::new(&self.filter)
                            .small()
                            .rounded_full()
                            .prefix(glyph("search")),
                    ),
                )
                .child(
                    div()
                        .w(px(150.))
                        .flex()
                        .items_center()
                        .gap_1()
                        .rounded_full()
                        .border_1()
                        .border_color(cx.theme().border)
                        .px_2()
                        .child(glyph("git-commit-horizontal").size_3())
                        .child(Input::new(&self.min_commits).small().appearance(false))
                        .child("-")
                        .child(Input::new(&self.max_commits).small().appearance(false)),
                )
                .child(
                    div()
                        .flex()
                        .items_center()
                        .rounded_full()
                        .border_1()
                        .border_color(cx.theme().border)
                        .child(self.sort_menu(cx))
                        .child(
                            self.action("sort-direction", "", cx, |v, _, cx| {
                                v.ascending = !v.ascending;
                                cx.notify();
                            })
                            .icon(icon(if self.ascending {
                                "arrow-up"
                            } else {
                                "arrow-down"
                            }))
                            .ghost()
                            .rounded_full()
                            .tooltip(if self.ascending {
                                "Ascending"
                            } else {
                                "Descending"
                            }),
                        ),
                )
                .child(self.topic_menu(cx))
                .child(div().flex_1())
                .child(
                    div()
                        .flex()
                        .gap_1()
                        .rounded_full()
                        .border_1()
                        .border_color(cx.theme().border)
                        .p_1()
                        .children((1..=4).map(|count| {
                            self.action(
                                ("columns", count),
                                count.to_string(),
                                cx,
                                move |v, _, cx| {
                                    v.columns = count;
                                    cx.notify();
                                },
                            )
                            .ghost()
                            .size(px(20.))
                            .rounded_full()
                            .text_size(px(9.))
                            .when(self.columns == count, |this| {
                                this.bg(cx.theme().primary).text_color(rgb(0xffffff))
                            })
                        })),
                );
        }
        let mut page = div()
            .w_full()
            .max_w(px(1600.))
            .mx_auto()
            .p_6()
            .pt(px(56.))
            .flex()
            .flex_col()
            .gap_6()
            .child(profile_header)
            .child(tabs);
        if self.overview {
            page = page.child(
                card(cx)
                    .bg(cx.theme().secondary.opacity(0.5))
                    .child(muted(cx, "PROFILE README").text_xs().line_height(px(16.)))
                    .child(
                        markdown(
                            "profile-readme",
                            if self.profile_readme.is_empty() {
                                "Loading profile README...".into()
                            } else {
                                self.profile_readme.clone()
                            },
                            window,
                            cx,
                        )
                        .w_full()
                        .h_auto()
                        .flex_shrink_0()
                        .selectable(true),
                    ),
            );
            let mut languages: Vec<(String, usize)> = Vec::new();
            for repo in &self.repos {
                if let Some(lang) = &repo.language {
                    if let Some((_, count)) = languages.iter_mut().find(|(name, _)| name == lang) {
                        *count += 1;
                    } else {
                        languages.push((lang.clone(), 1));
                    }
                }
            }
            let total = languages.iter().map(|(_, count)| count).sum::<usize>();
            languages.sort_by_key(|(_, count)| std::cmp::Reverse(*count));
            languages.truncate(6);
            page = page.child(
                div()
                    .flex()
                    .items_start()
                    .gap_6()
                    .child(
                        card(cx)
                            .w(relative(0.25))
                            .flex_shrink_0()
                            .p_5()
                            .gap_2()
                            .bg(cx.theme().secondary.opacity(0.5))
                            .child(
                                div()
                                    .flex()
                                    .items_center()
                                    .gap_2()
                                    .mb_2()
                                    .child(glyph("code").size_4())
                                    .child(
                                        muted(cx, "TOP LANGUAGES")
                                            .font_weight(FontWeight::SEMIBOLD),
                                    ),
                            )
                            .when(total == 0, |this| {
                                this.child(muted(cx, "No language data."))
                            })
                            .when(total > 0, |this| {
                                this.child(
                                    div()
                                        .w_full()
                                        .h_3()
                                        .flex()
                                        .rounded_full()
                                        .overflow_hidden()
                                        .mb_2()
                                        .bg(cx.theme().secondary)
                                        .children(languages.iter().map(|(lang, count)| {
                                            div()
                                                .h_full()
                                                .w(relative(*count as f32 / total as f32))
                                                .flex_shrink_0()
                                                .bg(rgb(language_color(lang)))
                                        })),
                                )
                            })
                            .children(languages.into_iter().map(|(lang, count)| {
                                div()
                                    .flex()
                                    .items_center()
                                    .gap_2()
                                    .text_xs()
                                    .line_height(px(16.))
                                    .child(
                                        div()
                                            .size(px(10.))
                                            .rounded_full()
                                            .bg(rgb(language_color(&lang))),
                                    )
                                    .child(lang)
                                    .child(div().flex_1())
                                    .child(
                                        muted(
                                            cx,
                                            format!(
                                                "{:.1}%",
                                                100. * count as f32 / total.max(1) as f32
                                            ),
                                        )
                                        .text_xs()
                                        .line_height(px(16.)),
                                    )
                            })),
                    )
                    .child(div().flex_1().min_w_0().child(self.contribution_graph(cx))),
            );
            return page.into_any_element();
        }
        let languages: BTreeSet<String> = self
            .repos
            .iter()
            .filter_map(|r| r.language.clone())
            .collect();
        let mut chips = div().flex().items_center().gap_2();
        for language in std::iter::once("All".to_string()).chain(languages) {
            let active = self.language == language;
            chips = chips.child(
                self.action(
                    SharedString::from(format!("language:{language}")),
                    language.clone(),
                    cx,
                    move |v, _, cx| {
                        v.language = language.clone();
                        cx.notify();
                    },
                )
                .outline()
                .rounded_full()
                .when(active, |this| {
                    this.bg(cx.theme().primary).text_color(rgb(0xffffff))
                }),
            );
        }
        chips = chips
            .child(div().flex_1())
            .when(!self.selected_downloads.is_empty(), |this| {
                this.child(
                    self.action(
                        "download-selected",
                        self.selected_downloads.len().to_string(),
                        cx,
                        |v, _, cx| {
                            let repos = v
                                .repos
                                .iter()
                                .filter(|r| v.selected_downloads.contains(&r.full_name))
                                .cloned()
                                .collect();
                            v.run(Job::DownloadRepos(repos), cx);
                        },
                    )
                    .icon(icon("download"))
                    .outline()
                    .rounded_full()
                    .text_color(cx.theme().success),
                )
            });
        page = page.child(chips);
        let query = self.filter.read(cx).value().to_lowercase();
        let topic = self.topic.read(cx).value().to_lowercase();
        let min = self.min_commits.read(cx).value().parse::<u64>().ok();
        let max = self.max_commits.read(cx).value().parse::<u64>().ok();
        let mut visible: Vec<_> = self
            .repos
            .iter()
            .filter(|r| {
                let count = self.counts.get(&r.name).copied().unwrap_or(0);
                (query.is_empty()
                    || format!("{} {}", r.name, r.description.as_deref().unwrap_or(""))
                        .to_lowercase()
                        .contains(&query))
                    && (self.language == "All" || r.language.as_deref() == Some(&self.language))
                    && (topic.is_empty() || r.topics.iter().any(|t| t.to_lowercase() == topic))
                    && min.is_none_or(|m| count >= m)
                    && max.is_none_or(|m| count <= m)
            })
            .cloned()
            .collect();
        visible.sort_by(|a, b| {
            let order = match self.sort {
                0 => a.stargazers_count.cmp(&b.stargazers_count),
                1 => a.updated_at.cmp(&b.updated_at),
                2 => a.created_at.cmp(&b.created_at),
                3 => self.counts.get(&a.name).cmp(&self.counts.get(&b.name)),
                _ => b.name.to_lowercase().cmp(&a.name.to_lowercase()),
            };
            if self.ascending {
                order
            } else {
                order.reverse()
            }
        });

        if visible.is_empty() {
            page = page.child(
                div()
                    .py_12()
                    .text_center()
                    .child(muted(cx, "No repositories match your filters.")),
            );
        }
        let mut repository_rows = div().flex().flex_col().gap_3();
        for chunk in visible.chunks(self.columns) {
            repository_rows = repository_rows.child(
                div()
                    .flex()
                    .gap_4()
                    .children(chunk.iter().map(|repo| {
                        let detail = repo.clone();
                        let selected = repo.full_name.clone();
                        let has_selected = self.selected_downloads.contains(&selected);
                        clickable(("repository", repo.id), cx, move |v, _, cx| {
                            v.run(Job::Detail(detail.clone()), cx)
                        })
                        .flex_1()
                        .min_w_0()
                        .p_4()
                        .rounded_xl()
                        .border_1()
                        .border_color(cx.theme().border)
                        .bg(cx.theme().secondary.opacity(0.5))
                        .hover(|s| s.bg(cx.theme().secondary.opacity(0.8)))
                        .cursor_pointer()
                        .flex()
                        .when(self.columns > 1, |this| this.flex_col())
                        .gap_4()
                        .child(
                            div()
                                .flex_1()
                                .min_w_0()
                                .flex()
                                .flex_col()
                                .gap_3()
                                .child(
                                    div()
                                        .flex()
                                        .items_center()
                                        .gap_2()
                                        .child(
                                            div()
                                                .text_lg()
                                                .line_height(px(28.))
                                                .font_weight(FontWeight::SEMIBOLD)
                                                .text_color(cx.theme().primary)
                                                .child(repo.name.clone()),
                                        )
                                        .when_some(repo.language.as_ref(), |this, lang| {
                                            this.child(
                                                div()
                                                    .px_2()
                                                    .rounded_full()
                                                    .border_1()
                                                    .border_color(cx.theme().border)
                                                    .text_size(px(10.))
                                                    .text_color(cx.theme().muted_foreground)
                                                    .child(lang.clone()),
                                            )
                                        }),
                                )
                                .child(muted(
                                    cx,
                                    repo.description
                                        .clone()
                                        .unwrap_or_else(|| "No description provided.".into()),
                                ))
                                .child(
                                    div()
                                        .flex()
                                        .flex_wrap()
                                        .items_center()
                                        .gap_4()
                                        .text_xs()
                                        .line_height(px(16.))
                                        .text_color(cx.theme().muted_foreground)
                                        .children(
                                            [
                                                ("star", repo.stargazers_count.to_string()),
                                                ("git-fork", repo.forks_count.to_string()),
                                                (
                                                    "git-commit-horizontal",
                                                    self.counts
                                                        .get(&repo.name)
                                                        .copied()
                                                        .unwrap_or(0)
                                                        .to_string(),
                                                ),
                                                ("clock", display_date(&repo.updated_at)),
                                                ("calendar", display_date(&repo.created_at)),
                                            ]
                                            .into_iter()
                                            .map(
                                                |(name, value)| {
                                                    div()
                                                        .flex()
                                                        .items_center()
                                                        .gap_1()
                                                        .child(glyph(name).size(px(14.)))
                                                        .child(value)
                                                },
                                            ),
                                        ),
                                )
                                .when(!repo.topics.is_empty(), |this| {
                                    this.child(
                                        div()
                                            .pt_3()
                                            .border_t_1()
                                            .border_color(cx.theme().border.opacity(0.5))
                                            .flex()
                                            .flex_wrap()
                                            .gap_2()
                                            .children(repo.topics.iter().take(10).map(|topic| {
                                                muted(cx, format!("#{topic}"))
                                                    .text_size(px(10.))
                                                    .px_2()
                                                    .rounded_full()
                                                    .bg(cx.theme().secondary.opacity(0.5))
                                            })),
                                    )
                                }),
                        )
                        .child(
                            div()
                                .flex()
                                .gap_2()
                                .when(self.columns == 1, |this| this.flex_col())
                                .when_some(
                                    repo.homepage.as_ref().filter(|url| !url.is_empty()),
                                    |this, url| {
                                        this.child(
                                            self.action(("homepage", repo.id), "Website", cx, {
                                                let url = url.clone();
                                                move |_, _, cx| cx.open_url(&url)
                                            })
                                            .icon(icon("external-link")),
                                        )
                                    },
                                )
                                .child(
                                    self.action(
                                        ("select-download", repo.id),
                                        if has_selected { "Selected" } else { "Select" },
                                        cx,
                                        move |v, _, cx| {
                                            if !v.selected_downloads.remove(&selected) {
                                                v.selected_downloads.insert(selected.clone());
                                            }
                                            cx.notify();
                                        },
                                    )
                                    .icon(icon(if has_selected {
                                        "circle-check"
                                    } else {
                                        "layers"
                                    }))
                                    .when(has_selected, |this| this.bg(cx.theme().success)),
                                ),
                        )
                    }))
                    .children((chunk.len()..self.columns).map(|_| div().flex_1().min_w_0())),
            );
        }
        page.child(repository_rows).into_any_element()
    }
}
