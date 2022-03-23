import { event } from 'd3-selection'
import { makeSnpSelect } from './termsetting.snplst'
import { filterInit, getNormalRoot } from './filter'
import { keyupEnter, gmlst2loci } from '../client'
import { debounce } from 'debounce'
import { dofetch3 } from './dofetch'
import { string2pos } from '../coord'

/* 
instance attributes

self.term{}
	.name: str, not really used
	.type: "geneVariant"
*/

const term_name = 'Variants in a locus'

// self is the termsetting instance
export function getHandler(self) {
	return {
		getPillName(d) {
			return self.term.name
		},

		getPillStatus() {
			return { text: 'TEST' }
		},

		validateQ(data) {},

		async showEditMenu(div) {
			//await makeEditMenu(self, div)
		}
	}
}

const idPrefix = `_geneVariant_AUTOID_${+new Date()}_`
let id = 0

export function fillTW(tw, vocabApi) {
	if (!('id' in tw)) tw.id = idPrefix + id++
}
