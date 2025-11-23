use anyhow::{Context, Result, bail};
fn main() -> Result<()> {
    let mut args = std::env::args().skip(1);
    let mut data = None;
    let mut repository = None;
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--data-dir" => data = Some(std::path::PathBuf::from(args.next().context("Missing data directory")?)),
            "--add-repo" => repository = Some(std::path::PathBuf::from(args.next().context("Missing repository path")?)),
            "--check" => {},
            "--help" | "-h" => { println!("GitNexus: --data-dir PATH --check"); return Ok(()); },
            _ => bail!("Unknown argument: {arg}"),
        }
    }
    let store = git_nexus_core::Store::open(data.unwrap_or(git_nexus_core::Store::default_directory()?))?;
    let _ = repository;
    
    println!("GitNexus {} storage check passed", env!("CARGO_PKG_VERSION"));
    Ok(())
}
