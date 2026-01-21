use super::*;
impl Nexus {
    pub(super) fn dialog_content(&self, name: &str, cx: &mut Context<Self>) -> Div {
        let title = match name {
            "add-repository" => "Add Worktree",
            "clone" => "Clone Repository",
            "add-watch" => "Add Repository",
            "import-watch" => "Import Config",
            "export-watch" => "Export Config",
            _ => "Repository",
        };
        let mut body = card(cx).gap_4().child(
            div()
                .flex()
                .items_center()
                .justify_between()
                .child(heading(title))
                .child(
                    self.action("close-dialog", "", cx, |v, _, cx| {
                        v.dialog = None;
                        cx.notify();
                    })
                    .icon(icon("x"))
                    .ghost(),
                ),
        );
        match name {
            "add-repository" => {
                body = body
                    .child(muted(cx, "Local Path"))
                    .child(Input::new(&self.local_path))
                    .child(
                        muted(cx, "Enter the full path to a local git repository.")
                            .text_xs()
                            .line_height(px(16.)),
                    )
                    .child(
                        div()
                            .flex()
                            .justify_between()
                            .child(
                                self.action("open-clone", "Clone a repository", cx, |v, _, cx| {
                                    v.dialog = Some("clone");
                                    cx.notify();
                                })
                                .ghost(),
                            )
                            .child(
                                self.action("add-local", "Add Worktree", cx, |v, _, cx| {
                                    v.dialog = None;
                                    v.run(
                                        Job::AddLocal(PathBuf::from(
                                            v.local_path.read(cx).value().as_str(),
                                        )),
                                        cx,
                                    );
                                })
                                .primary(),
                            ),
                    );
            }
            "clone" => {
                body = body
                    .child(Input::new(&self.clone_url))
                    .child(Input::new(&self.clone_path))
                    .child(
                        self.action("clone", "Clone Repository", cx, |v, _, cx| {
                            v.dialog = None;
                            v.run(
                                Job::Clone(
                                    v.clone_url.read(cx).value().to_string(),
                                    PathBuf::from(v.clone_path.read(cx).value().as_str()),
                                ),
                                cx,
                            );
                        })
                        .primary(),
                    );
            }
            "add-watch" => {
                body=body.child(muted(cx,"GitHub URL")).child(Input::new(&self.identity).prefix(glyph("github")))
                .child(muted(cx,"Paste the full GitHub URL. We'll fetch the latest releases automatically.").text_xs().line_height(px(16.)))
                .child(div().flex().justify_end().gap_2().child(self.action("cancel-add-watch","Cancel",cx,|v,_,cx|{v.dialog=None;cx.notify();}).ghost())
                    .child(self.action("add-watch","Track Asset",cx,|v,_,cx|{v.dialog=None;v.run(Job::Watch(v.identity.read(cx).value().trim().into()),cx);}).primary()));
            }
            "import-watch" | "export-watch" => {
                let export = name == "export-watch";
                body = body
                    .child(muted(cx, "JSON file path"))
                    .child(Input::new(&self.json_path))
                    .child(
                        self.action(
                            "config-file",
                            if export { "Export" } else { "Import" },
                            cx,
                            move |v, _, cx| {
                                let path = PathBuf::from(v.json_path.read(cx).value().as_str());
                                v.dialog = None;
                                if export {
                                    v.run(Job::ExportWatchlist(path), cx);
                                } else {
                                    v.run(Job::ImportWatchlist(path), cx);
                                }
                            },
                        )
                        .primary(),
                    );
            }
            _ => {}
        }
        body
    }
}

impl Nexus {
    pub(super) fn choose_watchlist_file(&mut self, export: bool, cx: &mut Context<Self>) {
        if export {
            let directory = PathBuf::from(&self.snapshot.download_path);
            let name = format!(
                "watchtower-config-{}.json",
                chrono::Local::now().format("%Y-%m-%d")
            );
            let selected = cx.prompt_for_new_path(&directory, Some(&name));
            cx.spawn(async move |this, cx| {
                let result = selected.await;
                let _ = this.update(cx, |v, cx| match result {
                    Ok(Ok(Some(path))) => v.run(Job::ExportWatchlist(path), cx),
                    Ok(Ok(None)) => {}
                    _ => {
                        v.dialog = Some("export-watch");
                        cx.notify();
                    }
                });
            })
            .detach();
        } else {
            let selected = cx.prompt_for_paths(PathPromptOptions {
                files: true,
                directories: false,
                multiple: false,
                prompt: Some("Import Watchtower Config".into()),
            });
            cx.spawn(async move |this, cx| {
                let result = selected.await;
                let _ = this.update(cx, |v, cx| match result {
                    Ok(Ok(Some(paths))) => {
                        if let Some(path) = paths.first() {
                            v.run(Job::ImportWatchlist(path.clone()), cx);
                        }
                    }
                    Ok(Ok(None)) => {}
                    _ => {
                        v.dialog = Some("import-watch");
                        cx.notify();
                    }
                });
            })
            .detach();
        }
    }
}
