import test from 'tape'
import LabelsMapper from '#plots/disco/label/LabelsMapper.ts'
import Reference from '#plots/disco/chromosome/Reference.ts'
import discoDefaults from '#plots/disco/defaults.ts'
import DataMapper from '#plots/disco/data/DataMapper.ts'
import _ from 'lodash'
import type Settings from '../../Settings'

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

test('When there is a cnv event which position intercepts gene position should return label with cnv info in tooltip', t => {
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
			value: 2,
			start: 139,
			stop: 149
		}
	]
	const dataHolder = new DataMapper(settings, reference, sampleName, []).map(rawData)

	const labelsMapper = new LabelsMapper(settings, sampleName, reference)

	const labels = labelsMapper.map(dataHolder.labelData, dataHolder.cnvData)

	t.equal(labels.length, 2, 'Should create two labels')

	if (labels[1].cnvTooltip) {
		t.equal(labels[1].cnvTooltip.length, 1, 'Second label should have one cnv mutation')
	} else {
		t.error('No cnv mutation tooltip')
	}
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
