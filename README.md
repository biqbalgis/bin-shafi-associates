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
