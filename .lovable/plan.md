

## Plan: Redesign Diagnose Tab + Fix Build Error

### 1. Fix Build Error (chat edge function)
Line 743 in `supabase/functions/chat/index.ts` has an escaped exclamation mark (`\!user`) that should be `!user`. Simple character fix.

### 2. Redesign Diagnose Tab with Stepped Wizard + Progressive Disclosure

The current DiagnoseTab dumps everything on one screen: When/Where/Sound chips, 5 symptom categories (all expanded), a textarea, attachment controls, and past diagnoses. This will be restructured into two clear zones with a stepped flow.

**New Layout:**

```text
┌─────────────────────────────────────┐
│  DIAGNOSIS HISTORY (default view)   │
│  ┌─────────────────────────────────┐│
│  │ Past diagnosis cards (compact)  ││
│  └─────────────────────────────────┘│
│                                     │
│  [ + New Diagnosis ] button         │
└─────────────────────────────────────┘

When "New Diagnosis" is clicked:
┌─────────────────────────────────────┐
│  Step 1: What's happening?          │
│  - Symptom category chips (collapsed│
│    accordions, one open at a time)  │
│  - Free-text textarea              │
│  [ Next → ]                        │
├─────────────────────────────────────┤
│  Step 2: Context                    │
│  - When chips                       │
│  - Where chips                      │
│  - Sound chips (if relevant)        │
│  [ ← Back ] [ Next → ]            │
├─────────────────────────────────────┤
│  Step 3: Evidence (optional)        │
│  - Photo/video/doc/link attachments │
│  [ ← Back ] [ Start Diagnosis ]   │
└─────────────────────────────────────┘
```

**Key Changes to `src/components/vehicle/DiagnoseTab.tsx`:**

- **Default view**: Show past diagnoses first with a prominent "New Diagnosis" button. If no history, show a clean empty state with the button.
- **3-step wizard** with a progress indicator (step dots or bar):
  - **Step 1 - Symptoms**: Category chips (only one accordion open at a time) + textarea. This is the core input.
  - **Step 2 - Context**: When/Where/Sound chips. Sound row auto-shows if noise-related chips were selected in Step 1.
  - **Step 3 - Evidence** (optional): Media attachments. Users can skip this.
- **Step navigation**: Back/Next buttons with validation (Step 1 requires at least one chip or text).
- **Visual cleanup**: Better spacing, step indicator at top, card-based steps instead of one giant form.
- Past diagnosis cards stay the same but move to the top as the primary content.

### Technical Details

- All state and logic (chip selection, file handling, `startDiagnosis`) stays the same -- just reorganized into steps via a `wizardStep` state variable (0 = history view, 1/2/3 = wizard steps).
- No database changes needed.
- No new dependencies.
- The build error fix is a one-character change in the edge function.

