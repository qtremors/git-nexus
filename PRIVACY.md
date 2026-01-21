# Privacy Policy for GitNexus

**Last Updated:** 2026-10-21

GitNexus is a personal project built with local storage and user-controlled GitHub access. This policy explains how the application handles information.

## 1. No Telemetry or Advertising

GitNexus has no advertising, analytics or telemetry service. It does not send usage statistics to the developer.

## 2. GitHub and Network Access

Discovery, release tracking and downloads contact GitHub and its download hosts. GitHub receives requested profile and repository identities and standard network connection information. An optional token authorizes API requests. README images and avatars can contact their HTTPS hosts through a separate client that does not receive the token.

Cloning uses the installed Git application's network and authentication configuration. Opening a link hands it to the system browser or associated application.

## 3. Local Storage

Settings, watchlists, repository paths, search history, cached GitHub responses and activity logs are stored in the application data directory. Downloaded files are saved in the configured download directory. These files are not uploaded to the developer.

Saved tokens and environment values are encrypted with a local key. The key is stored alongside the database, so someone with access to both can decrypt them. Keep `gitnexus.db` and `secret.key` together in private backups.

## 4. Repository Access and Previews

Replay reads repositories you register and exports selected commits to temporary local snapshots. It serves static files on the loopback address and does not execute repository scripts. The source checkout is preserved. Snapshots are removed on normal stop; forced process termination can leave temporary files behind.

## 5. Your Controls

Settings provides token, cache and log controls. Watchlist configuration can be exported without a token. Removing a repository registration preserves its checkout. Uninstalling the application preserves local settings and downloads; remove those separately when you want to erase them.

## 6. Source Availability and Policy Updates

Source is available for inspection on [GitHub](https://github.com/qtremors/git-nexus). This policy may change when application behavior changes. Report privacy questions through [GitHub Issues](https://github.com/qtremors/git-nexus/issues), without including tokens or private files.
