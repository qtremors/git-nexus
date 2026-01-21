use anyhow::Result;
use git_nexus_core::{Replay, Store, git, models::*};
use rusqlite::Connection;
use std::{
    fs,
    io::{Read, Write},
    net::TcpStream,
    path::Path,
    process::Command,
    time::Duration,
};

fn commit_fixture(path: &Path) -> Result<()> {
    let commands: Vec<Vec<&str>> = vec![
        vec!["init", "-q"],
        vec!["add", "."],
        vec![
            "-c",
            "user.name=Native Test",
            "-c",
            "user.email=test@example.com",
            "commit",
            "-qm",
            "First version",
        ],
    ];
    fs::write(path.join("index.html"), "<h1>Native Replay</h1>")?;
    fs::write(path.join("README.md"), "# Fixture")?;
    for args in commands {
        assert!(
            Command::new("git")
                .arg("-C")
                .arg(path)
                .args(args)
                .status()?
                .success()
        );
    }
    Ok(())
}

#[test]
fn settings_and_encrypted_credentials_survive_reopen() -> Result<()> {
    let directory = tempfile::tempdir()?;
    let store = Store::open(directory.path())?;
    store.save_setting("theme", "midnight")?;
    store.save_token("test-credential-not-a-real-secret")?;
    drop(store);
    let database = Connection::open(directory.path().join("gitnexus.db"))?;
    let ciphertext: String = database.query_row(
        "SELECT value FROM app_config WHERE key='github_token'",
        [],
        |r| r.get(0),
    )?;
    assert!(!ciphertext.contains("test-credential"));
    let store = Store::open(directory.path())?;
    assert_eq!(store.setting("theme")?.as_deref(), Some("midnight"));
    assert_eq!(
        store.token()?.as_deref(),
        Some("test-credential-not-a-real-secret")
    );
    assert!(store.save_setting("theme", "invalid").is_err());
    assert!(store.setting("github_token").is_err());
    store.save_token("")?;
    assert!(store.token()?.is_none());
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        assert_eq!(
            fs::metadata(directory.path().join("secret.key"))?
                .permissions()
                .mode()
                & 0o777,
            0o600
        );
    }
    Ok(())
}

#[test]
fn environment_scope_precedence_and_transactional_replacement() -> Result<()> {
    let directory = tempfile::tempdir()?;
    let mut store = Store::open(directory.path())?;
    let make = |value: &str| EnvVar {
        key: "MODE".into(),
        value: value.into(),
    };
    store.save_env("global", 0, "", &[make("global")])?;
    store.save_env("project", 1, "", &[make("project")])?;
    store.save_env("commit", 1, "abc1234", &[make("commit")])?;
    assert_eq!(store.merged_env(1, "abc1234")?["MODE"], "commit");
    assert_eq!(store.merged_env(1, "def1234")?["MODE"], "project");
    assert_eq!(store.merged_env(2, "def1234")?["MODE"], "global");
    assert!(
        store
            .save_env(
                "global",
                0,
                "",
                &[EnvVar {
                    key: "BAD=KEY".into(),
                    value: "bad".into()
                }]
            )
            .is_err()
    );
    assert_eq!(store.env_vars("global", 0, "")?[0].value, "global");
    assert!(store.save_env("commit", 1, "../../etc", &[]).is_err());
    let database = Connection::open(directory.path().join("gitnexus.db"))?;
    let encrypted: String =
        database.query_row("SELECT value FROM env_vars WHERE scope='global'", [], |r| {
            r.get(0)
        })?;
    assert_ne!(encrypted, "global");
    Ok(())
}

