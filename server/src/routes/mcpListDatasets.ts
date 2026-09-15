import type { RouteApi, RoutePayload } from '#types'

const payload: RoutePayload = {
	init,
	request: { typeId: 'McpListDatasetsRequest' },
	response: { typeId: 'McpListDatasetsResponse' }
}

export const api: RouteApi = {
	endpoint: 'mcp/listDatasets',
	methods: { get: payload }
}

//genomes is declared and populated in the initGenomesDs.js and it is populated based on the datasets
//listed in serverconfig.json.
function init({ genomes }) {
	return async (req, res) => {
		const datasets: { genome: string; dslabel: string }[] = []
		for (const genomeName in genomes) {
			const genome = genomes[genomeName]
			//For each genome listed in the serverconfig.json, we get the datasets
			for (const dslabel in genome.datasets || {}) {
				//We get each dataset from the genome
				const ds = genome.datasets[dslabel]
				//Make an entry with genomeName and datasetlabel
				const entry: any = { genome: genomeName, dslabel }
				//Select cohort from the dataset object (Check the termdb.test.ts for dataset's mds3 object)
				const selectCohort = ds.cohort?.termdb?.selectCohort
				//Check if the selectCohort has default cohort values.
				if (selectCohort) {
					entry.cohorts = selectCohort.values.map((v: any) => ({
						cohort: v.keys.join(','),
						label: v.label,
						isDefault: !!v.isdefault
					}))
				}
				//push the current entry to datasets
				datasets.push(entry)
			}
		}
		res.send({ datasets })
	}
}
