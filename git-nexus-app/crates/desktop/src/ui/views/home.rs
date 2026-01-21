use super::*;

impl Nexus {
    pub(super) fn home(&self, cx: &mut Context<Self>) -> AnyElement {
        let features = [
            (
                Screen::Discovery,
                "search",
                "User Discovery",
                "Explore GitHub profiles, browse repositories, view READMEs, and analyze commit history.",
                ["Profile Search", "Repo Browser", "README Render"],
                0x60a5fa,
            ),
            (
                Screen::Watchlist,
                "eye",
                "Asset Watchtower",
                "Track repositories, get release notifications, download assets with version tracking.",
                ["Release Alerts", "Asset Downloads", "Import/Export"],
                0xc084fc,
            ),
            (
                Screen::Replay,
                "history",
                "Code Replay",
                "Browse commit history and launch dev servers to preview any point in time.",
                ["Commit Browser", "Server Launch", "Multi-Version"],
                0x34d399,
            ),
        ];
        let glow = std::sync::Arc::new(Image::from_bytes(
            ImageFormat::Svg,
            include_bytes!("../../../assets/home-glow.svg").to_vec(),
        ));
        div().relative().w_full().min_h_full().flex().flex_col().items_center().py(px(56.))
            .child(img(glow).absolute().inset_0().size_full())
            .child(canvas(|bounds, _, _| bounds, |bounds, _, window, _| {
                // A 24px dot grid, fading towards the page edges.
                let width = f32::from(bounds.size.width);
                let height = f32::from(bounds.size.height);
                for y in (0..height as usize).step_by(24) {
                    for x in (0..width as usize).step_by(24) {
                        let dx = (x as f32 - width / 2.) / (width / 2.);
                        let dy = (y as f32 - height / 2.) / (height / 2.);
                        let opacity = (1. - (dx * dx + dy * dy) * 0.65).max(0.) * 0.15;
                        window.paint_quad(fill(Bounds::new(bounds.origin + point(px(x as f32), px(y as f32)), size(px(2.), px(2.))), hsla(0.607, 0.164, 0.305, opacity)));
                    }
                }
            }).absolute().inset_0())
            .child(div().relative().w_full().max_w(px(1024.)).px_6().flex().flex_col()
                .child(div().flex().flex_col().items_center().text_center().mb(px(80.))
                    .child(div().flex().items_center().gap_2().rounded_full().px_3().py_1().mb_8()
                        .bg(rgb(0x161b22)).border_1().border_color(rgb(0x30363d)).text_xs().line_height(px(16.)).font_family(MONO_FONT).text_color(rgb(0x60a5fa))
                        .child(glyph("terminal").size_3()).child(concat!("GITNEXUS_V", env!("CARGO_PKG_VERSION"))))
                    .child(div().text_size(px(72.)).line_height(px(72.)).font_weight(FontWeight::BOLD).text_color(rgb(0xf0f6fc)).child("Your GitHub"))
                    .child(div().text_size(px(72.)).line_height(px(80.)).font_weight(FontWeight::BOLD).text_color(rgb(0xbfdbfe)).child("Command Center"))
                    .child(div().mt_6().max_w(px(672.)).text_lg().line_height(px(28.)).text_color(rgb(0x8b949e))
                        .child("A unified interface for discovery, asset tracking, and historical code replay. Designed for precision and control.")))
                .child(div().flex().gap_6().mb(px(80.)).children(features.into_iter().enumerate().map(|(index, (screen, name, title, description, tags, color))| {
                    clickable(("feature", index), cx, move |v, _, cx| v.navigate(screen, cx)).group("feature-card").relative().flex_1().min_w_0().p_6().rounded_xl().border_1().border_color(rgb(0x30363d))
                        .bg(rgb(0x161b22)).cursor_pointer().hover(|s| s.bg(rgb(0x1c2128)).border_color(rgba(0x3b82f64d)).shadow_lg().top(px(-4.)))
                        .flex().flex_col()
                        .child(div().flex().items_center().justify_between().mb_5().child(div().size_12().rounded_lg().border_1().border_color(rgb(0x30363d)).bg(rgb(0x0d1117)).flex().items_center().justify_center()
                            .child(glyph(name).size(px(22.)).text_color(rgb(color)))).child(glyph("arrow-right").opacity(0.).group_hover("feature-card",|style|style.opacity(1.))))
                        .child(div().text_lg().line_height(px(28.)).font_weight(FontWeight::BOLD).text_color(rgb(0xf0f6fc)).mb_3().child(title))
                        .child(div().text_sm().line_height(px(22.)).text_color(rgb(0x8b949e)).mb_6().flex_1().child(description))
                        .child(div().flex().flex_wrap().gap_2().pt_4().border_t_1().border_color(rgba(0x30363d80))
                            .children(tags.into_iter().map(|tag| div().px_2().py_1().rounded_sm().bg(rgb(0x0d1117)).border_1().border_color(rgb(0x30363d))
                                .text_size(px(10.)).font_family(MONO_FONT).text_color(rgb(0x8b949e)).child(tag))))

                })))
                .child(div().border_t_1().border_color(rgb(0x30363d)).pt_10().flex().justify_center().gap(px(96.))
                    .children([("star", "REPOSITORIES"), ("download", "DOWNLOADS"), ("git-branch", "COMMITS")].into_iter().map(|(name, title)| {
                        div().flex().flex_col().items_center().gap_2().child(div().flex().items_center().gap_2().text_xs().line_height(px(16.)).text_color(rgb(0x8b949e))
                            .child(glyph(name).size_3()).child(title))
                            .child(div().text_2xl().line_height(px(32.)).font_family(MONO_FONT).text_color(rgb(0xf0f6fc)).child("--"))
                    }))))
            .into_any_element()
    }
}
