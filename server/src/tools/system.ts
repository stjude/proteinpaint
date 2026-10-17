import type { ToolSpec } from './index.ts'

/*
Spec of the OS commands that the server runs. See index.ts for how a spec is checked and used.
*/

export const specs: Record<string, ToolSpec> = {
	// the macOS virtual memory statistics, for the GRIN2 lesion cap
	vm_stat: {
		bin: () => 'vm_stat',
		fields: {},
		argv: []
	}
}
