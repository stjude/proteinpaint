import tape from 'tape'
import * as d3s from 'd3-selection'
import { runproteinpaint } from '../../test/front.helpers'

/*** test sections

basic bedj & bw test, could be expanded
BAM tk
*/

tape('\n', function (test) {
	test.comment('-***- block tracks -***-')
	test.end()
})

tape('basic bedj & bw test, could be expanded', test => {
	const holder: any = getHolder() // any suppresses tsc err
	runproteinpaint({
		holder,
		noheader: true,
		genome: 'hg38-test',
		block: 1,
		onloadalltk_always,
		tracks: [
			{ type: 'bedj', name: 'refgene', file: 'anno/refGene.hg38.test.gz' },
			{ type: 'bedj', name: 'good bed', file: 'files/hg38/TermdbTest/trackLst/bed1.gz' },
			{ type: 'bedj', name: 'bad bed', file: 'files/hg38/TermdbTest/trackLst/bed' },
			{ type: 'bigwig', name: 'good bw', file: 'files/hg38/TermdbTest/trackLst/bw1.bw' },
			{ type: 'bigwig', name: 'bad bw', file: 'files/hg38/TermdbTest/trackLst/bw' }
		]
	})
	function onloadalltk_always(bb) {
		{
			// bedj file as native gene track
			const t = bb.tklst[0]
			test.equal(t.name, 'refgene', 'tk named refgene exists')
			const b = t.img.node().getBBox() // get width/height of svg <image>
			test.ok(b.width > 500 && b.height > 100, 'refgene <image> width>500 & height>100 indicating successful rendering')
			// no way to test finer points about bedj rendering
		}
		{
			// bedj file as custom tk, with only one item and one row showing in default range
			const t = bb.tklst[1]
			test.equal(t.name, 'good bed', 'tk named good bed exists')
			const b = t.img.node().getBBox()
			test.ok(b.width > 500 && b.height == 12, 'good bed <image> width>500 & height=12')
		}
		{
			// invalid bedj
			const t = bb.tklst[2]
			test.equal(t.name, 'bad bed', 'tk named bad bed exists')
			const b = t.img.node().getBBox()
			test.ok(b.width == 0 && b.height == 0, 'bad bed <image> width=height=0')
			test.ok(
				t.gerror.text().startsWith('[E::hts_open_format] Failed to open file'),
				'gerror text begins with "[E::hts_open_format] Failed to open file"'
			)
		}
		{
			// bw file as custom tk
			const t = bb.tklst[3]
			test.equal(t.name, 'good bw', 'tk named good bw exists')
			const b = t.img.node().getBBox()
			test.ok(b.width > 500 && b.height == 50, 'good bw <image> width>500 & height=50')
			const leftAxisTickLabels = t.leftaxis.selectAll('text').nodes()
			test.equal(leftAxisTickLabels.length, 2, 'there are two <text> in left axis')
			test.ok(Number(leftAxisTickLabels[1].innerHTML) > 100, 'left axis bottom tick value >100')
			test.equal(leftAxisTickLabels[0].innerHTML, '0', 'left axis top tick value=0')
		}
		{
			// invalid bw
			const t = bb.tklst[4]
			test.equal(t.name, 'bad bw', 'tk named bad bw exists')
			const b = t.img.node().getBBox()
			test.ok(b.width == 0 && b.height == 0, 'bad bw <image> width=height=0')
			test.equal(t.gerror?.text(), 'Cannot read bigWig file', 'gerror text="Cannot read bigWig file"')
			test.equal(t.leftaxis.selectAll('text').nodes().length, 0, 'left axis is blank, no tick labels')
		}
		if (test['_ok']) holder.remove()
		test.end()
	}
})
tape('BAM tk', test => {
	const holder: any = getHolder() // any suppresses tsc err
	runproteinpaint({
		holder,
		noheader: true,
		genome: 'hg38-test',
		block: 1,
		onloadalltk_always,
		position: 'chr17:7674168-7674302',
		tracks: [
			{ type: 'bam', name: 'good bam', file: 'files/hg38/TermdbTest/trackLst/bam.bam' },
			{
				type: 'bam',
				name: 'genotyping bam',
				file: 'files/hg38/TermdbTest/trackLst/bam.bam',
				strictness: 1,
				variants: [{ chr: 'chr17', pos: 7674219, ref: 'C', alt: 'T' }]
			},
			{ type: 'bam', name: 'bad bam', file: 'files/hg38/TermdbTest/trackLst/xx' }
		]
	})
	function onloadalltk_always(bb) {
		{
			const t = bb.tklst[0]
			//console.log(t)
			test.equal(t.name, 'good bam', 'tk named good bam exists')

			let b = t.dom.pileup_img.node().getBBox()
			test.ok(b.width > 100 && b.height > 10, 'pileup <image> width>100 & height>10')
			test.ok(t.dom.pileup_axis.selectAll('text').nodes().length > 1, 'more than 1 tick labels in pileup Y axis')

			test.ok(
				t.groups[0].data.templatebox.length > 100,
				'groups[0].data.templatebox.length>100 (positional position for over 100 reads loaded)'
			)
			b = t.groups[0].dom.img_fullstack.node().getBBox()
			test.ok(b.width > 100 && b.height > 10, 'img_fullstack <image> width>100 & height>10')
			b = t.groups[0].dom.img_partstack.node().getBBox()
			test.ok(b.width == 0 && b.height == 0, 'img_partstack <image> width=0 & height=0')
		}
		{
			const t = bb.tklst[1]
			//console.log(t)
			test.equal(t.name, 'genotyping bam', 'tk named genotyping bam exists')
			let b = t.dom.pileup_img.node().getBBox()
			test.ok(b.width > 100 && b.height > 10, 'pileup <image> width>100 & height>10')

			/*************
			due to lack of reference genome sequence (all 'N'),
			re-alignment of read against ref & mut allele will always fail;
			thus there will be no reads supporting "reference" and "mutant" group, just "neither" group

			group[0] are the reads supporting neither ref or alt alleles
			*/
			test.ok(
				t.groups[0].data.templatebox.length > 10,
				'groups[0].data.templatebox.length>10 (positional position for over 10 reads loaded)'
			)
			b = t.groups[0].dom.img_fullstack.node().getBBox()
			test.ok(b.width > 100 && b.height > 10, 'img_fullstack <image> width>100 & height>10')
			b = t.groups[0].dom.img_partstack.node().getBBox()
			test.ok(b.width == 0 && b.height == 0, 'img_partstack <image> width=0 & height=0')
		}
		if (test['_ok']) holder.remove()
		test.end()
	}
})

/*** helper ***/
function getHolder() {
	return d3s.select('body').append('div').style('border', 'solid 1px black').style('padding', '20px').node()
}
