import tape from 'tape'
import { trackLabelSpanData, renderLabelSpans, SPANSELECTOR } from '../matrix.labelSpans'
import { select } from 'd3-selection'

/*************************
 reusable helper functions
**************************/

function getSvg(opts: { [key: string]: any } = {}) {
	const g = select('body')
		.append('svg')
		.attr('width', 200)
		.attr('heigth', 200)
		.append('g')
		.attr('transform', 'translate(50,50)')

	const relatedSamplesByAncestorId = new Map()

	const sample2 = {
		sample: '2',
		_ref_: {
			sample: 2,
			label: 'sj2222',
			sampleType: 2,
			ancestors: [
				{
					ancestor_id: 40,
					distance: 1
				},
				{
					ancestor_id: 30,
					distance: 2
				}
			]
		}
	}

	const sample3 = {
		sample: '3',
		_ref_: {
			sample: 3,
			label: 'sj3333',
			sampleType: 2,
			ancestors: [
				{
					ancestor_id: 40,
					distance: 1
				},
				{
					ancestor_id: 30,
					distance: 2
				}
			]
		}
	}

	const sample4 = {
		sample: '4',
		_ref_: {
			sample: 4,
			label: 'sj444',
			sampleType: 2,
			ancestors: [
				{
					ancestor_id: 40,
					distance: 1
				},
				{
					ancestor_id: 30,
					distance: 2
				}
			]
		}
	}

	const sample5 = {
		sample: '5',
		_ref_: {
			sample: 5,
			label: 'sj5555',
			sampleType: 2,
			ancestors: [
				{
					ancestor_id: 46,
					distance: 1
				},
				{
					ancestor_id: 30,
					distance: 2
				}
			]
		}
	}

	const sample6 = {
		sample: '6',
		_ref_: {
			sample: 6,
			label: 'sj6666',
			sampleType: 2,
			ancestors: [
				{
					ancestor_id: 46,
					distance: 1
				},
				{
					ancestor_id: 30,
					distance: 2
				}
			]
		}
	}

	const sample7 = {
		sample: '7',
		_ref_: {
			sample: 7,
			label: 'sj777777',
			sampleType: 2,
			ancestors: [
				{
					ancestor_id: 46,
					distance: 1
				},
				{
					ancestor_id: 30,
					distance: 2
				}
			]
		}
	}

	// another set of samples that has ancestor 30 as a *direct* (distance-1) parent,
	// so ancestor 30 is both the grandparent of samples 2-7 (via 40 and 46) and the
	// immediate parent of samples 8-10; its span should bracket all of samples 2-10
	const sample8 = {
		sample: '8',
		_ref_: {
			sample: 8,
			label: 'sj8888',
			sampleType: 2,
			ancestors: [
				{
					ancestor_id: 30,
					distance: 1
				}
			]
		}
	}

	const sample9 = {
		sample: '9',
		_ref_: {
			sample: 9,
			label: 'sj9999',
			sampleType: 2,
			ancestors: [
				{
					ancestor_id: 30,
					distance: 1
				}
			]
		}
	}

	const sample10 = {
		sample: '10',
		_ref_: {
			sample: 10,
			label: 'sj101010',
			sampleType: 2,
			ancestors: [
				{
					ancestor_id: 30,
					distance: 1
				}
			]
		}
	}

	const grp = {
		relatedSamples: {
			40: [sample2, sample3, sample4],
			46: [sample5, sample6, sample7],
			30: [sample8, sample9, sample10]
		}
	}

	const labelGTransform = () => null

	const sampleLabelData = [
		{
			label: sample2._ref_.label,
			transform: `translate(12.8,0)`,
			labelGTransform,
			grp,
			row: sample2
		},
		{
			label: sample3._ref_.label,
			transform: `translate(28.8,0)`,
			labelGTransform,
			grp,
			row: sample3
		},
		{
			label: sample4._ref_.label,
			transform: `translate(44.8,0)`,
			labelGTransform,
			grp,
			row: sample4
		},
		{
			label: sample5._ref_.label,
			transform: `translate(60.8,0)`,
			labelGTransform,
			grp,
			row: sample5
		},
		{
			label: sample6._ref_.label,
			transform: `translate(76.8,0)`,
			labelGTransform,
			grp,
			row: sample6
		},
		{
			label: sample7._ref_.label,
			transform: `translate(92.8,0)`,
			grp,
			row: sample7
		},
		{
			label: sample8._ref_.label,
			transform: `translate(108.8,0)`,
			labelGTransform,
			grp,
			row: sample8
		},
		{
			label: sample9._ref_.label,
			transform: `translate(124.8,0)`,
			labelGTransform,
			grp,
			row: sample9
		},
		{
			label: sample10._ref_.label,
			transform: `translate(140.8,0)`,
			labelGTransform,
			grp,
			row: sample10
		}
	]

	const side = {
		prefix: 'sample',
		direction: opts.direction || 'btm',
		attr: {
			transform: d => d.transform,
			labelGTransform: d => d.transform
		},
		box: g
	}

	g.selectAll('.sjpp-matrix-label')
		.data(sampleLabelData)
		.enter()
		.append('g')
		.attr('class', 'sjpp-matrix-label')
		.each(function (lab) {
			const g = select(this).attr('transform', lab.transform)
			const text = g.append('text').attr('transform', 'rotate(-90)').attr('text-anchor', 'end').text(lab.label)
			trackLabelSpanData(lab, side, 'btm', text, relatedSamplesByAncestorId)
		})

	const ancestorLabelData = relatedSamplesByAncestorId.values()

	g.selectAll('text')
		.data(ancestorLabelData)
		.enter()
		.append('text')
		.attr('transform', d => d.transform)
		.attr('stroke', '#000')
		.text(d => d.ancestor_id)

	renderLabelSpans(relatedSamplesByAncestorId, side, { colw: 16 })

	return {
		g
	}
}

/**************
 test sections
***************/

tape('renderLabelSpans()', test => {
	const { g } = getSvg()

	test.equal(
		g.selectAll(SPANSELECTOR).selectAll('text').size(),
		3,
		'there should be 3 rendered ancestor label texts (40, 46, and the nested 30 spanning both)'
	)
	test.equal(
		g.selectAll(SPANSELECTOR).selectAll('line').size(),
		3,
		'there should be 3 rendered ancestor line spans (40, 46, and the nested 30 spanning both)'
	)

	// ancestor 30 spans samples 2-10 (its 6 distance-2 descendants under 40 and 46,
	// plus its 3 distance-1 direct children 8-10), so its line covers all 9 samples
	const colw = 16
	const span30 = g
		.selectAll(SPANSELECTOR)
		.nodes()
		.find(node => select(node).select('text').text() === '30')
	test.ok(span30, 'there should be a rendered span for ancestor 30')
	test.equal(
		+select(span30!).select('line').attr('x2'),
		colw * (9 - 1) + 1,
		'the ancestor 30 span line should extend across all 9 descendant samples (2-10)'
	)
	test.end()
})
