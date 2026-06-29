# Requirements Document

## Introduction

This feature adds a "Layout Type" selector to the Traditional Org Chart (both the standalone
`TraditionalOrgChart.jsx` page and the project-scoped `ProjectTraditionalOrgChart.jsx` page).

Users can instantly switch between three visual presentations of the same employee hierarchy
without altering any employee data, reporting relationships, or database records.
The selected layout is persisted with the project/chart state and is honoured by all
export and share flows.

The existing "Hierarchical Tree" rendering is **not modified** in any way. It simply becomes
one of the three selectable options and continues to be the default.

## Glossary

- **Layout_Selector**: The button-group UI control that allows the user to pick a layout type.
- **Layout_Engine**: The pure rendering module (`orgChartLayouts.js`) that computes node
  positions and connector lines for a given layout type.
- **Hierarchical_Tree**: The existing, unmodified org chart rendering (standard horizontal
  fan-out). Value: `"hierarchical"`. This is the default.
- **Grid_Layout**: A compact matrix view where the root sits at the top and all descendants
  are arranged in balanced columns. Value: `"grid"`.
- **Vertical_Tree**: A version of the hierarchical tree with increased vertical spacing,
  emphasising top-down chains. Value: `"vertical"`.
- **layoutType**: The string field (`"grid" | "hierarchical" | "vertical"`) stored in the
  chart state (both `trad_chart_state` key-value store and `proj_trad_chart_state`).
- **Chart_State**: The persisted UI state object currently holding `expandedIds`; extended
  to also carry `layoutType`.
- **Shared_Chart_Snapshot**: The JSON blob stored in `trad_shared_charts` /
  `proj_trad_shared_charts` and rendered by `SharedOrgChart.jsx`.
- **Export_Area**: The DOM element captured by the export utilities (`orgChartExport.js`)
  for PNG and PDF generation.
- **Standalone_Chart**: The Traditional Org Chart accessed from the main dashboard
  (`/org-chart/traditional`), backed by `trad_*` tables.
- **Project_Chart**: The Traditional Org Chart opened from a project
  (`/projects/:pid/traditional-org-chart`), backed by `proj_trad_*` tables.

---

## Requirements

### Requirement 1: Layout Selector UI

**User Story:** As a user viewing a Traditional Org Chart, I want a clearly labelled
button group that lets me choose between Grid Layout, Hierarchical Tree, and Vertical
Hierarchical Tree, so that I can switch the visual arrangement without leaving the page.

#### Acceptance Criteria

1. THE Layout_Selector SHALL display exactly three buttons with the labels
   "Grid Layout", "Hierarchical Tree", and "Vertical Hierarchical Tree" — matching
   the button labels defined in `orgChartLayouts.js`.
2. WHEN the Standalone_Chart page renders, THE Layout_Selector SHALL be present in the
   DOM. WHEN the Project_Chart page renders, THE Layout_Selector SHALL be present in
   the DOM.
3. IF the server-persisted chart state contains no `layoutType` value (absent or null),
   THEN THE Layout_Selector SHALL display "Hierarchical Tree" as the active button
   and set internal state to `"hierarchical"`.
4. IF the server-persisted chart state contains a valid `layoutType` value
   (`"grid"`, `"hierarchical"`, or `"vertical"`), THEN THE Layout_Selector SHALL
   display the corresponding button as active and set internal state to that value.
5. WHEN the user clicks a layout button, THE Layout_Selector SHALL apply a visually
   distinct active state (e.g. filled background, contrasting text) to the clicked
   button and remove the active state from the previously active button.
6. THE Layout_Selector SHALL be placed above the chart canvas, within the existing
   toolbar area, without removing or reordering any existing toolbar controls.

---

### Requirement 2: Hierarchical Tree Layout (Default — Unmodified)

**User Story:** As a user, I want the existing hierarchical tree to continue working
exactly as it does today when "Hierarchical Tree" is selected, so that nothing I already
rely on is broken.

#### Acceptance Criteria

