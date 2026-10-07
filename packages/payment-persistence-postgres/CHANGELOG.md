# Changelog - @amirhossein-moloki/payment-persistence-postgres

All notable changes to `@amirhossein-moloki/payment-persistence-postgres` will be documented in this file.

## [1.0.0] - initial release

### Added

- PostgreSQL repository implementations for `Payment`, `Transaction`, `IdempotencyRecord`, and `WebhookEvent`.
- Database schema migration runner (`DatabaseMigrator`).
- Optimistic concurrency control (`version` tracking) and normalized database error mappers.
