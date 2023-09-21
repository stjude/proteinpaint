import { Genome } from '#shared/types/index'

/**
from multiple possible data sources, parse all into an array and return
app drawer will supply data for "snvText, svText, cnvText"
while the "File" and "Url" can come from url parameters e.g. host?disco=1&snvFile=path/to/file

Move these types to shared/server if used across multiple files

*/
type MutationListEntry = {
	/**json list of data points, each element is an event with "dt:int" and ready to be used by disco */
	dt: number
	chr: string
	position: number
	gene: string
	class: string
}

type DiscoPlotArgs = {
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
	3. chrB
	4. posB
	5. geneA
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
}

//... more datatypes can be added later

/**
 *  TODO add description about func
 * @param arg
 * @param genomeObj
 * @param holder
 * @returns
 */

export async function launch(arg: DiscoPlotArgs, genomeObj: Genome, holder: Element) {
	const mlst = await getMlst(arg)
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
					extension: 'ts'
					/*
					overrides: {
						label: {
							showPrioritizeGeneLabelsByGeneSets: !!genomeObj.geneset
						}
					}
					*/
				}
			]
		}
	}
	const plot = await import('#plots/plot.app.js')
	const plotAppApi = await plot.appInit(opts)
	return plotAppApi
}

/**
 * TODO add description about func
 * @param arg
 * @returns
 */

async function getMlst(arg: DiscoPlotArgs) {
	if (Array.isArray(arg.mlst)) {
		// has preformatted in
		return arg.mlst
	}

	// parse data from text and files and append to one mlst[] array
	const mlst = []
	if (arg.snvText) {
		// TODO parse and append to mlst
	}

	// ...

	return mlst
}
