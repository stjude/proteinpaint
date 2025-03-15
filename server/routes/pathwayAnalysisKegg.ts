import serverconfig from '#src/serverconfig.js'
import type { PathwayAnalysisKeggRequest, PathwayAnalysisKeggResponse, RouteApi } from '#types'
import { spawn } from 'child_process'

/*
given pathway ID and customization options, return the customized info from kgml file for the pathway map
*/

export const api: RouteApi = {
	endpoint: 'pathwayAnalysisKegg',
	methods: {
		get: {
			init,
			request: {
				typeId: 'PathwayAnalysisKeggRequest'
			},
			response: {
				typeId: 'PathwayAnalysisKeggResponse'
			}
		}
	}
}

function init() {
	return async (req: any, res: any): Promise<void> => {
		try {
			const query: PathwayAnalysisKeggRequest = req.query
			const pathwayId = query.keggid
			const compoundJson = query.compoundJson
			const keggPathwayData = await getPathwayAnalysisKegg(pathwayId, compoundJson)
			res.send({ keggPathwayData } satisfies PathwayAnalysisKeggResponse)
		} catch (e: any) {
			console.log(e)
			res.status(404).send('Pathway analysis id not found')
		}
	}
}

async function getPathwayAnalysisKegg(pathwayId, compoundJson) {
	return new Promise((resolve, reject) => {
		const cmd = [`${serverconfig.binpath}/utils/pathwayAnalysisKegg.py`, JSON.stringify(compoundJson), pathwayId]
		const ps = spawn(serverconfig.python, cmd)

		let output = ''
		let error = ''
		ps.stdout.on('data', data => {
			output += data
		})
		ps.stderr.on('data', data => {
			error += data
		})
		ps.on('close', code => {
			if (code === 0) {
				resolve(output)
			} else {
				reject(new Error(`Python script failed with code ${code}: ${error}`))
			}
		})
	})
}
