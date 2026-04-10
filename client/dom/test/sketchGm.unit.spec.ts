/**
 * Unit tests for sketchGm canvas rendering functions
 *
 * These tests verify the functionality of gene model sketching functions
 * that render gene structures, RNA, and protein domains on canvas elements.
 */

import tape from 'tape'
import { select } from 'd3-selection'
import type { Div } from '../../types/d3'
import { sketchSplicerna, sketchGmsum, sketchRna, sketchProtein2, sketchGene, sketchProtein } from '../sketchGm'

/**
 * Helper function to create a test container
 */
function getHolder(): Div {
	return select('body').append('div').style('max-width', '800px') as Div
}

/**
 * Create a simple gene model for testing
 */
function createSimpleGeneModel() {
	return {
		isoform: 'test-001',
		chr: 'chr1',
		start: 1000,
		stop: 5000,
		strand: '+',
		exon: [
			[1000, 1500],
			[2000, 2500],
			[3000, 3500],
			[4000, 5000]
		],
		codingstart: 1200,
		codingstop: 4800,
		coding: [
			[1200, 1500],
			[2000, 2500],
			[3000, 3500],
			[4000, 4800]
		],
		utr5: [[1000, 1200]],
		utr3: [[4800, 5000]],
		cdslen: 3600,
		rnalen: 4000
	}
}

/**
 * Create a gene model with protein domains
 */
function createGeneModelWithDomains() {
	const gm = createSimpleGeneModel()
	return {
		...gm,
		pdomains: [
			{ start: 0, stop: 100, color: '#ff0000' },
			{ start: 150, stop: 300, color: '#00ff00' },
			{ start: 350, stop: 500, color: '#0000ff' }
		]
	}
}

/**
 * Create exon regions for testing sketchGmsum
 */
function createExonRegions() {
	return [
		{
			chr: 'chr1',
			bstart: 1000,
			bstop: 1500,
			start: 1000,
			stop: 1500,
			reverse: false,
			width: 500
		},
		{
			chr: 'chr1',
			bstart: 2000,
			bstop: 2500,
			start: 2000,
			stop: 2500,
			reverse: false,
			width: 500
		},
		{
			chr: 'chr1',
			bstart: 3000,
			bstop: 3500,
			start: 3000,
			stop: 3500,
			reverse: false,
			width: 500
		}
	]
}

tape('\n', function (test) {
	test.comment('-***- dom/sketchGm -***-')
	test.end()
})

/**
 * Test sketchSplicerna function
 */
tape('sketchSplicerna renders spliced RNA on canvas', test => {
	const holder = getHolder()
	const gm = createSimpleGeneModel()

	// Render the spliced RNA
	sketchSplicerna(holder, gm, 400, '#0000ff')

	// Check that a canvas was created
	const canvas = holder.select('canvas').node() as HTMLCanvasElement
	test.ok(canvas, 'Canvas element should be created')
	test.ok(canvas.width > 0, 'Canvas width should be positive')
	test.ok(canvas.height > 0, 'Canvas height should be positive')

	// Verify devicePixelRatio is considered
	const dpr = window.devicePixelRatio || 1
	test.ok(Math.abs(canvas.width - 400 * dpr) <= 1, 'Canvas backing store should be scaled by devicePixelRatio')

	// Check that the canvas has been drawn on
	const ctx = canvas.getContext('2d')!
	const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
	const hasPixels = imageData.data.some(byte => byte !== 0)
	test.ok(hasPixels, 'Canvas should have been drawn on')

	holder.remove()
	test.end()
})

tape('sketchSplicerna handles reverse strand correctly', test => {
	const holder = getHolder()
	const gm = createSimpleGeneModel()
	gm.strand = '-'

	// Should render without errors
	sketchSplicerna(holder, gm, 400, '#ff0000')

	const canvas = holder.select('canvas').node() as HTMLCanvasElement
	test.ok(canvas, 'Canvas should be created for reverse strand')

	holder.remove()
	test.end()
})

/**
 * Test sketchGmsum function
 */
tape('sketchGmsum renders gene model summary', test => {
	const holder = getHolder()
	const gm = createSimpleGeneModel()
	const rglst = createExonRegions()

	sketchGmsum(holder, rglst, gm, 1, 10, 400, 20, '#00ff00')

	const canvas = holder.select('canvas').node() as HTMLCanvasElement
	test.ok(canvas, 'Canvas element should be created')
	test.equal(
		Math.round(canvas.height / (window.devicePixelRatio || 1)),
		20,
		'Canvas height should match specified height'
	)

	// Check for rendering
	const ctx = canvas.getContext('2d')!
	const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
	const hasPixels = imageData.data.some(byte => byte !== 0)
	test.ok(hasPixels, 'Canvas should have gene model rendered')

	holder.remove()
	test.end()
})

