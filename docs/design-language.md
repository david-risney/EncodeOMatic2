# UX design language

This guide describes Encode-O-Matic 2's current visual system and the rules to
follow when extending it. The application is a compact, dark, technical
workspace: the graph is primary, data is precise and information-dense, and
controls should stay quiet until they are relevant.

The principles are adapted from Anthony Hobday's
[Visual design rules you can safely follow every time][safe-rules]. They are
defaults, not absolutes. A deliberate exception is acceptable when it improves
usability, accessibility, or the graph-editing workflow.

## Product character

- **Technical and focused.** Prefer a restrained dark canvas, compact controls,
  and monospace data where exact bytes matter.
- **Graph first.** Pipes and their connections carry the strongest hierarchy.
  Toolbars, inspectors, menus, and dialogs support that workspace.
- **Meaningful color.** Red-pink marks primary actions and selection; blue and
  orange distinguish input and output; red and green communicate status.
- **Direct manipulation.** Drag pipes, draw connections, pan and zoom the
  canvas, resize the data panel, and expose immediate hover, focus, selection,
  and error feedback.

## Design tokens

The canonical tokens live in `styles/main.css` under `:root`. Component styles
are split across `controls.css`, `graph.css`, `data-viewer.css`, `dialogs.css`,
and `feedback.css`. Reuse the shared tokens rather than adding local colors,
fonts, radii, or shadows.

### Color

| Token | Value | Use |
| --- | --- | --- |
| `--color-bg` | `#1a1a2e` | Page, canvas, and inset field background |
| `--color-surface` | `#16213e` | Header, data panel, dialogs, and popovers |
| `--color-surface2` | `#0f3460` | Raised headers, controls, and hover surfaces |
| `--color-pipe-bg` | `#1e2d4a` | Pipe nodes and the add-pipe control |
| `--color-border` | `#2a3a5a` | Standard separators and control borders |
| `--color-pipe-border` | `#3a4e6a` | Pipe-node outlines |
| `--color-text` | `#e0e0e0` | Primary text |
| `--color-text-dim` | `#8892a4` | Secondary labels, metadata, and empty states |
| `--color-accent` | `#e94560` | Primary actions, focus, selection, and hover |
| `--color-accent2` | `#533483` | Active control background |
| `--color-port-input` | `#5bc4f5` | Input ports |
| `--color-port-output` | `#f5a25b` | Output ports |
| `--color-connection` | `#7090b0` | Resting graph connections |
| `--color-selection` | `#3390ff` | Selected data ranges |
| `--color-error` | `#ff4444` | Errors and destructive actions |
| `--color-success` | `#44cc66` | Success status |

The palette uses near-black and near-white rather than pure neutrals. Its dark
surfaces and text are cool, blue-saturated neutrals, which keeps the palette
coherent. Standard borders are lighter than both the page and the principal
containers, so edges remain crisp. The background-to-surface and
background-to-pipe brightness steps remain subtle enough to preserve the dark
workspace's depth hierarchy.

Use high contrast for selected pipes, primary actions, errors, and active
connection work. Use lower contrast for structure, metadata, inactive
connections, and decorative grid dots. Do not rely on color alone: input and
output ports also have stable positions, errors include text or accessible
labels, and active controls expose state.

`#fff` and `white` currently appear in a few active and hover states. Treat
these as implementation exceptions, not new palette values. Also avoid using
the referenced but undefined `--color-text-muted`; use `--color-text-dim`
unless a distinct muted token is deliberately added.

### Typography

The interface uses no more than two typeface stacks:

- `--font-ui`: `system-ui`, `-apple-system`, `sans-serif` for controls and
  labels.
- `--font-mono`: Cascadia Code, Fira Code, Consolas, then `monospace` for byte
  data, encoded text, locations, and filenames.

The default UI size is `14px`. Existing sizes form a compact hierarchy:

| Size | Typical use |
| --- | --- |
| `20px` | Add-pipe plus symbol |
| `18px` (`16px` on narrow screens) | Application title |
| `16px` | Dialog headings and icon buttons |
| `13px` | Standard buttons, inputs, list item names, and toasts |
| `12px` | Pipe names, panel headings, labels, data, and zoom status |
| `11px` | Compact buttons, descriptions, pipe input, and hex bytes |
| `10px` | Categories, counts, locations, and error indicator |
| `9px` | Port names |

Use `600` for component names and field labels and `700` for the brand and
uppercase categories. Monospace data uses a `1.6` line height; compact port
labels use `1`. The uppercase `10px` category label uses `1px` letter spacing,
while the `18px` title uses only `0.5px`, following the principle that smaller
text needs more spacing and larger text needs less.

The sub-16px sizes are a deliberate compact-tool exception, not a default for
reading content. New paragraphs, help text, or other sustained reading should
be at least `16px`, use a comfortable line height, and stay near 70 characters
per line. Never make essential information small merely to fit it.

### Spacing and sizing

Use the existing, mathematically related spacing family:
`2, 4, 6, 8, 10, 12, 16, 20, 24px`. Prefer `4px` and `8px` increments; use
`6px`, `10px`, and `12px` where the existing compact controls require them.

- Standard screen-edge and mobile-toast inset: `12px`.
- Header padding: `8px 16px`, reduced to `8px 12px` below `640px`.
- Dialog content inset: `20px`, reduced to `12px` below `640px`.
- Standard button padding: `5px 12px`; compact button padding: `3px 8px`.
  Horizontal padding is at least twice the vertical padding.
