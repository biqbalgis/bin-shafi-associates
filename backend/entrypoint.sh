#!/bin/sh
set -e

echo "Waiting for PostgreSQL to be ready..."
until python -c "
import os, sys
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from django.db import connection
connection.ensure_connection()
print('PostgreSQL is ready!')
" 2>/dev/null; do
  echo "PostgreSQL not ready yet, retrying in 2s..."
  sleep 2
done

echo "Running migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Starting Gunicorn on port 8085..."
exec gunicorn config.wsgi:application \
  --bind 0.0.0.0:8085 \
  --workers 3 \
  --timeout 120 \
  --access-logfile - \
  --error-logfile -
