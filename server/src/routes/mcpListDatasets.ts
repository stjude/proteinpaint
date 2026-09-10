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

function init({ genomes }) {
	return async (req, res) => {
		const datasets: { genome: string; dslabel: string }[] = []
		for (const genomeName in genomes) {
			const genome = genomes[genomeName]
			for (const dslabel in Object.keys(genome.datasets || {})) {
				datasets.push({ genome: genomeName, dslabel })
			}
		}
		res.send({ datasets })
	}
}
