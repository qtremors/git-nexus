This is xattr 0.2.3 from crates.io, retained under its MIT and Apache-2.0
licenses. GPUI 0.2.2 depends on it through gpui_util and zed-async-tar.

The only source change maps the missing-attribute error to libc::ENODATA on
Linux and Android. Recent libc releases removed their deprecated ENOATTR
alias on these platforms. Other platforms retain the upstream mapping.

Remove this patch when the GPUI dependency chain upgrades xattr.
