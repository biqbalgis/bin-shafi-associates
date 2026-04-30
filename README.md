# Aviation Fuel Management System

Production-oriented full-stack application for aviation fuel order workflow, approvals, and financial closure.

## Stack

- Frontend: React + TypeScript + Vite + Material UI
- Backend: Django + Django REST Framework
- Database: PostgreSQL
- Auth: JWT with role-based access control

## Project Structure

- `backend/`: Django project, modular apps, migrations, PostgreSQL schema notes
- `frontend/`: Vite React dashboard with Material UI and Axios integration

## Backend Setup

1. Open `aviation_fuel_system/backend/`.
2. Create a virtual environment:
   - Windows PowerShell: `python -m venv .venv`
3. Activate it:
   - Windows PowerShell: `.venv\Scripts\Activate.ps1`
4. Install dependencies:
   - `pip install -r requirements.txt`
5. Copy env values:
   - `Copy-Item .env.example .env`
6. Update `.env` with PostgreSQL credentials and secret key.
7. Run migrations:
   - `python manage.py migrate`
8. Create an admin user:
   - `python manage.py createsuperuser`
9. Ensure the admin user has `role=ADMIN`.
   - Example:
   - `python manage.py shell`
   - `from django.contrib.auth import get_user_model`
   - `User = get_user_model()`
   - `user = User.objects.get(username="your-admin")`
   - `user.role = "ADMIN"`
   - `user.save()`
10. Start the API:
   - `python manage.py runserver`

## Frontend Setup

1. Open `aviation_fuel_system/frontend/`.
2. Copy frontend env values:
   - `Copy-Item .env.example .env`
3. Install packages:
   - `npm install`
4. Start the frontend:
   - `npm run dev`
5. Production build:
   - `npm run build`

## Local Verification Used Here

- Backend syntax compiled successfully.
- Backend migrations were generated and applied successfully under a local SQLite override for verification.
- Frontend production build completed successfully with Vite.

## Production Deployment

This repo includes a separate production stack for a single-domain deployment with Docker, PostgreSQL, Nginx, and Let's Encrypt SSL.

Relevant files:

- `docker-compose.production.yml`
- `.env.production.example`
- `backend/.env.production.example`
- `deploy/nginx/init.conf.template`
- `deploy/nginx/prod.conf.template`
- `scripts/deploy-production.sh`

Expected server layout:

- `/home/binshafi/`
- `/home/binshafi/backend`
- `/home/binshafi/frontend`

Basic production flow:

1. Point your DNS `A` record for the subdomain to the server IP.
2. Clone the repo into `/home/binshafi`.
3. Copy `.env.production.example` to `.env.production`.
4. Copy `backend/.env.production.example` to `backend/.env.production`.
5. Set the production domain, Let's Encrypt email, Django secret, PostgreSQL credentials, and SMTP credentials.
6. Run:
   - `chmod +x scripts/deploy-production.sh`
   - `./scripts/deploy-production.sh`

What the production stack does:

- `db`: PostgreSQL 16 with a persistent Docker volume
- `backend`: Django + Gunicorn, with migrations and static collection at container startup
- `frontend`: built Vite app served from Nginx inside the frontend container
- `nginx`: public reverse proxy for `/`, `/api/`, `/admin/`, and `/static/`
- `certbot`: Let's Encrypt certificate issuance using the webroot method

## API Summary

- Auth:
  - `POST /api/auth/login/`
  - `POST /api/auth/register/`
  - `GET /api/auth/me/`
- Master data:
  - `GET /api/clients/`
  - `GET /api/aircrafts/`
  - `GET /api/airports/`
  - `GET /api/fuel-types/`
  - `GET /api/fuel-categories/`
- Orders:
  - `GET /api/orders/`
  - `POST /api/orders/`
  - `GET /api/orders/:id/`
  - `PATCH /api/orders/:id/`
  - `DELETE /api/orders/:id/`
- Financials:
  - `GET /api/financials/`
  - `POST /api/financials/`
  - `PATCH /api/financials/:id/`

## Roles

- `CUSTOMER`: create orders and view own client orders
- `MANAGER`: view all orders and update status
- `ADMIN`: full access including master data and financials

## Notes

- PostgreSQL schema reference: `backend/docs/postgresql_schema.sql`
- Customer registration is intentionally limited to `CUSTOMER` accounts linked to an existing client.
- Financial records auto-calculate profit and advance order status from `APPROVED` to `COMPLETED` when required fields are present.
