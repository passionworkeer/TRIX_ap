# TRIX Web MySQL

This folder contains the MySQL 8 schema used by the Web-only assignment version.

Files:
- `schema.sql`: full schema, views, and indexes
- `seed.sql`: classroom demo data

Apply order:
1. Create/import `schema.sql`
2. Run `seed.sql`

Environment variables for `packages/trix-web-api`:
- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`

The backend also supports:
- `PORT` or `TRIX_WEB_API_PORT`
- `JWT_SECRET`
- `JWT_EXPIRES_SECONDS`
