import tape from 'tape'
import { select } from 'd3-selection'
import { dtsnvindel, dtfusionrna, dtsv, dtitd, dtcnv } from '#shared/common.js'
import { getDriverRows, renderDriverFace, renderDriverTable } from '../sampleView.drivers.ts'
import { getSampleTools } from '../sampleView.tiles.ts'

/*
Tests:
	getDriverRows(): labels by dt, evidence, type, sources, VAF, origin, one row per alteration
	getDriverRows(): an enhancer gain by cnv and by sv
	renderDriverFace(): top events, more count, credit line without links, hypermutated note
	renderDriverFace() and renderDriverTable() of a sample without driver events
	renderDriverTable(): rows, VAF and origin columns, credit links, hypermutated note
	renderDriverTable(): the VAF of the first field with reads, named when the sample has several fields
	getSampleTools(): the drivers tool only for a dataset that ranks drivers
*/

const sources = [
	{
		id: 'hotspots',
		label: 'Cancer Hotspots',
		license: 'ODbL-1.0',
		licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
		url: 'https://www.cancerhotspots.org'
	},
	{ id: 'civic', label: 'CIViC', license: 'CC0-1.0', url: 'https://civicdb.org' }
]

function tag(tier: 1 | 2, reason: string, ruleIds: string[], genes: string[] = []) {
	return { tier, reason, genes, ruleIds, sources: [...new Set(ruleIds.map(id => id.split(':')[0]))] }
}

/** a singleSampleMutation response with driver tags, in the order of the server */
function getData(more = {}) {
	return {
		mlst: [
			{
				dt: dtsnvindel,
				gene: 'KRAS',
				mname: 'G12D',
				class: 'M',
				vafs: [{ altCount: 30, refCount: 70 }],
				driver: tag(1, 'snv', ['hotspots:KRAS:G12', 'civic:6'], ['KRAS'])
			},
			{ dt: dtfusionrna, geneA: 'BCR', geneB: 'ABL1', driver: tag(1, 'fusion', ['civic:feature:1'], ['BCR', 'ABL1']) },
			{ dt: dtitd, chr: 'chr13', start: 28034091, stop: 28034132, driver: tag(1, 'itd', ['civic:55'], ['FLT3']) },
			{ dt: dtcnv, chr: 'chr2', start: 1, stop: 2, value: 2, driver: tag(1, 'amp', ['civic:8'], ['MYCN']) },
			{
				dt: dtsnvindel,
				gene: 'TP53',
				mname: 'X126_splice',
				class: false,
				origin: 'germline',
				driver: tag(1, 'snv', ['hotspots:TP53:X126'], ['TP53'])
			},
			{ dt: dtsv, chrA: 'chr11', posA: 1, chrB: 'chr9', posB: 2, driver: tag(2, 'fusion', ['civic:2'], ['KMT2A']) },
			{ dt: dtsv, chrA: 'chr9', posA: 2, chrB: 'chr11', posB: 1, driver: tag(2, 'fusion', ['civic:2'], ['KMT2A']) },
			{ dt: dtsnvindel, gene: 'NPM1', mname: 'S254Lfs*22', class: 'F', driver: tag(2, 'gene', ['civic:5'], ['NPM1']) },
			{ dt: dtsnvindel, gene: 'ABC', mname: 'R1H', class: 'M' }
		],
		driverRank: { kbVersion: 'v1', sources },
		...more
	}
}

function getHolder() {
	return select(document.body).append('div').style('width', '230px')
}

tape('\n', test => {
	test.comment('-***- plots/sampleView/drivers -***-')
	test.end()
})

