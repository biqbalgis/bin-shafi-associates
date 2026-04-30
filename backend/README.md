# Aviation Fuel Backend

This Django backend exposes JWT-protected APIs for aviation fuel order management, dropdown/reference data, and admin-only financial processing.

## Apps

- `users`: custom user model, JWT login, registration, role permissions
- `clients`: customer organizations
- `aircrafts`: aircraft catalog linked to clients
- `orders`: airports, fuel reference tables, orders, audit logs
- `financials`: one-to-one financial records and profit calculation

## Key behaviors

- Customer users can register only as `CUSTOMER` and must belong to an existing client.
- Customer orders are always created with `PENDING` status.
- Managers can view all orders and update status only.
- Admins have full API access, including financials and master data CRUD.
- Creating or updating financials auto-calculates `profit`.
- Financial workflow advances an order to `APPROVED` or `COMPLETED`.
- Order creation can send a notification email to fixed recipients configured with `ORDER_NOTIFICATION_TO` and optional `ORDER_NOTIFICATION_CC`.

## Email configuration

Configure SMTP plus the fixed notification recipients in the backend environment:

- `EMAIL_BACKEND`
- `EMAIL_HOST`
- `EMAIL_PORT`
- `EMAIL_HOST_USER`
- `EMAIL_HOST_PASSWORD`
- `EMAIL_USE_TLS`
- `EMAIL_USE_SSL`
- `DEFAULT_FROM_EMAIL`
- `ORDER_NOTIFICATION_TO`
- `ORDER_NOTIFICATION_CC`
