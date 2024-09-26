import * as client from './client'
import { stratinput } from '#shared/tree.js'
import { stratify } from 'd3-hierarchy'

/*
input is:
- one vcf file
- one vcf url
- multiple vcf, not supported yet

return a tk object of ds type
*/

export default function vcf2dstk(arg) {
	/*
	arg is prime vcf track object

	.file
	.url
	.indexURL
	.name
	.pointdown

	.cohorttrack

	*/

	const ds = {
		id2vcf: {},
		label: arg.name || 'Unnamed VCF file'
	}

	let vcfobj
	if (arg.file) {
		const id = Math.random().toString()
		vcfobj = {
			file: arg.file,
			indexURL: arg.indexURL,
			vcfid: id
		}
		ds.id2vcf[id] = vcfobj
	} else if (arg.url) {
		const id = Math.random().toString()
		vcfobj = {
			url: arg.url,
			indexURL: arg.indexURL,
			vcfid: id
		}
		ds.id2vcf[id] = vcfobj
	} else {
		return ['no .file or .url']
	}

	// attr applied to the vcf obj
	vcfobj.headernotloaded = true
	if (arg.samplenamemap) {
		// to be used for header conversion in cohort vcf, only use once
		vcfobj.samplenamemap = arg.samplenamemap
	}

	if (arg.variant2img) {
		if (!arg.variant2img.path) return ['.path missing from .variant2img{}']
	}

	const tk = {
		type: client.tkt.ds,

		// to be loaded by loadvcftk() as a custom track, rather than "/dsdata" for official ds
		isvcf: true,

		name: ds.label,
		ds: ds,
		populationfrequencyfilter: arg.populationfrequencyfilter,
		vcfinfofilter: arg.vcfinfofilter,
		itemlabelname: arg.itemlabelname,
		viewrangeupperlimit: arg.viewrangeupperlimit,
		variant2img: arg.variant2img,
		axisheight: arg.axisheight
	}

	if (arg.url4variant) {
		const err = check_url4variant(arg.url4variant)
		if (err) return ['.url4variant error: ' + err]
		tk.url4variant = arg.url4variant
	}

	if (arg.button4variant) {
		const err = check_button4variant(arg.button4variant)
		if (err) return ['.button4variant error: ' + err]
		tk.button4variant = arg.button4variant
	}

	if (arg.sampleannotation) {
		const sn = arg.sampleannotation
		if (!sn.annotation) return ['.annotation{} missing from .sampleannotation']
		if (sn.levels) {
			if (!Array.isArray(sn.levels)) return ['.sampleannotation.levels should be array']
			const lst = []
			for (const sample in sn.annotation) {
				const o = { sample_name: sample }
				for (const k in sn.annotation[sample]) {
					o[k] = sn.annotation[sample][k]
				}
				lst.push(o)
			}
			const nodes = stratinput(lst, sn.levels)
			sn.root = stratify()(nodes)
			sn.root.sum(i => i.value)
		}

		if (sn.variantsunburst) {
			// bool
			if (!sn.levels) return ['.levels missing when .variantsunburst is on from .sampleannotation']
		}

		tk.ds.cohort = sn
	}

	// attributes applied to the .ds
	if (arg.vcfcohorttrack) {
		if (!arg.vcfcohorttrack.file && !arg.vcfcohorttrack.url) return ['no .file or .url provided from .vcfcohorttrack']
		tk.ds.vcfcohorttrack = arg.vcfcohorttrack
	}

	// plotter

	if (arg.germline2dvafplot) {
		if (!arg.germline2dvafplot.individualkey) return ['.individualkey missing from germline2dvafplot']
		if (!arg.germline2dvafplot.sampletypekey) return ['.sampletypekey missing from germline2dvafplot']
		if (!arg.germline2dvafplot.xsampletype) return ['.xsampletype missing from germline2dvafplot']
		if (!arg.germline2dvafplot.yleftsampletype) return ['.yleftsampletype missing from germline2dvafplot']
		if (arg.germline2dvafplot.yrightsampletype) {
			if (arg.germline2dvafplot.yrightsampletype == arg.germline2dvafplot.yleftsampletype)
				return ['.yrightsampletype should not be same as yleftsampletype']
		}
		tk.ds.germline2dvafplot = arg.germline2dvafplot
	}

	if (arg.vaf2coverageplot) {
		if (arg.vaf2coverageplot.categorykey) {
			// applies category
			if (!arg.vaf2coverageplot.categories)
				return ['.categories missing when .categorykey is in use for .vaf2coverageplot']
		}
		tk.ds.vaf2coverageplot = arg.vaf2coverageplot
	}

	if (arg.genotype2boxplot) {
		if (arg.genotype2boxplot.boxplotvaluekey) {
			// precomputed boxplot values
		} else if (arg.genotype2boxplot.sampleannotationkey) {
			if (!tk.ds.cohort) return ['sampleannotation missing when using genotype2boxplot.sampleannotationkey']
			if (!tk.ds.cohort.annotation)
				return ['sampleannotation.annotation missing when using genotype2boxplot.sampleannotationkey']
			let found = false
			for (const k in tk.ds.cohort.annotation) {
				if (arg.genotype2boxplot.sampleannotationkey in tk.ds.cohort.annotation[k]) {
					found = true
					break
				}
			}
			if (!found) return [arg.genotype2boxplot.sampleannotationkey + ' not found in any sample annotation']
		} else {
			return ['incomplete instruction for genotype2boxplot']
		}
		tk.ds.genotype2boxplot = arg.genotype2boxplot
	}

	if (arg.discardsymbolicallele) {
		tk.ds.discardsymbolicallele = true
	}

	if (arg.samplebynumericvalue) {
		if (!arg.samplebynumericvalue.attrkey) return ['attrkey missing from samplebynumericvalue']
		if (!tk.ds.cohort) return ['sampleannotation missing when using samplebynumericvalue']
		if (!tk.ds.cohort.annotation) return ['sampleannotation.annotation missing when using samplebynumericvalue']
		let found = false
		for (const k in tk.ds.cohort.annotation) {
			if (Number.isFinite(tk.ds.cohort.annotation[k][arg.samplebynumericvalue.attrkey])) {
				found = true
				break
			}
		}
		if (!found) return ['samplebynumericvalue.attrkey not found in any sample annotation']
		tk.ds.samplebynumericvalue = arg.samplebynumericvalue
	}

	{
		const g = arg.genotypebynumericvalue
		if (g) {
			if (!g.refref) return [tk.name + ': refref missing from genotypebynumericvalue']
			if (!g.refalt) return [tk.name + ': refalt missing from genotypebynumericvalue']
			if (!g.altalt) return [tk.name + ': altalt missing from genotypebynumericvalue']
			if (!g.refref.infokey) return [tk.name + ': refref.infokey missing from genotypebynumericvalue']
			if (!g.refalt.infokey) return [tk.name + ': refalt.infokey missing from genotypebynumericvalue']
			if (!g.altalt.infokey) return [tk.name + ': altalt.infokey missing from genotypebynumericvalue']
			if (g.refref.genotypeCountInfokey || g.refalt.genotypeCountInfokey || g.altalt.genotypeCountInfokey) {
				if (!g.refref.genotypeCountInfokey)
					return [tk.name + ': genotypeCountInfokey missing from genotypebynumericvalue.refref{}']
				if (!g.refalt.genotypeCountInfokey)
					return [tk.name + ': genotypeCountInfokey missing from genotypebynumericvalue.refalt{}']
				if (!g.altalt.genotypeCountInfokey)
					return [tk.name + ': genotypeCountInfokey missing from genotypebynumericvalue.altalt{}']
			}
			tk.ds.genotypebynumericvalue = g
		}
	}

	if (arg.pointdown) {
		tk.aboveprotein = false
	}

	if (arg.dstk_novcferror) {
		tk.dstk_novcferror = true
	}

	return [null, tk]
}

function check_url4variant(lst) {
	if (!Array.isArray(lst)) return 'value is not an array'
	for (const item of lst) {
		if (!item.makeurl) {
			return '.makeurl missing'
		}
		if (typeof item.makeurl != 'function') {
			return '.makeurl must be a function'
		}
	}
	return false
}
function check_button4variant(lst) {
	if (!Array.isArray(lst)) return 'value is not an array'
	for (const item of lst) {
		if (!item.makebutton) {
			return '.makebutton missing'
		}
		if (typeof item.makebutton != 'function') {
			return '.makebutton must be a function'
		}
	}
	return false
}