tape('getDriverRows()', test => {
	const rows = getDriverRows(getData())
	test.deepEqual(
		rows.map(r => r.label),
		[
			'KRAS G12D',
			'BCR::ABL1 fusion',
			'FLT3 ITD',
			'MYCN amplification',
			'TP53 X126_splice',
			'KMT2A rearrangement',
			'NPM1 S254Lfs*22'
		],
		'Should label the driver events by dt, in the order of the server, leaving out the non-driver'
	)
	test.equal(rows[5].count, 2, 'Should show an sv seen by both breakpoints as one row of 2 events')
	test.equal(rows[0].evidence, 'Hotspot', 'Should give a Cancer Hotspots residue as a hotspot')
	test.equal(rows[6].evidence, 'Gene-level evidence', 'Should give the evidence of a gene-level rule')
	test.equal(rows[0].type, 'Missense', 'Should give the class of an snvindel')
	test.equal(rows[4].type, 'Splice', 'Should give a splice event of class false as splice')
	test.equal(rows[1].type, 'Fusion RNA', 'Should give the dt of another event')
	test.deepEqual(rows[0].sources, ['Cancer Hotspots', 'CIViC'], 'Should name the sources of the matched rules')
	test.equal(rows[0].vaf, 0.3, 'Should give the VAF')
	test.equal(rows[4].origin, 'germline', 'Should give the germline origin')
	test.equal(rows[1].vaf, undefined, 'Should give no VAF for an event without read counts')
	test.end()
})

tape('getDriverRows() of enhancer gains', test => {
	const enhancer = { ...tag(2, 'enhancer', ['curated:MYC-N-Me'], ['MYC']), locus: 'N-Me' }
	const rows = getDriverRows({
		mlst: [
			{ dt: dtcnv, chr: 'chr8', start: 129148100, stop: 129203799, value: 2.593, driver: enhancer },
			{ dt: dtsv, chrA: 'chr8', posA: 129157775, chrB: 'chr8', posB: 129187288, svtype: 'DUP', driver: enhancer }
		],
		driverRank: { kbVersion: 'v1', sources: [] }
	})
	test.deepEqual(
		rows.map(r => r.label),
		['MYC enhancer (N-Me) gain', 'MYC enhancer (N-Me) duplication'],
		'Should label a cnv and an sv over the locus by the gene that it activates'
	)
	test.equal(rows[0].evidence, 'Gain of a known enhancer', 'Should give the evidence of an enhancer rule')
	test.end()
})

tape('renderDriverFace()', test => {
	const holder = getHolder()
	renderDriverFace(holder, getData())
	const lines = holder.selectAll('[data-testid="sjpp-sampleview-drivers-face"] > div').nodes() as HTMLElement[]
	test.equal(lines[0].textContent, 'T1KRAS G12D', 'Should list the top driver with its tier')
	test.ok(lines[5].textContent?.startsWith('+2 more'), 'Should count the drivers beyond the first 5')
	const credit = holder.select('[data-testid="sjpp-sampleview-drivers-sources"]')
	test.equal(credit.text(), 'Rules: Cancer Hotspots, CIViC', 'Should credit the sources')
	test.equal(credit.selectAll('a').size(), 0, 'Should not link the sources on a face, which a click expands')
	test.equal(
		holder.select('[data-testid="sjpp-sampleview-drivers-hypermutated"]').size(),
		0,
		'Should not note a hypermutated sample'
	)
	if (test['_ok']) holder.remove()
	test.end()
})

tape('a sample without driver events', test => {
	const holder = getHolder()
	const data = {
		mlst: [{ dt: dtsnvindel, gene: 'ABC', mname: 'R1H', class: 'M' }],
		driverRank: { kbVersion: 'v1', sources: [] }
	}
	renderDriverFace(holder, data)
	test.equal(holder.text(), 'No known driver alterations recognized', 'Should say so on the face')
	renderDriverTable(holder, data)
	test.equal(
		holder.select('[data-testid="sjpp-sampleview-drivers-table"]').text(),
		'No known driver alterations were recognized among the events of this sample.',
		'Should say so in the table'
	)
	if (test['_ok']) holder.remove()
	test.end()
})

