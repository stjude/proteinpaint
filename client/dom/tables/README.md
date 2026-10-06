# TableBase

An extendable HTML table: sorting, filtering, paging, row selection, buttons and cell editing, with the
accessibility and safety defaults built in. It is the follow-up to `renderTable()` in `../table.ts`, which
still exists and is still used by many callers; nothing here replaces it yet.

The rule for this folder: **`TableBase` holds what most tables need. Anything else is a subclass**, not a new
option. For example, hover effects, `afterRender`-style hooks and barplot columns belong in a child class.

```ts
import { TableBase } from '#dom'

const table = new TableBase({
	div: holder, // d3 selection to render into
	ariaLabel: 'Samples', // name for screen readers: say what the table holds
	columns: [
		{ label: 'Sample', sortable: true, filterable: true },
		{ label: 'Age', sortable: true }
	],
	rows: [
		[{ value: 'S1' }, { value: 30 }],
		[{ value: 'S2' }, { value: 41 }]
	]
}).render()
```

`render()` builds the table (and can be called again to rebuild it). `remove()` takes it out of the page.

## Options

Options are grouped by concern. Types and per-field docs are in `tableTypes.ts`.

| Option                              | What it is for                                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `columns`                           | `label`, `width`, `align`, `nowrap`, `tooltip`, `headerTestId`, plus the feature flags `sortable`, `filterable`, `editable` and `validate` |
| `rows`                              | an array per row, one cell per column. A cell has `value`, `url`, `html` or `color` (see below)                                            |
| `styles`                            | appearance only: `striped`, `showLines`, `maxWidth`, `maxHeight`, `header`, `selectedRow`, `buttonsAlign`                                  |
| `selection`                         | `onSelect`, `singleMode`, `hideInput`, `selectedRows`, `selectAll`, `autoScroll`                                                           |
| `buttons`                           | action buttons below the table; they also make rows selectable                                                                             |
| `pagination`                        | `pageSize`, `pageSizeOptions`, `currentPage`, `onChange`                                                                                   |
| `onEdit`, `ariaLabel`, `dataTestId` | edit callback, accessible name, test id                                                                                                    |

Invalid options throw with a `TableBase:` message (missing `div`/`columns`/`rows`, a row whose length is not
the column count, a bad page size, a button without `text` or `callback`, an out-of-range `selectedRows`).

## Cells

A cell is shown by the first of these that applies: `url` (a link), `html`, `value`, `color`.

- `url` becomes a link only for `http`, `https`, `mailto` and relative urls. Anything else, such as
  `javascript:`, is shown as plain text.
- `html` is inserted as raw HTML. **The caller must sanitize it**; never pass user-controlled text.
- A cell with only a `color` is shown as a colored cell and named after its color for screen readers.
- After a render, each cell object has `__td`, the rendered `<td>`, for code that needs to put things in it.

## Sort and filter

A `sortable` and/or `filterable` column gets one icon button in its header. It shows the sort arrow
(⇅ unsorted, ▲ ascending, ▼ descending) and a filter funnel (an outline, filled while a filter is applied).
Each symbol shows its own state: the arrow turns blue while the column is sorted, and the funnel turns blue
(and fills) while it is filtered. Clicking the button opens a popup with
"Sort ascending", "Sort descending" and the filter input.

- Filtering is a case-insensitive substring match, and the filters of several columns combine with AND.
  On a number cell the filter also takes `>n`, `>=n`, `<n`, `<=n`, `=n` and `lo-hi`. Filter text is limited
  to 100 characters.
- Sorting treats a column of numeric strings (e.g. file names used as ids) as numbers. A row with no value in
  the sorted column keeps its position, and the other rows sort around it.
- Typing in the filter is debounced (250 ms), so the rows are redrawn after a pause rather than on every key.
  Pending text is applied at once when the field is committed (it loses focus), on Enter or Escape, when
  another column's popup opens, or when a sort is chosen. `setColumnFilter()` itself is not delayed.
- Both apply to all rows, not only the current page, and both send the table back to page 1.
- The same from code: `table.sortByColumn(colIdx, ascending?)` (without a direction it toggles) and
  `table.setColumnFilter(colIdx, text)`.
- Only the `<tbody>` is redrawn. The caller's `rows` array is never reordered or filtered.

## Editing

`editable: true` on a column lets the user click a text cell (or press Enter or F2 on it) to change it.
Enter or leaving the cell commits, Escape cancels. `onEdit({ rowIdx, colIdx, cell })` runs after a commit, with
`cell.value` already updated and `rowIdx` an index into the array you passed in.

- A cell that holds a number only accepts a number. Add `validate: text => boolean` to a text column to allow
  only what you expect. A rejected edit is reverted and `onEdit` is not called. Edits are limited to 500
  characters.
