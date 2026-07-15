import test from 'tape'
import LabelsMapper from '#plots/disco/label/LabelsMapper.ts'
import Reference from '#plots/disco/chromosome/Reference.ts'
import discoDefaults from '#plots/disco/defaults.ts'
import DataMapper from '#plots/disco/data/DataMapper.ts'
import _ from 'lodash'
import type Settings from '../../Settings'
import LabelsRenderer from '#plots/disco/label/LabelsRenderer.ts'
import LabelFactory from '#plots/disco/label/LabelFactory.ts'
import { select } from 'd3-selection'

// Create test data
const overriders = { rings: { labelLinesInnerRadius: 10, labelsToLinesDistance: 5, labelsToLinesGap: 2 } }
const settings = discoDefaults(overriders)
const sampleName = 'Sample'
const chromosomesOrder = ['chr1', 'chr2']
const chromosomes = {
	chr1: 100,
	chr2: 150
}

const reference = new Reference(settings, chromosomesOrder, chromosomes)

test('Gene labels expose a test ID and show overlapping CNVs and ITDs on hover', t => {
	const holder = select(document.body).append('svg')
	const label = LabelFactory.createLabel(0, 0, 10, 15, 0, 'Gene1', '#000', 'MISSENSE', 'chr1', 50, false, 2)
	label.cnvTooltip = [
		{ dt: 4, value: 2, color: '#f00', chr: 'chr1', start: 40, stop: 60 },
		{ dt: 4, value: -1, color: '#00f', chr: 'chr1', start: 45, stop: 55 },
		{ dt: 6, value: 0, color: '#ff70ff', chr: 'chr1', start: 48, stop: 52 }
	]
	t.equal(LabelFactory.createMovedLabel(label, 0.01).cnvTooltip?.length, 3, 'Moved labels retain overlapping events')
	new LabelsRenderer(0, 12, () => {}).render(holder, [label])

	const geneLabel = holder.select('text.chord-text').node() as SVGTextElement
	t.equal(geneLabel.getAttribute('data-testid'), 'sjpp-disco-genelabel', 'Gene label has the requested test ID')
	geneLabel.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 10, clientY: 10 }))

	const menus = document.querySelectorAll('.sja_menu_div')
	const tooltip = menus[menus.length - 1]
	t.ok(tooltip.textContent?.includes('chr1:40-60'), 'Tooltip shows the first overlapping CNV')
	t.ok(tooltip.textContent?.includes('chr1:45-55'), 'Tooltip shows the second overlapping CNV')
	t.ok(tooltip.textContent?.includes('ITD'), 'Tooltip identifies the overlapping ITD')
	t.ok(tooltip.textContent?.includes('chr1:48-52'), 'Tooltip shows the overlapping ITD interval')

	holder.remove()
	tooltip.remove()
	t.end()
})

test('Gene label hover uses gene coordinates to find interval overlaps missed by the mutation position', async t => {
	const holder = select(document.body).append('svg')
	const label = LabelFactory.createLabel(0, 0, 10, 15, 0, 'Gene1', '#000', 'MISSENSE', 'chr1', 10, false, 2)
	const itd = { dt: 6, value: 0, color: '#ff70ff', chr: 'chr1', start: 40, stop: 60 }
	const loh = { dt: 10, value: 0.4, color: '#00aaaa', chr: 'chr1', start: 65, stop: 90 }
	let lookupCount = 0
	const lookup = async (gene: string, genome: string) => {
		lookupCount++
		t.equal(gene, 'Gene1', 'Looks up the hovered gene')
		t.equal(genome, 'hg38', 'Uses the plot genome')
		return { gmlst: [{ name: 'Gene1', chr: 'chr1', start: 30, stop: 70 }] }
	}
	new LabelsRenderer(0, 12, () => {}, 'hg38', [itd, loh], lookup).render(holder, [label])

	const geneLabel = holder.select('text.chord-text').node() as SVGTextElement
	geneLabel.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 10, clientY: 10 }))
	await new Promise(resolve => setTimeout(resolve, 0))

	const menus = document.querySelectorAll('.sja_menu_div')
	const tooltip = menus[menus.length - 1]
	t.ok(tooltip.textContent?.includes('ITD'), 'Tooltip shows the ITD overlapping the gene coordinates')
	t.ok(tooltip.textContent?.includes('chr1:40-60'), 'Tooltip shows the overlapping ITD interval')
	t.ok(tooltip.textContent?.includes('LOH'), 'Tooltip shows the LOH overlapping the gene coordinates')
	t.ok(tooltip.textContent?.includes('chr1:65-90'), 'Tooltip shows the overlapping LOH interval')

	geneLabel.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))
	geneLabel.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 10, clientY: 10 }))
	await new Promise(resolve => setTimeout(resolve, 0))
	t.equal(lookupCount, 1, 'Gene coordinates are cached across hovers')

	holder.remove()
	tooltip.remove()
	t.end()
})

