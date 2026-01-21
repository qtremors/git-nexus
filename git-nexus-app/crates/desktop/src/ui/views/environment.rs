use super::*;
impl Nexus {
    pub(super) fn add_env_row(
        &mut self,
        key: String,
        value: String,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        let key_state = input(window, cx, "KEY", false, false);
        let value_state = input(window, cx, "Value", !self.show_env, false);
        key_state.update(cx, |state, cx| state.set_value(key, window, cx));
        value_state.update(cx, |state, cx| state.set_value(value, window, cx));
        for field in [&key_state, &value_state] {
            cx.subscribe(field, |view, _, event, cx| {
                if matches!(event, InputEvent::Change) {
                    view.env_dirty = true;
                    view.env_revision += 1;
                    cx.notify();
                }
            })
            .detach();
        }
        self.next_env_row += 1;
        self.env_rows
            .push((self.next_env_row, key_state, value_state));
    }
    pub(super) fn close_environment(&mut self, cx: &mut Context<Self>) {
        self.env_scope = None;
        self.env_rows.clear();
        self.show_env = false;
        self.env_dirty = false;
        cx.notify();
    }
    pub(super) fn environment_dialog(&self, _: &str, _: i64, _: &str, cx: &mut Context<Self>) -> Div { card(cx).child("This feature is not available in this version.") }
}
