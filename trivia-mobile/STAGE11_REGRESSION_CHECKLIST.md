# Stage 11 Regression Checklist

## Automated checks

- [x] TypeScript compile: `pnpm -C trivia-mobile exec tsc --noEmit`
- [x] Jest test suite: `pnpm -C trivia-mobile test -- --runInBand`

## Manual realtime scenarios

- [ ] Auth: Login -> user loaded -> redirect to Home
- [ ] Auth: Register -> auto-login -> redirect to Home
- [ ] Auth: Logout -> tokens cleared -> redirect to Login
- [ ] Auth: Expired access token -> transparent refresh -> user remains logged in
- [ ] Auth: Expired refresh token -> redirect to Login
- [ ] Auth Guard: opening protected route without auth -> redirect to Login
- [ ] Lobby: WS connects -> player count updates
- [ ] Lobby: quiz cancellation event -> redirect to Home
- [ ] Play: question event -> timer appears -> answers rendered
- [ ] Play: answer submission -> answer result event updates feedback/score
- [ ] Play: elimination event -> eliminated state shown
- [ ] Play: finish event -> redirect to Results
- [ ] Results: score/rank/winner/prize rendered correctly
- [ ] Ad break: `quiz:ad_break` pauses interaction and overlay shown
- [ ] Ad break: `quiz:ad_break_end` hides overlay and flow continues correctly
- [ ] Offline -> Online: banner shown, WS reconnects, state recovers
- [ ] Background -> Foreground: WS reconnect + resync works
- [ ] Reconnect mid-game: backoff reconnect + current question recovered
- [ ] Language switch RU<->KK persists after app restart
- [ ] Crash monitoring: test error appears in Sentry dashboard

## Sign-off

- [x] All automated checks green
- [ ] All manual scenarios passed
