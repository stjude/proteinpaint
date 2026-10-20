import serverconfig from '../serverconfig.js'
import type { ToolSpec, Field } from './index.ts'
import { chrPattern } from './regions.ts'

/*
Spec of the bigBed tools of ucsc. See index.ts for how a spec is checked and used.
*/

/** a bigBed file under tp, or a url; no server code writes a bigBed file to cachedir */
const file: Field = { type: 'fileOrUrl', roots: ['tp'] }
/** a 0-based coordinate */
const coord: Field = { type: 'int', min: 0, max: 999_999_999_999 }

export const specs: Record<string, ToolSpec> = {
	'bigBed.query': {
		bin: () => serverconfig.bigBedToBed,
		fields: { chr: { type: 'string', pattern: chrPattern, maxLength: 100 }, start: coord, end: coord, file },
		argv: ['-chrom=$chr', '-start=$start', '-end=$end', '$file', 'stdout']
	},
	'bigBed.byName': {
		bin: () => serverconfig.bigBedNamedItems,
		fields: {
			file,
			// a name in an extra index of the file, such as a snp rsid or a gene name
			name: { type: 'string', pattern: /^[A-Za-z0-9_.][A-Za-z0-9_.:+-]{0,199}$/, maxLength: 200 }
		},
		argv: ['$file', '$name', 'stdout']
	},
	'bigBed.info': {
		bin: () => serverconfig.bigBedInfo,
		fields: { file },
		argv: ['$file']
	}
}
