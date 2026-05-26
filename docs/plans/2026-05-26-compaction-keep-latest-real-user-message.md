# Compaction: keep only the latest real user message live

## Overview
Replace the current "keep last 4 user turns verbatim" behavior in context compaction with "summarize everything before the latest real user message, then keep only that message live." Tool-result-only messages with `role: user` no longer count as real user turns, which prevents large `tool_result` payloads from sneaking past the compaction boundary.

## Context
- Files involved:
  - Modify: `platform/backend/src/routes/chat/context-compaction.ts`
  - Modify: `platform/backend/src/routes/chat/context-compaction.test.ts`
- Related patterns:
  - `splitMessagesForCompaction()` already has a low-turn fallback (`splitLowUserTurnMessagesForCompaction`) that mostly matches the new "no compaction if only one unresolved user message" rule; the new logic generalizes that fallback to all cases.
  - `buildRecentUserMessagesReference()` already filters by `role === "user"`; needs the same `isRealUserMessage()` filter so tool-result-only pseudo-user messages do not poison the "recent user intent" reference.
  - `resolveUsableCompaction()` reconstructs `[summary, ...messages.slice(boundaryIndex + 1)]` — boundary must remain the last compacted message so old tool results never reappear.
- Dependencies: none new; `ChatMessage` / `ChatMessagePart` shapes already include `type` discriminators (text, file, tool-*) and the existing helpers (e.g. `getMessageTextForTokenEstimate`) already distinguish them.

## Development Approach
- Testing approach: Regular (code first, then tests in the same task — both must be updated together because tests pin current behavior)
- Keep the change localized to `context-compaction.ts`; do not refactor surrounding code.
- Preserve the exported `CONTEXT_COMPACTION_RECENT_USER_TURNS` constant signature only if still used elsewhere; otherwise remove it. The `splitMessagesForCompaction` body should no longer reference it.
- CRITICAL: every task MUST include new/updated tests
- CRITICAL: all tests must pass before starting next task

## Implementation Steps

### Task 1: Introduce isRealUserMessage and rewrite split behavior

Files:
- Modify: `platform/backend/src/routes/chat/context-compaction.ts`

- [x] Add `isRealUserMessage(message: ChatMessage): boolean` that returns true only when `message.role === "user"` and at least one part is user-authored content (`part.type === "text"` with non-empty text, or `part.type === "file"`). Parts whose `type` starts with `"tool-"` do not count.
- [x] Replace `splitMessagesForCompaction()` body with the new rule:
  - find `latestRealUserIndex = findLatestRealUserMessageIndex(messages)`
  - if `latestRealUserIndex < 0`: `compactable = messages`, `recent = []`
  - if `latestRealUserIndex === messages.length - 1`:
    - if it is the only message (`messages.length === 1`) AND there is nothing before it: `compactable = []`, `recent = [that message]` (current "single unresolved user turn" behavior)
    - otherwise: `compactable = messages.slice(0, latestRealUserIndex)`, `recent = [messages[latestRealUserIndex]]`
  - if `latestRealUserIndex < messages.length - 1`: `compactable = messages`, `recent = []`
- [x] Delete the now-unused `splitLowUserTurnMessagesForCompaction` and `findLatestUserMessageIndex` helpers; replace with `findLatestRealUserMessageIndex` that uses `isRealUserMessage`.
- [x] Decide on `CONTEXT_COMPACTION_RECENT_USER_TURNS`: it is still used by `buildRecentUserMessagesReference()` as a slice cap. Keep the constant but rename its role in a one-line comment ("max number of recent real user messages serialized into the reference block") — do not delete it.
- [x] Update `buildRecentUserMessagesReference()` to filter with `isRealUserMessage` instead of `message.role === "user"`. Slice last N stays.
- [x] Verify boundary handling: the compactable list's last element is still passed to `resolveCompactionBoundaryMessageId()` unchanged, so `compactedThroughMessageId` continues to point at the last compacted message.
- [x] Update / add unit tests in `context-compaction.test.ts`:
  - Replace `"keeps the last four user turns verbatim"` with `"keeps only the latest unresolved real user message live"` — given a long conversation, expect `compactable` to contain everything up to but not including the final real user message and `recent` to contain exactly that one message.
  - Add `"treats tool-result-only user messages as compactable, not as recent user turns"`: build messages where the second-to-last message has `role: "user"` but only `parts: [{ type: "tool-foo", ... }]`, followed by a real user text message. Expect the tool-result message to land in `compactable` and only the real user message in `recent`.
  - Add `"compacts historical tool-result payloads even when they appear as role: user"`: large synthetic tool-result-only user message followed by an assistant message followed by a final real user message — expect the tool-result and assistant message in `compactable`, only the final real user message in `recent`.
  - Keep `"does not compact a single unresolved user turn"` as is.
  - Adjust `"compacts short older work while keeping the latest user turn live"` and `"keeps the latest unresolved user turn live while compacting prior low-turn work"` only if their expectations change — under the new rule, both should still pass without modification because their final message is already a real user message.
  - Adjust `"compacts completed low-turn conversations without a size gate"`: under the new rule, the final message is an assistant message, so `latestRealUserIndex < messages.length - 1` ⇒ `compactable = messages`, `recent = []`. Existing expectation already matches; verify.
  - Update `"compaction prompt preserves recent user messages outside the bounded transcript"` if needed so that a tool-result-only user message is excluded from the reference block.
- [x] Run backend tests for this file: `pnpm --filter @platform/backend test context-compaction` (from `platform/`). All tests must pass.

### Task 2: Verify the type-checker and linter are clean

Files:
- (no source changes expected)

- [ ] From `platform/`, run `pnpm type-check` — must pass.
- [ ] From `platform/`, run `pnpm lint` — must pass; auto-fix anything trivial.
- [ ] Run full backend test suite for the chat routes: `pnpm --filter @platform/backend test routes/chat`.

### Task 3: Verify acceptance criteria

- [ ] Confirm `splitMessagesForCompaction` no longer references `CONTEXT_COMPACTION_RECENT_USER_TURNS` for slicing the recent suffix.
- [ ] Confirm `buildRecentUserMessagesReference` filters with `isRealUserMessage`.
- [ ] Confirm boundary id resolution is unchanged (still derived from `split.compactable.at(-1)`).
- [ ] Confirm at least one regression test covers tool-result-only user messages being treated as compactable.
- [ ] Run the full backend test suite from `platform/`: `pnpm --filter @platform/backend test`.

### Task 4: Update documentation if needed

- [ ] If `../docs/pages` mentions "last 4 user turns" or the prior compaction shape, update the wording to reflect the new rule. Otherwise no docs change.
- [ ] No CLAUDE.md updates expected — this is an internal behavior change without new conventions.
