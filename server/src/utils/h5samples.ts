import { runToolOutput } from '#src/tools/index.ts'

export async function getH5samples(file: string, path = 'samples'): Promise<string[]> {
	const stdout = await runH5dump(file, path)
	const samples = parseH5dumpStrings(stdout)
	if (!samples.length) throw new Error(`No samples found in HDF5 dataset '${path}' of ${file}`)
	return samples
}

async function runH5dump(file: string, path: string): Promise<string> {
	const { code, stdout, stderr } = await runToolOutput('h5dump.dataset', { dataset: path, file })
	if (code !== 0) throw new Error(`h5dump failed for dataset '${path}' of ${file}: ${stderr || `exit code ${code}`}`)
	return stdout
}

function parseH5dumpStrings(text: string): string[] {
	const start = text.indexOf('DATA {')
	if (start === -1) throw new Error('h5dump output does not contain a DATA block')

	const end = text.indexOf('\n   }', start)
	const data = end === -1 ? text.slice(start) : text.slice(start, end)
	const samples: string[] = []

	for (let i = 0; i < data.length; i++) {
		if (data[i] !== '"') continue
		let sample = ''
		i++
		for (; i < data.length; i++) {
			const char = data[i]
			if (char === '"') break
			if (char === '\\' && i + 1 < data.length) {
				i++
				sample += data[i]
			} else {
				sample += char
			}
		}
		samples.push(sample)
	}

	return samples
}

/** The dimensions of an HDF5 dataset, e.g. [1304718, 415] for a CpG matrix's beta/values, read from its header
 * alone (h5dump -H), so it takes milliseconds whatever the size of the dataset */
export async function getH5shape(file: string, dataset: string): Promise<number[]> {
	const { code, stdout, stderr } = await runToolOutput('h5dump.shape', { dataset, file })
	if (code !== 0) throw new Error(`h5dump failed for dataset '${dataset}' of ${file}: ${stderr || `exit code ${code}`}`)
	// DATASPACE  SIMPLE { ( 1304718, 415 ) / ( H5S_UNLIMITED, 415 ) }
	const dims = /DATASPACE\s+SIMPLE\s*\{\s*\(\s*([\d,\s]+)\)/.exec(stdout)?.[1]
	if (!dims) throw new Error(`no dimensions in the h5dump header of dataset '${dataset}' of ${file}`)
	return dims.split(',').map(Number)
}
