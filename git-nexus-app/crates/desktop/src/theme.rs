//! Semantic colors from frontend/src/index.css at 9a51a75.
use gpui::{App, Window, px, rgb};
use gpui_component::{Theme, ThemeMode};

pub fn apply_theme(name: &str, window: &mut Window, cx: &mut App) {
    Theme::change(
        if name == "light" {
            ThemeMode::Light
        } else {
            ThemeMode::Dark
        },
        Some(window),
        cx,
    );
    let (background, surface, hover, border, foreground, muted, primary, secondary) = match name {
        "dracula" => (
            0x282a36, 0x44475a, 0x6272a4, 0x6272a4, 0xf8f8f2, 0xbd93f9, 0xbd93f9, 0x50fa7b,
        ),
        // Retain compatibility with already saved native preferences.
        "light" => (
            0xf4f5fa, 0xffffff, 0xe8ecf2, 0xd7dce8, 0x242b3b, 0x626d80, 0x0085d0, 0x009688,
        ),
        _ => (
            0x0d1117, 0x161b22, 0x21262d, 0x30363d, 0xc9d1d9, 0x8b949e, 0x0085d0, 0x03dac6,
        ),
    };
    let theme = Theme::global_mut(cx);
    // GPUI maps .SystemUIFont to IBM Plex on Linux even when it is absent.
    // Use the installed desktop font so weight selection works reliably.
    #[cfg(target_os = "linux")]
    {
        theme.font_family = "DejaVu Sans".into();
    }

    theme.background = rgb(background).into();
    theme.foreground = rgb(foreground).into();
    theme.secondary = rgb(surface).into();
    theme.secondary_foreground = rgb(foreground).into();
    theme.muted = rgb(hover).into();
    theme.muted_foreground = rgb(muted).into();
    theme.border = rgb(border).into();
    theme.input = rgb(border).into();
    theme.primary = rgb(primary).into();
    theme.primary_foreground = rgb(0xffffff).into();
    theme.accent = rgb(hover).into();
    theme.accent_foreground = rgb(foreground).into();
    theme.success = rgb(secondary).into();
    theme.ring = rgb(primary).into();
    theme.radius = px(8.);
    window.refresh();
}
