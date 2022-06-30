const tape = require('tape')
const helpers = require('../../test/front.helpers.js')
const d3s = require('d3-selection')
const host = window.location.origin

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('', {
	genome: 'hg38',
	tracks: [
		{
			type: 'mds3',
			dslabel: 'GDC'
		}
	]
})

function getHolder() {
	return d3s
		.select('body')
		.append('div')
		.style('border', '1px solid #aaa')
		.style('padding', '5px')
		.style('margin', '5px')
		.node()
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**************
 test sections
***************/

tape('\n', function(test) {
	test.pass('-***- mds3/gdc -***-')
	test.end()
})

tape('Run GDC dataset via gene symbol, ensembl ID and RefSeq ID', async test => {
	test.timeoutAfter(10000)
	const holder = getHolder()

	await callGDCByGene(test)
	await callGDCByEnsembl(test)
	await callGDCByRefSeq(test)

	async function callGDCByGene(test) {
		await runproteinpaint({
			holder,
			noheader: true,
			nobox: true,
			genome: 'hg38',
			gene: 'AKT1',
			tracks: [
				{
					type: 'mds3',
					dslabel: 'GDC'
				}
			]
		})
		await sleep(2300)
		const geneFound = [...holder.querySelectorAll('span')].some(elem => elem.innerText == 'AKT1')
		if (!geneFound) test.fail('Should render default AKT1 track')
		else {
			test.equal(geneFound, true, 'Render AKT1 default track')
		}
	}

	async function callGDCByEnsembl(test) {
		await runproteinpaint({
			holder,
			noheader: true,
			nobox: true,
			genome: 'hg38',
			gene: 'ENST00000407796',
			tracks: [
				{
					type: 'mds3',
					dslabel: 'GDC'
				}
			]
		})
		await sleep(2300)
		const ensemblFound = [...holder.querySelectorAll('span.sja_clbtext')].some(
			elem => elem.innerText == 'AKT1 ENST00000407796'
		)
		if (!ensemblFound) test.fail('Should render default AKT1 ENST0000040779 isoform track')
		else {
			test.equal(ensemblFound, true, 'Rendered AKT1 ENST0000040779 isoform track')
		}
	}

	async function callGDCByRefSeq(test) {
		await runproteinpaint({
			holder,
			noheader: true,
			nobox: true,
			genome: 'hg38',
			gene: 'NM_005163',
			tracks: [
				{
					type: 'mds3',
					dslabel: 'GDC'
				}
			]
		})
		await sleep(2300)
		const refseqFound = [...holder.querySelectorAll('span.sja_clbtext')].some(
			elem => elem.innerText == 'AKT1 NM_005163'
		)
		if (!refseqFound) test.fail('Should render AKT1 NM_005163 isoform track')
		else {
			test.equal(refseqFound, true, 'Rendered AKT1 NM_005163 isoform track')
		}
	}
	test.end()
})

tape('Launch GDC dataset by SSM ID', async test => {
	test.timeoutAfter(3000)
	const holder = getHolder()

	await runproteinpaint({
		holder,
		noheader: true,
		nobox: true,
		genome: 'hg38',
		mds3_ssm2canonicalisoform: {
			dslabel: 'GDC',
			ssm_id: '4fb37566-16d1-5697-9732-27c359828bc7' // kras G12V
		},
		tracks: [
			{
				type: 'mds3',
				dslabel: 'GDC'
			}
		]
	})
	await sleep(2300)
	const ssmFound = [...holder.querySelectorAll('.sja_aa_disclabel')].some(elem => elem.innerHTML == 'G12V')
	if (!ssmFound) test.fail('Should render KRAS track with focused G12V mutation')
	else {
		test.equal(ssmFound, true, 'Render GDC KRAS ssm track')
	}

	test.end()
})

tape('Render gene track from search box', async test => {
	test.timeoutAfter(3000)
	const holder = getHolder()

	await runproteinpaint({
		holder,
		noheader: 1,
		geneSearch4GDCmds3: true
	})

	await sleep(2300)
	test.end()
})