#[test]
fn watchlist_tracks_versions_deduplicates_and_roundtrips() -> Result<()> {
    let directory = tempfile::tempdir()?;
    let mut store = Store::open(directory.path())?;
    let repo = GitHubRepo {
        name: "git-nexus".into(),
        html_url: "https://github.com/qtremors/git-nexus".into(),
        ..Default::default()
    };
    store.watch("qtremors", "git-nexus", &repo, Some("v1"))?;
    assert!(store.watch("QTREMORS", "git-nexus", &repo, None).is_err());
    let id = store.watchlist()?[0].id;
    store.update_version(id, Some("v2"))?;
    assert!(store.watchlist()?[0].has_update());
    let path = directory.path().join("watchlist.json");
    store.export_watchlist(&path)?;
    store.unwatch(id)?;
    assert_eq!(store.import_watchlist(&path)?, 1);
    assert_eq!(store.import_watchlist(&path)?, 0);
    let id = store.watchlist()?[0].id;
    store.mark_current(id)?;
    assert!(!store.watchlist()?[0].has_update());
    fs::write(
        &path,
        r#"[{"owner":"safe","name":"repo"},{"owner":"..","name":"bad"}]"#,
    )?;
    assert!(store.import_watchlist(&path).is_err());
    assert_eq!(store.watchlist()?.len(), 1);
    Ok(())
}

#[test]
fn cache_expiration_and_credential_changes_invalidate_data() -> Result<()> {
    let directory = tempfile::tempdir()?;
    let store = Store::open(directory.path())?;
    store.cache_put("old", &serde_json::json!({"old":true}), -1)?;
    store.cache_put("fresh", &serde_json::json!({"fresh":true}), 3600)?;
    assert!(store.cache_get("old")?.is_none());
    assert!(store.cache_get("fresh")?.is_some());
    store.save_token("changed-test-token")?;
    assert!(store.cache_get("fresh")?.is_none());
    Ok(())
}

#[test]
fn watchtower_config_exports_only_identities_and_protects_other_files() -> Result<()> {
    let dir = tempfile::tempdir()?;
    let mut store = Store::open(dir.path())?;
    store.watch("owner", "project", &GitHubRepo::default(), Some("v1"))?;
    let path = dir.path().join("watchtower.JSON");
    store.export_watchlist_config(&path)?;
    assert_eq!(
        serde_json::from_slice::<serde_json::Value>(&fs::read(&path)?)?,
        serde_json::json!([{"owner":"owner","name":"project"}])
    );
    let database = dir.path().join("gitnexus.db");
    let before = fs::read(&database)?;
    assert!(store.export_watchlist_config(&database).is_err());
    assert_eq!(fs::read(database)?, before);
    fs::write(
        &path,
        r#"{"repos":[{"owner":"owner","repo_name":"other"},{"owner":"../bad","name":"invalid"}]}"#,
    )?;
    assert!(Store::read_watchlist_import(&path).is_err());
    assert_eq!(store.watchlist()?.len(), 1);
    fs::write(
        &path,
        r#"{"repos":[{"owner":"owner","repo_name":"other"}]}"#,
    )?;
    assert_eq!(store.import_watchlist(&path)?, 1);
    assert_eq!(store.watchlist()?[1].name, "other");
    Ok(())
}

