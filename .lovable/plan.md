

# GarageOS — AI-Powered Virtual Mechanic Platform

## Overview
A dark-themed, mobile-first web app where users add vehicles by VIN, get AI-powered diagnostics and repair guidance, and track maintenance/repair history with DIY savings tracking.

## Phase 1: Foundation

### Design System & App Shell
- Dark-only theme (#0a0a0a bg, #f97316 orange accent, Inter font)
- Sidebar navigation (desktop) + bottom tab bar (mobile)
- Vehicle switcher dropdown in sidebar/header
- Auth pages (login/signup) with Supabase email + Google OAuth

### Database Setup
- All tables as specified: profiles, vehicles, maintenance_logs, repair_logs, chat_sessions, chat_messages, dtc_records
- RLS policies scoped to authenticated user's own data
- Storage bucket for repair photos

## Phase 2: Vehicle Management

### Garage Page
- Vehicle card grid with status indicators (recalls, maintenance due, active DTCs)
- Add Vehicle modal with two tabs: VIN Lookup (NHTSA API decode + cache) and Manual Entry
- All forms validated with React Hook Form + Zod

### Vehicle Detail Page
- Overview tab: specs grid, recall alerts (NHTSA API), known issues section
- Maintenance tab: service timeline, upcoming alerts with color coding, add service modal with auto-suggested next-due dates
- Repairs tab: repair cards with cost breakdown, DIY savings tracking, photo uploads, parts list
- Stats rows on each tab

## Phase 3: AI Mechanic Chat (Core Feature)

### Chat Infrastructure
- Supabase Edge Function calling Lovable AI gateway (since LOVABLE_API_KEY is available)
- Dynamic system prompt injected per vehicle (year/make/model/engine/mileage + recent services + active DTCs)
- Streaming SSE responses with token-by-token rendering
- Chat sessions persisted to Supabase, auto-titled from first message

### Chat UI
- Full-height chat with session history sidebar (desktop)
- Markdown rendering in AI responses (code blocks for part numbers/torque specs, numbered lists for steps)
- Quick-start prompt chips for new conversations
- Parts recommendation cards parsed from AI output (with RockAuto/Amazon affiliate links)

## Phase 4: Dashboard & Polish

### Dashboard
- Greeting + active vehicle pill
- Alert strips for recalls and overdue maintenance
- Stats cards (vehicles, repairs, DIY savings, next maintenance)
- Recent activity feed + quick action buttons

### Empty States & Loading
- Designed empty states with SVG illustrations and CTAs for each section
- Skeleton loaders for all async content
- Toast notifications (success/error/info)
- Error states with retry buttons

### Phase 2 Placeholders
- OBD2 Scanner, Audio Diagnosis, Pre-Purchase Mode, Community — UI shells with "Coming Soon" modals

### Settings Page
- Profile management, notification preferences, data export, account deletion

## State Management
- Zustand for UI state (active vehicle, open modals)
- React Query for server state with 5-minute stale time
- Chat message pagination (50 per load)