test('When Two mutations on two genes LabelsMapper.map() should return two labels', t => {
	const rawData = [
		{
			dt: 1,
			mname: 'Mutation1',
			class: 'M',
			gene: 'Gene1',
			chr: 'chr1',
			pos: 50,
			ref: 'G',
			alt: 'A',
			position: 50
		},
		{
			dt: 1,
			mname: 'Mutation2',
			class: 'M',
			gene: 'Gene2',
			chr: 'chr2',
			pos: 150,
			ref: 'G',
			alt: 'T',
			position: 150
		}
	]

	const dataHolder = new DataMapper(settings, reference, sampleName, []).map(rawData)

	const labelsMapper = new LabelsMapper(settings, sampleName, reference)

	const labels = labelsMapper.map(dataHolder.labelData)

	t.equal(labels.length, 2, 'Should create two labels')
	t.equal(labels[0].text, 'Gene1', 'Label1 should have correct gene')
	if (labels[0].mutationsTooltip && labels[1].mutationsTooltip) {
		t.equal(labels[0].mutationsTooltip.length, 1, 'Label1 should have one mutation')
		t.equal(labels[1].mutationsTooltip.length, 1, 'Label2 should have one mutation')
		t.equal(labels[0].mutationsTooltip[0].mname, 'Mutation1', 'Mutation 1 of Label 1 should have correct mname')
		t.equal(labels[1].mutationsTooltip[0].mname, 'Mutation2', 'Mutation 1 of Label 2 should have correct mname')
	} else {
		t.error('No mutations tooltip')
	}
	t.end()
})

test('When Two mutations on one gene LabelsMapper.map() should return one label', t => {
	const rawData = [
		{
			dt: 1,
			mname: 'Mutation1',
			class: 'M',
			gene: 'Gene1',
			chr: 'chr1',
			pos: 35,
			ref: 'G',
			alt: 'A',
			position: 35
		},
		{
			dt: 1,
			mname: 'Mutation2',
			class: 'M',
			gene: 'Gene1',
			chr: 'chr1',
			pos: 45,
			ref: 'G',
			alt: 'T',
			position: 45
		}
	]
	const dataHolder = new DataMapper(settings, reference, sampleName, []).map(rawData)

	const labelsMapper = new LabelsMapper(settings, sampleName, reference)

	const labels = labelsMapper.map(dataHolder.labelData)

	t.equal(labels.length, 1, 'Should create one label')
	t.equal(labels[0].text, 'Gene1', 'Label1 should have correct gene')
	if (labels[0].mutationsTooltip) {
		t.equal(labels[0].mutationsTooltip.length, 2, 'Label1 should have one mutation')
		t.equal(labels[0].mutationsTooltip[0].mname, 'Mutation1', 'Mutation1 of Label1 should have correct mname')
		t.equal(labels[0].mutationsTooltip[1].mname, 'Mutation2', 'Mutation2 of Label1 should have correct mname')
	} else {
		t.error('No mutations tooltip')
	}

	t.end()
})