#[test]
fn native_replay_serves_git_snapshot_and_cleans_up() -> Result<()> {
    let directory = tempfile::tempdir()?;
    let source = directory.path().join("repo");
    fs::create_dir(&source)?;
    fs::create_dir(source.join("nested"))?;
    fs::write(
        source.join("nested/index.html"),
        "<link rel='stylesheet' href='style.CSS'>",
    )?;
    fs::write(source.join("nested/style.CSS"), "body { color: blue; }")?;
    fs::write(source.join("other.HTM"), "<h1>Other page</h1>")?;
    commit_fixture(&source)?;
    let store = Store::open(directory.path().join("data"))?;
    let repo = store.add_repository(&source)?;
    let commits = git::commits(&source, 1, 30)?;
    assert_eq!(commits.len(), 1);
    assert_eq!(
        git::file_content(&source, &commits[0].hash, "README.md")?,
        "# Fixture"
    );
    assert!(git::file_content(&source, &commits[0].hash, "../../etc/passwd").is_err());
    assert!(git::commits(&source, 2, 30)?.is_empty());
    assert!(git::files(&source, &commits[0].hash)?.contains(&"index.html".into()));
    let snapshots = directory.path().join("snapshots");
    let mut replay = Replay::new(snapshots.clone())?;
    let info = replay.start(&repo, &commits[0].hash, None)?;
    let again = replay.start(&repo, &commits[0].hash, None)?;
    assert_eq!(info.id, again.id);
    let client = reqwest::blocking::Client::builder()
        .no_proxy()
        .timeout(Duration::from_secs(3))
        .build()?;
    let response = client.get(&info.url).send()?;
    assert_eq!(response.status().as_u16(), 200);
    assert!(
        response.headers()["content-type"]
            .to_str()?
            .starts_with("text/html")
    );
    assert_eq!(response.text()?, "<h1>Native Replay</h1>");
    let nested = client
        .get(format!("{}/nested?theme=dark", info.url))
        .send()?;
    assert_eq!(nested.url().path(), "/nested/");
    assert_eq!(nested.url().query(), Some("theme=dark"));
    assert!(nested.text()?.contains("style.CSS"));
    let css = client
        .get(format!("{}/nested/style.CSS", info.url))
        .send()?;
    assert!(
        css.headers()["content-type"]
            .to_str()?
            .starts_with("text/css")
    );
    let html = client.get(format!("{}/other.HTM", info.url)).send()?;
    assert!(
        html.headers()["content-type"]
            .to_str()?
            .starts_with("text/html")
    );
    let head = client.head(&info.url).send()?;
    assert_eq!(head.status().as_u16(), 200);
    assert!(head.text()?.is_empty());

    // Real browsers can preconnect without sending headers. Other requests must
    // still complete, and a fragmented request must survive a polling timeout.
    let idle = TcpStream::connect(("127.0.0.1", info.port))?;
    let mut fragmented = TcpStream::connect(("127.0.0.1", info.port))?;
    fragmented.set_read_timeout(Some(Duration::from_secs(3)))?;
    fragmented.write_all(b"GET / HTTP/1.1\r\nHost: localhost\r\n")?;
    std::thread::sleep(Duration::from_millis(300));
    assert_eq!(
        client.get(&info.url).send()?.text()?,
        "<h1>Native Replay</h1>"
    );
    fragmented.write_all(b"\r\n")?;
    let mut response = String::new();
    fragmented.read_to_string(&mut response)?;
    assert!(response.starts_with("HTTP/1.1 200 OK"));
    assert!(response.ends_with("<h1>Native Replay</h1>"));
    drop(idle);
    assert_eq!(client.post(&info.url).send()?.status().as_u16(), 405);
    assert_eq!(
        client
            .get(format!("{}/%2Fetc%2Fpasswd", info.url))
            .send()?
            .status()
            .as_u16(),
        404
    );
    fs::write(source.join("index.html"), "Changed working tree")?;
    assert_eq!(
        client.get(&info.url).send()?.text()?,
        "<h1>Native Replay</h1>"
    );
    replay.stop(&info.id)?;
    assert_eq!(replay.list()[0].status, "stopped");
    assert_eq!(fs::read_dir(snapshots)?.count(), 0);
    assert!(client.get(&info.url).send().is_err());
    let restarted = replay.start(&repo, &commits[0].hash, None)?;
    assert_eq!(restarted.id, info.id);
    assert_eq!(restarted.port, info.port);
    assert_eq!(replay.list().len(), 1);
    assert_eq!(
        client.get(&restarted.url).send()?.text()?,
        "<h1>Native Replay</h1>"
    );
    replay.remove(&info.id)?;
    assert!(replay.list().is_empty());
    assert_eq!(
        fs::read_to_string(source.join("index.html"))?,
        "Changed working tree"
    );
    Ok(())
}

#[cfg(unix)]
#[test]
fn snapshot_does_not_follow_git_symlinks() -> Result<()> {
    let directory = tempfile::tempdir()?;
    commit_fixture(directory.path())?;
    std::os::unix::fs::symlink("/etc/passwd", directory.path().join("unsafe.txt"))?;
    assert!(
        Command::new("git")
            .arg("-C")
            .arg(directory.path())
            .args(["add", "."])
            .status()?
            .success()
    );
    assert!(
        Command::new("git")
            .arg("-C")
            .arg(directory.path())
            .args([
                "-c",
                "user.name=Test",
                "-c",
                "user.email=test@example.com",
                "commit",
                "-qm",
                "Symlink"
            ])
            .status()?
            .success()
    );
    let hash = git::commits(directory.path(), 1, 1)?[0].hash.clone();
    let snapshot = directory.path().join("snapshot");
    git::export_snapshot(directory.path(), &hash, &snapshot)?;
    assert!(!snapshot.join("unsafe.txt").exists());
    Ok(())
}

