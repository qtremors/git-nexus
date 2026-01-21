use super::*;
impl Nexus {
    pub(super) fn repository_detail(&self, _: &GitHubRepo, _: &mut Window, cx: &mut Context<Self>) -> AnyElement { card(cx).child("This feature is not available in this version.").into_any_element() }
    pub(super) fn repository_commit_dialog(&self, _: &serde_json::Value, _: &mut Window, cx: &mut Context<Self>) -> Div { card(cx).child("This feature is not available in this version.") }
}
