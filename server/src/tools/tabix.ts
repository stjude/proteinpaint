import serverconfig from '../serverconfig.js'
import type { ToolSpec, FieldSpec } from './index.ts'
import { regionPattern } from './regions.ts'

/*
Spec of the tabix operations. See index.ts for how a spec is checked and used.

A read of a url file runs in the cache dir of the url, where tabix keeps the index that it downloads, see
cache_index in utils.js.
*/

/** a bgzipped, tabix-indexed file under tp or cachedir, or a url */
const file: FieldSpec = { type: 'fileOrUrl', roots: ['tp', 'cache'] }
/** the cache dir of a url file, or none for a local file */
const dir: FieldSpec = { type: 'file', roots: ['cache'], optional: true }

export const specs: Record<string, ToolSpec> = {
	'tabix.query': {
		bin: () => serverconfig.tabix,
		fields: {
			file,
			// the 1000 regions of a request at most, see utils.validateRglst()
			regions: { type: 'list', item: { type: 'string', pattern: regionPattern, maxLength: 128 }, maxItems: 1000 },
			dir
		},
		argv: ['$file', '...$regions'],
		cwd: '$dir'
	},
	'tabix.header': {
		bin: () => serverconfig.tabix,
		fields: { file, dir },
		argv: ['-H', '$file'],
		cwd: '$dir'
	},
	'tabix.listChrs': {
		bin: () => serverconfig.tabix,
		fields: { file, dir },
		argv: ['-l', '$file'],
		cwd: '$dir'
	}
}