1. IF `layoutType` is `"hierarchical"`, THEN THE Hierarchical_Tree SHALL render the
   chart using the constants `CARD_W=176`, `CARD_H=80`, `H_GAP=36`, `V_GAP=60` and
   the functions `subtreeWidth`, `renderTree`, and `OrgTreeCanvas` as they exist prior
   to this feature. The card positions, connector coordinates, and canvas dimensions
   SHALL be identical to the pre-feature baseline.
2. IF the employee list is empty or all root nodes have `undefined` children, THEN THE
   Hierarchical_Tree SHALL render a chart area that contains no node cards and no
   connector lines, and no uncaught JavaScript exception SHALL reach the browser runtime.
3. IF the server-persisted chart state contains no `layoutType` value (absent or null),
   THEN THE Layout_Selector SHALL activate `"hierarchical"` and THE Hierarchical_Tree
   SHALL render as the initial view.
4. THE Layout_Engine SHALL NOT modify `OrgTreeCanvas`, `subtreeWidth`, `renderTree`,
   or `measureCanvas` in `TraditionalOrgChart.jsx` or `ProjectTraditionalOrgChart.jsx`.

---

### Requirement 3: Grid Layout

**User Story:** As a user with a large team (50–5000+ employees), I want a Grid Layout
that groups all employees into balanced columns under their root manager, so that I can
see everyone on screen without excessive horizontal scrolling.

#### Acceptance Criteria

1. WHEN `layoutType` is `"grid"` and the root node's `isCollapsed` flag is `false`
   (expanded), THE Grid_Layout SHALL render the root node at the top of the canvas.
2. WHEN `layoutType` is `"grid"`, THE Grid_Layout SHALL collect all descendants of the
   root node using breadth-first traversal and arrange them in a matrix of columns
   below the root, where each column has an equal number of cells except the last
   column, which MAY have fewer cells filled left-to-right with no empty interior cells.
3. THE Grid_Layout SHALL auto-calculate the number of columns as
   `min(12, max(1, ceil(sqrt(N))))` where N is the total descendant count regardless
   of individual node collapse state, producing a roughly square arrangement.
4. THE Grid_Layout SHALL draw connector lines from the root node's bottom edge down
   to a horizontal bar, and from that bar a vertical drop line to the top of each column.
5. WHEN `layoutType` is `"grid"` and the root node's `isCollapsed` flag is `true`,
   THE Grid_Layout SHALL display only the root node with no descendant cells rendered.
6. WHEN `layoutType` is `"grid"` and N is 0 (root has no descendants), THE Grid_Layout
   SHALL display only the root node with no matrix cells and no connector lines.
7. THE Grid_Layout SHALL complete the initial BFS layout calculation for a dataset of
   5000 or more employees within 500ms measured from the moment `layoutType` is set
   to `"grid"` to the moment the canvas is repainted.
8. THE Grid_Layout SHALL NOT alter any employee `manager_id` or reporting relationship
   at any point during or after rendering.

---

### Requirement 4: Vertical Hierarchical Tree Layout

**User Story:** As a user preparing a presentation, I want a Vertical Hierarchical Tree
that renders the hierarchy with more vertical breathing room between levels, so that
reporting chains are easier to trace top-to-bottom.

#### Acceptance Criteria

1. WHEN `layoutType` is `"vertical"`, THE Vertical_Tree SHALL render connector lines
   using a stub-from-parent-bottom → horizontal bar → vertical drop-to-child geometry
   (matching the Hierarchical_Tree connector shape) with `V_GAP=80px` and `H_GAP=40px`
   instead of the Hierarchical_Tree values of 60px and 36px respectively.
2. WHEN `layoutType` is `"vertical"`, THE Vertical_Tree SHALL assign every parent node
   a `top` CSS value strictly less than the `top` CSS value of any of its children.
3. WHEN `layoutType` is `"vertical"` and a parent has a single child, THE Vertical_Tree
   SHALL set the child's horizontal centre to equal the parent's horizontal centre.
   WHEN a parent has multiple children, THE Vertical_Tree SHALL centre the group of
   children horizontally under the parent's midpoint with equal horizontal spacing
   between siblings.