- Pipe header padding: `6px 10px 4px`; pipe body areas use `4px 8px`.
- Related items use `4–8px` gaps; major component groups use `12–20px`.
- Graph grid: `24px`; ports: `12px`; logo: `32px`.

Measure spacing between visible, high-contrast edges. Keep a container's outer
padding at least as large as gaps among its children, because those children
are more closely related to each other than to the container edge.

Align every element to a container edge, sibling baseline, grid line, pipe
center, or port path. Optical corrections are welcome for icons and irregular
shapes when mathematical centering looks wrong.

### Shape, borders, and depth

- Standard radius: `6px`; large container radius: `10px`.
- Small nested items use `2–4px` radii. When adding nested rounded containers,
  derive the inner radius from the outer radius minus the inset.
- Controls and dialogs use `1px` borders; pipe nodes and ports use `2px`.
- Dashed `2px` borders identify the provisional add-pipe control.
- Avoid adjacent separators when a container edge or background transition
  already provides the divide.

The current depth token is `0 4px 16px rgba(0, 0, 0, 0.4)` and is used for
nodes, dialogs, popovers, and toasts. This is an intentional existing exception
to the safe rule against shadows in dark interfaces. Do not introduce another
depth technique. Prefer borders and surface brightness for new depth; if a
shadow is necessary, reuse `--shadow`. Hover and selection rings are state
indicators, not general elevation.

Keep complex elements on simple surfaces. The graph's pipes and colored byte
data sit on restrained backgrounds; do not place gradients, illustrations, or
other visual noise behind them.

## Component and interaction patterns

### Buttons and controls

- Use `.btn` for ordinary actions, `.btn-primary` for the single strongest
  action in a context, `.btn-danger` for destructive actions, `.btn-sm` for
  dense secondary controls, and `.btn-icon` for icon-only controls.
- Order action groups by visual weight, with the primary action at the outside
  edge. Dialog actions are right-aligned on wide screens and wrap into equal,
  usable widths on narrow screens.
- Pair icon-only controls with `aria-label` and usually `title`. When an icon is
  paired with text, reduce its contrast if it otherwise outweighs the label.
- Hover changes the surface or border; keyboard focus must remain equally
  visible. Stateful controls use `.active` plus `aria-pressed` or
  `aria-expanded`.

### Graph

- Pipe nodes are movable containers with top input ports, bottom output ports,
  a clear name, and a low-emphasis configuration control.
- Input blue and output orange are stable semantic assignments. Connections
  rest in muted blue-gray and switch to accent color when hovered or drafted.
- Keep the visible connection thin (`2px`) while retaining the separate
  transparent `14px` hit target. Interaction targets may be larger than their
  visible geometry.
- Selection is a border/ring treatment. Errors add a warning indicator and
  accessible error label without replacing the node's identity.
- The dotted `24px` canvas grid supports alignment but stays low contrast.

### Panels, menus, dialogs, and feedback

- The data panel is a secondary inspector. It may be resized, hidden, and
  divided into pinnable or minimizable views without competing with the graph.
- Popovers open adjacent to their trigger and are clamped to the viewport.
  Menus use familiar `role="menu"`/`menuitem` semantics and expose expansion.
- Dialogs use a heading, scrollable content, and a footer action row. Keep a
  `12px` screen-edge gap and an `80vh`/`80dvh` height limit.
- Toasts appear at the bottom-right, become full-width within mobile insets,
  and use status-colored borders. They supplement rather than replace durable
  inline errors.
- Empty, loading, invalid, selected, hover, focus, disabled, and minimized
  states should all be designed explicitly.

### Responsive behavior

The compact breakpoint is `640px`. At that width the header wraps, toolbar
controls tighten, the data panel is limited to `75vw`, its drag resizer is
hidden, dialogs reduce horizontal padding, action rows wrap, and toasts fill
the available inset width. Preserve usable controls and the graph workspace
before preserving desktop alignment.

If a future layout needs columns, start from a 12-column grid so it can divide
cleanly into halves, thirds, and quarters. The current application primarily
uses flex layout and the free-positioned graph, so do not impose columns where
they do not help.

## Rules for extending the interface

1. Start with existing tokens and component classes.
2. Give every color, size, space, alignment, and state a reason.
3. Preserve the cool-neutral dark palette and semantic color assignments.
4. Keep important actions and states high contrast; keep structure quiet.
5. Use the established spacing family and align new elements with siblings.
6. Prefer borders and brightness steps over adding new shadows.
7. Use UI type for controls and monospace only where exact data benefits.
8. Design keyboard, pointer, touch, narrow-screen, empty, and error behavior
   together with the default state.
9. Check text contrast, focus visibility, target size, clipping, and zoom
   before considering a visual change complete.
10. When breaking a rule, document why the exception serves the user.

## HTML-first implementation

Prefer semantic, declarative HTML and CSS over JavaScript-created structure or
presentation. Reusable and conditional UI structure belongs in `<template>`
elements in `index.html`; JavaScript clones those templates, supplies data, and
wires behavior. Keep component styles in the focused stylesheet for that UI
area and use native CSS nesting to colocate states and descendants.

JavaScript may set CSS custom properties for values that only exist at runtime,
such as graph coordinates, zoom, popover placement, panel width, and byte
colors. It should not set fixed presentation properties or embed HTML/CSS
strings. Continue to assign user-controlled content with `textContent`.

[safe-rules]: https://anthonyhobday.com/sideprojects/saferules/
