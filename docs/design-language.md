# UX design language

This guide is the canonical visual and interaction guidance for Encode-O-Matic
2. It takes precedence over historical implementation choices. The application
is a compact, dark, technical workspace: the graph is primary, exact data is
easy to inspect, and supporting controls stay quiet until relevant.

The principles are adapted from Anthony Hobday's
[Visual design rules you can safely follow every time][safe-rules]. Accessibility
and usability take precedence when a rule needs an exception.

## Product character

- **Technical and focused.** Use a restrained dark canvas and monospace only
  where exact bytes, encoded text, locations, or filenames benefit from it.
- **Graph first.** Pipes and connections carry the strongest hierarchy.
  Toolbars, inspectors, menus, and dialogs support the workspace.
- **Meaningful color.** Accent red marks primary actions and selected UI;
  blue and orange distinguish input and output; red and green communicate
  status. Data-range selection uses blue so it remains distinct from graph
  selection.
- **Direct and accessible.** Pointer, touch, and keyboard interactions expose
  equivalent focus, selection, active, and error feedback.

## Design tokens

Canonical tokens live in `styles/main.css` under `:root`. Reuse them rather
than adding local colors, fonts, radii, shadows, or type sizes.

### Color

| Token | Use |
| --- | --- |
| `--color-bg` | Page, canvas, and inset fields |
| `--color-surface` | Header, inspector, dialogs, and popovers |
| `--color-surface2` | Raised headers, controls, and hover surfaces |
| `--color-pipe-bg` | Pipe nodes and the add-pipe control |
| `--color-border`, `--color-pipe-border` | Separators and outlines |
| `--color-text`, `--color-text-dim` | Primary and secondary text |
| `--color-accent`, `--color-on-accent` | Primary actions, focus, and UI selection |
| `--color-port-input`, `--color-port-output` | Input and output ports |
| `--color-connection` | Resting graph connections |
| `--color-selection` | Selected data ranges |
| `--color-error`, `--color-success` | Error/destructive and success status |

Use near-black and near-white neutrals instead of pure values. Pure white is
reserved for `--color-on-accent`, where it is needed for readable text on the
accent. Keep selected items, primary actions, errors, and active connection
work high contrast; keep structure, metadata, inactive connections, and the
grid quieter. Never rely on color alone.

### Typography

Use only the UI and monospace stacks and the five-size type scale:

| Token | Size | Use |
| --- | --- | --- |
| `--font-size-title` | `18px` | Application title |
| `--font-size-heading` | `16px` | Dialog headings and prominent icons |
| `--font-size-body` | `14px` | Default text, controls, inputs, and toasts |
| `--font-size-compact` | `12px` | Dense graph, inspector, and data labels |
| `--font-size-metadata` | `10px` | Categories, counts, locations, and ports |

Use regular weight by default and `600` for names, labels, headings, and the
brand. Use `1.5–1.6` line height for reading and data; compact port labels may
use `1`. Uppercase metadata may use `1px` letter spacing. Sustained help or
paragraph text stays at least `16px`, with comfortable line height and a line
length near 70 characters.

### Spacing and sizing

Use the `2, 4, 6, 8, 12, 16, 20, 24px` spacing family. Prefer `4px` and `8px`
increments; use the others only when the component hierarchy needs them.

- Screen-edge inset: `12px`.
- Header padding: `8px 16px`, reduced to `8px 12px` on compact screens.
- Dialog content inset: `20px`, reduced to `12px` on compact screens.
- Standard button padding: `6px 12px`; compact button padding: `4px 8px`.
- Pipe header padding: `6px 8px`; pipe bodies use `4px 8px`.
- Related-item gaps: `4–8px`; component-group gaps: `12–20px`.
- Graph grid: `24px`; visible ports: `12px`; logo: `32px`.

Keep container padding at least as large as the gaps among its children. Align
elements to container edges, sibling baselines, grid lines, pipe centers, or
port paths. Visible geometry may be smaller than its keyboard or pointer target.

### Shape and depth

- Standard radius: `6px`; large containers: `10px`.
- Nested controls use the standard radius unless geometry requires a circle.
- Controls and dialogs use `1px` borders; pipe nodes and ports use `2px`.
- A dashed `2px` border identifies the provisional add-pipe control.
- Do not add a separator where an edge or surface change already divides items.

Dark surfaces communicate depth through borders and small brightness steps.
Do not use general elevation shadows. Focus and selection rings communicate
state, not depth. Keep graph content on simple surfaces without decorative
noise behind it.

## Component and interaction patterns

### Controls and fields

- Use `.btn` for ordinary actions, `.btn-primary` for the strongest action,
  `.btn-danger` for destructive actions, `.btn-sm` for dense secondary actions,
  and `.btn-icon` for icon-only controls.
- Place destructive actions first and separate from the right-aligned
  `Cancel`, then primary action. On compact screens, action buttons wrap to
  equal usable widths.
- Use the shared inset-field surface, border, radius, and focus treatment for
  inputs, selects, and textareas. Component-specific size and typeface are
  allowed when the data requires them.
- Icon-only controls have an accessible name and usually a tooltip. Stateful
  controls expose `aria-pressed` or `aria-expanded`.
- Hover may change surface or border. Keyboard focus uses a consistent visible
  accent outline. Disabled controls remain legible but visibly inactive.

### Graph

- Pipe nodes are movable containers with top input ports, bottom output ports,
  a clear name, and a low-emphasis configuration control.
- Input blue and output orange are stable semantic assignments. Connections
  rest in muted blue-gray and become accent colored when hovered or drafted.
- Connections use a `2px` visible line and a separate `14px` hit target.
- Selection uses an accent border/ring. Errors add a warning and accessible
  label without replacing node identity.
- The low-contrast dotted canvas grid uses a `24px` interval.

### Panels, menus, dialogs, and feedback

- The data inspector may be resized, hidden, pinned, or minimized without
  competing with the graph.
- Popovers open by their trigger and remain inside the viewport. Menus use
  `menu`/`menuitem` semantics and expose expansion state.
- Dialogs have an accessible heading, scrollable content, and one footer action
  pattern. Keep a `12px` screen gap and an `80vh`/`80dvh` height limit.
- Toasts appear bottom-right, fill the available inset width on compact
  screens, and use status-colored borders. They supplement durable errors.
- Design empty, loading, invalid, selected, hover, focus, disabled, minimized,
  and reduced-motion states explicitly.

### Responsive behavior

Use one compact breakpoint at `640px`. The header wraps, controls tighten, the
data panel is limited to `75vw`, its drag resizer is hidden, dialogs reduce
horizontal padding, action rows wrap, submenus stay in the viewport, and toasts
fill the inset width. Preserve usable controls and graph space before desktop
alignment.

## Extension checklist

1. Reuse existing tokens and component classes.
2. Preserve the semantic color assignments and five-size type scale.
3. Keep important actions and states high contrast and structure quiet.
4. Align spacing to the established family and nearby elements.
5. Use borders and surface brightness, not shadows, for depth.
6. Use UI type by default and monospace only for exact data.
7. Design keyboard, pointer, touch, compact-screen, empty, and error behavior
   with the default state.
8. Check contrast, focus visibility, target size, clipping, zoom, and reduced
   motion before completing a visual change.

[safe-rules]: https://anthonyhobday.com/sideprojects/saferules/
