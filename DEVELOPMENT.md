# GitNexus - Developer Documentation

**Version:** 0.1.6 | **Last Updated:** 2026-01-21

The `git-nexus-app/` Cargo workspace separates `crates/core/` from `crates/desktop/`. Core owns data and repository services. Desktop owns the GPUI interface. Dependencies with required local patches are retained under `vendor/` with their licenses.

Run local Cargo commands from `git-nexus-app/`:

```sh
cargo build --workspace --locked -j 2
cargo test --workspace --locked -j 2
```

Builds, tests and packaging run locally.
