import serverconfig from '../serverconfig.js'
import type { ToolSpec } from './index.ts'

/*
Spec of gfClient, which aligns a sequence with a blat gfServer. See index.ts for how a spec is checked and used.
*/

export const specs: Record<string, ToolSpec> = {
	'gfClient.align': {
		bin: () => serverconfig.gfClient,
		fields: {
			// the gfServer host and port and the dir of its 2bit file, from the genome config
			host: { type: 'string', pattern: /^[A-Za-z0-9][A-Za-z0-9.:_-]{0,252}$/, maxLength: 253 },
			port: { type: 'int', min: 1, max: 65535 },
			seqDir: { type: 'string', pattern: /^[A-Za-z0-9_./+-]{1,1024}$/, maxLength: 1024 },
			// the query fasta file that the server writes, and the psl output file
			queryFile: { type: 'file', roots: ['cache'] },
			outFile: { type: 'file', roots: ['cache'] }
		},
		argv: [
			'$host',
			'$port',
			'$seqDir',
			'$queryFile',
			'$outFile',
			'-q=dna',
			'-nohead',
			'-minScore=20',
			'-minIdentity=0',
			'-out=psl'
		]
	}
}
