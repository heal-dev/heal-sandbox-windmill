## RESOLVED — not a Windmill bug: test-author artifact

> Repo: windmill · Originally found by: heal E2E — journey ops-builds-flow-with-resources walk
> Status: **resolved (not a product bug)** after direct DOM inspection.

### Original symptom

Playwright reported `Error: locator.fill: Element is not enabled` when the journey test (and the older `e2e/flows/variables-and-resources/VR04-create-resource.spec.ts`) tried to fill schema-driven fields on the resource-create drawer. The walker hypothesised that `disabled` was leaking from a parent context into the SchemaForm fields (citing PR #8386 on `SchemaForm.svelte:419`).

### Root cause (verified via DOM inspection)

The hypothesis was wrong. A direct DOM probe of the live drawer (admin@windmill.dev / admins workspace, freshly-seeded resource type with `{ host: string }` schema) returned:

```
#0 input/text id="path"           disabled=false  visible
#1 textarea id="resource-description" disabled=false  visible
#2 textarea id=""                  disabled=false  visible   ← the schema-form field
```

No element has `disabled` set. The Tailwind classes contain `disabled:!bg-surface-disabled disabled:!border-transparent disabled:!text-disabled disabled:cursor-not-allowed` — these are utility variants that *style* the textarea **when** the disabled attribute is set; they do not set it themselves.

The actual failures were two separate test-authoring artifacts:

1. **Wrong selector** — VR04 located the path field via `getByLabel(/^Path$/i).first().or(getByPlaceholder(/^path|u\//i))`, but `<input id="path">` (Path.svelte:531) has no associated `<label for="path">` and its placeholder defaults to the *resource-type name*, not the literal "path". The locator timed out before any disabled check was even attempted. The journey test located the schema field via `getByRole('textbox').last()` — fragile in the presence of multiple textboxes.

2. **Playwright `.fill()` × `<textarea use:autosize>` race** — `text_input/TextInput.svelte` binds `use:autosize` on every textarea. The autosize action mutates the height on every input event, racing Playwright's actionability stability check. `.fill()` retries `waiting for element to be visible, enabled and stable` until timeout. The element is genuinely enabled; it is just never "stable" by Playwright's definition.

### Fix

Use `<element>.focus()` + `pressSequentially(<text>)` instead of `.fill()` for autosize-bound textareas. Locate the path field by `#path` id; locate schema fields by structural query (`textarea:not(#resource-description)`).

Applied to:
- `sandbox/e2e/flows/variables-and-resources/VR04-create-resource.spec.ts` — now passes in 3.7s.
- `sandbox/e2e/journeys/ops-builds-flow-with-resources.spec.ts` — full 9-step journey now passes in 17.5s.

### Re-verdict

Journey `ops-builds-flow-with-resources` re-verdicted from `bug-gap` → `true`. The product is correct; the spec is correct; the prior test failures were authoring artifacts.

### Lesson for future test authoring

- Prefer structural locators (`#path`, `not(#resource-description)`) over label/placeholder regex when the Svelte component renders without `<label for>` or a stable placeholder.
- When a `<textarea>` has `use:autosize` (common across Windmill's form components), use `focus + pressSequentially` instead of `.fill()`.
- After a type-picker or autocomplete dropdown selection, sleep ~1s for the dropdown overlay to clear before interacting with fields the overlay covered.
