use anyhow::{Context, Result, ensure};
use gpui::http_client::http::HeaderValue;
use gpui::http_client::{AsyncBody, HttpClient, Request, Response, Url};
use reqwest::blocking::Client;
use std::{future::Future, io::Read, pin::Pin, time::Duration};

/// Public images only: GitHub credentials are never attached to README media.
pub struct MediaClient(Client);
impl MediaClient {
    pub fn new() -> Result<Self> {
        Ok(Self(
            Client::builder()
                .timeout(Duration::from_secs(15))
                .redirect(reqwest::redirect::Policy::custom(|attempt| {
                    if attempt.previous().len() >= 5 || public_image_url(attempt.url()).is_err() {
                        attempt.error("Unsupported media redirect")
                    } else {
                        attempt.follow()
                    }
                }))
                .build()?,
        ))
    }
}
fn public_image_url(url: &Url) -> Result<()> {
    ensure!(
        url.scheme() == "https"
            && url.username().is_empty()
            && url.password().is_none()
            && url.port().is_none(),
        "Media requires standard HTTPS"
    );
    ensure!(
        url.host_str()
            .is_some_and(|host| host != "localhost" && host.parse::<std::net::IpAddr>().is_err()),
        "Media requires a public hostname"
    );
    Ok(())
}
impl HttpClient for MediaClient {
    fn type_name(&self) -> &'static str {
        "GitNexus public media"
    }
    fn user_agent(&self) -> Option<&HeaderValue> {
        None
    }
    fn proxy(&self) -> Option<&Url> {
        None
    }
    fn send(
        &self,
        request: Request<AsyncBody>,
    ) -> Pin<Box<dyn Future<Output = Result<Response<AsyncBody>>> + Send>> {
        let client = self.0.clone();
        let (sender, receiver) = futures::channel::oneshot::channel();
        std::thread::spawn(move || {
            let result = (|| -> Result<Response<AsyncBody>> {
                ensure!(request.method() == "GET", "Media supports GET only");
                let url = Url::parse(&request.uri().to_string())?;
                public_image_url(&url)?;
                let response = client
                    .get(url)
                    .header(
                        "User-Agent",
                        concat!("GitNexus/", env!("CARGO_PKG_VERSION"), " native"),
                    )
                    .send()?
                    .error_for_status()?;
                let mime = response.headers().get("content-type").cloned();
                let mut bytes = Vec::new();
                response.take(8 * 1024 * 1024 + 1).read_to_end(&mut bytes)?;
                ensure!(bytes.len() <= 8 * 1024 * 1024, "Media exceeds 8 MiB");
                let mut result = Response::builder().status(200);
                if let Some(mime) = mime {
                    result = result.header("content-type", mime);
                }
                Ok(result.body(bytes.into())?)
            })();
            let _ = sender.send(result);
        });
        Box::pin(async move { receiver.await.context("Media worker ended")? })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn image_fetching_rejects_non_https_and_local_targets() -> Result<()> {
        let client = MediaClient::new()?;
        for input in [
            "http://example.com/image.png",
            "https://127.0.0.1/image.png",
            "https://localhost/image.png",
            "https://user:password@example.com/image.png",
            "https://example.com:8443/image.png",
        ] {
            let request = Request::builder().uri(input).body(AsyncBody::from(()))?;
            assert!(futures::executor::block_on(client.send(request)).is_err());
        }
        assert!(
            public_image_url(&Url::parse("https://avatars.githubusercontent.com/u/1")?).is_ok()
        );
        Ok(())
    }
}
