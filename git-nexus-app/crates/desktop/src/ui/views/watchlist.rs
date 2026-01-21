use super::*;
#[derive(Clone)]
struct WatchDrag {
    id: i64,
    name: String,
}
impl Render for WatchDrag {
    fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        card(cx).p_3().child(self.name.clone())
    }
}
fn asset_icon(name: &str, detailed: bool) -> (&'static str, Option<u32>) {
    let name = name.to_lowercase();
    if name.contains("apk") {
        ("smartphone", Some(0x34d399))
    } else if name.contains("exe") || name.contains("msi") {
        ("monitor", Some(0x60a5fa))
    } else if name.contains("dmg") || name.contains("pkg") {
        ("box", Some(0xc084fc))
    } else if name.contains("deb") || name.contains("rpm") {
        ("file-code", Some(0xfb923c))
    } else if detailed && (name.contains("zip") || name.contains("tar")) {
        ("file-code", Some(0xfacc15))
    } else {
        ("file-code", None)
    }
}
impl Nexus {
    fn open_release_history(&mut self, owner: String, name: String, cx: &mut Context<Self>) {
        if let Some(releases) = self.cached_releases.get(&format!("{owner}/{name}")) {
            self.navigation_generation += 1;
            self.downloaded_assets.clear();
            self.releases = releases.clone();
            self.release_repo = Some((owner, name));
            cx.notify();
        } else {
            self.run(Job::Releases(owner, name, false), cx);
        }
    }

