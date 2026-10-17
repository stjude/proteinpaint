import { setRoutes as setAugenRoutes } from '@sjcrh/augen'
import { genomes as loadedGenomes } from '../initGenomesDs.js'
import * as cardsjson from '../routes/cardsjson.ts'
import * as isoformbycoord from '../routes/isoformbycoord.ts'
import * as mdsexpressionrank from '../routes/mdsexpressionrank.ts'
import * as mdsgenevalueonesample from '../routes/mdsgenevalueonesample.ts'
import * as mdssvcnv from '../routes/mdssvcnv.ts'
import * as samplematrix from '../routes/samplematrix.ts'

/*
Sets up, in a test route table, the routes that app.unorg.js set up before they were moved to route files, so that
the specs that drive these routes with app.unorg.js setRoutes() still reach them.

The init getter of a legacy mds route reads the loaded genomes, so the loaded genomes are the given ones while the
routes are set up, and are restored after.
*/
export const movedRoutes = [cardsjson, isoformbycoord, mdsexpressionrank, mdsgenevalueonesample, mdssvcnv, samplematrix]

export function setMovedRoutes(app, genomes) {
	const prev = { ...loadedGenomes }
	for (const k of Object.keys(loadedGenomes)) delete loadedGenomes[k]
	Object.assign(loadedGenomes, genomes)
	try {
		setAugenRoutes(app, movedRoutes, { genomes })
	} finally {
		for (const k of Object.keys(loadedGenomes)) delete loadedGenomes[k]
		Object.assign(loadedGenomes, prev)
	}
}
