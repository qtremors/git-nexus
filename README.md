<p align="center">
  <img src="assets/git-nexus.png" alt="GitNexus Logo" width="120">
</p>

<h1 align="center"><a href="https://qtremors.github.io/git-nexus/">GitNexus</a></h1>

<p align="center">Discover repositories, follow releases, and explore Git history.</p>

<p align="center">
  <a href="https://github.com/qtremors/git-nexus/releases/latest"><img src="https://img.shields.io/github/v/release/qtremors/git-nexus?label=Download&color=2da44e&logo=windows&logoColor=white" alt="Download GitNexus" height="32"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Rust-GPUI-orange" alt="Rust and GPUI">
  <img src="https://img.shields.io/badge/Windows-x64-0078D4" alt="Windows x64">
  <img src="https://img.shields.io/badge/License-TSL-red" alt="Tremors Source License">
</p>

## Why GitNexus

GitNexus brings GitHub discovery, release tracking, and local commit previews into a native desktop app. Settings and caches stay on your machine. There are no ads, trackers, or telemetry.

## Download

Windows packages are available from [GitHub Releases](https://github.com/qtremors/git-nexus/releases): choose the setup EXE for installation or the portable ZIP to run from a folder. The installer creates shortcuts and an uninstall entry for your Windows account. Uninstalling preserves application data and downloads.

Install [Git](https://git-scm.com/downloads) and make it available on PATH for repository cloning and Replay. Public GitHub queries work without a token; a token in Settings provides authenticated access and higher API limits.

Windows builds require the [Microsoft Visual C++ x64 runtime](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist/). The installer checks for its runtime DLL before installing.

## Features

- **Discovery:** Explore GitHub profiles, READMEs, repositories and contributions. Filter and sort results, inspect commit details, and download selected repositories.
- **Watchtower:** Track releases, compare current and latest versions, read release notes, download assets and source archives, and import or export a watchlist.
- **Repo Replay:** Browse a local repository's history and files, preview Markdown, and serve static HTML snapshots from selected commits without changing the checkout.
- **Local preferences:** Choose a download directory and theme, manage an encrypted token and scoped environment values, and clear caches or activity logs.

Replay serves commits containing a root `index.html`. It does not execute project scripts or inject saved environment values into browser files. Downloading a release does not change its marked current version; use the explicit version action.

## Community and support

- Report bugs or request features through [GitHub Issues](https://github.com/qtremors/git-nexus/issues).
- Review changes in the [changelog](CHANGELOG.md).
- Read the [privacy policy](PRIVACY.md).

## Credits

GitNexus is built by [Tremors](https://github.com/qtremors) with Rust and GPUI. Thanks to the maintainers of GPUI, GPUI Component, SQLite, reqwest, Rustls, Fernet, Lucide and NSIS. Dependency licenses and bundled notices are described in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## For developers

Architecture, setup, platform dependencies, local builds, Windows packaging, configuration and verification guidance live in [DEVELOPMENT.md](DEVELOPMENT.md). Remaining work is tracked in [TASKS.md](TASKS.md).

To run from source with Rust and the platform build tools installed:

```sh
cd git-nexus-app
cargo run --locked
```

## License

GitNexus is source-available under the **Tremors Source License (TSL) Version 2.0**. Attribution is required; commercial use requires written permission. Read [LICENSE.md](LICENSE.md).

---

<p align="center">Made by <a href="https://github.com/qtremors">Tremors</a></p>
