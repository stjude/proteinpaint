export default async function (termdbConfig, dslabel, queryKey, sample, holder, genomeObj, _overrides = {}) {
	const overrides = computeOverrides(_overrides)

	const loadingDiv = holder.append('div').style('margin', '20px').text('Loading...')

	try {
		// must do this check to make sure this ds supports brainImaging
		if (typeof termdbConfig?.queries?.NIdata != 'object') throw 'termdbConfig.queries.NIdata{} not object'
		const q = termdbConfig.queries.NIdata[queryKey]
		if (!q) throw 'invalid queryKey'
		if (typeof sample != 'object') throw 'sample{} not object'
		if (typeof genomeObj != 'object') throw 'genomeObj{} not object'

		// request data
		const brainImaging_arg = {
			sampleName: sample.sample_id,
			genome: genomeObj,
			queryKey
		}

		const opts = {
			holder: holder,
			state: {
				genome: genomeObj.name,
				dslabel: dslabel,
				plots: [
					{
						chartType: 'brainImaging',
						selectedSampleFileNames: [sample.sample_id + '.nii'],
						queryKey,
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

function computeOverrides(o) {
	const overrides = structuredClone(o)
	if (!overrides.brainImaging) overrides.brainImaging = {}
	if (!overrides.downloadImgName) {
		overrides.downloadImgName = 'brainImaging'
	}
	return overrides
}
