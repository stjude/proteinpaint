import type { Genome } from '#types'
import type { Selection } from 'd3-selection'
import { appInit } from '../plot.app'
import { showErrorsWithCounter } from '../../dom/sayerror'
import { mclass } from '#shared/common.js'

type SnvEntry = {
	dt: 1
	chr: string
	position: number
	gene: string
	mname: string
	class: string
}
type CnvEntry = {
	dt: 4
	chr: string
	start: number
	stop: number
	value: number
}
type SvEntry4Cols = {
	dt: number
	chrA: string
	posA: number
	chrB: string
	posB: number
}

type SvEntry6Cols = {
	dt: number
	chrA: string
	posA: number
	geneA: string
	chrB: string
	posB: number
	geneB: string
}

type SvEntry = SvEntry4Cols | SvEntry6Cols

type MutationListEntry = SnvEntry | CnvEntry | SvEntry

/** When disco is embedded, the arguments below are nested under arg.disco */
export type DiscoPlotArgs = {
	/**optional array of preparsed mutation events, from runpp() */
	mlst?: MutationListEntry[]

	/**tabular text of snv data, with follow columns.
	1. chr
	2. position
	3. gene
	4. aachange
	5. class
	each line is parsed into an object:
	{dt:1, chr:, position:, gene:, class:} */
	snvText?: string
	/**tp path to a text file of same content as snvText */
	snvFile?: string
	/**url of a text file of same content as snvText */
	snvUrl?: string

	/**tabular text of sv/fusion data, with follow columns
	1. chrA
	2. posA
	3. geneA
	4. chrB
	5. posB
	6. geneB
	each line is parsed into an object:
	{dt:2, chrA, posA, geneA, chrB, posB, geneB} */
	svText?: string
	svFile?: string
	svUrl?: string

	/**tabular text of cnv data, with following columns
	1. chr
	2. start
	3. stop
	4. value
	each line is parsed into an object
	{chr, start, stop, value} */
	cnvText?: string
	cnvFile?: string
	cnvUrl?: string
	settings?: any
}

//... more datatypes can be added later

/**
 * parse input data into mlst[] and pass to disco
 * TODO display data error on ui
 * TODO later make this script a native part of disco, so that runpp() directly invokes plot.app.js...
 * @param arg
 * @param genomeObj
 * @param holder
 * @returns
 */

export async function launch(arg: DiscoPlotArgs, genomeObj: Genome, holder: Selection<HTMLDivElement, any, any, any>) {
	const [mlst, errors] = await getMlst(arg)

	if (errors?.length) {
		return showErrorsWithCounter(errors, holder)
	}

	const opts = {
		holder,
		vocabApi: {
			// api is required by plot.app.js, so create a mock one for the adhoc data
			vocab: { terms: [] },
			main: () => {
				return //fix so linter doesn't yell while this is in development
			},
			getTermdbConfig: () => {
				return {}
			}
		},
		state: {
			args: {
				data: mlst,
				genome: genomeObj
			},
			plots: [
				{
					chartType: 'Disco',
					subfolder: 'disco',
					extension: 'ts',
					/** NOTE: Users should only override the settings in the default
					 * settings.Disco:{}, not the entire settings:{} object.*/
					overrides: { Disco: arg?.settings || {} }
				}
			]
		}
	}

	const plotAppApi = await appInit(opts)
	return plotAppApi
}

/**
 * from multiple possible data sources, parse mutation events and put everything into one array and return, for disco rendering
 * app drawer will supply data for "snvText, svText, cnvText"
 * while the "File" and "Url" can come from url parameters e.g. host?disco=1&snvFile=path/to/file
 * @param arg
 * @returns
 */
async function getMlst(arg: DiscoPlotArgs): Promise<[MutationListEntry[], string[] | null]> {
	if (Array.isArray(arg.mlst)) {
		// has preformatted in runpp()
		return [arg.mlst, null]
	}

	// parse data from text and files and append to one mlst[] array
	const mlst = [] as MutationListEntry[]
	const errors = [] as string[]

	if (arg.snvText) parseSnvText(arg.snvText, mlst, errors)
	if (arg.svText) parseSvText(arg.svText, mlst, errors)
	if (arg.cnvText) parseCnvText(arg.cnvText, mlst, errors)

	// if (arg.snvFile) {
	// }
	// if (arg.snvUrl) {
	// }
	// if (arg.svFile) {
	// }
	// if (arg.svUrl) {
	// }
	// if (arg.cnvFile) {
	// }
	// if (arg.cnvUrl) {
	// }

	return [mlst, errors]
}

function parseSnvText(text: string, mlst: MutationListEntry[], errors: string[]) {
	// TODO share a parser for snvindel text file with samples (with header line and non-fixed columns), but should not require sample here
	for (const line of text.trim().split('\n')) {
		const l = line.trim().split('\t')

		if (l.length != 5) {
			errors.push('snv input not equal to 5 columns')
			continue
		}

		let m: SnvEntry
		try {
			m = {
				dt: 1,
				chr: l[0],
				position: Number(l[1]),
				gene: l[2],
				mname: l[3],
				class: validateMutation(l[4], errors)
			}
		} catch (e: any) {
			errors.push(e)
			continue
		}
		mlst.push(m)
	}
}

function parseSvText(text: string, mlst: MutationListEntry[], errors: string[]) {
	for (const line of text.trim().split('\n')) {
		const l = line.trim().split('\t')
		if (l.length < 4 || l.length > 6) {
			errors.push('sv input not equal to 4 or 6 columns')
			continue
		}
		let m: SvEntry
		try {
			const length: number = l.length
			if (length == 4) {
				m = {
					dt: 2,
					chrA: l[0],
					posA: Number(l[1]),
					chrB: l[2],
					posB: Number(l[3])
				}
			} else {
				m = {
					dt: 2,
					chrA: l[0],
					posA: Number(l[1]),
					geneA: l[2],
					chrB: l[3],
					posB: Number(l[4]),
					geneB: l[5]
				}
			}
		} catch (e: any) {
			errors.push(e)
			continue
		}
		mlst.push(m)
	}
}

function parseCnvText(text: string, mlst: MutationListEntry[], errors: string[]) {
	for (const line of text.trim().split('\n')) {
		const l = line.trim().split('\t')
		if (l.length != 4) {
			errors.push('cnv input not equal to 4 columns')
			continue
		}
		let m: CnvEntry
		try {
			m = {
				dt: 4,
				chr: l[0],
				start: Number(l[1]),
				stop: Number(l[2]),
				value: Number(l[3])
			}
		} catch (e: any) {
			errors.push(e)
			continue
		}
		mlst.push(m)
	}
}

function validateMutation(mutation: string, errors: string[]) {
	const mut2check = mutation.toLowerCase()
	const foundMutation = Object.values(mclass).find(
		(m: any) => m.key.toLowerCase() === mut2check || m.label.toLowerCase() === mut2check
	) as any
	if (foundMutation) {
		return foundMutation.key
	} else {
		errors.push(`Invalid mutation class: ${mutation}`)
	}
}
