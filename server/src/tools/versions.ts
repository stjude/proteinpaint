import serverconfig from '../serverconfig.js'
import type { ToolSpec } from './index.ts'

/*
Spec of the version checks of the tools that the server requires. See index.ts for how a spec is checked and used.
*/

export const specs: Record<string, ToolSpec> = {
	'bcftools.version': {
		bin: () => serverconfig.bcftools,
		fields: {},
		argv: ['-v']
	}
}