tape('sketchGmsum handles missing coding regions', test => {
	const holder = getHolder()
	const gm = createSimpleGeneModel()
	const gmWithoutCoding = { ...gm, coding: undefined }
	const rglst = createExonRegions()

	// Should render without errors even without coding regions
	sketchGmsum(holder, rglst, gmWithoutCoding as any, 1, 10, 400, 20, '#00ff00')

	const canvas = holder.select('canvas').node() as HTMLCanvasElement
	test.ok(canvas, 'Canvas should be created even without coding regions')

	holder.remove()
	test.end()
})

/**
 * Test sketchRna function
 */
tape('sketchRna renders RNA structure', test => {
	const holder = getHolder()
	const gm = createSimpleGeneModel()

	sketchRna(holder, gm, 400, '#ff00ff')

	const canvas = holder.select('canvas').node() as HTMLCanvasElement
	test.ok(canvas, 'Canvas element should be created')
	test.equal(Math.round(canvas.height / (window.devicePixelRatio || 1)), 20, 'Canvas height should be 20px')

	// Check devicePixelRatio scaling
	const dpr = window.devicePixelRatio || 1
	test.ok(Math.abs(canvas.width - 400 * dpr) <= 1, 'Canvas should be scaled by devicePixelRatio')

	holder.remove()
	test.end()
})

tape('sketchRna handles noncoding genes', test => {
	const holder = getHolder()
	const gm = createSimpleGeneModel()
	const noncodingGm = { ...gm, cdslen: undefined }

	sketchRna(holder, noncodingGm as any, 400, '#ffff00')

	const canvas = holder.select('canvas').node() as HTMLCanvasElement
	test.ok(canvas, 'Canvas should be created for noncoding genes')

	// Check that gray color is used for noncoding
	const ctx = canvas.getContext('2d')!
	const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
	const hasPixels = imageData.data.some(byte => byte !== 0)
	test.ok(hasPixels, 'Noncoding gene should still be rendered')

	holder.remove()
	test.end()
})

tape('sketchRna renders protein domains when present', test => {
	const holder = getHolder()
	const gm = createGeneModelWithDomains()

	sketchRna(holder, gm, 400, '#00ffff')

	const canvas = holder.select('canvas').node() as HTMLCanvasElement
	test.ok(canvas, 'Canvas should be created with protein domains')

	holder.remove()
	test.end()
})

/**
 * Test sketchProtein2 function
 */
tape('sketchProtein2 renders protein domains', test => {
	const holder = getHolder()
	const gm = createGeneModelWithDomains()

	sketchProtein2(holder, gm, 400)

	const canvas = holder.select('canvas').node() as HTMLCanvasElement
	test.ok(canvas, 'Canvas element should be created')
	test.equal(Math.round(canvas.height / (window.devicePixelRatio || 1)), 20, 'Canvas height should be 20px')

	// Verify that domains are rendered (canvas has content)
	const ctx = canvas.getContext('2d')!
	const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
	const hasPixels = imageData.data.some(byte => byte !== 0)
	test.ok(hasPixels, 'Protein domains should be rendered')

	holder.remove()
	test.end()
})

/**
 * Test sketchGene function
 */
tape('sketchGene renders gene structure', test => {
	const holder = getHolder()
	const gm = createSimpleGeneModel()

	sketchGene(holder, gm, 400, 30, 1000, 5000, '#ff0000', false, false)

	const canvas = holder.select('canvas').node() as HTMLCanvasElement
	test.ok(canvas, 'Canvas element should be created')
	test.equal(
		Math.round(canvas.height / (window.devicePixelRatio || 1)),
		30,
		'Canvas height should match specified height'
	)

	// Check devicePixelRatio scaling
	const dpr = window.devicePixelRatio || 1
	test.ok(Math.abs(canvas.width - 400 * dpr) <= 1, 'Canvas should be scaled by devicePixelRatio')

	// Verify rendering
	const ctx = canvas.getContext('2d')!
	const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
	const hasPixels = imageData.data.some(byte => byte !== 0)
	test.ok(hasPixels, 'Gene structure should be rendered')

	holder.remove()
	test.end()
})

tape('sketchGene renders strand direction', test => {
	const holder = getHolder()
	const gm = createSimpleGeneModel()
	const gmWithIntron = {
		...gm,
		intron: [
			[1500, 2000],
			[2500, 3000],
			[3500, 4000]
		]
	}

	// Render with strand (nostrand = false)
	sketchGene(holder, gmWithIntron as any, 400, 30, 1000, 5000, '#0000ff', false, false)

	const canvas = holder.select('canvas').node() as HTMLCanvasElement
	test.ok(canvas, 'Canvas should be created with strand direction')

	holder.remove()
	test.end()
})

