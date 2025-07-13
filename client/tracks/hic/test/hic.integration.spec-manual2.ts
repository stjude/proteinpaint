import tape from 'tape'
import { dofetch2 } from '../../../common/dofetch.js'
import { hicData } from './hicData.ts'
import { hicparsestat } from '../../../tracks/hic/data/parseData.ts'
//import { runproteinpaint } from '../../../test/front.helpers.js'

// function getHolder() {
// 	return d3s
// 		.select('body')
// 		.append('div')
// 		.style('border', '1px solid #aaa')
// 		.style('padding', '5px')
// 		.style('margin', '5px')
// }

async function getGenomes(genome: string) {
	const response = await dofetch2('genomes')
	const g = response.genomes[genome]
	g.chrlookup = {}
	for (const nn in g.majorchr) {
		g.chrlookup[nn.toUpperCase()] = { name: nn, len: g.majorchr[nn], major: true }
	}
	if (g.minorchr) {
		for (const nn in g.minorchr) {
			g.chrlookup[nn.toUpperCase()] = { name: nn, len: g.minorchr[nn] }
		}
	}
	return g
}

tape('\n', test => {
	test.comment('-***- tracks/hic integration -***-')
	test.end()
})

//TODO: Get rid of getGenomes, only supply what's need, and move to unit test
tape('hicparsestat()', async test => {
	test.plan(13)

	let result: string | undefined, message: string

	const hic: any = { ...hicData.hic.v8 }
	hic.genome = await getGenomes('hg19')
	const j: any = { ...hicData.serverResponse.v8 }

	//Return for missing server response
	message = `Should return for missing hic file message`
	result = hicparsestat(hic, undefined)
	test.equal(result, 'cannot stat hic file', message)

	//Update hic normalization
	message = `Should change hic normalization to match server response`
	hic.normalization = ['ABC']
	result = hicparsestat(hic, j)
	test.equal(hic.normalization, j.normalization, message)

	//Update hic version
	message = `Should change hic normalization to match server response`
	hic.version = 100
	result = hicparsestat(hic, j)
	test.equal(hic.normalization, j.normalization, message)

	//Missing chromosomes
	message = `Should return message for missing chromosomes in server response`
	j.Chromosomes = undefined
	result = hicparsestat(hic, j)
	test.equal(result, 'Chromosomes not found in file stat', message)

	//Missing chrorder
	message = `Should return message for missing chrorder in server response`
	j.Chromosomes = hicData.serverResponse.v8.Chromosomes
	delete j.chrorder
	result = hicparsestat(hic, j)
	test.equal(result, '.chrorder[] missing', message)

	//Update hic chrorder
	message = `Should change hic chrorder to match server response`
	hic.chrorder = ['chr1']
	j.chrorder = hicData.serverResponse.v8.chrorder
	result = hicparsestat(hic, j)
	test.equal(hic.chrorder, j.chrorder, message)

	//Empty chrorder
	message = `Should return message for empty chrorder array in server response`
	j.chrorder = []
	result = hicparsestat(hic, j)
	test.equal(result, '.chrorder[] empty array', message)

	//Missing bpresolution
	message = `Should return message for missing bpresolution in server response`
	j.chrorder = hicData.serverResponse.v8.chrorder
	delete j['Base pair-delimited resolutions']
	result = hicparsestat(hic, j)
	test.equal(result, 'Base pair-delimited resolutions not found in file stat', message)

	//Invalid bpresolution
	message = `Should return message for invalid bpresolution in server response`
	j['Base pair-delimited resolutions'] = 'test'
	result = hicparsestat(hic, j)
	test.equal(result, 'Base pair-delimited resolutions should be array', message)

	//Update hic bpresolution
	message = `Should change hic bpresolution to match server response`
	hic.bpresolution = [10]
	j['Base pair-delimited resolutions'] = hicData.serverResponse.v8['Base pair-delimited resolutions']
	result = hicparsestat(hic, j)
	test.equal(hic.bpresolution, j['Base pair-delimited resolutions'], message)

	//Missing fragresolution
	message = `Should return message for missing fragresolution in server response`
	j['Base pair-delimited resolutions'] = hicData.serverResponse.v8['Base pair-delimited resolutions']
	delete j['Fragment-delimited resolutions']
	result = hicparsestat(hic, j)
	test.equal(result, 'Fragment-delimited resolutions not found in file stat', message)

	//Invalid fragresolution
	message = `Should return message for invalid fragresolution in server response`
	j['Fragment-delimited resolutions'] = 'test'
	result = hicparsestat(hic, j)
	test.equal(result, 'Fragment-delimited resolutions is not array', message)

	//Update hic fragresolution
	message = `Should change hic fragresolution to match server response`
	hic.fragresolution = [10]
	j['Fragment-delimited resolutions'] = hicData.serverResponse.v8['Fragment-delimited resolutions']
	result = hicparsestat(hic, j)
	test.equal(hic.fragresolution, j['Fragment-delimited resolutions'], message)
})
