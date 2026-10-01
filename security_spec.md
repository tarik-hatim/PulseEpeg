# PulseEPG Security Specification (`security_spec.md`)

## 1. Access Control Matrix & Collections

| Collection Path | Document ID | Visibility | Allowed Operations |
| :--- | :--- | :--- | :--- |
| `/users/{userId}` | `userId` (`request.auth.uid`) | Private (Owner-only, PII) | `get`, `create`, `update`, `delete` by verified owner (`list` denied) |
| `/user_settings/{userId}` | `userId` (`request.auth.uid`) | Private (Owner-only preferences) | `get`, `create`, `update`, `delete` by verified owner (`list` denied) |

## 2. Eight Pillars Enforcement
1. **Master Gate**: Root-level owner-isolated collections `/users/{userId}` and `/user_settings/{userId}`. Arrays (`selected_bouquets` <= 25, `favorite_channels` <= 200) are strictly bounded.
2. **Validation Blueprints**:
   - `isValidUserProfile(data, userId)` validates all keys, types, lengths, and plan/premium consistency.
   - `isValidUserSettings(data, userId)` validates `user_id`, `selected_bouquets`, `favorite_channels`, `is_premium`, `created_at`, `updated_at`, and enforces the Freemium/Premium invariant:
     - When `is_premium == false`: `selected_bouquets.size() >= 1 && selected_bouquets.size() <= 3`
     - When `is_premium == true`: `selected_bouquets.size() >= 1 && selected_bouquets.size() <= 25`
     - `favorite_channels.size() <= 200`
3. **Path Variable Hardening**: `isValidId(userId)` (`^[a-zA-Z0-9_\-]+$`, 1..128 chars) on `get`, `create`, `update`, `delete`.
4. **State Machine & Temporal Integrity**: `createdAt`/`created_at == request.time` on create and immutable on update; `updatedAt`/`updated_at == request.time` on create and update; `uid`/`user_id` immutable on update.
5. **Micro-segmented Updates**: `incoming().diff(existing()).affectedKeys().hasOnly(...)` combined with `isValidUserProfile` / `isValidUserSettings`.
6. **Query Alignment**: `allow list: if false;` on both collections to prevent user enumeration.
7. **Defensive Nullability**: `request.auth != null && request.auth.token.email_verified == true`.
8. **Global Safety Net**: Default deny `match /{document=**} { allow read, write: if false; }`.

## 3. Red Team Audit Conflict Report
- **Identity Spoofing**: Blocked (`data.uid == request.auth.uid` and `data.user_id == request.auth.uid && userId == request.auth.uid`).
- **Freemium Bypass Attempt**: Blocked (`(data.is_premium == false && data.selected_bouquets.size() <= 3) || (data.is_premium == true && data.selected_bouquets.size() <= 25)`).
- **Resource Poisoning**: Blocked (`isValidId(userId)`, `selected_bouquets.size() <= 25`, `favorite_channels.size() <= 200`).
- **Value Poisoning on Update**: Blocked (`isValidUserProfile` and `isValidUserSettings` are called inside `allow update`).
