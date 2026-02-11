# Table Restore Row Order Feature

## Overview

The `allowRestoreRowOrder` feature allows users to restore the original row order of a table after sorting. When enabled, a "Restore row order" button appears after the user sorts the table, which can be clicked to return the rows to their original order.

## Usage

### Basic Example

```typescript
import { renderTable } from '#dom'
import { select } from 'd3-selection'

const columns = [
	{ label: 'Name', sortable: true },
	{ label: 'Age', sortable: true },
	{ label: 'Department', sortable: true }
]

const rows = [
	[{ value: 'Alice' }, { value: 30 }, { value: 'Engineering' }],
	[{ value: 'Bob' }, { value: 25 }, { value: 'Design' }],
	[{ value: 'Charlie' }, { value: 35 }, { value: 'Management' }]
]

renderTable({
	div: select('#container'),
	columns,
	rows,
	header: { allowSort: true },
	allowRestoreRowOrder: true  // Enable the restore button
})
```

## Parameters

### `allowRestoreRowOrder?: boolean`

**Type:** `boolean`  
**Default:** `false`  
**Location:** `TableArgs` interface in `client/dom/types/table.ts`

When set to `true`, shows a "Restore row order" button after the user sorts the table. The button allows users to restore the original row order.

**Requirements:**
- At least one column must have `sortable: true`
- `header.allowSort` must be set to `true`

**Validation:**
The function will throw an error if `allowRestoreRowOrder` is set to `true` but no columns have `sortable: true`:

```
allowRestoreRowOrder can only be true when at least one column has sortable:true
```

## Behavior

### Initial State
- The "Restore row order" button is hidden when the table is first rendered
- The original row order is preserved internally

### After Sorting
- When the user clicks any sort button, the table rows are reordered
- The "Restore row order" button becomes visible

### After Restoring
- When the user clicks "Restore row order", the table rows return to their original order
- The button is hidden again
- Any row selections are maintained

## Implementation Details

### State Management
- `isSorted`: Tracks whether the table has been sorted by the user
- `originalRows`: Stores a copy of the original row order

### Button Styling
The restore button uses the `sjpp_apply_btn` CSS class for consistent styling with other buttons in the application.

### Row Selection Preservation
When restoring the original order, the implementation maintains the selected rows by:
1. Getting the currently checked row indices
2. Mapping them to the original row order
3. Updating the selected rows accordingly

## Examples

See `client/dom/examples/table-restore-order-example.ts` for complete working examples.

## Testing

Unit tests are available in `client/dom/test/table-restore.unit.spec.ts`, covering:
- Validation that `allowRestoreRowOrder` requires sortable columns
- Table rendering with the feature enabled
- Button visibility after sorting
- Order restoration functionality

## Related Files

- `client/dom/table.ts` - Main implementation
- `client/dom/types/table.ts` - Type definitions
- `client/dom/test/table-restore.unit.spec.ts` - Unit tests
- `client/dom/examples/table-restore-order-example.ts` - Usage examples