tape('renderDriverTable()', test => {
	const holder = getHolder().style('width', '900px')
	const data = getData({
		driverRank: { kbVersion: 'v1', sources, hypermutated: { snvindelCount: 812, threshold: 500 } }
	})
	renderDriverTable(holder, data)
	const table = holder.select('[data-testid="sjpp-sampleview-drivers-rows"]')
	const headers = table
		.selectAll('thead th')
		.nodes()
		.map((th: any) => th.textContent.trim())
		.filter(Boolean)
	test.ok(
		['Alteration', 'Type', 'Tier', 'Evidence', 'Sources', 'VAF', 'Origin'].every(h => headers.includes(h)),
		'Should have the columns, with VAF and origin when an event has them'
	)
	test.equal(table.selectAll('tbody tr').size(), 7, 'Should have a row per alteration')
	test.ok(table.text().includes('KMT2A rearrangement (2 events)'), 'Should count the events of an alteration')
	const links = holder
		.selectAll('[data-testid="sjpp-sampleview-drivers-sources"] a')
		.nodes()
		.map((a: any) => a.href)
	test.deepEqual(
		links,
		['https://www.cancerhotspots.org/', 'https://opendatacommons.org/licenses/odbl/1-0/', 'https://civicdb.org/'],
		'Should link to the sources, and to the license of a source with a license url'
	)
	test.ok(
		holder.select('[data-testid="sjpp-sampleview-drivers-hypermutated"]').text().startsWith('Hypermutated sample (812'),
		'Should note a hypermutated sample'
	)

	const somatic = getData()
	somatic.mlst = somatic.mlst.map((m: any) => ({ ...m, origin: 'somatic' }))
	const holder2 = getHolder().style('width', '900px')
	renderDriverTable(holder2, somatic)
	const headers2 = holder2
		.selectAll('thead th')
		.nodes()
		.map((th: any) => th.textContent.trim())
	test.notOk(headers2.includes('Origin'), 'Should leave out the origin column when every driver is somatic')
	if (test['_ok']) {
		holder.remove()
		holder2.remove()
	}
	test.end()
})

tape('renderDriverTable() of VAF fields', test => {
	const vafs = [
		{ id: 'tumor_DNA_WGS', altCount: 0, refCount: 0 },
		{ id: 'tumor_DNA_WES', altCount: 69, refCount: 185 },
		{ id: 'germline_DNA_WES', altCount: 60, refCount: 60 }
	]
	const driver = tag(1, 'snv', ['hotspots:KRAS:G12'], ['KRAS'])
	const data = {
		mlst: [
			{ dt: dtsnvindel, gene: 'KRAS', mname: 'G12D', class: 'M', vafs, driver },
			{ dt: dtsnvindel, gene: 'ABC', mname: 'R1H', class: 'M', vafs: [{ id: 'tumor_RNA', altCount: 1, refCount: 1 }] }
		],
		driverRank: { kbVersion: 'v1', sources }
	}
	const rows = getDriverRows(data)
	test.equal(rows[0].vafId, 'tumor_DNA_WES', 'Should take the first VAF field with reads, not the highest')
	test.equal(rows[0].vaf, 69 / 254, 'Should give the VAF of that field')

	const holder = getHolder().style('width', '900px')
	renderDriverTable(holder, data)
	// null-safe, as a test that throws stops the run of the browser specs without a failure
	const names = holder.selectAll('[data-testid="sjpp-sampleview-drivers-vafid"]').nodes() as HTMLElement[]
	test.deepEqual(
		names.map(n => n.textContent),
		['tumor_DNA_WES'],
		'Should name the VAF field, as the sample has several'
	)
	test.equal(names[0]?.parentElement?.textContent, '27% tumor_DNA_WES', 'Should show the VAF with it')

	const one = { ...data, mlst: [{ ...data.mlst[0], vafs: [{ id: 'tumor_DNA_WGS', altCount: 1, refCount: 3 }] }] }
	const holder2 = getHolder().style('width', '900px')
	renderDriverTable(holder2, one)
	test.equal(
		holder2.select('[data-testid="sjpp-sampleview-drivers-vafid"]').size(),
		0,
		'Should not name the VAF field of a sample with one field'
	)
	test.ok(holder2.select('[data-testid="sjpp-sampleview-drivers-rows"]').text().includes('25%'), 'Should show its VAF')
	if (test['_ok']) {
		holder.remove()
		holder2.remove()
	}
	test.end()
})

tape('getSampleTools()', test => {
	const keys = (singleSampleMutation: any) => getSampleTools({ queries: { singleSampleMutation } }).map(t => t.key)
	test.deepEqual(
		keys({ sample_id_key: 'sample_id', driverRank: true }),
		['disco', 'drivers'],
		'Should have the drivers tool after disco for a dataset that ranks drivers'
	)
	test.deepEqual(keys({ sample_id_key: 'sample_id' }), ['disco'], 'Should have no drivers tool otherwise')
	test.end()
})
