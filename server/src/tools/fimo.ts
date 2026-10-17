import serverconfig from '../serverconfig.js'
import type { ToolSpec } from './index.ts'

/*
Spec of fimo, which scans a fasta file for the motifs of a motif db. See index.ts for how a spec is checked and used.
*/

export const specs: Record<string, ToolSpec> = {
	'fimo.scan': {
		bin: () => serverconfig.fimo || 'fimo',
		fields: {
			// the p-value threshold of a motif match
			thresh: { type: 'number', min: 0, max: 1 },
			// the motif db of the genome, from the genome config
			motifDb: { type: 'file', roots: ['tp'] },
			// the sequence file that the server writes
			fasta: { type: 'file', roots: ['cache'] }
		},
		argv: ['--parse-genomic-coord', '--verbosity', '1', '--text', '--thresh', '$thresh', '$motifDb', '$fasta']
	}
}