4. WHEN the user clicks the expand/collapse button on a node in THE Vertical_Tree,
   exactly the direct children of that node SHALL toggle visibility, and no other
   nodes SHALL change their expanded or collapsed state.
5. THE Vertical_Tree SHALL NOT alter any employee `manager_id` or reporting relationship
   at any point during or after rendering.

---

### Requirement 5: Instant Layout Switching

**User Story:** As a user, I want clicking a different layout button to immediately
redraw the chart in the new layout, so that I can compare layouts without navigating away.

#### Acceptance Criteria

1. WHEN the user clicks a layout button in THE Layout_Selector, THE Chart_State SHALL
   update `layoutType` in local component state to one of the three valid values:
   `"grid"`, `"hierarchical"`, or `"vertical"`.
2. WHEN `layoutType` changes, THE Layout_Engine SHALL render the new layout without
   displaying a loading spinner or skeleton screen during the transition.
3. WHEN switching layouts, the `expandedSet` (the set of node IDs that are expanded)
   SHALL contain the same IDs before and after the switch.
4. WHEN switching layouts, the `lineSettings` object (connector color and width) and
   all per-node box style overrides stored in `nodeColors` SHALL be identical before
   and after the switch.
5. WHEN switching layouts, THE Layout_Engine SHALL NOT call any API endpoint that
   modifies employee records, `manager_id` values, or database rows.

---

### Requirement 6: Persist Layout Type with Chart State

**User Story:** As a user who has chosen a preferred layout, I want the selected layout
to be saved when I click "Save Chart", so that the chart reopens in the same layout
the next time I visit.

#### Acceptance Criteria

1. WHEN the user clicks "Save Chart", THE Chart_State SHALL include `layoutType` in the
   persisted state payload for both the Standalone_Chart and the Project_Chart.
2. WHEN the chart page loads and the server-persisted state contains a `layoutType`
   value that is a non-null, non-empty string equal to `"grid"`, `"hierarchical"`, or
   `"vertical"`, THE Layout_Selector SHALL restore that layout automatically.
3. WHEN the chart page loads and the server-persisted state contains no `layoutType`
   (absent), a null `layoutType`, or an empty-string `layoutType`, THE Layout_Selector
   SHALL default to `"hierarchical"`.
4. IF the server-persisted state contains a `layoutType` value that is a non-empty
   string but is not one of `"grid"`, `"hierarchical"`, or `"vertical"`, THEN
   THE Layout_Selector SHALL treat it as `"hierarchical"` without throwing an error.

---

### Requirement 7: Exports Respect Selected Layout

**User Story:** As a user, I want all exports (PNG, PDF, Export Team) to capture the
chart exactly as it appears in the currently selected layout, so that what I export
matches what I see on screen.

#### Acceptance Criteria

1. WHEN the user triggers "Export Full PNG" while `layoutType` is one of `"grid"`,
   `"hierarchical"`, or `"vertical"`, THE Export_Area SHALL contain the chart
   rendered in that layout type at the moment the export is triggered.
2. WHEN the user triggers "Export Full PDF" while `layoutType` is one of `"grid"`,
   `"hierarchical"`, or `"vertical"`, THE Export_Area SHALL contain the chart
   rendered in that layout type at the moment the export is triggered.
3. WHEN the user opens the subtree export dialog, selects an employee, and triggers
   the export, THE Export_Area SHALL render that employee's subtree using the
   currently active `layoutType`.
4. WHEN the user triggers any export while chart data is still loading (loading
   state is `true`), THE export button SHALL remain disabled and no export SHALL
   be initiated.
5. IF an export operation fails (e.g. canvas capture throws an error), THEN the
   application SHALL display a user-visible error message and SHALL NOT leave the
   UI in a permanently disabled state.

---

### Requirement 8: Share Links Preserve Layout

**User Story:** As a user sharing a chart, I want the shared link to open in the same
layout I was viewing when I generated the link, so that recipients see the intended
presentation.

