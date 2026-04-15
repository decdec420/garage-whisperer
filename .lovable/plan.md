

# Audit: Step Photos System — Findings

## Current State: Not Implemented

The `project_steps` table has a `photo_urls` column (text array), and the `Camera` icon is imported in ProjectDetail.tsx — but **neither upload nor display is wired up**. Here's what's missing:

### What exists
- DB column `photo_urls` on `project_steps` — ready to store paths
- `repair-photos` storage bucket (private, RLS-enabled)
- `uploadFile()` and `getSignedUrl()` helpers in `src/lib/storage-helpers.ts`
- The `Camera` icon is imported but never rendered in step cards

### What's missing (the full gap list)

1. **No upload button on steps** — No camera/attach button inside expanded step cards. Users can't add photos to document their work.

2. **No photo display on steps** — Even if `photo_urls` were populated, there's no rendering logic. The column is completely ignored in the step UI.

3. **No signed URL resolution** — `repair-photos` is a private bucket. Photos need `getSignedUrl()` before display. No such logic exists for step photos (only chat has it).

4. **No image compression** — Chat in RatchetPanel resizes images before upload. Step photos would need the same treatment to avoid 10MB raw camera shots.

5. **No lightbox for user photos** — Factory photos get a lightbox via `FactoryPhotoLightbox`. User step photos have no viewer at all.

6. **No photo deletion** — No way to remove a bad photo from a step.

7. **MechanicMode is also blind** — The garage/hands-free mode (`MechanicMode.tsx`) has no photo capture either, despite being the most likely context for snapping photos mid-repair.

---

## Plan: Build Diamond-Tier Step Photos

### A. Upload mutation + compression
**File:** `src/pages/ProjectDetail.tsx`
- Add a `uploadStepPhoto` mutation that:
  1. Resizes the image (max 1920px, JPEG 0.85 quality — same as chat)
  2. Uploads to `repair-photos` bucket at `{userId}/steps/{stepId}/{timestamp}.jpg`
  3. Appends the storage path to `photo_urls` array on the step row
- Add hidden `<input type="file" accept="image/*" capture="environment">` ref

### B. Camera button in step cards
**File:** `src/pages/ProjectDetail.tsx`
- Add a 📷 button in the expanded step area (between sub-steps and the tip section)
- On mobile: opens camera directly. On desktop: file picker.
- Shows upload spinner during upload
- Disabled when step is already done (read-only)

### C. Photo thumbnails + lightbox
**File:** `src/pages/ProjectDetail.tsx`
- Below the camera button, render a horizontal thumbnail strip of uploaded photos (similar to factory diagrams gallery)
- Each thumbnail is clickable → opens in `FactoryPhotoLightbox` (rename/generalize to `PhotoLightbox` or reuse as-is with user photos)
- Photos resolve via `getSignedUrl('repair-photos', path)` with a React Query cache

### D. Photo deletion
- Long-press (mobile) or X overlay (desktop) on thumbnails to delete
- Mutation removes path from `photo_urls` array and deletes from storage bucket

### E. MechanicMode photo capture
**File:** `src/components/vehicle/MechanicMode.tsx`
- Add a camera button to the mechanic mode step view
- Same upload logic, large touch target for gloved hands

---

## Files to edit
| File | Change |
|------|--------|
| `src/pages/ProjectDetail.tsx` | Upload mutation, camera button, thumbnail gallery, deletion |
| `src/components/vehicle/MechanicMode.tsx` | Camera button for hands-free photo capture |
| `src/components/vehicle/FactoryPhotoLightbox.tsx` | Minor: accept user photos (remove "Honda FSM" hardcoded attribution when source isn't charm.li) |

No DB migrations needed — `photo_urls` column and `repair-photos` bucket already exist with correct RLS.