test('When there is a fusion event with two genes LabelsMapper.map() should return two labels', t => {
	const rawData = [
		{
			chrA: 'chr1',
			chrB: 'chr1',
			dt: 2,
			geneA: 'Gene1',
			geneB: 'Gene2',
			posA: 35,
			posB: 45,
			strandA: '+',
			strandB: '+',
			sample: 'sample'
		}
	]
	const dataHolder = new DataMapper(settings, reference, sampleName, []).map(rawData)

	const labelsMapper = new LabelsMapper(settings, sampleName, reference)

	const labels = labelsMapper.map(dataHolder.labelData)

	t.equal(labels.length, 2, 'Should create 2 labels')
	t.equal(labels[0].text, 'Gene1', 'Label1 should have correct gene')
	t.equal(labels[1].text, 'Gene2', 'Label2 should have correct gene')
	if (labels[0].fusionTooltip) {
		t.equal(labels[0].fusionTooltip.length, 1, 'Label1 should have one fusion event')
	} else {
		t.error('No fusion tooltip')
	}

	t.end()
})

test('Overlapping CNV and ITD segments are added to the gene label tooltip', t => {
	const rawData = [
		{
			dt: 1,
			mname: 'Mutation1',
			class: 'M',
			gene: 'Gene1',
			chr: 'chr1',
			pos: 50,
			ref: 'G',
			alt: 'A',
			position: 50
		},
		{
			dt: 1,
			mname: 'Mutation2',
			class: 'M',
			gene: 'Gene2',
			chr: 'chr2',
			pos: 150,
			ref: 'G',
			alt: 'T',
			position: 150
		},
		{
			dt: 4,
			chr: 'chr2',
			value: 2,
			start: 149,
			stop: 150
		},
		{
			dt: 4,
			chr: 'chr2',
			value: -1,
			start: 150,
			stop: 150
		},
		{
			dt: 4,
			chr: 'chr2',
			value: 2,
			start: 139,
			stop: 149
		},
		{
			dt: 6,
			class: 'ITD',
			chr: 'chr2',
			start: 140,
			stop: 150
		}
	]
	const dataHolder = new DataMapper(settings, reference, sampleName, []).map(rawData)

	const labelsMapper = new LabelsMapper(settings, sampleName, reference)

	const labels = labelsMapper.map(dataHolder.labelData, dataHolder.cnvData)

	t.equal(labels.length, 2, 'Should create two labels')

	if (labels[1].cnvTooltip) {
		t.equal(labels[1].cnvTooltip.length, 3, 'Every overlapping CNV and ITD is included')
		t.deepEqual(
			labels[1].cnvTooltip.map(event => event.dt).sort(),
			[4, 4, 6],
			'Tooltip retains the type of each overlapping interval'
		)
		t.deepEqual(
			labels[1].cnvTooltip.filter(event => event.dt == 4).map(event => event.value),
			[2, -1],
			'CNV tooltip retains each overlapping segment value'
		)
	} else {
		t.error('No cnv mutation tooltip')
	}
	t.end()
})

test('Fusion gene labels detect CNVs overlapping their breakpoint', t => {
	const rawData = [
		{
			dt: 2,
			chrA: 'chr1',
			chrB: 'chr2',
			geneA: 'Gene1',
			geneB: 'Gene2',
			posA: 50,
			posB: 150,
			strandA: '+',
			strandB: '-'
		},
		{ dt: 4, chr: 'chr1', value: 2, start: 40, stop: 60 }
	]
	const dataHolder = new DataMapper(settings, reference, sampleName, []).map(rawData)
	const labels = new LabelsMapper(settings, sampleName, reference).map(dataHolder.labelData, dataHolder.cnvData)
	const gene1 = labels.find(label => label.text == 'Gene1')

	t.equal(gene1?.cnvTooltip?.length, 1, 'Fusion breakpoint label includes its overlapping CNV')
	t.end()
})

