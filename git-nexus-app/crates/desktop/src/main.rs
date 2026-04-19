mod assets;
mod history;
mod jobs;
mod media;
mod service;
mod theme;
mod ui;

use anyhow::{Context, Result, bail};
use git_nexus_core::Store;
use gpui::{
    App, AppContext, Application, Bounds, TitlebarOptions, WindowBounds, WindowOptions, px, size,
};
use gpui_component::{Root, Theme, ThemeMode};
use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
};

fn main() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("warn")).init();
    if let Err(error) = run() {
        eprintln!("GitNexus: {error:#}");
        std::process::exit(1);
    }
}

fn run() -> Result<()> {
    let mut arguments = std::env::args().skip(1);
    let mut data_dir = None;
    let mut screen = String::from("home");
    let mut local = None;
    let mut check = false;
    while let Some(argument) = arguments.next() {
        match argument.as_str() {
            "--data-dir" => {
                data_dir = Some(PathBuf::from(
                    arguments.next().context("--data-dir requires a path")?,
                ))
            }
            "--screen" => {
                screen = arguments
                    .next()
                    .context("--screen requires home, discovery, watchlist, replay, or settings")?
            }
            "--add-repo" => {
                local = Some(PathBuf::from(
                    arguments
                        .next()
                        .context("--add-repo requires a repository path")?,
                ))
            }
            "--check" => check = true,
            "--help" | "-h" => {
                println!(
                    "GitNexus desktop\n\n  --data-dir PATH       Override the application data directory\n  --screen NAME         Start on home, discovery, watchlist, replay, or settings\n  --add-repo PATH       Register an existing local Git checkout\n  --check               Verify storage and Git, then exit without a window"
                );
                return Ok(());
            }
            _ => bail!("Unknown argument: {argument}"),
        }
    }
    let initial_screen = ui::Screen::parse(&screen)?;
    let services = service::Services::open(data_dir.unwrap_or(Store::default_directory()?))?;
    if let Some(path) = local {
        services.store.add_repository(&path)?;
    }
    if check {
        let snapshot = services.snapshot()?;
        for repo in &snapshot.repositories {
            git_nexus_core::git::commits(std::path::Path::new(&repo.path), 1, 1)?;
        }
        println!(
            "Native storage and Git checks passed. {} watched repositories; {} local repositories.",
            snapshot.watchlist.len(),
            snapshot.repositories.len()
        );
        return Ok(());
    }
    let services = Arc::new(Mutex::new(services));
    Application::new()
        .with_assets(assets::Assets)
        .with_http_client(Arc::new(media::MediaClient::new()?))
        .run(move |cx: &mut App| {
            gpui_component::init(cx);
            Theme::change(ThemeMode::Dark, None, cx);
            let preferred = size(px(1400.), px(920.));
            let window_size = cx
                .primary_display()
                .map(|display| {
                    let available = display.bounds().size;
                    size(
                        preferred.width.min(available.width - px(48.)),
                        preferred.height.min(available.height - px(80.)),
                    )
                })
                .unwrap_or(preferred);
            let bounds = Bounds::centered(None, window_size, cx);
            let result = cx.open_window(
                WindowOptions {
                    titlebar: Some(TitlebarOptions {
                        title: Some("GitNexus".into()),
                        ..Default::default()
                    }),
                    window_bounds: Some(WindowBounds::Windowed(bounds)),
                    window_min_size: Some(size(px(1000.), px(680.))),
                    ..Default::default()
                },
                move |window, cx| {
                    let view = cx.new(|cx| ui::Nexus::new(services, initial_screen, window, cx));
                    cx.new(|cx| Root::new(view, window, cx))
                },
            );
            if let Err(error) = result {
                eprintln!("Cannot open the desktop window: {error}");
                cx.quit();
            }
            cx.activate(true);
            cx.on_window_closed(|cx| {
                if cx.windows().is_empty() {
                    cx.quit();
                }
            })
            .detach();
        });
    Ok(())
}
