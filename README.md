# 🐝 WorkHive Workspace Collaboration Platform

Welcome to the **WorkHive Monorepo**. This repository houses both the frontend client and the backend API service for the WorkHive application.

```
├── WorkHive-Backend/   # FastAPI (Python) backend service
└── WorkHive-Frontend/  # React (Vite) frontend application
```

---

# 🚀 Production Deployment Guide (Step-by-Step)

This guide provides a comprehensive walkthrough to deploy the database, backend service, and frontend client to production.

---

## 📂 Phase 1: Deploying the MySQL Database

WorkHive requires a **MySQL** database. You can host a free/managed MySQL database using cloud providers such as **Aiven**, **Clever Cloud**, or any managed MySQL instance.

### Aiven MySQL Hosting (Recommended)
1. Sign up for a free account at [Aiven.io](https://aiven.io/).
2. Create a new service and select **MySQL**.
3. Choose a cloud provider (e.g., AWS or GCP) and a region closest to your users.
4. Select the free tier or a standard plan, then click **Create Service**.
5. Once running, copy the **Service URI** (connection string) from the Aiven dashboard.
   * Connection String format: `mysql+pymysql://<user>:<password>@<host>:<port>/<defaultdb>?ssl-mode=REQUIRED`
   * *Note: Ensure your URI uses the `mysql+pymysql://` driver schema so SQLAlchemy can parse it correctly.*

---

## 📂 Phase 2: Deploying the Backend API (Render)

We deploy the Python FastAPI backend to [Render.com](https://render.com) as a Web Service.

### Step-by-Step Settings:
1. Log in to your Render dashboard and click **New +** > **Web Service**.
2. Connect your GitHub repository.
3. Configure the following service settings:
   * **Name**: `workhive-backend`
   * **Language**: `Python`
   * **Root Directory**: `WorkHive-Backend`
   * **Build Command**: `pip install -r requirements.txt && alembic upgrade head`
     > [!NOTE]
     > Appending `&& alembic upgrade head` to the build command automatically runs your database schema migrations on every deployment.
   * **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

4. Click **Advanced** and add the following **Environment Variables**:

| Key | Value | Notes |
| :--- | :--- | :--- |
| `DATABASE_URL` | *Your Aiven MySQL Service URI* | Replace driver prefix `mysql://` with `mysql+pymysql://` |
| `SECRET_KEY` | *Your secret token key* | Generate a secure random string (e.g. run `openssl rand -hex 32`) |
| `ALGORITHM` | `HS256` | JWT signing algorithm |
| `FRONTEND_URL` | *Your live Vercel URL* | Set to `https://<your-project>.vercel.app` (after Phase 4 is completed) |
| `GOOGLE_CLIENT_ID` | *Your Google OAuth Client ID* | Obtain from Google Cloud API credentials dashboard |
| `GOOGLE_CLIENT_SECRET` | *Your Google OAuth Client Secret* | Obtain from Google Cloud API credentials dashboard |
| `GOOGLE_REDIRECT_URI` | `https://<your-project>.vercel.app/auth/google/callback` | Must match authorized redirect URIs in Google Cloud Console |
| `SMTP_HOST` | *Optional SMTP host* | e.g. `smtp.gmail.com` if using email notifications |
| `SMTP_PORT` | `587` | Port for TLS encryption |
| `SMTP_USER` | *Your email address* | Username for mail authentication |
| `SMTP_PASSWORD` | *Your App Password* | Password/App Password for mail authentication |
| `SMTP_FROM` | `noreply@workhive.com` | Outgoing sender email address |

5. Click **Create Web Service**. Wait for the build and deployment process to finish. Once complete, copy the backend URL (e.g. `https://workhive-backend.onrender.com`).

---

## 📂 Phase 3: Seeding the Admin User

After the backend is deployed successfully and tables are created, you must seed a default Workspace Admin account to approve employee registration requests.

1. Go to your Render Web Service dashboard.
2. Select the **Shell** tab in the sidebar menu.
3. Run the following command inside the shell environment:
   ```bash
   python seed_admin.py
   ```
4. Copy the output admin credentials (email and auto-generated temporary password) printed in the console.

---

## 📂 Phase 4: Deploying the Frontend Client (Vercel)

We deploy the React frontend client to [Vercel.com](https://vercel.com).

### Step-by-Step Settings:
1. Log in to your Vercel dashboard.
2. Click **Add New** > **Project** and select this repository.
3. In the project configuration:
   * **Framework Preset**: Select **Vite** (auto-detected).
   * **Root Directory**: Click *Edit* and select **`WorkHive-Frontend`**.
4. Expand **Environment Variables** and add:
   * `VITE_API_BASE`: Set to your live Render backend service URL (e.g. `https://workhive-backend.onrender.com`).
   * `VITE_GOOGLE_CLIENT_ID`: Your Google OAuth Client ID (must match the ID used in the backend).
5. Click **Deploy**.
6. Once deployed, note down your production Vercel URL (e.g. `https://workhive.vercel.app`).
7. **Important Follow-up**: Update the `FRONTEND_URL` and `GOOGLE_REDIRECT_URI` environment variables in your Render backend dashboard with your live Vercel URL to allow correct CORS access and OAuth callback handling.