test('When Two mutations on two genes LabelsMapper.map() and only one gene is prioritized should return 1 label', t => {
	const settingsOverride: Settings = _.cloneDeep(settings)
	const prioritizedGenes = ['Gene1']
	settingsOverride.Disco.prioritizeGeneLabelsByGeneSets = true
	const rawData = [
		{
			dt: 1,
			mname: 'Mutation1',
			class: 'M',
			gene: 'Gene1',
			chr: 'chr1',
			pos: 50,
			ref: 'G',
			alt: 'A',
			position: 50
		},
		{
			dt: 1,
			mname: 'Mutation2',
			class: 'M',
			gene: 'Gene2',
			chr: 'chr2',
			pos: 150,
			ref: 'G',
			alt: 'T',
			position: 150
		}
	]

	const dataHolder = new DataMapper(settingsOverride, reference, sampleName, prioritizedGenes).map(rawData)

	const labelsMapper = new LabelsMapper(settings, sampleName, reference)

	const labels = labelsMapper.map(dataHolder.labelData)

	t.equal(labels.length, 1, 'Should create one labels')
	t.equal(labels[0].text, 'Gene1', 'Label1 should have correct gene')
	if (labels[0].mutationsTooltip) {
		t.equal(labels[0].mutationsTooltip.length, 1, 'Label1 should have one mutation')
		t.equal(labels[0].mutationsTooltip[0].mname, 'Mutation1', 'Mutation 1 of Label 1 should have correct mname')
	} else {
		t.error('No mutations tooltip')
	}
	t.end()
})
test('When SNV has vafs array, mutation tooltip should retain vafs entries', t => {
	const rawData = [
		{
			dt: 1,
			mname: 'Mutation1',
			class: 'M',
			gene: 'Gene1',
			chr: 'chr1',
			pos: 50,
			ref: 'G',
			alt: 'A',
			position: 50,
			vafs: [
				{ id: 'Tumor', refCount: 12, altCount: 3 },
				{ name: 'Relapse', refCount: '5', altCount: '1' }
			]
		}
	]

	const dataHolder = new DataMapper(settings, reference, sampleName, []).map(rawData)
	const labelsMapper = new LabelsMapper(settings, sampleName, reference)
	const labels = labelsMapper.map(dataHolder.labelData)

	t.equal(labels.length, 1, 'Should create one label')
	if (labels[0].mutationsTooltip) {
		t.deepEqual(
			labels[0].mutationsTooltip[0].vafs,
			[
				{ id: 'Tumor', refCount: 12, altCount: 3 },
				{ name: 'Relapse', refCount: '5', altCount: '1' }
			],
			'Mutation tooltip should include vafs array'
		)
	} else {
		t.error('No mutations tooltip')
	}
	t.end()
})

test('When SNV has vafs array, mutation tooltip should retain vafs entries', t => {
	const rawData = [
		{
			dt: 1,
			mname: 'Mutation1',
			class: 'M',
			gene: 'Gene1',
			chr: 'chr1',
			pos: 50,
			ref: 'G',
			alt: 'A',
			position: 50,
			vafs: [
				{ id: 'Tumor', refCount: 12, altCount: 3 },
				{ name: 'Relapse', refCount: '5', altCount: '1' }
			]
		}
	]

	const dataHolder = new DataMapper(settings, reference, sampleName, []).map(rawData)
	const labelsMapper = new LabelsMapper(settings, sampleName, reference)
	const labels = labelsMapper.map(dataHolder.labelData)

	t.equal(labels.length, 1, 'Should create one label')
	if (labels[0].mutationsTooltip) {
		t.deepEqual(
			labels[0].mutationsTooltip[0].vafs,
			[
				{ id: 'Tumor', refCount: 12, altCount: 3 },
				{ name: 'Relapse', refCount: '5', altCount: '1' }
			],
			'Mutation tooltip should include vafs array'
		)
	} else {
		t.error('No mutations tooltip')
	}
	t.end()
})