#[test]
fn missing_key_cannot_silently_replace_existing_encryption() -> Result<()> {
    let dir = tempfile::tempdir()?;
    let store = Store::open(dir.path())?;
    store.save_token("retained-test-token")?;
    drop(store);
    let original = fs::read(dir.path().join("gitnexus.db"))?;
    fs::remove_file(dir.path().join("secret.key"))?;
    assert!(Store::open(dir.path()).is_err());
    assert!(!dir.path().join("secret.key").exists());
    assert_eq!(fs::read(dir.path().join("gitnexus.db"))?, original);
    Ok(())
}

#[test]
fn replay_head_conflicting_ports_and_slow_client_shutdown() -> Result<()> {
    let dir = tempfile::tempdir()?;
    let source = dir.path().join("repo");
    fs::create_dir(&source)?;
    commit_fixture(&source)?;
    let store = Store::open(dir.path().join("data"))?;
    let repo = store.add_repository(&source)?;
    let hash = git::commits(&source, 1, 1)?[0].hash.clone();
    let mut replay = Replay::new(dir.path().join("snapshots"))?;
    assert!(replay.start(&repo, &hash, Some(80)).is_err());
    let info = replay.start(&repo, &hash, None)?;
    let client = reqwest::blocking::Client::builder()
        .no_proxy()
        .timeout(Duration::from_secs(2))
        .build()?;
    let head = client.head(&info.url).send()?;
    assert_eq!(head.headers()["content-length"], "22");
    assert_eq!(head.bytes()?.len(), 0);
    // A connected client that never sends a request must not prevent shutdown.
    let _slow = std::net::TcpStream::connect(("127.0.0.1", info.port))?;
    let start = std::time::Instant::now();
    replay.stop_all()?;
    assert!(start.elapsed() < Duration::from_secs(1));
    assert_eq!(replay.list()[0].status, "stopped");
    // A port occupied by an unrelated listener fails without leaking a snapshot.
    let occupied = std::net::TcpListener::bind("127.0.0.1:0")?;
    assert!(
        replay
            .start(&repo, &hash, Some(occupied.local_addr()?.port()))
            .is_err()
    );
    assert_eq!(fs::read_dir(dir.path().join("snapshots"))?.count(), 0);
    Ok(())
}

#[test]
fn empty_local_repository_and_live_commit_pagination() -> Result<()> {
    let dir = tempfile::tempdir()?;
    assert!(
        Command::new("git")
            .arg("-C")
            .arg(dir.path())
            .args(["init", "-q"])
            .status()?
            .success()
    );
    assert!(git::commits(dir.path(), 1, 2)?.is_empty());
    assert_eq!(git::total_commits(dir.path())?, 0);
    commit_fixture(dir.path())?;
    fs::write(dir.path().join("index.html"), "<h1>Second</h1>")?;
    assert!(
        Command::new("git")
            .arg("-C")
            .arg(dir.path())
            .args(["add", "."])
            .status()?
            .success()
    );
    assert!(
        Command::new("git")
            .arg("-C")
            .arg(dir.path())
            .args([
                "-c",
                "user.name=Test",
                "-c",
                "user.email=test@example.com",
                "commit",
                "-qm",
                "Second version"
            ])
            .status()?
            .success()
    );
    assert_eq!(git::commits(dir.path(), 1, 1)?[0].message, "Second version");
    assert_eq!(git::commits(dir.path(), 2, 1)?[0].message, "First version");
    assert!(git::commits(dir.path(), 3, 1)?.is_empty());
    assert_eq!(git::total_commits(dir.path())?, 2);
    Ok(())
}
