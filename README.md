# Global Review Rotator v3.3 — Production Safe

Routes:

- `/` — operator selector
- `/worker/operator1` to `/worker/operator4` — open work dashboards, no password
- `/analytics/operator1` to `/analytics/operator4` — operator analytics, password protected
- `/admin` — admin dashboard, password protected

v3.3 production-safety updates:

- Excel upload replaces only the active pool.
- Completed job history is preserved across Excel uploads.
- Every completed job stores full values: operator, original link, submitted link, text, business tab/source sheet, data version, date/time.
- Upload archive with version number, version name, link/text counts, and imported sheets.
- Lifetime completed jobs counter.
- Reset Active Pool keeps history.
- Reset Everything deletes history and upload archive.
- Admin export includes data version and upload archive.

Render settings:

Build Command:
```bash
npm install
```

Start Command:
```bash
npm start
```

Environment Variables:
```bash
ADMIN_PASSWORD=your-admin-password
OPERATOR1_PASSWORD=operator1-password
OPERATOR2_PASSWORD=operator2-password
OPERATOR3_PASSWORD=operator3-password
OPERATOR4_PASSWORD=operator4-password
DATA_DIR=/opt/render/project/src/data
```

Persistent Disk:
```text
Mount Path: /opt/render/project/src/data
Size: 1 GB
```

Excel format:

- `Texts` sheet = text suggestions in column A
- Every other sheet = link tab/business tab, links in column A

The system keeps distribution fair across link tabs by selecting tabs with the lowest completion count first, then randomly choosing a link inside that tab.

## v3.4 Date Search Update

Admin and Operator Analytics dashboards now start with the current week, Sunday to Saturday. Use the calendar fields or quick filters to search any date range. Exports follow the selected date range.

Back buttons are included on the main dashboards for easier navigation on mobile and desktop.


## Admin Notes in Completed History

The Admin dashboard now includes an Admin Notes column in the Completed History table. Notes are saved per history row, persist across uploads/redeploys when using the Render Persistent Disk, and are included in Excel exports.


## v3.7 Editable Submitted Links
- Admin Completed History: Submitted Link and Admin Notes are editable.
- Operator Analytics: My Completed History Submitted Link is editable.
- Use Save All Changes to save all row edits at once.


## v3.8 Locked History Edits

Admin and operator history tables now support Edit + Save for submitted links. Admin notes use the same pattern. Saved submitted links become clickable, rows lock after saving, and the browser warns about unsaved changes.

## v3.9 Admin Completed History Table

The Admin Completed History table now has a compact layout, sticky header, better mobile scrolling, and Excel-style resizable columns. Drag the right edge of a column header to resize it. Column widths are saved in the browser on that device.


v3.10: Admin Completed History table cleanup: combined date/time into one column, removed Version column from the visible admin table, made Business Tab column smaller, and kept resizable columns.


v3.12: Admin Completed History columns tightened. Link/text/note cells now default to narrow one-line previews, keep double-click full view, and column resize handles remain on the header. Browser column widths reset with a new v3.12 storage key.

## v3.13 Compact History Column Fix
- Completed History columns now use fixed compact defaults.
- Long Original Link / Submitted Link values are clipped with ellipsis and no longer widen the table.
- Resizing still works by dragging column edges in the header.
- Double-click clipped cells to view full content.

## v3.14 Completed History hard column fix
- Forces compact fixed columns in Admin Completed History.
- Uses a new saved-width key so old wide column settings do not carry over.
- Adds Reset Column Sizes button in Admin history tip line.

## v3.16 Dashboard Cleanup + Weekly Goals

- Admin and Operator Analytics dashboards now show Completed History above Recent Activity.
- Date Search quick buttons were simplified to This Week, Today, and Last 7 Days. Full calendar date search still works for any date range.
- Performance charts/summary sections are combined into a cleaner Performance Overview section.
- Weekly Goals were added for Operator 1–4. Admin can edit goals from the Admin Dashboard; operators can only view their own weekly goal.

## v3.16.1 Admin Completed History Fix
- Admin Completed History now has compact one-line rows.
- Admin can select history rows and move them to Trash.
- Deleted rows are excluded from history/statistics/export and can be restored from Admin Trash.
- Worker dashboards and Operator Analytics dashboards were not changed.


## v3.16.5
- Improved Performance Overview chart styling on Admin and Operator Analytics.
- Operator Leaderboard is sorted by completed count in the selected date range.
- Operator Analytics My Completed History rows are compact one-line rows with double-click full view.
