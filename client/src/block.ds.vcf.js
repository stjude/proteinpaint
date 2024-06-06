import * as client from './client'
import * as vcf from '#shared/vcf'
import * as coord from './coord'
import * as common from '#shared/common'
import { load2tk } from './block.ds'

/*

load vcf for vcf track, should be custom track from embedding api

if has vcfcohorttrack, server will not preload the header, must be loaded here along with first data request


********************** EXPORTED

loadvcftk
data2tk


*/

export function loadvcftk(block, tk) {
	// single file

	let vcfconfig = null
	for (const id in tk.ds.id2vcf) {
		vcfconfig = tk.ds.id2vcf[id]
	}
	if (!vcfconfig) {
		block.tkcloakoff(tk, { error: 'no vcf config found' })
		return
	}

	Promise.resolve()
		.then(() => {
			if (!vcfconfig.headernotloaded) return
			delete vcfconfig.headernotloaded
			const arg = ['genome=' + block.genome.name]
			if (vcfconfig.file) {
				arg.push('file=' + vcfconfig.file)
			} else {
				arg.push('url=' + vcfconfig.url)
				if (vcfconfig.indexURL) arg.push('indexURL=' + vcfconfig.indexURL)
			}
			return client.dofetch2('vcfheader?' + arg.join('&')).then(data => {
				if (data.error) throw { message: data.error }
				if (!data.metastr) throw { message: 'no meta lines for vcf file ' + tk.name }
				const [info, format, samples, errs] = vcf.vcfparsemeta(data.metastr.split('\n'))
				if (errs) throw { error: 'vcf meta error for file ' + tk.name + ': ' + errs.join('; ') }
				vcfconfig.info = info
				vcfconfig.format = format
				if (vcfconfig.samplenamemap) {
					vcfconfig.samples = samples.map(vcfconfig.samplenamemap)
				} else {
					vcfconfig.samples = samples
				}
				vcfconfig.nochr = data.nochr
			})
		})
		.then(() => {
			// load m data for vcf
			const arg = {
				file: vcfconfig.file,
				url: vcfconfig.url,
				indexURL: vcfconfig.indexURL,
				rglst: block.tkarg_maygm(tk)
			}
			if (vcfconfig.nochr) {
				for (const r of arg.rglst) {
					r.chr = r.chr.replace('chr', '')
				}
			}
			return client.dofetch2('vcf', { method: 'POST', body: JSON.stringify(arg) }).then(data => {
				if (data.error) throw { message: data.error }
				const lines = data.linestr ? data.linestr.trim().split('\n') : []
				load2tk([{ vcfid: vcfconfig.vcfid, lines: lines }], block, tk)
				return
			})
		})
		.catch(err => {
			if (err.stack) console.log(err.stack)
			return err.message
		})
		.then(errmsg => {
			block.tkcloakoff(tk, { error: errmsg })
		})
}

export function data2tk(data, tk, block) {
	const vcfconfig = tk.ds.id2vcf[data.vcfid]
	if (!vcfconfig) {
		block.error('vcf not found by id: ' + data.vcfid)
		return
	}
	if (!data.lines) {
		block.error('no vcf lines from vcf file ' + data.vcfid)
		return
	}

	const errors = []

	for (const line of data.lines) {
		const [errmsg, mlst, altinvalid] = vcf.vcfparseline(line, vcfconfig)
		if (errmsg) {
			errors.push(errmsg)
		}
		if (!mlst) {
			// error
			continue
		}

		for (const m of mlst) {
			if (m.alt == 'NON_REF') {
				// discard such from gVCF
				continue
			}
			if (tk.ds.discardsymbolicallele && m.issymbolicallele) {
				// user setting
				continue
			}

			if (block.usegm) {
				const t = coord.genomic2gm(m.pos, block.usegm)
				m.rnapos = t.rnapos
				m.aapos = t.aapos
			}
			m.vcfid = data.vcfid

			/* what problem is this?
			if(m2.ref.length>m2.alt.length) {
				const nt1=m2.ref[0]
				const nt2=m2.alt[0]
				if(common.basecolor[nt1] && common.basecolor[nt2] && nt1==nt2) {
					is small deletion, both alleles are valid nucleotides
					first nt of both alleles are the same and it's the padding base
					trim the padding base, shift the m.pos
					m2.ref=m2.ref.substr(1)
					if(m2.alt.length==1) {
						m2.alt='-'
					} else {
						m2.alt=m2.alt.substr(1)
					}
					m2.pos++
					if(block.usegm) {
						const t=coord.genomic2gm(m2.pos,block.usegm)
						m2.rnapos=t.rnapos
						m2.aapos=t.aapos
					}
				}
			}
			*/

			common.vcfcopymclass(m, block)

			tk.mlst.push(m)
		}
	}
	if (!tk.dstk_novcferror && errors.length) {
		block.error(
			errors[0] + (errors.length == 1 ? '' : ' and ' + (errors.length - 1) + ' more errors with the VCF track')
		)
	}
}
