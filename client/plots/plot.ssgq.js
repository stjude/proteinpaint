import { first_genetrack_tolist } from '#common/1stGenetk'
import { dofetch3 } from '#common/dofetch'
import { gmlst2loci } from '#src/client'

/*
for lack of better name, this script is called "ssgq", after singleSampleGenomeQuantification
later it should also export singleSampleGbtk plotter function

make a plot for the "singleSampleGenomeQuantification" directive, as well as the subsequent block-launching from clicking the image
this function is not made as a vocab api method as it has a lot of dom and interactivity things

termdbConfig = {}
	.queries{}
		.singleSampleGenomeQuantification{ k: {} }
			{ positiveColor, negativeColor, sample_id_key=str, singleSampleGbtk=str }
		.singleSampleGbtk{ k: {} }

dslabel=str
	as on vocab.dslabel

queryKey=str
	a key of singleSampleGenomeQuantification{}

sample={}
	must have value for key of singleSampleGenomeQuantification[queryKey].sample_id_key

holder

genomeObj={}
	client side genome obj

geneName
	optional, if provided,show a genome browser view around the gene under the methylationArrayPlot when its launched

throwError
	optional, instead of showing error to the user, throw
*/
export async function plotSingleSampleGenomeQuantification(
	termdbConfig,
	dslabel,
	queryKey,
	sample,
	holder,
	genomeObj,
	geneName,
	throwError
) {
	const loadingDiv = holder.append('div').text('Loading...')
	try {
		// verify this dataset supports this plot
		if (typeof termdbConfig?.queries?.singleSampleGenomeQuantification != 'object')
			throw 'termdbConfig.queries.singleSampleGenomeQuantification{} missing, cannot plot'
		const q = termdbConfig.queries.singleSampleGenomeQuantification[queryKey]
		if (!q) throw 'invalid queryKey'

		if (typeof sample != 'object') throw 'sample{} not object'
		if (typeof genomeObj != 'object') throw 'genomeObj{} not object'

		const body = {
			genome: genomeObj.name,
			dslabel,
			devicePixelRatio: window.devicePixelRatio > 1 ? window.devicePixelRatio : 1,
			singleSampleGenomeQuantification: { dataType: queryKey, sample: sample[q.sample_id_key] }
		}
		const data = await dofetch3('mds3', { body })
		if (data.error) throw data.error

		holder.attr('id', 'sjpp_ssgq_holder')

		// optional query, if present, will enable clicking on genome-wide img to launch block
		const q2 = termdbConfig.queries.singleSampleGbtk?.[q.singleSampleGbtk]

		// description
		holder
			.append('div')
			.attr('data-testid', 'sjpp_ssgq_sandbox')
			.text(q.description || queryKey)
		if (q2) {
			holder
				.append('div')
				.text(`Click a chromosomal position to zoom in and view ${q2.description || q.singleSampleGbtk}`)
		}

		const img = holder
			.append('img')
			.attr('width', data.canvasWidth)
			.attr('height', data.canvasHeight)
			.attr('src', data.src)

		loadingDiv.remove()

		if (!q2) return // singleSampleGbtk is not enabled

		// !!

		let bb // so as to only load block once, later clicks all update existing block
		if (geneName) {
			const geneData = await dofetch3('genelookup', {
				body: { genome: genomeObj.name, input: geneName, deep: 1 }
			})
			if (geneData.error) throw geneData.error
			if (geneData.gmlst && geneData.gmlst.length) {
				const locs = gmlst2loci(geneData.gmlst)
				const chr = locs[0].chr
				const start = Math.max(0, locs[0].start - (locs[0].stop - locs[0].start))
				const chrLen = data.chrLst.filter(c => c.chr == chr)[0].chrLen
				const stop = Math.min(chrLen, locs[0].stop + (locs[0].stop - locs[0].start))

				// block is not present yet. load block
				bb = await plotSingleSampleGbtk(dslabel, sample, holder, genomeObj, q, q2, chr, start, stop)
			}
		}

		img.on('click', async event => {
			const x = event.offsetX - data.xoff

			let chr, chrLen, position

			for (const c of data.chrLst) {
				if (c.xStart <= x && c.xStop >= x) {
					chr = c.chr
					chrLen = c.chrLen
					position = Math.ceil((c.chrLen / (c.xStop - c.xStart)) * (x - c.xStart))
					break
				}
			}
			if (!chr) return

			const start = Math.max(0, position - 500000),
				stop = Math.min(position + 500000, chrLen)

			if (bb) {
				// block already loaded, jump
				bb.jump_1basedcoordinate({ chr, start, stop })
				return
			}

			// block is not present yet. load block
			bb = await plotSingleSampleGbtk(dslabel, sample, holder, genomeObj, q, q2, chr, start, stop)
		})
	} catch (e) {
		if (throwError) {
			loadingDiv.remove()
		} else loadingDiv.text('Error: ' + (e.message || e))
	}
}

async function plotSingleSampleGbtk(dslabel, sample, holder, genomeObj, q, q2, chr, start, stop) {
	const body = {
		genome: genomeObj.name,
		dslabel,
		singleSampleGbtk: { dataType: q.singleSampleGbtk, sample: sample[q2.sample_id_key] }
	}
	const d2 = await dofetch3('mds3', { body })
	// d2={path:str}
	if (!d2.path) return // no file
	// has bedgraph file, load block
	const tklst = [
		{
			type: 'bigwig',
			name: sample[q2.sample_id_key],
			file: d2.path,
			height: 100,
			scale: { min: q2.min, max: q2.max },
			pcolor: q.positiveColor,
			ncolor: q.negativeColor
		}
	]
	first_genetrack_tolist(genomeObj, tklst)

	const bb = new (await import('#src/block')).Block({
		genome: genomeObj,
		holder: holder.append('div'),
		nobox: true,
		tklst,
		chr,
		start,
		stop
	})
	return bb
}
