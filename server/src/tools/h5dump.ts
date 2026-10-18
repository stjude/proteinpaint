import type { ToolSpec } from './index.ts'

/*
Spec of h5dump, which prints a dataset of an HDF5 file. See index.ts for how a spec is checked and used.
*/

export const specs: Record<string, ToolSpec> = {
	'h5dump.dataset': {
		bin: () => 'h5dump',
		fields: {
			// the path of a dataset in the file, such as samples or /meta/samples/names; a segment does not start with a dot
			dataset: {
				type: 'string',
				pattern: /^\/?[A-Za-z0-9_][A-Za-z0-9_.]*(\/[A-Za-z0-9_][A-Za-z0-9_.]*)*$/,
				maxLength: 256
			},
			file: { type: 'file', roots: ['tp'] }
		},
		argv: ['-d', '$dataset', '$file']
	}
}