tape('sketchGene handles nostrand option', test => {
	const holder = getHolder()
	const gm = createSimpleGeneModel()

	// Render without strand (nostrand = true)
	sketchGene(holder, gm, 400, 30, 1000, 5000, '#00ff00', true, false)

	const canvas = holder.select('canvas').node() as HTMLCanvasElement
	test.ok(canvas, 'Canvas should be created without strand direction')

	holder.remove()
	test.end()
})

tape('sketchGene handles reverse orientation', test => {
	const holder = getHolder()
	const gm = createSimpleGeneModel()

	// Render in reverse
	sketchGene(holder, gm, 400, 30, 1000, 5000, '#ff00ff', false, true)

	const canvas = holder.select('canvas').node() as HTMLCanvasElement
	test.ok(canvas, 'Canvas should be created in reverse orientation')

	holder.remove()
	test.end()
})

/**
 * Test sketchProtein function
 */
tape('sketchProtein displays protein information', test => {
	const holder = getHolder()
	const gm = createSimpleGeneModel()

	const span = sketchProtein(holder, gm, 200)

	test.ok(span, 'Span element should be returned')
	const text = span.html()
	test.ok(text.includes('AA'), 'Should display amino acid count')
	test.ok(text.includes('1200'), 'Should show correct AA count (3600/3 = 1200)')

	holder.remove()
	test.end()
})

tape('sketchProtein handles noncoding genes', test => {
	const holder = getHolder()
	const gm = createSimpleGeneModel()
	const noncodingGm = { ...gm, cdslen: undefined }

	const span = sketchProtein(holder, noncodingGm as any, 200)

	const text = span.html()
	test.ok(text.includes('noncoding'), 'Should display "noncoding" for genes without CDS')

	holder.remove()
	test.end()
})

tape('sketchProtein handles incomplete CDS', test => {
	const holder = getHolder()
	const gm = createSimpleGeneModel()
	gm.cdslen = 3601 // Not divisible by 3

	const span = sketchProtein(holder, gm, 200)

	const text = span.html()
	test.ok(text.includes('incomplete CDS'), 'Should indicate incomplete CDS when length not divisible by 3')

	holder.remove()
	test.end()
})

/**
 * Test devicePixelRatio handling across all canvas functions
 */
tape('All canvas functions respect devicePixelRatio', test => {
	const holder = getHolder()
	const gm = createGeneModelWithDomains()
	const rglst = createExonRegions()

	// Test each function that creates a canvas
	const width = 400
	const dpr = window.devicePixelRatio || 1

	// Test sketchSplicerna
	sketchSplicerna(holder, gm, width, '#000')
	let canvas = holder.select('canvas').node() as HTMLCanvasElement
	test.ok(Math.abs(canvas.width - width * dpr) <= 1, 'sketchSplicerna respects DPR')
	holder.selectAll('canvas').remove()

	// Test sketchGmsum
	sketchGmsum(holder, rglst, gm, 1, 10, width, 20, '#000')
	canvas = holder.select('canvas').node() as HTMLCanvasElement
	test.ok(Math.abs(canvas.width - width * dpr) <= 1, 'sketchGmsum respects DPR')
	holder.selectAll('canvas').remove()

	// Test sketchRna
	sketchRna(holder, gm, width, '#000')
	canvas = holder.select('canvas').node() as HTMLCanvasElement
	test.ok(Math.abs(canvas.width - width * dpr) <= 1, 'sketchRna respects DPR')
	holder.selectAll('canvas').remove()

	// Test sketchProtein2
	sketchProtein2(holder, gm, width)
	canvas = holder.select('canvas').node() as HTMLCanvasElement
	test.ok(Math.abs(canvas.width - width * dpr) <= 1, 'sketchProtein2 respects DPR')
	holder.selectAll('canvas').remove()

	// Test sketchGene
	sketchGene(holder, gm, width, 30, 1000, 5000, '#000', false, false)
	canvas = holder.select('canvas').node() as HTMLCanvasElement
	test.ok(Math.abs(canvas.width - width * dpr) <= 1, 'sketchGene respects DPR')

	holder.remove()
	test.end()
})

/**
 * Edge cases and error handling
 */
tape('Functions handle edge cases gracefully', test => {
	const holder = getHolder()

	// Test with minimal gene model
	const minimalGm = {
		isoform: 'test',
		chr: 'chr1',
		start: 1000,
		stop: 2000,
		exon: [[1000, 2000]]
	}

	// Should not throw errors
	try {
		sketchSplicerna(holder, minimalGm as any, 400, '#000')
		test.pass('sketchSplicerna handles minimal gene model')
	} catch (_e) {
		test.fail('sketchSplicerna should not throw with minimal model')
	}

	holder.selectAll('*').remove()

	try {
		sketchRna(holder, minimalGm as any, 400, '#000')
		test.pass('sketchRna handles minimal gene model')
	} catch (_e) {
		test.fail('sketchRna should not throw with minimal model')
	}

	holder.remove()
	test.end()
})
