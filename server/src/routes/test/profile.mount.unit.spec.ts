import tape from 'tape'
import { setRoutes } from '@sjcrh/augen'
import { genomes } from '#src/initGenomesDs.js'
import * as barchart2 from '../profile.barchart2.ts'
import * as polar2 from '../profile.polar2.ts'
import * as radar2 from '../profile.radar2.ts'
import * as radarFacility2 from '../profile.radarFacility2.ts'
import * as impressionDistribution from '../../../routes/profile.impressionDistribution.ts'
import * as profileFormScores from '../termdb.profileFormScores.ts'

/*
Tests:
	profile routes (profile.* and termdb.profileFormScores) are not set up when the profile ds is not loaded
	profile routes are set up when the profile ds is loaded

the profile routes check the loaded genomes when augen sets up the route, so each case
sets the genomes before calling setRoutes()
*/

// returns the route methods that augen sets up from the profile.* and termdb.profileFormScores routes for the given genomes
function getMounted(_genomes) {
	for (const n in genomes) delete genomes[n]
	Object.assign(genomes, _genomes)
	const mounted: string[] = []
	const app = {}
	for (const method of ['get', 'post', 'put', 'delete']) app[method] = endpoint => mounted.push(method + ' ' + endpoint)
	try {
		setRoutes(app, [barchart2, polar2, radar2, radarFacility2, impressionDistribution, profileFormScores], { genomes })
	} finally {
		for (const n in genomes) delete genomes[n]
	}
	return mounted
}

tape('\n', function (test) {
	test.comment('-***- routes/profile.* mount specs -***-')
	test.end()
})

tape('profile routes are not set up when the profile ds is not loaded', test => {
	test.deepEqual(getMounted({}), [], 'should not set up the routes when no genome is loaded')
	test.deepEqual(
		getMounted({ hg38: { datasets: { SJLife: { label: 'SJLife' } } } }),
		[],
		'should not set up the routes when no ds is labeled profile'
	)
	test.end()
})

tape('profile routes are set up when the profile ds is loaded', test => {
	const mounted = getMounted({
		hg19: {},
		hg38: { datasets: { SJLife: { label: 'SJLife' }, profile: { label: 'profile' } } }
	})
	const endpoints = [
		'/termdb/profileBarchart2Scores',
		'/termdb/profilePolar2Scores',
		'/termdb/profileRadar2Scores',
		'/termdb/profileRadarFacility2Scores',
		'/termdb/profileImpressionDistribution',
		'/termdb/profileFormScores'
	]
	test.deepEqual(
		mounted,
		endpoints.flatMap(e => ['get ' + e, 'post ' + e]),
		'should set up the GET and POST routes when the profile ds is loaded'
	)
	test.end()
})
