# Redesign against your REAL app — batch 9 (avatar set complete)

## Files → destination

| File | Destination |
|---|---|
| avatar-14.png, avatar-16.png, avatar-18.png, avatar-19.png, avatar-20.png | public/avatars/ (add to the folder from batch 8) |
| avatar-catalog.ts | src/lib/avatar-catalog.ts (replaces batch 8's version) |

## What changed

All 20 avatars are now in the catalog (`AVAILABLE_AVATARS` in
`avatar-catalog.ts` lists all 20 instead of 15). No other code changes —
`ContactAvatar`, and everywhere it's already wired in (Leads, Contacts,
Sidebar user block, Dashboard), automatically benefits from the fuller
set since selection is just an index into this array.

## How to apply

1. Drop the 5 new PNGs into `public/avatars/` alongside the 15 from batch 8.
2. Replace `src/lib/avatar-catalog.ts` with this version.
3. Restart `pnpm dev` — no other steps needed.
