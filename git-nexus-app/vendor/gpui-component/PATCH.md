This is gpui-component 0.5.1 from crates.io, retained under its Apache-2.0
license. The native app patches `src/text/node.rs` to give Markdown list/list-item
containers full width, prevent row shrinking, and let list text occupy the
remaining width beside the marker. Without these constraints, real Linux
captures showed narrow, overlapping bullet paragraphs.

The non-scrolling TextView containers in `src/text/text_view.rs` also use
automatic height instead of 100% height, keeping subsequent controls inside
their card. Scrolling text views retain their full-height behavior.

No parser or network behavior is changed. Remove this patch when an upstream
release fixes the list layout. Upstream tests and locales are retained.

The patch also fixes block spacing in non-scrolling Markdown:
root children now receive their own `is_last` flag, and block containers keep
their width and intrinsic height. `TextViewStyle` has an optional heading style
callback so the app can style article headings (size, spacing,
and dividers) without hardcoding app colors into the component renderer.