- **`cell.value` is raw user input.** The table cannot make it safe for a query, file path or shell. If you
  send it to a server, validate it there and use parameterized queries.
- Cells with a `url` or `html` are not editable. The table is not redrawn after an edit; call `update()` to
  apply the current sort and filter again.

## Selection and buttons

`selection` (or `buttons`) adds a selection column: checkboxes, or radios with `singleMode: true`.
A click on the input, a click anywhere on the row, and Enter or Space on a focused row all end in the same
place, so `onSelect(idx, input)` is the same in both modes.

- Indexes are always into the array you passed in, however the table is sorted, filtered or paged. Selection
  is kept by row, so it survives all three, and rows a filter hides stay selected.
- `table.getSelectedIndexes()` reads the selection. `table.setSelectedIndexes(idxs)` sets it from code, for
  example when app state changes; it does not call `onSelect`.
- `selectedRows` and `selectAll` preselect rows without calling `onSelect`. `autoScroll` scrolls the first
  preselected row into view on the first render.
- In multiple mode the header has a check-all box that acts on the displayed page.
- A button gets `callback(selectedIdxs, button)` and is disabled while nothing is selected. Its `onChange`
  runs on render and on every selection change.

## Pagination

`pagination: { pageSize }` shows a pager under the table. `table.goToPage(n)` and `table.setPageSize(n)`
do the same from code. `onChange({ currentPage, pageSize })` runs on a user change and when a sort or filter
sends the table back to page 1. Line numbers and striping continue across pages.

## Updating

| Call                    | What it does                                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `update()`              | redraws the body from the current rows, sort, filter and page                                                                                                |
| `update(rows)`          | replaces the table's data: re-indexes the rows, keeps the selection of rows that are still present (matched by object) and redraws. `onSelect` is not called |
| `render()`              | rebuilds everything, keeping the sort and filters                                                                                                            |
| `getOriginalIndex(row)` | the row's index in the data, or -1 if the table does not have it                                                                                             |

The table holds the array you give it, not a copy. Pass a new array to `update(rows)` rather than changing
the old one.

## Extending

Subclass `TableBase` and override the protected extension points:
`renderHeader`, `renderHeaderCell`, `renderBody`, `renderRow`, `renderCell`, `renderSelector`,
`createWrapper`, `createTable`, `createFooter`. Each builds one part of the table, so you override only the
part you change and call `super` for the rest.

```ts
class HoverTable extends TableBase {
	onHover?: (idx: number) => void // your own member; the base class has no hover option

	protected renderRow(row: TableBaseRow, rowIdx: number) {
		const tr = super.renderRow(row, rowIdx)
		tr.on('mouseover', () => this.onHover?.(this.getOriginalIndex(row)))
		return tr
	}
}
```

A hook that runs after every redraw is an override of `renderBody` that calls `super.renderBody()` first.
`../../plots/sc/view/SCSampleTable.ts` is the worked example. It adds a lookup of rows by sample id and a
hidden-able column, restores its buttons after each redraw, and changes what clicking a selected row means.

Useful protected members: `columns`, `originalRows`, `rows` (the displayed page), `tbody`, `thead`, `wrapper`,
`selection` (the resolved selection settings, including `onSelect`) and `styles`.

## Accessibility

- Header cells have `scope="col"`; a sortable column's `<th>` reports `aria-sort`.
- The header icon is a real `<button>` with an `aria-label` ("Sort and filter Name"), `aria-haspopup`,
  `aria-expanded` and `aria-controls`. Escape closes its popup and returns focus to it.
- Selection inputs are labelled by the row's first text cell. Rows are focusable and respond to Enter and Space.
  Editable cells are focusable, described ("Press Enter to edit"), and focus returns to the cell after an edit.
- A hidden live region announces a sort, a filter result count and a page change.
- Give every table an `ariaLabel`. `selection.hideInput` removes the selected state from screen readers, so
  only use it when the selection is shown another way.

## Files

| File                 | Holds                                                     |
| -------------------- | --------------------------------------------------------- |
| `TableBase.ts`       | the class                                                 |
| `tableTypes.ts`      | option, cell and column types                             |
| `tableSortFilter.ts` | sorting and filtering rows, and the numeric filter syntax |
| `tableColumnMenu.ts` | the header icon button and its popup                      |
| `tablePager.ts`      | the pager                                                 |
| `tableEdit.ts`       | editing a cell                                            |
| `tableUtils.ts`      | unique ids, url safety, shared button style               |

## Tests

Specs are in `test/`. From the `client` directory:

```bash
./test.sh "*.unit.spec.*" "name=[Tt]able*.unit"   # every table spec, including the old renderTable one
./test.sh "*.unit.spec.*" "name=TableBase.unit"   # just this class
```
