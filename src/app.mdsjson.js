import * as client from './client'

export async function init_mdsjson(file_str, url_str, holder) {
	let json_files = [],
		json_urls = []

	if (file_str && file_str.includes(',')) json_files = file_str.split(',')
	else if (file_str) json_files.push(file_str)
	else if (url_str && url_str.includes(',')) json_urls = url_str.split(',')
	else if (url_str) json_urls.push(url_str)

	const tklst = []
	if (json_files.length) {
		const json_url = undefined
		for (const json_file of json_files) {
			const obj = await mdsjson_parse(json_file, json_url, holder)
			validate_mdsjson(obj, holder)
			tklst.push(get_json_tk(obj))
		}
	} else if (json_urls.length) {
		const json_file = undefined
		for (const json_url of json_urls) {
			const obj = await mdsjson_parse(json_file, json_url, holder)
			validate_mdsjson(obj, holder)
			tklst.push(get_json_tk(obj))
		}
	}

	return tklst
}

async function mdsjson_parse(json_file, json_url, holder) {
	let error_m
	if (json_file !== undefined && json_file == '') error_m = '.jsonfile missing'
	if (json_url !== undefined && json_url == '') error_m = '.jsonurl missing'
	if (error_m) {
		client.sayerror(holder, error_m)
		throw error_m
	}

	let tmp
	if (json_file !== undefined) tmp = await client.dofetch('textfile', { file: json_file })
	else if (json_url !== undefined) tmp = await client.dofetch('urltextfile', { url: json_url })
	if (tmp.error) {
		client.sayerror(holder, tmp.error)
		throw tmp.error
	}
	return JSON.parse(tmp.text)
}

function validate_mdsjson(obj, holder) {
	let error_m
	if (!obj.type) error_m = 'dataset type is missing'
	const svcnvfile = obj.svcnvfile || obj.svcnvurl
	const vcffile = obj.vcffile || obj.vcfurl
	if (!svcnvfile || !vcffile) error_m = 'vcf or cnv file/url is required'
	if (Object.keys(obj).filter(x => x.includes('expression')).length) {
		if (!obj.expressionfile && !obj.expressionurl) error_m = 'expression file/url is missing'
	}
	if (Object.keys(obj).filter(x => x.includes('rnabam')).length) {
		if (!obj.rnabamfile && !obj.rnabamurl) error_m = 'rnabam file/url is missing'
	}
	if (obj.sampleset) {
		for (const sample of obj.sampleset) {
			if (obj.sampleset.length != 1 && !sample.name) error_m = 'sampleset name is missing'
			if (!sample.samples) error_m = 'sampleset samples[] is missing'
		}
	}
	if (obj.sample2assaytrack) {
		for (const [sample, assaylst] of Object.entries(obj.sample2assaytrack)) {
			if (!assaylst.length) error_m = 'assay[] missing for ' + sample
			for (const assay of assaylst) {
				if (!assay.name) error_m = 'assay name is missing for ' + sample
				if (!assay.type) error_m = 'assay type is missing for ' + sample
			}
		}
	}
	if (error_m) {
		client.sayerror(holder, error_m)
		throw error_m
	}
}

function get_json_tk(tkobj) {
	const track = {
		type: tkobj.type,
		name: tkobj.name
	}

	// dense or full
	if (tkobj.isdense || tkobj.isfull === false) track.isdense = true
	else if (tkobj.isfull) track.isfull = true

	// svcnv file
	if (tkobj.svcnvfile) track.file = tkobj.svcnvfile
	else if (tkobj.svcnvurl) track.url = tkobj.svcnvurl

	// expressionrank
	if (Object.keys(tkobj).filter(x => x.includes('expression')).length) {
		track.checkexpressionrank = {
			file: tkobj.expressionfile,
			url: tkobj.expressionurl
		}
	}

	// vcf
	if (Object.keys(tkobj).filter(x => x.includes('vcf')).length) {
		track.checkvcf = {
			file: tkobj.vcffile,
			url: tkobj.vcfurl
		}
	}

	// rna bam
	if (Object.keys(tkobj).filter(x => x.includes('rnabam')).length) {
		track.checkrnabam = {
			file: tkobj.rnabamfile,
			url: tkobj.rnabamurl
		}
	}

	// sampleset
	if (tkobj.sampleset) {
		track.sampleset = tkobj.sampleset
	}

	// SampleAssayTrack
	if (tkobj.sample2assaytrack) {
		track.sample2assaytrack = tkobj.sample2assaytrack
	}

	// cnv cutoff settings
	track.valueCutoff = tkobj.cnvValueCutoff || undefined
	track.bplengthUpperLimit = tkobj.cnvLengthUpperLimit || undefined

	// loh cutoff settings
	track.segmeanValueCutoff = tkobj.segmeanValueCutoff || undefined
	track.lohLengthUpperLimit = tkobj.lohLengthUpperLimit || undefined

	// multihide labels
	track.multihidelabel_vcf = tkobj.multihidelabel_vcf || undefined
	track.multihidelabel_fusion = tkobj.multihidelabel_fusion || undefined
	track.multihidelabel_sv = tkobj.multihidelabel_sv || undefined

	return track
}
