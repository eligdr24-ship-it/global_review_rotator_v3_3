# Fresh Setup Guide — GitHub + Render

1. Extract this ZIP.
2. Upload the extracted files to GitHub.
3. Your repo should show these at the top level:

```text
package.json
server.js
README.md
SETUP.md
data/
public/
```

4. In Render, create a **Web Service**.
5. Use:

```text
Build Command: npm install
Start Command: npm start
```

6. Add environment variables:

```text
ADMIN_PASSWORD=choose-your-admin-password
OPERATOR1_PASSWORD=choose-operator-1-password
OPERATOR2_PASSWORD=choose-operator-2-password
OPERATOR3_PASSWORD=choose-operator-3-password
OPERATOR4_PASSWORD=choose-operator-4-password
DATA_DIR=/opt/render/project/src/data
```

7. Add Persistent Disk:

```text
Mount Path: /opt/render/project/src/data
Size: 1 GB
```

8. Deploy with **Clear build cache & deploy**.

9. Test these pages:

```text
/
/worker/operator1
/worker/operator2
/worker/operator3
/worker/operator4
/analytics/operator1
/admin
```

The work dashboards are open/no-password for speed.
The analytics dashboards require the matching operator password.
The admin dashboard requires the admin password.
