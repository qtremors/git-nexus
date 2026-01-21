use super::*;
impl Nexus {
    pub(super) fn watchlist(&self, _: &mut Window, cx: &mut Context<Self>) -> AnyElement { card(cx).child("This feature is not available in this version.").into_any_element() }
}
