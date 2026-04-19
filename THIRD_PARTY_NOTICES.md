# Third-party notices

GitNexus is authored by Tremors and distributed under [LICENSE.md](LICENSE.md). Dependencies retain their own copyrights and license terms.

The application uses GPUI, GPUI Component, rusqlite and SQLite, reqwest and Rustls, Fernet, Serde, Chrono and their dependencies. `Cargo.lock` records exact dependency versions. Upstream package metadata and license files identify their respective terms.

Windows packages include `THIRD-PARTY-LICENSES.txt`, generated from the locked dependency graph and bundled license files by `git-nexus-app/scripts/write-dependency-notices.ps1`.

Vendored source and notices are retained under `git-nexus-app/vendor/`. Changes are described in [the GPUI Component patch](git-nexus-app/vendor/gpui-component/PATCH.md) and [the xattr patch](git-nexus-app/vendor/xattr/PATCH.md).

Bundled Lucide icons are used under the ISC license. Their copyright and license text are retained in `git-nexus-app/crates/desktop/assets/LUCIDE-LICENSE`.

Windows installers use NSIS. Its applicable notices are retained in `git-nexus-app/installer/licenses/NSIS.txt` and included in distributed packages as `NSIS-LICENSES.txt`. The GitNexus icon comes from this repository's `assets/git-nexus.png`.
