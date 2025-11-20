fn main() -> anyhow::Result<()> {
    let path = std::env::args().nth(1).unwrap_or_else(|| ".".into());
    let root = git_nexus_core::git::repository_root(std::path::Path::new(&path))?;
    println!("{} commits in {}", git_nexus_core::git::total_commits(&root)?, root.display());
    Ok(())
}
