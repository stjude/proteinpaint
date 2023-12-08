import tape from 'tape'
import * as d3s from 'd3-selection'
import { dofetch2 } from '../../../common/dofetch.js'
import { hicData } from './hicData.ts'
import { init_hicstraw } from '../../../tracks/hic/hic.straw.ts'
import { hicparsestat } from '../../../tracks/hic/parse.genome.ts'
// import { runproteinpaint } from '../../../test/front.helpers.js'
// import { HicRunProteinPaintTrackArgs } from '../../../types/hic.ts'

/*
Tests:
	init_hicstraw() - TODO: needs more work
	hicparsestat()
	SKIPPED - hicparsefragdata()
 */

function getHolder() {
	return d3s
		.select('body')
		.append('div')
		.style('border', '1px solid #aaa')
		.style('padding', '5px')
		.style('margin', '5px')
		.node()
}

async function getGenomes(genome: string) {
	const response = await dofetch2('genomes')
	return response.genomes[genome]
}

tape('\n', test => {
	test.pass('-***- tracks/hic integration -***-')
	test.end()
})

tape('init_hicstraw()', async test => {
	//test.plan()
	const holder = getHolder()

	const copy = { ...hicData.hic.v8 }
	const opts = {
		holder,
		genome: await getGenomes('hg19')
	}
	const hic: any = Object.assign(copy, opts)
	const hicOriginal = { ...hic }
	await init_hicstraw(hic, true)
	test.ok(!hicOriginal.name && hic.name == 'Hi-C', 'Should set name to Hi-C since no name was provided')
	test.ok(
		hic.wholegenome &&
			hic.chrpairview &&
			hic.detailview &&
			hic.inwholegenome == true &&
			hic.inchrpair == false &&
			hic.indetail == false &&
			hic.inlineview == false,
		'Should add .wholegenome, .chrpairview, and .detailview objects as well as .inwholegenome, .inchrpair, .indetail, and .inlineview booleans to hic'
	)
	if (test['_ok']) holder!.remove()
	test.end()
})

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

tape.skip('hicparsefragdata()', test => {
	//test.plan()
	test.end()
})

// tape('Render Hi-C track', function (test) {
// 	// test.plan(1)
// 	test.timeoutAfter(3000)
// 	const holder = getHolder()

// 	runproteinpaint({
// 		holder,
// 		block: true,
// 		nobox: 1,
// 		noheader: 1,
// 		genome: 'hg19',
// 		position: 'chr7:13749862-20841903',
// 		nativetracks: 'RefGene',
// 		tracks: [
// 			{
// 				type: 'hicstraw',
// 				file: 'proteinpaint_demo/hg19/hic/hic_demo.hic',
// 				name: 'Hi-C Demo',
// 				percentile_max: 95,
// 				mincutoff: 1,
// 				pyramidup: 1,
// 				enzyme: 'MboI',
// 				normalizationmethod: 'VC'
// 			} as HicRunProteinPaintTrackArgs
// 		]
// 	})
// 	test.pass('Rendered Hi-C track')

// 	// if (test._ok) holder.remove()
// 	test.end()
// })
