import * as client from './client'

/*
********************** EXPORTED
init_mdsjson
validate_mdsjson
get_json_tk
*/

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
			try {
				tklst.push(await tklst_pipeline(json_file, json_url, holder))
			} catch (e) {
				client.sayerror(holder, e)
			}
		}
	} else if (json_urls.length) {
		const json_file = undefined
		for (const json_url of json_urls) {
			try {
				tklst.push(await tklst_pipeline(json_file, json_url, holder))
			} catch (e) {
				client.sayerror(holder, e)
			}
		}
	}

	return tklst
}

async function tklst_pipeline(json_file, json_url) {
	const obj = await mdsjson_parse(json_file, json_url)
	validate_mdsjson(obj)
	const tk = get_json_tk(obj)
	return tk
}

async function mdsjson_parse(json_file, json_url) {
	if (json_file !== undefined && json_file == '') throw '.jsonfile missing'
	if (json_url !== undefined && json_url == '') throw '.jsonurl missing'

	let tmp
	if (json_file !== undefined) tmp = await client.dofetch('textfile', { file: json_file })
	else if (json_url !== undefined) tmp = await client.dofetch('urltextfile', { url: json_url })
	if (tmp.error) {
		throw tmp.error
	}
	return JSON.parse(tmp.text)
}

export function validate_mdsjson(obj) {
	if (!obj) throw 'file is missing'
	if (!obj.type) throw 'dataset type is missing'
	const svcnvfile = obj.svcnvfile || obj.svcnvurl
	const vcffile = obj.vcffile || obj.vcfurl
	if (!svcnvfile && !vcffile) throw 'vcf or cnv file/url is required'
	if (Object.keys(obj).filter(x => x.includes('expression')).length) {
		if (!obj.expressionfile && !obj.expressionurl) throw 'expression file/url is missing'
	}
	if (Object.keys(obj).filter(x => x.includes('rnabam')).length) {
		if (!obj.rnabamfile && !obj.rnabamurl) throw 'rnabam file/url is missing'
	}
	if (obj.sampleset) {
		for (const sample of obj.sampleset) {
			if (obj.sampleset.length != 1 && !sample.name) throw 'sampleset name is missing'
			if (!sample.samples) throw 'sampleset samples[] is missing'
		}
	}
	if (obj.sample2assaytrack) {
		for (const [sample, assaylst] of Object.entries(obj.sample2assaytrack)) {
			if (!assaylst.length) throw 'assay[] missing for ' + sample
			for (const assay of assaylst) {
				if (!assay.name) throw 'assay name is missing for ' + sample
				if (!assay.type) throw 'assay type is missing for ' + sample
			}
		}
	}

	if (obj.groupsamplebyattr) {
		if (!obj.groupsamplebyattr.attrlst) return '.attrlst[] missing from groupsamplebyattr'
		if (obj.groupsamplebyattr.attrlst.length == 0) return 'groupsamplebyattr.attrlst[] empty array'

		for (const attr of obj.groupsamplebyattr.attrlst) {
			if (!attr.k) return 'k missing from one of groupsamplebyattr.attrlst[]'
		}

		if (obj.groupsamplebyattr.sortgroupby) {
			if (!obj.groupsamplebyattr.sortgroupby.key) return '.key missing from .sortgroupby'
			if (!obj.groupsamplebyattr.sortgroupby.order) return '.order[] missing from .sortgroupby'
			if (!Array.isArray(obj.groupsamplebyattr.sortgroupby.order)) return '.order must be an array'
			// values of order[] is not validated
		}
		if (!obj.groupsamplebyattr.attrnamespacer) obj.groupsamplebyattr.attrnamespacer = ', '
	}

	if (obj.fixedgeneexpression) {
		for (const gene of obj.fixedgeneexpression) {
			if (!gene.gene) throw 'gene missing in fixedgeneexpression array'
		}
	}

	// hidden classes for vcf file
	if (obj.vcf) {
		if (!obj.vcf.hiddenclass) throw 'hiddenclasses[] missing from .vcf'
	}
}

