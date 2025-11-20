use crate::models::{Commit, FileEntry};
use anyhow::{Context, Result, ensure};
use std::{
    fs,
    path::{Component, Path, PathBuf},
    process::Command,
};

fn run(path: &Path, args: &[&str]) -> Result<Vec<u8>> {
    let output = Command::new("git")
        .arg("-C")
        .arg(path)
        .args(args)
        .output()
        .context("Git is required; install it and ensure it is on PATH")?;
    ensure!(
        output.status.success(),
        "Git operation failed: {}",
        String::from_utf8_lossy(&output.stderr).trim()
    );
    Ok(output.stdout)
}

pub fn repository_root(path: &Path) -> Result<PathBuf> {
    let result = run(path, &["rev-parse", "--show-toplevel"])?;
    Ok(PathBuf::from(String::from_utf8(result)?.trim()).canonicalize()?)
}

pub fn validate_hash(hash: &str) -> Result<()> {
    ensure!(
        (7..=64).contains(&hash.len()) && hash.bytes().all(|c| c.is_ascii_hexdigit()),
        "Invalid commit hash"
    );
    Ok(())
}

pub fn resolve_commit(path: &Path, hash: &str) -> Result<String> {
    validate_hash(hash)?;
    let output = run(
        path,
        &["rev-parse", "--verify", &format!("{hash}^{{commit}}")],
    )?;
    Ok(String::from_utf8(output)?.trim().into())
}

pub fn total_commits(path: &Path) -> Result<usize> {
    if commits(path, 1, 1)?.is_empty() {
        return Ok(0);
    }
    let output = run(path, &["rev-list", "--count", "HEAD"])?;
    String::from_utf8(output)?
        .trim()
        .parse()
        .context("Invalid Git commit count")
}

pub fn commits(path: &Path, page: usize, page_size: usize) -> Result<Vec<Commit>> {
    ensure!(
        page > 0 && (1..=200).contains(&page_size),
        "Invalid commit pagination"
    );
    let head = Command::new("git")
        .arg("-C")
        .arg(path)
        .args(["rev-parse", "--verify", "--quiet", "HEAD"])
        .output()?;
    if !head.status.success() {
        let branch = run(path, &["symbolic-ref", "--quiet", "HEAD"])?;
        let branch = String::from_utf8(branch)?;
        let reference = Command::new("git")
            .arg("-C")
            .arg(path)
            .args(["show-ref", "--verify", "--quiet", branch.trim()])
            .status()?;
        ensure!(
            reference.code() == Some(1),
            "Cannot resolve repository HEAD"
        );
        return Ok(Vec::new());
    }
    let skip = (page - 1)
        .checked_mul(page_size)
        .context("Commit page is too large")?;
    let output = run(
        path,
        &[
            "log",
            "--format=%H%x00%h%x00%s%x00%an%x00%cI%x00",
            &format!("--max-count={page_size}"),
            &format!("--skip={skip}"),
        ],
    )?;
    let text = String::from_utf8(output)?;
    let fields: Vec<&str> = text.split('\0').collect();
    let mut result = Vec::new();
    for chunk in fields.chunks(5) {
        if chunk.len() < 5 {
            break;
        }
        result.push(Commit {
            hash: chunk[0].trim_start_matches('\n').into(),
            short_hash: chunk[1].into(),
            message: chunk[2].into(),
            author: chunk[3].into(),
            date: chunk[4].into(),
        });
    }
    Ok(result)
}

pub fn files(path: &Path, hash: &str) -> Result<Vec<String>> {
    Ok(file_entries(path, hash)?
        .into_iter()
        .map(|entry| entry.path)
        .collect())
}

pub fn file_entries(path: &Path, hash: &str) -> Result<Vec<FileEntry>> {
    let hash = resolve_commit(path, hash)?;
    let output = run(path, &["ls-tree", "-rzl", &hash])?;
    output
        .split(|c| *c == 0)
        .filter(|v| !v.is_empty())
        .map(|entry| {
            let entry = std::str::from_utf8(entry).context("Git file path is not UTF-8")?;
            let (metadata, path) = entry.split_once('\t').context("Invalid Git tree entry")?;
            let size = metadata
                .split_whitespace()
                .nth(3)
                .context("Missing Git blob size")?;
            Ok(FileEntry {
                path: path.into(),
                size: if size == "-" { 0 } else { size.parse()? },
            })
        })
        .collect()
}

pub fn validate_relative(path: &str) -> Result<()> {
    ensure!(
        !path.is_empty()
            && !path.contains('\\')
            && !path.contains('\0')
            && Path::new(path)
                .components()
                .all(|c| matches!(c, Component::Normal(_))),
        "Invalid relative file path"
    );
    Ok(())
}

pub fn file_content(path: &Path, hash: &str, file: &str) -> Result<String> {
    validate_relative(file)?;
    let hash = resolve_commit(path, hash)?;
    let object = format!("{hash}:{file}");
    let size = String::from_utf8(run(path, &["cat-file", "-s", &object])?)?
        .trim()
        .parse::<u64>()?;
    ensure!(
        size <= 2 * 1024 * 1024,
        "File exceeds the 2 MiB text viewer limit"
    );
    let output = run(path, &["show", &object])?;
    ensure!(
        output.len() <= 2 * 1024 * 1024,
        "File exceeds the 2 MiB text viewer limit"
    );
    ensure!(
        !output.contains(&0),
        "Binary files cannot be displayed as text"
    );
    String::from_utf8(output).context("File is not UTF-8 text")
}

pub fn clone_repository(identity: &str, destination: &Path) -> Result<PathBuf> {
    let (owner, name) = crate::github::parse_identity(identity)?;
    let url = format!("https://github.com/{owner}/{name}.git");
    let output = Command::new("git")
        .args(["clone", "--", &url])
        .arg(destination)
        .output()?;
    // Avoid echoing stderr: authentication helpers can include credential material.
    ensure!(
        output.status.success(),
        "Git clone failed; check destination, network access, and platform authentication"
    );
    repository_root(destination)
}

/// Export regular Git blobs, without modifying the source checkout or following symlinks.
pub fn export_snapshot(path: &Path, hash: &str, destination: &Path) -> Result<()> {
    let hash = resolve_commit(path, hash)?;
    fs::create_dir(destination).context("Snapshot destination must not exist")?;
    let result = (|| -> Result<()> {
        let entries = run(path, &["ls-tree", "-rz", "--full-tree", &hash])?;
        for entry in entries.split(|c| *c == 0).filter(|v| !v.is_empty()) {
            let entry = std::str::from_utf8(entry)?;
            let (meta, file) = entry.split_once('\t').context("Invalid Git tree entry")?;
            let parts: Vec<_> = meta.split_whitespace().collect();
            if parts.len() != 3 || parts[1] != "blob" || !matches!(parts[0], "100644" | "100755") {
                continue;
            }
            validate_relative(file)?;
            let target = destination.join(file);
            fs::create_dir_all(target.parent().context("Invalid snapshot file path")?)?;
            fs::write(target, run(path, &["cat-file", "blob", parts[2]])?)?;
        }
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_dir_all(destination);
    }
    result
}
