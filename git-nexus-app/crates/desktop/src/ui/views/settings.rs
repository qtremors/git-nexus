use super::*;
fn settings_heading(cx: &App, name: &str, title: &str, subtitle: &str, color: u32) -> Div {
    div()
        .flex()
        .items_center()
        .gap_4()
        .mb_5()
        .child(
            div()
                .size_10()
                .rounded_lg()
                .bg(Hsla::from(rgb(color)).opacity(0.1))
                .border_1()
                .border_color(Hsla::from(rgb(color)).opacity(0.2))
                .flex()
                .items_center()
                .justify_center()
                .child(glyph(name).size_5().text_color(rgb(color))),
        )
        .child(
            div().flex_1().child(heading(title.to_string())).child(
                muted(cx, subtitle.to_string())
                    .text_xs()
                    .line_height(px(16.)),
            ),
        )
}
impl Nexus {
    pub(super) fn settings(&self, cx: &mut Context<Self>) -> AnyElement {
        let token=card(cx).bg(cx.theme().secondary.opacity(0.5))
            .child(div().flex().items_start().justify_between()
                .child(settings_heading(cx,"key","GitHub Access Token","Required for accessing private repositories and increasing API rate limits.",0xf59e0b))
                .child(self.action("generate-token","Generate new token",cx,|_,_,cx|cx.open_url("https://github.com/settings/tokens")).icon(icon("external-link")).outline().text_color(cx.theme().primary)))
            .when(self.snapshot.token_from_env,|this|this.child(muted(cx,"Managed by GITHUB_TOKEN")))
            .child(div().max_w(px(768.)).flex().items_center().gap_3()
                .child(div().flex_1().child(Input::new(&self.token).disabled(self.snapshot.token_from_env || self.working("save-token"))))
                .child(self.action("save-token","",cx,|v,_,cx|{let value=v.token.read(cx).value().to_string();v.run(Job::SaveToken(value),cx);}).icon(icon("save")).primary().tooltip("Save Token").disabled(self.snapshot.token_from_env || self.working("save-token") || self.token.read(cx).value().trim().is_empty())))
            .when(self.snapshot.token_active&&!self.snapshot.token_from_env,|this|this.child(self.action("remove-token","Remove saved token",cx,|v,_,cx|{v.confirm=Some(("Remove the stored GitHub token?".into(),Job::SaveToken(String::new())));cx.notify();}).ghost().disabled(self.working("save-token"))));
        let api = card(cx)
            .flex_1()
            .bg(cx.theme().secondary.opacity(0.5))
            .child(settings_heading(
                cx,
                "activity",
                "API Usage",
                "Rate & quotas",
                0x06b6d4,
            ))
            .child(
                self.action("rate-limit", "Refresh API status", cx, |v, _, cx| {
                    v.run(Job::RateLimit, cx)
                })
                .icon(icon("refresh-cw"))
                .ghost(),
            )
            .child(if let Some(value) = &self.api_status {
                let remaining = value["resources"]["core"]["remaining"]
                    .as_u64()
                    .unwrap_or(0);
                let limit = value["resources"]["core"]["limit"].as_u64().unwrap_or(60);
                div()
                    .flex()
                    .flex_col()
                    .gap_3()
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .justify_between()
                            .child(muted(cx, "REMAINING").text_xs().line_height(px(16.)))
                            .child(
                                div()
                                    .text_2xl()
                                    .line_height(px(32.))
                                    .font_family(MONO_FONT)
                                    .text_color(cx.theme().success)
                                    .child(format!("{remaining} / {limit}")),
                            ),
                    )
                    .child(
                        div().h_2().rounded_full().bg(cx.theme().muted).child(
                            div()
                                .h_full()
                                .w(relative(remaining as f32 / limit.max(1) as f32))
                                .rounded_full()
                                .bg(cx.theme().success),
                        ),
                    )
            } else {
                div().child(muted(cx, "Check your current GitHub API quota."))
            });
        let storage = card(cx)
            .flex_1()
            .bg(cx.theme().secondary.opacity(0.5))
            .child(settings_heading(
                cx,
                "folder-open",
                "Storage",
                "Local path",
                0x14b8a6,
            ))
            .child(
                div()
                    .flex()
                    .items_center()
                    .gap_3()
                    .child(div().flex_1().child(Input::new(&self.download_path)))
                    .child(
                        self.action("save-path", "", cx, |v, _, cx| {
                            v.run(
                                Job::SavePath(v.download_path.read(cx).value().to_string()),
                                cx,
                            )
                        })
                        .icon(icon("save"))
                        .outline()
                        .tooltip("Save Download Path"),
                    ),
            );
        let themes = card(cx)
            .flex_1()
            .bg(cx.theme().secondary.opacity(0.5))
            .child(settings_heading(
                cx,
                "palette",
                "Appearance",
                "Color themes",
                0xa855f7,
            ))
            .child(
                div().flex().gap_3().children(
                    [
                        ("default", "Default", 0x0085d0),
                        ("dracula", "Dracula (Dark)", 0xbd93f9),
                    ]
                    .into_iter()
                    .map(|(name, label, color)| {
                        let active = self.snapshot.theme == name
                            || name == "default"
                                && !matches!(self.snapshot.theme.as_str(), "dracula" | "light");
                        clickable(name, cx, move |v, window, cx| {
                            crate::theme::apply_theme(name, window, cx);
                            v.run(Job::Theme(name.into()), cx);
                        })
                        .w(px(100.))
                        .h(px(90.))
                        .p_3()
                        .rounded_lg()
                        .border_1()
                        .border_color(if active { rgb(0x3b82f6) } else { rgb(0x334155) })
                        .bg(rgb(0x1e293b))
                        .cursor_pointer()
                        .flex()
                        .flex_col()
                        .items_center()
                        .justify_center()
                        .gap_2()
                        .child(
                            div()
                                .size_6()
                                .rounded_full()
                                .bg(rgb(color))
                                .border_2()
                                .border_color(rgb(0x475569))
                                .when(active, |this| {
                                    this.child(glyph("circle-check").text_color(rgb(0xffffff)))
                                }),
                        )
                        .child(
                            muted(cx, label)
                                .text_xs()
                                .line_height(px(16.))
                                .text_center(),
                        )
                    }),
                ),
            );
        let environment = card(cx)
            .flex_1()
            .bg(cx.theme().secondary.opacity(0.5))
            .child(settings_heading(
                cx,
                "globe",
                "Global Environment",
                "Variables for all replay servers",
                0x818cf8,
            ))
            .child(
                div()
                    .mt_5()
                    .p_4()
                    .rounded_lg()
                    .border_1()
                    .border_color(cx.theme().border)
                    .flex()
                    .items_center()
                    .justify_between()
                    .child(muted(cx, "Configure global vars"))
                    .child(
                        self.action("global-env", "Manage Variables", cx, |v, _, cx| {
                            v.run(Job::Env("global".into(), 0, String::new()), cx)
                        })
                        .outline()
                        .text_color(rgb(0x818cf8)),
                    ),
            );
        let maintenance = card(cx)
            .bg(cx.theme().secondary.opacity(0.5))
            .child(
                div()
                    .flex()
                    .items_center()
                    .gap_2()
                    .child(glyph("database").text_color(rgb(0xf59e0b)))
                    .child(heading("System Maintenance")),
            )
            .child(
                div()
                    .flex()
                    .gap_4()
                    .child(
                        div()
                            .flex_1()
                            .p_4()
                            .rounded_lg()
                            .border_1()
                            .border_color(cx.theme().border)
                            .flex()
                            .items_center()
                            .justify_between()
                            .child(
                                div().child("API Cache").child(
                                    muted(cx, "Clear cached GitHub API responses")
                                        .text_xs()
                                        .line_height(px(16.)),
                                ),
                            )
                            .child(
                                self.action("clear-cache", "Clear Cache", cx, |v, _, cx| {
                                    v.confirm = Some((
                                        "Clear cached GitHub responses?".into(),
                                        Job::ClearCache,
                                    ));
                                    cx.notify();
                                })
                                .icon(icon("trash-2"))
                                .outline()
                                .text_color(rgb(0xf87171)),
                            ),
                    )
                    .child(
                        div()
                            .flex_1()
                            .p_4()
                            .rounded_lg()
                            .border_1()
                            .border_color(cx.theme().border)
                            .flex()
                            .items_center()
                            .justify_between()
                            .child(
                                div().child("System Logs").child(
                                    muted(cx, "View and manage application logs")
                                        .text_xs()
                                        .line_height(px(16.)),
                                ),
                            )
                            .child(
                                div()
                                    .flex()
                                    .gap_2()
                                    .child(
                                        self.action("clear-logs", "Clear", cx, |v, _, cx| {
                                            v.confirm = Some((
                                                "Clear the activity log?".into(),
                                                Job::ClearLogs,
                                            ));
                                            cx.notify();
                                        })
                                        .icon(icon("trash-2"))
                                        .outline()
                                        .text_color(rgb(0xf87171)),
                                    )
                                    .child(
                                        self.action("view-logs", "View", cx, |v, _, cx| {
                                            v.show_logs(cx)
                                        })
                                        .icon(icon("file-text"))
                                        .outline()
                                        .text_color(cx.theme().primary),
                                    ),
                            ),
                    ),
            );
        div().w_full().max_w(px(1280.)).mx_auto().px_6().pb_6().flex().flex_col().gap_6()
            .child(div().mb_2().child(div().text_3xl().line_height(px(36.)).font_weight(FontWeight::BOLD).mb_2().child("Settings"))
                .child(muted(cx,"Manage your GitHub connection, storage preferences, and application appearance.").text_base().line_height(px(24.))))
            .child(token).child(div().flex().gap_6().child(api).child(storage)).child(div().flex().gap_6().child(themes).child(environment)).child(maintenance)
            .into_any_element()
    }
}
