

## Recommended: Chat History on Vehicle Detail Page

### Why This Structure

You think in terms of vehicles, not chat sessions. "What did Ratchet say about my Accord's starter?" — you'd go to your Accord, not to a generic chat page. So chat history should live on the Vehicle Detail page as a tab.

### What Changes

**1. New "Chats" tab on Vehicle Detail page** (`src/pages/VehicleDetail.tsx`)
- Add tab after "Docs" in the tab bar
- Icon: MessageCircle
- Shows all `chat_sessions` where `vehicle_id` matches

**2. New ChatsTab component** (`src/components/vehicle/ChatsTab.tsx`)
- Two sections: **Project Conversations** and **General Conversations**
- Project conversations show project title badge, link to project
- Each row: title, date, message count preview
- Tap a conversation → opens it in the Ratchet panel (reuses existing infrastructure)
- Empty state: "No conversations yet — tap the Ratchet button to start chatting"

**3. Keep Ratchet panel session drawer as-is**
- It's the quick switcher for recent threads while chatting
- No changes needed

**4. Remove /chat route** (optional, could keep as redirect)
- It's redundant once history lives on the vehicle page
- Redirect `/chat` → `/garage`

### Technical Details

- Query: `chat_sessions` joined with message count, filtered by `vehicle_id`, ordered by `updated_at`
- Tapping a session: calls `openRatchetPanel()` and sets `activeSessionId` via a new store action
- Project conversations: filter where `project_id IS NOT NULL`, show project title
- General conversations: filter where `project_id IS NULL`

### Files to Create/Edit

| File | Action |
|------|--------|
| `src/components/vehicle/ChatsTab.tsx` | Create — chat history list component |
| `src/pages/VehicleDetail.tsx` | Edit — add "Chats" tab |
| `src/stores/app-store.ts` | Edit — add `openRatchetWithSession(sessionId)` action |
| `src/components/RatchetPanel.tsx` | Edit — respect pre-set session ID from store |
| `src/App.tsx` | Edit — redirect `/chat` to `/garage` (optional) |

