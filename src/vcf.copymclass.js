import * as common from './common'
import * as client from './client'



export function copymclass(m, block) {

	if(m.csq) {

		// there could be many annotations, the first one not always desirable
		// choose *colorful* annotation based on _csqrank
		let useone=null
		if(block.usegm) {
			for(const q of m.csq) {
				if(q._isoform!=block.usegm.isoform) continue
				if(useone) {
					if(q._csqrank<useone._csqrank) {
						useone=q
					}
				} else {
					useone=q
				}
			}
			if(!useone && block.gmmode==client.gmmode.genomic) {
				// no match to this gene, but in genomic mode, maybe from other genes?
				useone=m.csq[0]
			}
		} else {
			useone=m.csq[0]
			for(const q of m.csq) {
				if(q._csqrank<useone._csqrank) {
					useone=q
				}
			}
		}
		if(useone) {
			m.class=useone._class
			m.dt=useone._dt
			m.mname=useone._mname

			if(m.class==common.mclassnoncoding) {
				// noncoding converted from csq is not a meaningful, drab color, has no mname label, delete so later will be converted to non-protein class
				delete m.class
			}
		}

	} else if(m.ann) {

		// there could be many applicable annotations, the first one not always desirable
		// choose *colorful* annotation based on _csqrank
		let useone=null
		if(block.usegm) {
			for(const q of m.ann) {
				if(q._isoform!=block.usegm.isoform) continue
				if(useone) {
					if(q._csqrank<useone._csqrank) {
						useone=q
					}
				} else {
					useone=q
				}
			}
			if(!useone && block.gmmode==client.gmmode.genomic) {
				// no match to this gene, but in genomic mode, maybe from other genes?
				useone=m.ann[0]
			}
		} else {
			useone=m.ann[0]
			for(const q of m.ann) {
				if(q._csqrank<useone._csqrank) {
					useone=q
				}
			}
		}
		if(useone) {
			m.class=useone._class
			m.dt=useone._dt
			m.mname=useone._mname

			if(m.class==common.mclassnoncoding) {
				delete m.class
			}
		}
	}

	if(m.class==undefined) {
		// infer class from m.type, which was assigned by vcf.js
		if(common.mclass[m.type]) {
			m.class=m.type
			m.dt=common.mclass[m.type].dt
			m.mname=m.ref+'>'+m.alt
			if(m.mname.length>15) {
				// avoid long indel
				m.mname=m.type
			}
		} else {
			m.class=common.mclassnonstandard
			m.dt=common.dtsnvindel
			m.mname=m.type
		}
	}

	delete m.type
}
