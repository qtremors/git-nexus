use anyhow::{Context, Result, ensure};
use url::Url;
pub const COMMIT_PAGE_SIZE: usize = 100;

pub fn validate_identity(owner: &str, name: &str) -> Result<()> {
    for value in [owner, name] {
        ensure!(
            !value.is_empty()
                && value.len() <= 100
                && value
                    .bytes()
                    .all(|c| c.is_ascii_alphanumeric() || b"._-".contains(&c))
                && value != "."
                && value != "..",
            "Invalid GitHub owner or repository name"
        );
    }
    Ok(())
}

pub fn parse_identity(input: &str) -> Result<(String, String)> {
    let input = input.trim();
    let identity = if input.contains("://") {
        let url = Url::parse(input)?;
        ensure!(
            url.scheme() == "https"
                && url.host_str() == Some("github.com")
                && url.username().is_empty()
                && url.password().is_none()
                && url.port().is_none(),
            "Expected an HTTPS github.com repository URL"
        );
        ensure!(
            url.query().is_none() && url.fragment().is_none(),
            "Repository URLs cannot contain queries or fragments"
        );
        url.path().trim_matches('/').to_string()
    } else {
        input.to_string()
    };
    let (owner, name) = identity
        .split_once('/')
        .context("Use owner/repository or a GitHub repository URL")?;
    let name = name.strip_suffix(".git").unwrap_or(name);
    validate_identity(owner, name)?;
    Ok((owner.to_string(), name.to_string()))
}

pub fn validate_download_url(input: &str) -> Result<()> {
    let url = Url::parse(input)?;
    ensure!(
        url.scheme() == "https"
            && url.username().is_empty()
            && url.password().is_none()
            && url.port().is_none(),
        "Only standard HTTPS downloads are supported"
    );
    ensure!(
        matches!(
            url.host_str(),
            Some(
                "github.com"
                    | "api.github.com"
                    | "raw.githubusercontent.com"
                    | "codeload.github.com"
                    | "objects.githubusercontent.com"
                    | "github-releases.githubusercontent.com"
                    | "release-assets.githubusercontent.com"
            )
        ),
        "Download destination is not a trusted GitHub host"
    );
    Ok(())
}

pub fn sanitize_filename(input: &str) -> String {
    let value: String = input
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || "._- ".contains(*c))
        .collect();
    let value = value.trim_matches(['.', ' ']);
    if value.is_empty() {
        "download".into()
    } else {
        value.to_string()
    }
}

