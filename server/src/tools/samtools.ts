import serverconfig from '../serverconfig.js'
import type { ToolSpec } from './index.ts'

/*
Spec of the samtools operations, other than the reads of bam files. See index.ts for how a spec is checked and used.
*/

export const specs: Record<string, ToolSpec> = {
	'samtools.index': {
		bin: () => serverconfig.samtools,
		// a bam slice that the server downloads to cachedir
		fields: { file: { type: 'file', roots: ['cache'] } },
		argv: ['index', '$file']
	}
}
