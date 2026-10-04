# YouTube Jam — Web

Web version of the YouTube Jam Android app, built with React + Vite and the
Firebase Web SDK (modular v10), reading/writing the exact same Realtime
Database paths and field names as the Kotlin app (see `Models.kt` /
`RoomRepository.kt`).

The "browse YouTube" tab from the mobile app is intentionally left out —
YouTube blocks embedding its own site in an iframe, so on web you add videos
by pasting a link (same as the mobile app's clipboard/share-intent flow),
and the Playlist tab plays them with the YouTube IFrame Player API.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Firebase config lives in `.env` (already filled in with your project's
   values, matching the snippet you pasted from the Firebase console). If
   you ever rotate keys or point this at a different Firebase project, edit
   `.env` — never commit it (it's already in `.gitignore`). `.env.example`
   shows the shape without values, safe to commit.

   Note: unlike a server secret, a Firebase **client** config (including
   `apiKey`) is not sensitive on its own — Firebase's own docs say it's safe
   to ship in client bundles. Real protection comes from your Realtime
   Database security rules, not from hiding this file. Keeping it in `.env`
   is still good practice (keeps prod/dev separate, keeps it out of your
   repo history if you ever swap projects).

3. Run the dev server:
   ```
   npm run dev
   ```
   Opens at http://localhost:5173. The YouTube IFrame API requires a real
   http(s) origin — opening the built files directly via `file://` won't
   work.

4. Build for deployment:
   ```
   npm run build
   ```
   Outputs static files to `dist/` — deploy anywhere that serves static
   files (Firebase Hosting, Vercel, Netlify, etc).

## What's implemented

- Sign in / Create account / Forgot password (Firebase Auth, email+password)
- Lobby: Host a Jam (generates a unique 5-digit code via a DB transaction,
  same collision-retry logic as `createRoom()` in the Kotlin repo) / Join a
  Jam by code
- Room shell with Playlist / Chat / People / Profile tabs (bottom nav on
  mobile widths, top tab row on desktop — see the `@media (min-width: 860px)`
  block in `src/styles.css`)
- Playlist tab: paste-a-link add flow (oEmbed for title, no API key needed),
   synced playback via the YouTube IFrame Player API — every room member can
   write shared `playerState`, and everyone else's player follows it with drift
   correction; the host alone advances the queue automatically when a video ends
- Chat tab: realtime messages under `rooms/{code}/chat`
- People tab: live member list with a host badge; all room members can use the
   shared playlist and playback controls
- Profile tab: room code with copy/share, leave room, sign out

## Room administration and limits

The web client uses the shared `RoomMeta` contract from `models.kt`:
`hostUid`, `hostUsername`, `createdAt`, `name`, `description`, `maxMembers`,
and `expiresAt` (milliseconds; `0` means no expiry).

- Only users listed manually at `admins/<uid>: true` in Realtime Database can
   create rooms while `config/roomCreationOpenToAll` is `false`.
- An admin can switch `config/roomCreationOpenToAll` from the lobby to let all
   signed-in users create rooms.
- Room creation collects a name, optional description, capacity, and optional
   expiry duration. The complete metadata object is written in one transaction.
- Joining checks capacity and expiry in the client for clear errors; the rules
   enforce both server-side. Playlist, playback, and chat writes also show an
   expiry error before the rules reject them.
- The host can edit the room name and description in the Profile tab under
   Room Settings.

Deploy `firebase-rules-no-permissions.json` as the Realtime Database rules,
then add the intended administrator UID manually in the Firebase console.
The `admins` node is intentionally not writable by either client.

## Database rules

This expects the finalized rules in `firebase-rules-no-permissions.json` to be
deployed in the Firebase console. The rules enforce admin-only configuration,
room-creation access, member capacity, and room expiry on the server.
