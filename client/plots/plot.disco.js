import { dofetch3 } from '#common/dofetch'
import { dt2label } from '#shared/common'

/*
make a disco plot for the "singleSampleMutation" directive, as well as the subsequent block-launching from clicking the image
this function is not made as a vocab api method as it has a lot of dom and interactivity things

termdbConfig = {}
	.queries{}
		.singleSampleGenomeQuantification{ k: {} }
			{ positiveColor, negativeColor, sample_id_key=str, singleSampleGbtk=str }
		.singleSampleGbtk{ k: {} }

dslabel=str
	as on vocab.dslabel

sample={}
	must have value for key of singleSampleGenomeQuantification[queryKey].sample_id_key

holder

genomeObj={}
	client side genome obj

_overrides={}
	optional override parameters to pass to disco

throwError
	optional, instead of showing error to the user, throw
*/
export default async function (termdbConfig, dslabel, sample, holder, genomeObj, _overrides = {}, throwError) {
	const overrides = computeOverrides(_overrides, termdbConfig, genomeObj, sample)

	const loadingDiv = holder.append('div').style('margin', '20px').text('Loading...')

	try {
		// must do this check to make sure this ds supports disco
		if (typeof termdbConfig?.queries?.singleSampleMutation != 'object')
			throw 'termdbConfig.queries.singleSampleMutation{} not object'
		// TODO can delete following checks if written as ts
		if (typeof sample != 'object') throw 'sample{} not object'
		if (typeof genomeObj != 'object') throw 'genomeObj{} not object'

		// request data
		const body = {
			genome: genomeObj.name,
			dslabel,
			sample: sample[termdbConfig.queries.singleSampleMutation.sample_id_key]
		}
		const data = await dofetch3('termdb/singleSampleMutation', { body })
		if (data.error) {
			if (throwError) {
				loadingDiv.remove()
				return
			} else throw data.error
		}
		if (!Array.isArray(data.mlst)) throw 'data.mlst is not array'

		if (data.dt2total?.length) {
			// array element: {dt:int, total:int}
			// may pass this to disco argument to display it in legend
			for (const o of data.dt2total) {
				holder
					.append('div')
					.style('margin', '20px 20px 0px 40px')
					.text(`(Displaying ${data.mlst.filter(i => i.dt == o.dt).length} out of total ${o.total} ${dt2label[o.dt]})`)
			}
		}

		const mlst = data.mlst

		for (const i of mlst) i.position = i.pos

		const disco_arg = {
			sampleName: sample[termdbConfig.queries.singleSampleMutation.sample_id_key],
			data: mlst,
			genome: genomeObj
		}

		if (termdbConfig.queries.singleSampleMutation.discoSkipChrM) {
			// quick fix: exclude chrM from list of chromosomes
			// assume the name of "chrM" but not chrMT. do case insensitive match
			disco_arg.chromosomes = {}
			for (const k in genomeObj.majorchr) {
				if (k.toLowerCase() == 'chrm') continue
				disco_arg.chromosomes[k] = genomeObj.majorchr[k]
			}
		}

		const opts = {
			holder: holder,

			state: {
				genome: genomeObj.name,
				dslabel: dslabel,
				args: disco_arg,

				plots: [
					{
						chartType: 'Disco',
						subfolder: 'disco',
						extension: 'ts',
						overrides
					}
				]
			}
		}
		const plot = await import('#plots/plot.app.js')
		const plotAppApi = await plot.appInit(opts)
		loadingDiv.remove()
	} catch (e) {
		loadingDiv.text('Error: ' + (e.message || e))
	}
}

function computeOverrides(o, termdbConfig, genomeObj, sample) {
	// parameter is duplicated into a new object; this script computes new attributes and add to the new obj
	const overrides = structuredClone(o)
	if (!overrides.Disco) overrides.Disco = {}
	overrides.Disco.showPrioritizeGeneLabelsByGeneSets = !!genomeObj.geneset
	if (!overrides.downloadImgName) {
		overrides.downloadImgName = sample[termdbConfig.queries.singleSampleMutation.sample_id_key] + ' Disco'
	}
	return overrides
}
