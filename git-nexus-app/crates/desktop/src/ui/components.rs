use super::*;
#[cfg(target_os = "windows")]
pub(super) const MONO_FONT: &str = "Consolas";
#[cfg(target_os = "macos")]
pub(super) const MONO_FONT: &str = "Menlo";
#[cfg(not(any(target_os = "windows", target_os = "macos")))]
pub(super) const MONO_FONT: &str = "DejaVu Sans Mono";

pub(super) fn display_path(path: &str) -> String {
    if let Some(path) = path.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{path}")
    } else {
        path.strip_prefix(r"\\?\").unwrap_or(path).to_string()
    }
}

pub(super) fn clickable(
    id: impl Into<ElementId>,
    cx: &Context<Nexus>,
    callback: impl Fn(&mut Nexus, &mut Window, &mut Context<Nexus>) + 'static,
) -> Stateful<Div> {
    let callback = Rc::new(callback);
    let keyboard = callback.clone();
    div()
        .id(id)
        .focusable()
        .tab_stop(true)
        .focus(|style| style.border_1().border_color(cx.theme().ring))
        .on_click(cx.listener(move |view, _, window, cx| {
            cx.stop_propagation();
            callback(view, window, cx);
        }))
        .on_key_down(cx.listener(move |view, event: &KeyDownEvent, window, cx| {
            if matches!(event.keystroke.key.as_str(), "enter" | "space" | " ") {
                cx.stop_propagation();
                keyboard(view, window, cx);
            }
        }))
}

pub(super) fn input(
    window: &mut Window,
    cx: &mut App,
    placeholder: &str,
    masked: bool,
    multiline: bool,
) -> Entity<InputState> {
    let placeholder = placeholder.to_string();
    cx.new(|cx| {
        InputState::new(window, cx)
            .placeholder(placeholder)
            .masked(masked)
            .multi_line(multiline)
            .rows(if multiline { 8 } else { 1 })
    })
}
pub(super) fn muted(cx: &App, value: impl Into<SharedString>) -> Div {
    div()
        .text_color(cx.theme().muted_foreground)
        .text_sm()
        .child(value.into())
}
pub(super) fn card(cx: &App) -> Div {
    div()
        .flex()
        .flex_col()
        .gap_3()
        .p_6()
        .rounded_xl()
        .border_1()
        .border_color(cx.theme().border)
        .bg(cx.theme().secondary)
}
pub(super) fn heading(value: impl Into<SharedString>) -> Div {
    div()
        .text_lg()
        .line_height(px(28.))
        .font_weight(FontWeight::SEMIBOLD)
        .child(value.into())
}

pub(super) fn glyph(name: &str) -> Svg {
    svg()
        .path(SharedString::from(format!("icons/{name}.svg")))
        .size_4()
        .flex_shrink_0()
        .text_color(rgb(0x8b949e))
}
pub(super) fn icon(name: &str) -> Icon {
    Icon::default().path(SharedString::from(format!("icons/{name}.svg")))
}
pub(super) fn section_header(cx: &App, name: &str, title: &str) -> Div {
    div()
        .h_12()
        .flex_shrink_0()
        .px_4()
        .flex()
        .items_center()
        .gap_2()
        .border_b_1()
        .border_color(cx.theme().border)
        .child(glyph(name).text_color(cx.theme().primary))
        .child(
            div()
                .font_weight(FontWeight::SEMIBOLD)
                .child(title.to_string()),
        )
}
pub(super) fn markdown(
    id: impl Into<ElementId>,
    text: impl Into<SharedString>,
    window: &mut Window,
    cx: &mut App,
) -> TextView {
    let style = TextViewStyle::default()
        .paragraph_gap(rems(1.))
        .heading_font_size(|level, _| {
            px(match level {
                1 => 30.,
                2 => 24.,
                3 => 20.,
                4 => 18.,
                _ => 16.,
            })
        })
        .heading_style(|level| {
            let mut heading = div()
                .text_size(px(match level {
                    1 => 30.,
                    2 => 24.,
                    3 => 20.,
                    4 => 18.,
                    _ => 16.,
                }))
                .font_weight(FontWeight::BOLD)
                .text_color(rgb(0xffffff))
                .line_height(px(match level {
                    1 => 36.,
                    2 => 32.,
                    _ => 28.,
                }))
                .mt(px(if level <= 2 {
                    32.
                } else if level == 3 {
                    24.
                } else {
                    16.
                }))
                .mb_4()
                .when(level <= 2, |this| {
                    this.pb_2().border_b_1().border_color(rgb(0x1e293b))
                });
            heading.style().clone()
        });
    TextView::markdown(id, text, window, cx)
        .style(style)
        .text_base()
        .line_height(px(28.))
}
pub(super) fn display_date(value: &str) -> String {
    chrono::DateTime::parse_from_rfc3339(value)
        .map(|date| date.format("%-m/%-d/%Y").to_string())
        .unwrap_or_else(|_| value.get(..10).unwrap_or(value).to_string())
}
pub(super) fn language_color(language: &str) -> u32 {
    match language {
        "JavaScript" => 0xf1e05a,
        "TypeScript" => 0x3178c6,
        "HTML" => 0xe34c26,
        "CSS" => 0x563d7c,
        "Python" => 0x3572a5,
        "Rust" => 0xdea584,
        "Go" => 0x00add8,
        "Java" => 0xb07219,
        "C++" => 0xf34b7d,
        "Ruby" => 0x701516,
        "Shell" => 0x89e051,
        "C#" => 0x178600,
        "PHP" => 0x4f5d95,
        "Svelte" => 0xff3e00,
        "Vue" => 0x4fc08d,
        "Kotlin" => 0xa97bff,
        "Dart" => 0x00b4ab,
        "Swift" => 0xf05138,
        _ => 0xcccccc,
    }
}


impl Nexus {
    pub(super) fn action(
        &self,
        id: impl Into<ElementId>,
        label: impl Into<SharedString>,
        cx: &Context<Self>,
        callback: impl Fn(&mut Self, &mut Window, &mut Context<Self>) + 'static,
    ) -> Button {
        Button::new(id)
            .label(label)
            .small()
            .h_8()
            .rounded_lg()
            .on_click(cx.listener(move |view, _, window, cx| {
                cx.stop_propagation();
                view.focus_handle.focus(window);
                callback(view, window, cx);
            }))
    }
}
