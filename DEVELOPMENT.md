# GitNexus - Developer Documentation

> Architecture, setup, builds, distribution and maintenance guidance.

**Version:** 0.2.6 | **Last Updated:** 2026-10-21

## Contents

- [Architecture](#architecture)
- [Technology stack](#technology-stack)
- [Project structure](#project-structure)
- [Runtime flow](#runtime-flow)
- [Setup and local development](#setup-and-local-development)
- [Builds and distribution](#builds-and-distribution)
- [Configuration and local data](#configuration-and-local-data)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)
- [Maintenance](#maintenance)

## Architecture

The application workspace lives in `git-nexus-app/` and has two crates. `git-nexus-core` owns SQLite storage, GitHub requests, Git operations and static Replay servers. `git-nexus-desktop` owns the GPUI window, views, input state and service jobs.

Blocking work runs on bounded background lanes. Foreground network, background network, local reads and mutations have separate queues. Each worker opens its own SQLite connection; workers share the Replay registry. Request generations and repository/commit identities prevent stale results from replacing the selected content. Token and cache mutations wait for active network reads.

The desktop UI separates state, runtime/job handling, navigation, rendering and shared components under `crates/desktop/src/ui/`. Feature views live beneath `ui/views/`.

Service outcomes carry view updates and monotonically numbered snapshots. GPUI applies current outcomes and renders feedback. The public media client loads HTTPS images independently and does not receive the GitHub token.

Replay exports regular Git blobs into an isolated snapshot, excluding symlinks and submodules. Its HTTP server binds to `127.0.0.1`, handles bounded concurrent connections, and closes connections and removes snapshots on normal stop. The source checkout stays untouched. Servers are not resumed after an app restart.

## Technology stack

| Area | Implementation |
| --- | --- |
| Language and toolchain | Rust, pinned by `rust-toolchain.toml` |
| Interface | GPUI 0.2.2 and GPUI Component 0.5.1 |
| Storage | Bundled SQLite through rusqlite |
| GitHub and media | reqwest, Rustls and platform certificate trust |
| Secrets | Fernet encryption with a retained local key |
| Repository operations | Installed Git executable |
| Windows resources | embed-resource, application icon and version information |
| Windows packages | PowerShell scripts and NSIS |

## Project structure

```text
git-nexus/
  README.md, DEVELOPMENT.md   Product and developer documentation
  CHANGELOG.md, TASKS.md      Version history and unfinished work
  LICENSE.md, PRIVACY.md      License and data-handling policy
  THIRD_PARTY_NOTICES.md      Dependency notice guide
  assets/                    Canonical branding and application icon
  docs/                      Static project website and its assets
  git-nexus-app/              Rust application workspace
    Cargo.toml, Cargo.lock   Shared version and locked dependencies
    rust-toolchain.toml      Pinned development toolchain
    crates/
      core/                  Storage, GitHub, Git and Replay
      desktop/               GPUI startup, UI and Windows resources
        src/ui/              State, runtime, navigation and components
          views/             Feature views
    installer/               Windows recipe and compiler license notices
    scripts/                 Local build and packaging tools
    vendor/                  Patched dependency sources and licenses
    target/, dist/           Ignored build outputs and packages
```

## Runtime flow

1. Open the application data directory and validate the database and retained encryption key.
2. Create the GPUI window and load saved preferences and repository registrations.
3. Queue work for the selected feature and render independent loading or error states.
4. Persist settings and caches locally; keep Replay server ownership in the current process.
5. On normal app close, stop owned servers and remove their temporary snapshots.

## Setup and local development

Install Rust through rustup and install Git. Cargo uses the checked-in toolchain and lockfile. Run from `git-nexus-app/`:

```sh
cd git-nexus-app
cargo run --locked
cargo run --locked -- --data-dir ./native-data --screen replay --add-repo .
cargo run --locked -- --data-dir ./native-data --check
```

On Windows, install Visual Studio 2022 Build Tools with Desktop development with C++ and a Windows SDK. The application targets Windows x64 with a Direct3D-capable graphics driver. A release build uses the GUI subsystem and embeds the application icon and version.

Release shader compilation requires the SDK's `fxc.exe`. The packaging script discovers it on PATH or through the installed SDK registry entry, including SDKs on another drive. Use `-ShaderCompiler 'X:/Windows Kits/10/bin/<sdk-version>/x64/fxc.exe'` to select it explicitly. For a direct release Cargo build, set `GPUI_FXC_PATH` to that full path in the build process environment.

On Debian or Ubuntu, install the native libraries before building:

```sh
sudo apt-get install build-essential pkg-config git libfontconfig1-dev \
  libfreetype6-dev libxkbcommon-dev libxkbcommon-x11-dev libxcb1-dev \
  libxcb-xkb-dev libx11-xcb-dev libwayland-dev libvulkan1 \
  mesa-vulkan-drivers fonts-dejavu-core
cargo run --locked --release
```

Linux X11 has been exercised. XWayland can supply X11 on a Wayland desktop. The `wayland` feature selects native Wayland support, which still needs manual validation. macOS requires Xcode and its command-line tools; macOS validation is pending.

## Builds and distribution

From `git-nexus-app/`, build Windows packages with NSIS 3.11 or newer installed:

```powershell
./scripts/build-windows.ps1
# Or supply the compiler explicitly:
./scripts/build-windows.ps1 -Compiler 'C:/Tools/NSIS/makensis.exe'
```

The script runs workspace tests and builds the release executable with two Cargo jobs by default. `-Jobs` changes that limit; `-SkipTests` is intended for packaging a build already checked in the current session. Versions come from Cargo metadata and are checked against the executable resource before packaging.

Outputs appear under `git-nexus-app/dist/`:

- `GitNexus-0.2.6-windows-x64-setup.exe`
- `GitNexus-0.2.6-windows-x64-portable.zip`
- A SHA-256 sidecar for each package.

The setup EXE installs per user under `%LOCALAPPDATA%/Programs/GitNexus`, adds desktop and Start menu shortcuts, and registers an uninstaller. It does not require administrator rights. Uninstall removes its known program files and shortcuts while preserving application data, downloads and unrelated files. Close GitNexus before installing or uninstalling. Packages are unsigned.

The current MSVC build links the Visual C++ runtime dynamically. Install Microsoft's x64 Visual C++ runtime before using either package; setup checks for `VCRUNTIME140.dll` and reports the prerequisite when missing. The installer does not install system components itself.

`assets/git-nexus.ico` contains multiple sizes derived from `assets/git-nexus.png`. The executable, setup EXE, uninstaller, shortcuts and installed-app entry use this icon. Keep the ICO synchronized when replacing the PNG.

## Configuration and local data

| Setting | Behavior |
| --- | --- |
| `GIT_NEXUS_DATA_DIR` | Overrides the platform application data directory |
| `--data-dir PATH` | Chooses an explicit data directory for this launch |
| `GITHUB_TOKEN` | Overrides a token saved in Settings |
| Download directory | Chosen in Settings; release assets use repository subfolders |
| Proxy configuration | Standard process proxy variables and platform certificate trust |

The application does not load `.env` files. Keep both `gitnexus.db` and `secret.key` in private backups. The key is stored alongside the database; encryption does not protect against someone who can read both files. A missing key for an existing database is an error, not a request to generate a replacement.

Scoped environment values merge global, project and commit settings. They are saved configuration; static Replay previews neither execute project code nor substitute these values into files. Text previews accept UTF-8 files up to 2 MiB. Downloads use trusted HTTPS destinations and do not overwrite existing files.

## Verification

Run focused local checks serially on resource-constrained machines:

```sh
cargo check --workspace --locked -j 2
cargo test --workspace --locked -j 2
cargo build --release --locked -j 2
```

Tests use temporary databases, real Git repositories, cached responses and loopback HTTP. They cover encryption, watchlist import/export, download containment, pagination, job scheduling, cache refresh and Replay lifecycle. External GitHub behavior and native accessibility require separate manual checks.

Before distributing a build, check:

- Discovery, Watchtower, Replay and Settings navigation, keyboard input and modal dismissal.
- Replay Start, an HTTP request, Stop, restart, file viewing and unchanged checkout contents.
- Watchlist import/export, failed-network feedback and a small asset download.
- Installer icon, executable version, shortcuts, uninstall entry and retained user data.
- Matching package version, changelog, dependency notices, hashes and final diff.

Do not claim full UI coverage or accessibility based only on unit tests. Pending work stays in [TASKS.md](TASKS.md).

Local validation covers workspace builds and tests, formatting, Clippy, version resources and package contents. Manual installer upgrade and clean-machine prerequisite checks remain pending.

## Troubleshooting

- **Git not found:** Install Git and reopen the app so PATH is refreshed.
- **Graphics startup failure:** Check the graphics driver and required platform libraries. On Linux, confirm an X11 display and Vulkan driver are available.
- **GitHub request failure:** Check connectivity, proxy settings, quota and the optional token in Settings.
- **Database cannot open:** Preserve the database and key together. Use a separate disposable directory for tests.
- **Download already exists:** Move or rename the existing file before retrying.
- **Installer compiler missing:** Install NSIS or pass `-Compiler` with its full path.

## Maintenance

Keep the project version centralized in the workspace. Update user-facing changelog entries only for completed, verified behavior. Retain dependency licenses and the documented patches in `git-nexus-app/vendor/`. Keep the website's commands and download links aligned with the current app. Builds, tests and packaging run locally.
