use super::*;
impl Nexus {
    pub(super) fn add_env_row(
        &mut self,
        key: String,
        value: String,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let key_state = input(window, cx, "KEY", false, false);
        let value_state = input(window, cx, "Value", !self.show_env, false);
        key_state.update(cx, |state, cx| state.set_value(key, window, cx));
        value_state.update(cx, |state, cx| state.set_value(value, window, cx));
        for field in [&key_state, &value_state] {
            cx.subscribe(field, |view, _, event, cx| {
                if matches!(event, InputEvent::Change) {
                    view.env_dirty = true;
                    view.env_revision += 1;
                    cx.notify();
                }
            })
            .detach();
        }
        self.next_env_row += 1;
        self.env_rows
            .push((self.next_env_row, key_state, value_state));
    }
    pub(super) fn close_environment(&mut self, cx: &mut Context<Self>) {
        self.env_scope = None;
        self.env_rows.clear();
        self.show_env = false;
        self.env_dirty = false;
        cx.notify();
    }
    pub(super) fn environment_dialog(
        &self,
        scope: &str,
        id: i64,
        hash: &str,
        cx: &mut Context<Self>,
    ) -> Div {
        let merged = scope == "merged";
        let repo = self
            .snapshot
            .repositories
            .iter()
            .find(|repo| repo.id == id)
            .map(|repo| repo.name.as_str())
            .unwrap_or("Repository");
        let title = match scope {
            "global" => "Global Environment".to_string(),
            "project" => format!("Project Environment - {repo}"),
            "commit" => format!(
                "Commit Environment - {repo} ({})",
                &hash[..hash.len().min(7)]
            ),
            _ => "Merged Environment".to_string(),
        };
        let description = match scope {
            "global" => {
                "Global defaults for saved environment values. Static previews do not execute project code or inject these values into browser files."
            }
            "project" => {
                "Project values override global defaults. Static previews do not execute project code or inject these values into browser files."
            }
            "commit" => {
                "Values for this commit override project defaults. Static previews do not execute project code or inject these values into browser files."
            }
            _ => "Global → project → commit precedence.",
        };
        card(cx)
            .gap_4()
            .child(
                div()
                    .flex()
                    .items_center()
                    .gap_2()
                    .child(
                        glyph(match scope {
                            "global" => "globe",
                            "project" => "box",
                            _ => "git-branch",
                        })
                        .text_color(rgb(0x60a5fa)),
                    )
                    .child(
                        div()
                            .id("environment-title")
                            .flex_1()
                            .min_w_0()
                            .truncate()
                            .tooltip({
                                let title = title.clone();
                                move |window, cx| {
                                    gpui_component::tooltip::Tooltip::new(title.clone())
                                        .build(window, cx)
                                }
                            })
                            .child(heading(title)),
                    )
                    .child(
                        self.action("close-env", "", cx, |v, _, cx| v.close_environment(cx))
                            .icon(icon("x"))
                            .flex_shrink_0()
                            .ghost(),
                    ),
            )
            .child(
                div()
                    .p_3()
                    .rounded_lg()
                    .border_1()
                    .border_color(rgb(0x1e293b))
                    .bg(rgba(0x0f172a80))
                    .child(muted(cx, description)),
            )
            .child(
                div()
                    .id("environment-rows")
                    .min_h(px(200.))
                    .max_h(px(400.))
                    .overflow_y_scroll()
                    .flex()
                    .flex_col()
                    .gap_2()
                    .when(self.env_rows.is_empty(), |this| {
                        this.child(
                            div()
                                .py_12()
                                .border_1()
                                .border_dashed()
                                .border_color(rgb(0x1e293b))
                                .rounded_lg()
                                .flex()
                                .flex_col()
                                .items_center()
                                .gap_2()
                                .child(glyph("box").size_8().opacity(0.2))
                                .child(muted(cx, "No variables defined")),
                        )
                    })
                    .children(self.env_rows.iter().map(|(row, key, value)| {
                        let row = *row;
                        div()
                            .id(("env-row", row))
                            .flex()
                            .items_center()
                            .gap_2()
                            .child(
                                div().flex_1().min_w_0().child(
                                    Input::new(key).disabled(merged).text_color(rgb(0x93c5fd)),
                                ),
                            )
                            .child(muted(cx, "="))
                            .child(
                                div()
                                    .flex_1()
                                    .min_w_0()
                                    .child(Input::new(value).disabled(merged)),
                            )
                            .when(!merged, |this| {
                                this.child(
                                    self.action(("remove-env", row), "", cx, move |v, _, cx| {
                                        v.env_rows.retain(|(id, _, _)| *id != row);
                                        v.env_dirty = true;
                                        v.env_revision += 1;
                                        cx.notify();
                                    })
                                    .icon(icon("trash-2"))
                                    .ghost()
                                    .tooltip("Remove variable"),
                                )
                            })
                    })),
            )
            .when(!merged, |this| {
                this.child(
                    self.action("add-env", "Add Variable", cx, |v, window, cx| {
                        v.add_env_row(String::new(), String::new(), window, cx);
                        v.env_dirty = true;
                        v.env_revision += 1;
                        cx.notify();
                    })
                    .icon(icon("plus"))
                    .outline()
                    .border_dashed()
                    .w_full(),
                )
            })
            .child(
                div()
                    .flex()
                    .items_center()
                    .gap_2()
                    .child(
                        self.action(
                            "toggle-env",
                            if self.show_env {
                                "Hide values"
                            } else {
                                "Show values"
                            },
                            cx,
                            |v, window, cx| {
                                v.show_env = !v.show_env;
                                for (_, _, field) in &v.env_rows {
                                    field.update(cx, |state, cx| {
                                        state.set_masked(!v.show_env, window, cx)
                                    });
                                }
                                cx.notify();
                            },
                        )
                        .icon(icon(if self.show_env { "eye-off" } else { "eye" }))
                        .ghost(),
                    )
                    .when(scope == "commit", |this| {
                        this.child(
                            self.action("merged-env", "View Merged Variables", cx, {
                                let hash = hash.to_string();
                                move |v, _, cx| v.run(Job::MergedEnv(id, hash.clone()), cx)
                            })
                            .ghost(),
                        )
                    }),
            )
            .child(
                div()
                    .flex()
                    .justify_end()
                    .items_center()
                    .gap_2()
                    .child(
                        self.action("cancel-env", "Cancel", cx, |v, _, cx| {
                            v.close_environment(cx)
                        })
                        .ghost(),
                    )
                    .when(!merged, |this| {
                        this.child(
                            self.action("save-env", "Save Changes", cx, {
                                let scope = scope.to_string();
                                let hash = hash.to_string();
                                move |v, _, cx| {
                                    let values = v
                                        .env_rows
                                        .iter()
                                        .filter_map(|(_, key, value)| {
                                            let key = key.read(cx).value().trim().to_string();
                                            (!key.is_empty()).then(|| EnvVar {
                                                key,
                                                value: value.read(cx).value().to_string(),
                                            })
                                        })
                                        .collect();
                                    v.run(
                                        Job::SaveEnv(scope.clone(), id, hash.clone(), values),
                                        cx,
                                    );
                                }
                            })
                            .icon(icon("save"))
                            .primary()
                            .disabled(self.working("save-env") || !self.env_dirty),
                        )
                    }),
            )
    }
}
