# Obsidian mobile: build plan

Saga loads on Obsidian mobile (iOS, Android). On a touch screen the map takes one-finger pan, two-finger pinch to zoom and press-and-hold for the right-click menus.

## Assumptions

- No code uses Node or Electron (no `require`, `fs`, `electron`, `process`), so `isDesktopOnly: false` is the only load blocker.
- Bases and custom Bases views run on mobile from Obsidian 1.10.2; `minAppVersion` stays.
- The header, links, explorer and settings use DOM that mobile shares (`.markdown-source-view .cm-sizer`, `.inline-title`, `.nav-file-title[data-path]`); they need checking, not changes.
- Pointer events already carry touch: one-finger pan on the map and one-finger pin drag work through the existing `pointerdown`/`move`/`up` handlers (`pointerType: 'touch'`, `button` 0). The gaps are pinch and press-and-hold.
- iOS fires no `contextmenu` on press-and-hold; Android does. iOS WebKit fires `gesture*` for a two-finger touch pinch; Android does not.

## Behaviour (touch)

| Gesture | On the map | On a pin |
|---|---|---|
| Tap | closes the card | opens the card |
| One-finger drag | pans | moves the pin (as desktop) |
| Two-finger pinch | zooms around the fingers' midpoint and pans with it | same (a pin drag in progress is cancelled) |
| Press and hold (500 ms, < 4 px movement) | map menu (Add pin here) | pin menu (Remove pin) |
| Double-tap | zooms one level | — |

- A press-and-hold opens the menu once; the native `contextmenu` that follows on Android is ignored, and so is the click after release.
- During a touch pinch the `gesture*` handlers in `trackpad.ts` do nothing, so iOS does not zoom twice.

## Steps

### 1. Touch input on the map
- `src/map/touch.ts` (beside `trackpad.ts`): tracks the active touch pointers on the stage, including those that start on a pin. Two pointers → pinch: zoom by `log2(distance / startDistance)` around the midpoint and pan by the midpoint's movement, applied once per frame through `ViewportStore`. One pointer held 500 ms within `DRAG_PX` → `onHold(screenPoint, target)`.
- The pinch maths (two start points, two current points → zoom delta, anchor, pan) is a pure function in `src/shared/maps/viewport.ts`.
- `MapCanvas`: attaches `touch.ts`; `onHold` over the map calls `onMapMenu`, over a pin calls the pin's menu; a single-pointer pan stops when a second pointer goes down.
- `PinLayer`: a pin drag is cancelled when a pinch starts; `contextmenu` after a touch hold is ignored.
- `map.css`: `-webkit-touch-callout: none` on the stage (no iOS callout on hold).
- **Agent:** `react-dev`.
- **Done:** tests first. Unit: pinch maths (spread doubles → +1 zoom around the midpoint; moving midpoint pans; clamped to limits). Component (synthetic `PointerEvent`s with `pointerType: 'touch'` and two `pointerId`s): pinch zooms and pans; hold on the map opens "Add pin here", on a pin "Remove pin"; a hold that moves 4 px pans instead; a pinch during a pin drag returns the pin unwritten; a `contextmenu` after a hold opens no second menu. `typecheck`, `lint`, `test` pass.

### 2. Mobile release
- `manifest.json`: `isDesktopOnly: false`.
- `docs/checks/*.md`: a Mobile section per feature (map gestures; header, links, explorer and settings render and edit on a phone).
- As-built: `docs/map.md` Input gains the touch row; `CLAUDE.md` drops "desktop".
- Version 0.7.0.
- **Agent:** none (main session).
- **Done:** the Mobile checks pass on iPhone and iPad; all scripts pass.
- **Depends on:** 1.

## Decisions

- Pins drag on move, as on desktop; press-and-hold on a pin opens its menu.
- Hover-only features stay as they are: in "On hover" label mode a pin's label shows when it is selected or focused; no hover previews on touch.
- Manual checks run on iPhone and iPad, in several vaults, installed from the release through BRAT.
- Small-screen layout (Pins list, Layers panel, card, controls) is a follow-up.

## Risks

- Obsidian mobile's DOM for the header or explorer may differ from desktop in ways only a device shows; `header/dom.ts` and `explorer/dom.ts` hold every selector, so fixes stay there.
