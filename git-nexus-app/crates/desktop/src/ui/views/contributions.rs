use super::*;
impl Nexus {
    pub(super) fn contribution_graph(&self, cx: &mut Context<Self>) -> AnyElement { card(cx).child("This feature is not available in this version.").into_any_element() }
    pub(super) fn contribution_day(&self, _: &str, cx: &mut Context<Self>) -> Div { card(cx).child("This feature is not available in this version.") }
}
