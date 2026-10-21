# GitNexus - Tasks

**Version:** 0.2.6 | **Last Updated:** 2026-10-21

This backlog records remaining native application work. It is not a claim of complete UI or platform validation.

## Accessibility and keyboard use

- Expose named controls and content through Windows accessibility APIs. Current inspection exposes the window controls but not the application interface.
- Complete keyboard activation for custom controls, modal focus trapping, initial focus and focus restoration.
- Verify labels, focus visibility, keyboard order and screen-reader feedback on every screen.

## Interface and workflows

- Finish responsive layout and visual checks for both themes, small windows and display scaling.
- Finish Discovery contribution states, search and filtering edge cases, and long-content layouts.
- Refine release-history layout, loading feedback, failed downloads and file-dialog behavior.
- Keep add/clone dialogs open through submission and show errors in context.
- Finish Settings token-source badges, quota reset details, download-path synchronization and structured live logs.
- Verify Replay history loading, filtered empty states, file sizes, server errors and controls across rapid navigation.

## Platform and packaging verification

- Exercise installer upgrades, running-app rejection and missing-runtime messaging on a disposable Windows account. Basic installation, shortcuts and retained-data uninstall have passed local checks.
- Check native Wayland and macOS builds and workflows.
- Record remaining slow-network, empty-state and error-path manual checks.