#### Acceptance Criteria

1. WHEN the user generates a "Share Full Chart" link, THE Shared_Chart_Snapshot SHALL
   include a `layoutType` field set to one of `"grid"`, `"hierarchical"`, or
   `"vertical"` — the value that was active at the time of sharing.
2. WHEN the user generates a "Share Team" link, THE Shared_Chart_Snapshot SHALL
   include a `layoutType` field set to one of `"grid"`, `"hierarchical"`, or
   `"vertical"` — the value that was active at the time of sharing.
3. WHEN `SharedOrgChart.jsx` loads a snapshot whose `layoutType` field is `"grid"`,
   `"hierarchical"`, or `"vertical"`, THE chart SHALL render using the corresponding
   Grid_Layout, Hierarchical_Tree, or Vertical_Tree renderer respectively.
   IF `layoutType` contains an unrecognised value, THE chart SHALL render using the
   Hierarchical_Tree renderer.
4. WHEN `SharedOrgChart.jsx` loads a snapshot where `layoutType` is absent or null
   (i.e. a legacy shared link created before this feature existed), THE chart SHALL
   render using the `"hierarchical"` layout as a fallback.

---

### Requirement 9: Web Chart Export Respects Layout

**User Story:** As a user exporting a web chart (Export Web Chart / Share Full Chart
via `ExportWebChartModal`), I want the exported web chart to carry the selected layout
type in its configuration, so that anyone who opens the exported web chart sees the
correct layout.

#### Acceptance Criteria

1. WHEN `buildChartData()` is called in `TraditionalOrgChart.jsx`, the returned object
   SHALL contain a `layoutType` property set to the currently active layout value
   (`"grid"`, `"hierarchical"`, or `"vertical"`).
2. WHEN `buildChartData()` is called in `ProjectTraditionalOrgChart.jsx`, the returned
   object SHALL contain a `layoutType` property set to the currently active layout value.
3. WHEN `SharedOrgChart.jsx` receives a `chartData` object whose `layoutType` property
   is `"grid"`, `"hierarchical"`, or `"vertical"`, THE chart SHALL render in that
   layout automatically without requiring any user interaction.
4. IF `buildChartData()` is called before the chart has fully loaded (loading state is
   `true`), THE returned object SHALL still include a `layoutType` property set to the
   current local state value (not undefined).

---

### Requirement 10: Backward Compatibility

**User Story:** As an existing user, I want all current features of the Traditional Org
Chart and every other part of the application to continue working exactly as before,
so that adopting this new feature does not break anything.

#### Acceptance Criteria

1. THE Layout_Engine SHALL NOT modify any existing component, function, constant, or
   utility outside of `orgChartLayouts.js`, `TraditionalOrgChart.jsx`,
   `ProjectTraditionalOrgChart.jsx`, and `SharedOrgChart.jsx`.
2. THE Layout_Engine SHALL NOT modify `OrgTreeCanvas`, `subtreeWidth`, `renderTree`,
   or `measureCanvas` inside `TraditionalOrgChart.jsx` or `ProjectTraditionalOrgChart.jsx`.
3. THE Layout_Engine SHALL NOT modify any server route, database schema migration, or
   API endpoint beyond including `layoutType` in the JSON body of the existing
   `saveState` and `shareChart` API calls.
4. IF a saved state JSON (in either `trad_chart_state` or `proj_trad_chart_state`)
   does not contain a `layoutType` key, THEN loading that state SHALL complete without
   displaying an error modal and without throwing an uncaught exception, defaulting
   to `"hierarchical"` as specified in Requirement 6 Criterion 3.
5. WHEN a user performs any of the following operations — Save Chart, Open Existing
   Project, Import Excel, Export PNG, Export PDF, Export Team, Share Full Chart,
   Share Team, Export Web Chart, Undo, Redo, Expand/Collapse, Color Customization —
   on a chart that has this feature installed, each operation SHALL complete
   successfully and produce the same output type (file download, modal, confirmation
   message) as it did before this feature was added.