export function get_json_tk(tkobj) {
	const track = {
		type: tkobj.type,
		name: tkobj.name
	}

	// dense or full
	if (tkobj.isdense == 'true' || tkobj.isdense == true || tkobj.isfull === false) track.isdense = true
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

	// hidden mutation classes
	if (tkobj.vcf) {
		if (tkobj.vcf.hiddenclass) {
			track.vcf = []
			track.vcf.hiddenclass = tkobj.vcf.hiddenclass
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

	if (tkobj.groupsamplebyattr) {
		track.groupsamplebyattr = tkobj.groupsamplebyattr
	}

	// fixed panel of gene expression
	track.fixedgeneexpression = tkobj.fixedgeneexpression
	// show all samples
	track.getallsamples = tkobj.getallsamples

	// cnv cutoff settings
	track.valueCutoff = tkobj.cnvValueCutoff !== undefined ? tkobj.cnvValueCutoff : undefined
	track.bplengthUpperLimit = tkobj.cnvLengthUpperLimit !== undefined ? tkobj.cnvLengthUpperLimit : undefined

	// loh cutoff settings
	track.segmeanValueCutoff = tkobj.segmeanValueCutoff !== undefined ? tkobj.segmeanValueCutoff : undefined
	track.lohLengthUpperLimit = tkobj.lohLengthUpperLimit !== undefined ? tkobj.lohLengthUpperLimit : undefined

	// multihide labels
	track.multihidelabel_vcf = tkobj.multihidelabel_vcf || undefined
	track.multihidelabel_fusion = tkobj.multihidelabel_fusion || undefined
	track.multihidelabel_sv = tkobj.multihidelabel_sv || undefined

	return track
}

export async function get_scatterplot_data(json_file, json_url, holder) {
	let data = {}
	const obj = await mdsjson_parse(json_file, json_url)
	validate_scatter_json(obj)
	data.mdssamplescatterplot = obj
	return data
}

function validate_scatter_json(obj) {
	// console.log(obj)
	let sample_attrs = []
	const samplekey = obj.analysisdata.samplekey

	if (!obj) throw 'file is missing'
	if (!obj.analysisdata) throw '"analysisdata" is required for sctter plot'

	// validate sample_attributes
	if (obj.analysisdata.sample_attributes) sample_attrs = Object.keys(obj.analysisdata.sample_attributes)

	// validate attr_levels
	if (obj.analysisdata.attr_levels) {
		for (const attr of obj.analysisdata.attr_levels) {
			if (!attr.key) throw '"key" is required field for "attr_levels"'
			if (!sample_attrs.filter(x => x.includes(attr.key)).length) throw '"key" must be present in "sample_attrs{}"'
		}
	}

	// validate colorbyattributes
	if (obj.analysisdata.colorbyattributes) {
		for (const attr of obj.analysisdata.colorbyattributes) {
			if (!attr.key) throw '"key" is required field for "colorbyattributes"'
			if (!sample_attrs.filter(x => x.includes(attr.key)).length) throw '"key" must be present in "sample_attrs{}"'
		}
	}

	// validate samples
	if (!obj.analysisdata.samples) throw '"samples" is required field'
	validate_samples(obj.analysisdata.samples, 'samples[]')

	// validate user's samples
	if (obj.analysisdata.user_samples) {
		validate_samples(obj.analysisdata.user_samples, 'user_samples[]')
	}

	function validate_samples(samples, samples_name) {
		for (const sample of samples) {
			if (!sample.x) throw '"x" is required for each sample in ' + samples_name
			if (!sample.y) throw '"y" is required for each sample in ' + samples_name
			if (!samplekey && !sample.sample) '"sample" should be present for each sample in ' + samples_name
			if (samplekey && !Object.keys(sample).filter(x => x.includes(samplekey)).length) {
				throw samplekey + ' must be present for each sample in ' + samples_name
			}
		}
	}
}
