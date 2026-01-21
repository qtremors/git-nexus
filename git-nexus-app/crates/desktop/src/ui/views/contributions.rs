use super::*;
use chrono::Datelike;
impl Nexus {
    pub(super) fn contribution_graph(&self, cx: &mut Context<Self>) -> AnyElement {
        let counts =
            self.contributions
                .iter()
                .fold(BTreeMap::<String, usize>::new(), |mut map, c| {
                    *map.entry(c.date.get(..10).unwrap_or(&c.date).into())
                        .or_default() += 1;
                    map
                });
        let today = chrono::Local::now().date_naive();
        let start = today
            .with_year(today.year() - 1)
            .unwrap_or(today - chrono::Duration::days(365));
        let offset = start.weekday().num_days_from_sunday() as i64;
        let total = (today - start).num_days() + 1 + offset;
        let weeks = (total + 6) / 7;
        let color = |count| match count {
            0 => 0x161b22,
            1..=3 => 0x064e3b,
            4..=6 => 0x047857,
            7..=10 => 0x10b981,
            _ => 0x34d399,
        };
        let mut months = div()
            .relative()
            .h_5()
            .ml(px(36.))
            .text_xs()
            .line_height(px(16.))
            .text_color(rgb(0x64748b));
        let mut previous = None;
        for week in 0..weeks {
            let date = (start + chrono::Duration::days((week * 7 - offset).max(0))).min(today);
            if previous != Some(date.month()) && week < weeks - 1 {
                months = months.child(
                    div()
                        .absolute()
                        .left(px(week as f32 * 16.))
                        .child(date.format("%b").to_string()),
                );
                previous = Some(date.month());
            }
        }
        let grid = div()
            .flex()
            .gap_2()
            .child(
                div()
                    .w_7()
                    .flex_shrink_0()
                    .flex()
                    .flex_col()
                    .pt_4()
                    .gap_5()
                    .text_size(px(10.))
                    .text_color(rgb(0x94a3b8))
                    .child("Mon")
                    .child("Wed")
                    .child("Fri"),
            )
            .child(div().flex().gap_1().children((0..weeks).map(|week| {
                div().flex().flex_col().gap_1().children((0..7).map(|day| {
                    let index = week * 7 + day - offset;
                    let date = start + chrono::Duration::days(index);
                    let valid = index >= 0 && date <= today;
                    let value = date.to_string();
                    let count = counts.get(&value).copied().unwrap_or(0);
                    div()
                        .id(SharedString::from(format!("day:{value}")))
                        .size_3()
                        .rounded_sm()
                        .bg(rgb(color(count)))
                        .when(!valid, |this| this.opacity(0.))
                        .cursor_pointer()
                        .hover(|s| s.border_1().border_color(rgb(0x94a3b8)))
                        .on_click(cx.listener(move |v, _, _, cx| {
                            if valid {
                                v.selected_day = Some(value.clone());
                                cx.notify();
                            }
                        }))
                }))
            })));
        card(cx)
            .bg(cx.theme().secondary.opacity(0.5))
            .child(
                div()
                    .flex()
                    .items_center()
                    .gap_2()
                    .child(glyph("git-commit-horizontal"))
                    .child(
                        muted(cx, "CONTRIBUTION ACTIVITY (LAST YEAR)")
                            .font_weight(FontWeight::SEMIBOLD),
                    )
                    .child(div().flex_1())
                    .when_some(self.profile.as_ref(), |this, profile| {
                        this.child(
                            self.action("refresh-graph", "", cx, {
                                let owner = profile.login.clone();
                                let repos = self.repos.clone();
                                move |v, _, cx| {
                                    v.run(
                                        Job::Contributions(owner.clone(), repos.clone(), true),
                                        cx,
                                    )
                                }
                            })
                            .icon(icon("clock"))
                            .ghost()
                            .tooltip("Force Refresh from GitHub"),
                        )
                    }),
            )
            .child(
                div().id("contribution-scroll").overflow_x_scroll().child(
                    div().min_w(px(884.)).p_2().child(months).child(grid).child(
                        div()
                            .mt_4()
                            .flex()
                            .items_center()
                            .justify_end()
                            .gap_2()
                            .text_xs()
                            .line_height(px(16.))
                            .text_color(rgb(0x64748b))
                            .child("Less")
                            .children([0, 1, 4, 7, 11].into_iter().map(|count| {
                                div().size(px(10.)).rounded_sm().bg(rgb(color(count)))
                            }))
                            .child("More"),
                    ),
                ),
            )
            .into_any_element()
    }
    pub(super) fn contribution_day(&self, day: &str, cx: &mut Context<Self>) -> Div {
        let commits: Vec<_> = self
            .contributions
            .iter()
            .filter(|c| c.date.starts_with(day))
            .collect();
        card(cx)
            .child(
                div()
                    .flex()
                    .justify_between()
                    .child(heading(format!("Contributions on {day}")))
                    .child(
                        self.action("close-day", "", cx, |v, _, cx| {
                            v.selected_day = None;
                            cx.notify();
                        })
                        .icon(icon("x"))
                        .ghost(),
                    ),
            )
            .child(muted(cx, format!("{} commits", commits.len())))
            .when(commits.is_empty(), |this| {
                this.child(muted(cx, "No contributions on this day."))
            })
            .children(commits.into_iter().enumerate().map(|(index, commit)| {
                let url = commit.url.clone();
                div()
                    .p_3()
                    .rounded_lg()
                    .border_1()
                    .border_color(cx.theme().border)
                    .child(muted(cx, commit.repo.clone()).text_color(cx.theme().primary))
                    .child(
                        self.action(
                            ("day-commit", index),
                            commit.message.lines().next().unwrap_or("").to_string(),
                            cx,
                            move |_, _, cx| cx.open_url(&url),
                        )
                        .icon(icon("external-link"))
                        .ghost(),
                    )
                    .child(
                        muted(cx, commit.sha.get(..7).unwrap_or(&commit.sha).to_string())
                            .text_xs()
                            .line_height(px(16.)),
                    )
            }))
    }
}
