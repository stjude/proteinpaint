import serverconfig from '../serverconfig.js'
import type { ToolSpec } from './index.ts'

/*
Spec of the straw operations, which read a .hic file. See index.ts for how a spec is checked and used.

straw <matrixType> <normalization> <file> <pos1> <pos2> <unit> <resolution>
*/

/** a chromosome name, then an optional :start:stop, where a coordinate may be fractional when computed from a view */
const hicPos = /^[A-Za-z0-9_.][A-Za-z0-9_.-]{0,99}(:\d{1,12}(\.\d{1,12})?:\d{1,12}(\.\d{1,12})?)?$/

export const specs: Record<string, ToolSpec> = {
	'hicstraw.query': {
		bin: () => serverconfig.hicstraw,
		fields: {
			matrixType: { type: 'enum', values: ['observed', 'expected', 'oe'] },
			// read from the hic file, such as NONE, VC, VC_SQRT, KR, SCALE, or GW_KR
			normalization: { type: 'string', pattern: /^[A-Z][A-Z0-9_]{0,31}$/, maxLength: 32 },
			file: { type: 'fileOrUrl' },
			pos1: { type: 'string', pattern: hicPos, maxLength: 256 },
			pos2: { type: 'string', pattern: hicPos, maxLength: 256 },
			unit: { type: 'enum', values: ['BP', 'FRAG'] },
			// a bin size in base pairs or fragments; the largest standard hic resolution is 2.5 Mb
			resolution: { type: 'int', min: 1, max: 100_000_000 }
		},
		argv: ['$matrixType', '$normalization', '$file', '$pos1', '$pos2', '$unit', '$resolution']
	}
}
