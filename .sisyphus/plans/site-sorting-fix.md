# Work Plan: Fix Site Sorting and Default to "Recently Starred"

## Overview
The goal is to update the GitHub Pages site to default to the "Recently Starred" sorting method and ensure that the repository `adriangalilea/namecheap-python` appears as the most recent entry, matching the user's actual GitHub stars page.

## Current Issues
1.  **Default Sort**: The `index.html` dropdown for `sort-by` does not explicitly set `recent-desc` as the selected default, and `app.js` doesn't handle the initial state to ensure it's applied correctly.
2.  **Unclassified Filter**: `app.js` currently hides "unclassified" repositories by default unless a search is performed. New stars like `adriangalilea/namecheap-python` might be unclassified initially or if the classification hasn't run yet.

## Proposed Changes

### 1. Update `docs/index.html`
- Set `selected` attribute on the `<option value="recent-desc">` to make it the default in the UI.

### 2. Update `docs/app.js`
- **Initial Sort**: Ensure `applyFilters()` is called with the correct initial value from the `sortBy` element.
- **Unclassified Handling**: Adjust the logic that hides unclassified repos. If the user expects to see their latest stars (which might not be classified yet), we should either:
    - Show unclassified repos when sorted by "Recently Starred".
    - Or remove the auto-hiding of unclassified repos if they are fresh.
- **Data Accuracy**: Verify `starred_at` dates in `docs/data.json` are being parsed correctly by `new Date()`.

## Task Breakdown
- [ ] UI Update: Modify `docs/index.html` to set `recent-desc` as the default selected option.
- [ ] Logic Update: Modify `docs/app.js` to:
    - Default `sort` variable to `recent-desc` if not explicitly set.
    - Review and relax the "unclassified" hiding logic (line 152) to ensure new stars are visible.
- [ ] Verification: Simulate or check `data.json` content for `adriangalilea/namecheap-python` to ensure `starred_at` is the highest/most recent.

## Verification Plan
1.  Check `docs/index.html` to confirm `recent-desc` has the `selected` attribute.
2.  Check `docs/app.js` to confirm the default sorting logic and visibility of unclassified repositories.
3.  Manually inspect the site (or data output) to confirm `adriangalilea/namecheap-python` is at the top when sorted by `recent-desc`.

### 3. UI Enhancement: Recency Indication
- The current `style.css` has "Neon Recency" styles (`fresh`, `recent`, `stale`, `old`).
- I will ensure these are correctly applied to the `adriangalilea/namecheap-python` card to make it pop as a "fresh" star.
- This will involve verifying the `getRecency` function in `app.js` is correctly identifying stars from the last 24-48 hours.

## Updated Verification Plan
1.  Verify the site renders and sorts correctly.
2.  Confirm `adriangalilea/namecheap-python` is at the very top.
3.  Confirm it has the `fresh` class (neon green indicator) because it was starred on 2026-01-10.
