# Security Specification — Ryan's Shoes Collection

## 1. Data Invariants
1. **Product Integrity**: Only verified store administrators (`isAdmin()`) may create, update, or delete `/products/{productId}`. Every product must have valid pricing (`price > 0`), bounded discount (`0 <= discountPercent <= 90`), non-negative stock (`stock >= 0`), and valid image/category strings within length bounds.
2. **Customer PII Isolation**: Customer documents at `/customers/{userId}` contain PII (`email`, `phone`, `address`) and may only be read by the owning authenticated user (`request.auth.uid == userId`) or an administrator. Self-registration strictly forces `role == 'customer'` and prevents privilege escalation.
3. **Order Integrity & Terminal State Lock**: Orders at `/orders/{orderId}` can only be created by verified authenticated users with `customerId == request.auth.uid`, initial `orderStatus == 'Pending'`, and `stockDeducted == false`. Once an order passes `'Pending'` (Confirmed/Processing/Shipped/Delivered/Cancelled), customers cannot alter it; only admins may transition order lifecycle states or verify payments. Orders are never deleted.
4. **Non-PII Tracking Lookup**: `/orderTracking/{trackingCode}` holds zero PII (no name, address, phone, or email) and prohibits collection listing (`allow list: if false`) to prevent enumeration.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Privilege Escalation on Signup**: `POST /customers/uid123` with `{ role: 'admin', ... }` -> MUST fail (`PERMISSION_DENIED`).
2. **Role Mutation on Profile Update**: `PATCH /customers/uid123` changing `{ role: 'admin' }` -> MUST fail (`PERMISSION_DENIED`).
3. **Unauthenticated Product Creation**: `POST /products/p1` with `auth: null` -> MUST fail (`PERMISSION_DENIED`).
4. **Customer Modifying Product Stock**: `PATCH /products/p1` by non-admin customer `{ stock: 999 }` -> MUST fail (`PERMISSION_DENIED`).
5. **Cross-User PII Read**: `GET /customers/victimUid` by `attackerUid` -> MUST fail (`PERMISSION_DENIED`).
6. **Cross-User Order Scraping (List)**: `LIST /orders` without owner filter by non-admin -> MUST fail (`PERMISSION_DENIED`).
7. **Order Identity Spoofing**: `POST /orders/o1` by `attackerUid` with `{ customerId: 'victimUid' }` -> MUST fail (`PERMISSION_DENIED`).
8. **Order Status Shortcut on Create**: `POST /orders/o1` by customer with `{ orderStatus: 'Delivered', paymentStatus: 'Verified & Paid' }` -> MUST fail (`PERMISSION_DENIED`).
9. **Shadow Field Injection**: `POST /orders/o1` with extra ghost field `{ isFreeVip: true }` -> MUST fail (`PERMISSION_DENIED`).
10. **ID Poisoning**: `POST /orders/<1500-char-junk>` -> MUST fail (`PERMISSION_DENIED`).
11. **Unverified Email Spoofing**: Request with `{ email: 'clonekey7@gmail.com', email_verified: false }` -> MUST fail (`PERMISSION_DENIED`).
12. **Customer Deleting Order**: `DELETE /orders/o1` by owner or admin -> MUST fail (`PERMISSION_DENIED`).