    fn asset_row(
        &self,
        repo: &WatchedRepo,
        release: &Release,
        asset: &ReleaseAsset,
        detailed: bool,
        cx: &Context<Self>,
    ) -> Div {
        let id = repo.id;
        let download = AssetDownload {
            repo: repo.clone(),
            asset: asset.clone(),
        };
        let filename = download.filename();
        let url = download.url();
        let downloading = self.working(&format!("download:{url}"));
        let downloaded = !detailed && self.downloaded_assets.get(&id) == Some(&filename);
        let (asset_icon, asset_color) = asset_icon(&asset.name, detailed);
        div()
            .p(px(10.))
            .rounded_lg()
            .border_1()
            .border_color(if downloaded {
                cx.theme().success.opacity(0.3)
            } else {
                cx.theme().border
            })
            .bg(if downloaded {
                cx.theme().success.opacity(0.1)
            } else {
                cx.theme().secondary
            })
            .flex()
            .items_center()
            .gap_3()
            .child(
                div()
                    .size_8()
                    .flex_shrink_0()
                    .rounded_md()
                    .border_1()
                    .border_color(cx.theme().border)
                    .bg(cx.theme().background)
                    .flex()
                    .items_center()
                    .justify_center()
                    .relative()
                    .child(
                        glyph(asset_icon)
                            .size(px(if detailed { 18. } else { 16. }))
                            .text_color(
                                asset_color
                                    .map(|color| Hsla::from(rgb(color)))
                                    .unwrap_or(cx.theme().muted_foreground),
                            ),
                    )
                    .when(downloaded, |this| {
                        this.child(
                            div()
                                .absolute()
                                .right(px(-4.))
                                .top(px(-4.))
                                .size(px(10.))
                                .rounded_full()
                                .bg(cx.theme().success)
                                .border_1()
                                .border_color(cx.theme().background),
                        )
                    }),
            )
            .child(
                div()
                    .flex_1()
                    .min_w_0()
                    .child(
                        div()
                            .id(SharedString::from(format!(
                                "asset-name:{id}:{}:{url}",
                                release.id
                            )))
                            .truncate()
                            .text_color(if downloaded {
                                cx.theme().success
                            } else {
                                cx.theme().foreground
                            })
                            .tooltip({
                                let name = asset.name.clone();
                                move |window, cx| {
                                    gpui_component::tooltip::Tooltip::new(name.clone())
                                        .build(window, cx)
                                }
                            })
                            .child(asset.name.clone()),
                    )
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .gap_2()
                            .child(muted(
                                cx,
                                format!(
                                    "{:.*} MB",
                                    if detailed { 2 } else { 1 },
                                    asset.size as f64 / 1048576.
                                ),
                            ))
                            .when(downloaded, |this| {
                                this.child(
                                    div()
                                        .text_color(cx.theme().success)
                                        .flex()
                                        .items_center()
                                        .gap_1()
                                        .child(glyph("history").size(px(10.)))
                                        .child("Downloaded"),
                                )
                            })
                            .text_xs()
                            .line_height(px(16.)),
                    ),
            )
            .child(
                self.action(
                    SharedString::from(format!("asset:{id}:{}:{url}", release.id)),
                    "",
                    cx,
                    move |v, _, cx| v.run(Job::DownloadRelease(download.clone()), cx),
                )
                .icon(icon("download"))
                .loading(downloading)
                .loading_icon(icon("refresh-cw"))
                .ghost()
                .text_color(cx.theme().primary)
                .tooltip("Download"),
            )
    }
    pub(super) fn watchlist(&self, window: &mut Window, cx: &mut Context<Self>) -> AnyElement {
        if let Some((owner, name)) = &self.release_repo {
            return self.release_detail(owner, name, window, cx);
        }
        let toolbar = div()
            .w_full()
            .bg(cx.theme().secondary)
            .border_b_1()
            .border_color(cx.theme().border)
            .child(
                div()
                    .max_w(px(1152.))
                    .mx_auto()
                    .px_6()
                    .h_16()
                    .flex()
                    .items_center()
                    .gap_3()
                    .child(
                        div()
                            .size_8()
                            .rounded_lg()
                            .bg(cx.theme().primary)
                            .flex()
                            .items_center()
                            .justify_center()
                            .child(glyph("shield-check").size_5().text_color(rgb(0xffffff))),
                    )
                    .child(
                        div()
                            .text_lg()
                            .line_height(px(28.))
                            .font_weight(FontWeight::BOLD)
                            .text_color(rgb(0xffffff))
                            .child("Watchtower"),
                    )
                    .child(div().flex_1())
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .p_1()
                            .rounded_lg()
                            .border_1()
                            .border_color(cx.theme().border)
                            .bg(cx.theme().muted)
                            .children(
                                [
                                    (true, "layout-grid", "Grid View"),
                                    (false, "list", "List View"),
                                ]
                                .into_iter()
                                .map(|(grid, name, label)| {
                                    self.action(label, "", cx, move |v, _, cx| {
                                        v.watch_grid = grid;
                                        cx.notify();
                                    })
                                    .icon(icon(name))
                                    .ghost()
                                    .tooltip(label)
                                    .when(
                                        self.watch_grid == grid,
                                        |this| {
                                            this.bg(cx.theme().primary).text_color(rgb(0xffffff))
                                        },
                                    )
                                }),
                            ),
                    )
                    .child(div().w_px().h_4().mx_1().bg(cx.theme().border))
                    .child(
                        self.action("toggle-prereleases", "", cx, |v, _, cx| {
                            v.show_prereleases = !v.show_prereleases;
                            cx.notify();
                        })
                        .icon(icon(if self.show_prereleases {
                            "eye"
                        } else {
                            "eye-off"
                        }))
                        .ghost()
                        .tooltip(if self.show_prereleases {
                            "Hide Pre-releases"
                        } else {
                            "Show Pre-releases"
                        })
                        .when(self.show_prereleases, |this| {
                            this.bg(cx.theme().primary.opacity(0.1))
                                .text_color(cx.theme().primary)
                        }),
                    )
                    .child(
                        self.action("export-watch", "", cx, |v, _, cx| {
                            v.choose_watchlist_file(true, cx);
                        })
                        .icon(icon("file-json"))
                        .ghost()
                        .tooltip("Export Config"),
                    )
                    .child(
                        self.action("import-watch", "", cx, |v, _, cx| {
                            v.choose_watchlist_file(false, cx);
                        })
                        .icon(icon("upload"))
                        .ghost()
                        .tooltip("Import Config"),
                    )
                    .child(div().w_px().h_4().mx_1().bg(cx.theme().border))
                    .child(
                        self.action("add-watch-dialog", "Add Repo", cx, |v, _, cx| {
                            v.dialog = Some("add-watch");
                            cx.notify();
                        })
                        .icon(icon("plus"))
                        .primary(),
                    ),
            );
        let query = self.watch_filter.read(cx).value().to_lowercase();
        let repos: Vec<_> = self
            .snapshot
            .watchlist
            .iter()
            .filter(|r| {
                format!("{}/{}", r.owner, r.name)
                    .to_lowercase()
                    .contains(&query)
            })
            .collect();
        let mut main = div()
            .w_full()
            .max_w(px(1152.))
            .mx_auto()
            .px_6()
            .py_8()
            .flex()
            .flex_col()
            .gap_8()
            .child(
                div()
                    .flex()
                    .items_end()
                    .justify_between()
                    .child(
                        div()
                            .child(
                                div()
                                    .text_2xl()
                                    .line_height(px(32.))
                                    .font_weight(FontWeight::SEMIBOLD)
                                    .child("Your Assets"),
                            )
                            .child(muted(cx, format!("Tracking {} repositories.", repos.len()))),
                    )
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .gap_3()
                            .child(
                                div()
                                    .w(px(256.))
                                    .child(Input::new(&self.watch_filter).prefix(glyph("search"))),
                            )
                            .child(
                                self.action("check-updates", "", cx, |v, _, cx| {
                                    v.run(Job::CheckUpdates, cx);
                                })
                                .icon(icon("refresh-cw"))
                                .outline()
                                .tooltip("Refresh All"),
                            ),
                    ),
            );
        if repos.is_empty() {
            main = main.child(
                div()
                    .w_full()
                    .py_12()
                    .flex()
                    .flex_col()
                    .items_center()
                    .gap_4()
                    .rounded_xl()
                    .border_1()
                    .border_color(cx.theme().border)
                    .bg(cx.theme().secondary)
                    .child(
                        glyph("search")
                            .size_12()
                            .text_color(cx.theme().muted_foreground)
                            .opacity(0.5),
                    )
                    .child(
                        muted(cx, "No repositories found matching your filter.")
                            .text_lg()
                            .line_height(px(28.)),
                    )
                    .child(
                        self.action(
                            "clear-watch-filter",
                            "Clear Filters",
                            cx,
                            |v, window, cx| {
                                v.watch_filter
                                    .update(cx, |state, cx| state.set_value("", window, cx))
                            },
                        )
                        .ghost()
                        .text_color(cx.theme().primary),
                    ),
            );
        }
        for chunk in repos.chunks(if self.watch_grid { 2 } else { 1 }) {
            main = main.child(
                div()
                    .flex()
                    .gap_6()
                    .children(chunk.iter().map(|repo| {
                        let repo = *repo;
                        let owner = repo.owner.clone();
                        let name = repo.name.clone();
                        let remove_id = repo.id;
                        let url = repo
                            .html_url
                            .clone()
                            .unwrap_or_else(|| format!("https://github.com/{owner}/{name}"));
                        let latest = self
                            .cached_releases
                            .get(&format!("{owner}/{name}"))
                            .and_then(|items| {
                                items
                                    .iter()
                                    .find(|r| self.show_prereleases || !r.prerelease)
                            });
                        let filter = self.asset_filters.get(&repo.id);
                        let query = filter
                            .map(|field| field.read(cx).value().to_lowercase())
                            .unwrap_or_default();
                        let assets: Vec<_> = latest
                            .into_iter()
                            .flat_map(|r| r.display_assets())
                            .filter(|a| a.name.to_lowercase().contains(&query))
                            .collect();
                        let expanded = self.expanded_assets.contains(&repo.id) || !self.watch_grid;
                        let mut info = div()
                            .flex_1()
                            .p_5()
                            .flex()
                            .flex_col()
                            .gap_3()
                            .child(
                                div()
                                    .flex()
                                    .items_start()
                                    .gap_4()
                                    .child(
                                        img(format!("https://github.com/{}.png", repo.owner))
                                            .size_12()
                                            .rounded_lg()
                                            .with_fallback(|| {
                                                glyph("github").size_12().into_any_element()
                                            }),
                                    )
                                    .child(
                                        div()
                                            .flex_1()
                                            .child(
                                                div()
                                                    .flex()
                                                    .items_center()
                                                    .gap_2()
                                                    .child(heading(repo.name.clone()))
                                                    .when(repo.has_update(), |this| {
                                                        this.child(
                                                            div()
                                                                .size_2()
                                                                .rounded_full()
                                                                .bg(cx.theme().primary),
                                                        )
                                                    }),
                                            )
                                            .child(muted(cx, format!("by {}", repo.owner))),
                                    )
                                    .child(
                                        self.action(
                                            ("open-watch", repo.id as u64),
                                            "",
                                            cx,
                                            move |_, _, cx| cx.open_url(&url),
                                        )
                                        .icon(icon("external-link"))
                                        .ghost()
                                        .tooltip("View on GitHub"),
                                    )
                                    .child(
                                        self.action(
                                            ("unwatch", repo.id as u64),
                                            "",
                                            cx,
                                            move |v, _, cx| {
                                                v.confirm = Some((
                                                    "Stop tracking this repository?".into(),
                                                    Job::Unwatch(remove_id),
                                                ));
                                                cx.notify();
                                            },
                                        )
                                        .icon(icon("trash-2"))
                                        .ghost()
                                        .tooltip("Stop Tracking"),
                                    ),
                            )
                            .child(
                                muted(
                                    cx,
                                    repo.description
                                        .clone()
                                        .unwrap_or_else(|| "No description".into()),
                                )
                                .min_h(px(40.)),
                            )
                            .child(
                                div().mt_1().flex().gap_6().children(
                                    [
                                        ("CURRENT", repo.current_version.clone()),
                                        (
                                            "LATEST",
                                            repo.latest_version
                                                .clone()
                                                .unwrap_or_else(|| "Not Checked".into()),
                                        ),
                                    ]
                                    .into_iter()
                                    .map(|(title, value)| {
                                        div()
                                            .child(
                                                muted(cx, title)
                                                    .text_size(px(10.))
                                                    .font_weight(FontWeight::SEMIBOLD),
                                            )
                                            .child(
                                                div()
                                                    .font_family(MONO_FONT)
                                                    .when(title == "LATEST", |this| {
                                                        this.text_color(cx.theme().primary)
                                                    })
                                                    .child(value),
                                            )
                                    }),
                                ),
                            );
                        info = info.min_w_0();
                        let mut section = div()
                            .flex_1()
                            .min_w_0()
                            .p_4()
                            .bg(cx.theme().background)
                            .flex()
                            .flex_col()
                            .gap_2()
                            .child(
                                div()
                                    .flex()
                                    .items_center()
                                    .gap_2()
                                    .mb_1()
                                    .child(
                                        muted(cx, "ASSETS")
                                            .flex_shrink_0()
                                            .whitespace_nowrap()
                                            .text_xs()
                                            .line_height(px(16.))
                                            .font_weight(FontWeight::SEMIBOLD),
                                    )
                                    .when_some(filter, |this, filter| {
                                        let focused =
                                            filter.read(cx).focus_handle(cx).is_focused(window);
                                        this.child(
                                            div()
                                                .id(("asset-filter", repo.id as u64))
                                                .relative()
                                                .size_3()
                                                .group("asset-filter")
                                                .child(glyph("filter").size_3())
                                                .child(
                                                    div()
                                                        .absolute()
                                                        .left_4()
                                                        .top(px(-4.))
                                                        .w(px(112.))
                                                        .opacity(if focused { 1. } else { 0. })
                                                        .group_hover("asset-filter", |style| {
                                                            style.opacity(1.)
                                                        })
                                                        .child(
                                                            Input::new(filter)
                                                                .small()
                                                                .appearance(false),
                                                        ),
                                                )
                                                .on_click(|_, _, cx| cx.stop_propagation()),
                                        )
                                    })
                                    .child(div().flex_1())
                                    .child(
                                        muted(cx, format!("{} Files", assets.len()))
                                            .flex_shrink_0()
                                            .whitespace_nowrap()
                                            .text_xs()
                                            .line_height(px(16.))
                                            .px_2()
                                            .py_1()
                                            .rounded_sm()
                                            .border_1()
                                            .border_color(cx.theme().border),
                                    ),
                            );
                        if let Some(latest) = latest {
                            for asset in assets.iter().take(if expanded { usize::MAX } else { 2 }) {
                                section =
                                    section.child(self.asset_row(repo, latest, asset, false, cx));
                            }
                        }
                        let release_key = format!("{owner}/{name}");
                        let loading = self.working(&format!("releases:{release_key}"));
                        if let Some(error) = self.release_errors.get(&release_key) {
                            let owner = owner.clone();
                            let name = name.clone();
                            section = section.child(
                                div()
                                    .py_2()
                                    .flex()
                                    .items_center()
                                    .gap_2()
                                    .child(
                                        div()
                                            .flex_1()
                                            .text_xs()
                                            .text_color(rgb(0xf87171))
                                            .child(error.clone()),
                                    )
                                    .child(
                                        self.action(
                                            ("retry-assets", repo.id as u64),
                                            "Retry",
                                            cx,
                                            move |v, _, cx| {
                                                v.run(
                                                    Job::WatchlistRelease(
                                                        owner.clone(),
                                                        name.clone(),
                                                        true,
                                                    ),
                                                    cx,
                                                );
                                            },
                                        )
                                        .ghost()
                                        .disabled(loading),
                                    ),
                            );
                        } else if loading && latest.is_none() {
                            section = section.child(
                                div().py_2().child(muted(cx, "Loading releases…").text_xs()),
                            );
                        } else if assets.is_empty() {
                            section = section.child(
                                div().py_2().text_center().child(
                                    muted(
                                        cx,
                                        if query.is_empty() {
                                            "No release assets"
                                        } else {
                                            "No assets match filter"
                                        },
                                    )
                                    .text_xs()
                                    .line_height(px(16.)),
                                ),
                            );
                        }
                        if assets.len() > 2 && self.watch_grid {
                            let id = repo.id;
                            section = section.child(
                                self.action(
                                    ("expand-assets", id as u64),
                                    if expanded {
                                        "Show Less".into()
                                    } else {
                                        format!("Show {} More Assets", assets.len() - 2)
                                    },
                                    cx,
                                    move |v, _, cx| {
                                        if !v.expanded_assets.remove(&id) {
                                            v.expanded_assets.insert(id);
                                        }
                                        cx.notify();
                                    },
                                )
                                .ghost()
                                .w_full()
                                .text_xs()
                                .line_height(px(16.)),
                            );
                        }
                        clickable(("watch-card", repo.id as u64), cx, move |v, _, cx| {
                            v.open_release_history(owner.clone(), name.clone(), cx)
                        })
                        .flex_1()
                        .min_w_0()
                        .rounded_xl()
                        .border_1()
                        .border_color(cx.theme().border)
                        .bg(cx.theme().secondary)
                        .overflow_hidden()
                        .cursor_pointer()
                        .flex()
                        .when(self.watch_grid, |this| this.flex_col())
                        .child(info)
                        .child(section)
                        .on_drag(
                            WatchDrag {
                                id: repo.id,
                                name: repo.name.clone(),
                            },
                            |drag, _, _, cx| cx.new(|_| drag.clone()),
                        )
                        .on_drop(cx.listener({
                            let target = repo.id;
                            move |v, drag: &WatchDrag, _, cx| {
                                let mut ids: Vec<_> =
                                    v.snapshot.watchlist.iter().map(|r| r.id).collect();
                                if let (Some(from), Some(to)) = (
                                    ids.iter().position(|id| *id == drag.id),
                                    ids.iter().position(|id| *id == target),
                                ) {
                                    let id = ids.remove(from);
                                    ids.insert(to, id);
                                    v.run(Job::Reorder(ids), cx);
                                }
                            }
                        }))
                    }))
                    .children(
                        (chunk.len()..if self.watch_grid { 2 } else { 1 })
                            .map(|_| div().flex_1().min_w_0()),
                    ),
            );
        }
        div()
            .w_full()
            .pt_2()
            .flex()
            .flex_col()
            .child(toolbar)
            .child(main)
            .into_any_element()
    }
    fn release_detail(&self, _: &str, _: &str, _: &mut Window, cx: &mut Context<Self>) -> AnyElement {
        card(cx).child("Release history is not available in this version.").into_any_element()
    }
}
