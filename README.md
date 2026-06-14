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
