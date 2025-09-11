export * from './utils.ts'
export * from './TermSettingApi.ts'

/*
********************* EXPORTED
termsettingInit()
getPillNameDefault()
fillTermWrapper()
	call_fillTW
	mayValidateQmode
set_hiddenvalues()
********************* Instance methods
clickNoPillDiv
showTree

opts{}

*/

// append the common ID substring,
// so that the first characters of $id is more indexable
const idSuffix = `_ts_${(+new Date()).toString().slice(-8)}`
let $id = 0

export async function get$id(minTwCopy) {
	if (!minTwCopy) return <string>`${$id++}${idSuffix}`
	delete minTwCopy.$id
	const i = window.location.pathname == '/testrun.html' || window.location.pathname == '/puppet.html' ? '' : $id++
	// TODO: may need to distinguish between unique tw $id and id for caching server response
	// for now, just append unique $id++ to ensure unique $id
	return await digestMessage(JSON.stringify(minTwCopy) + i)
}

const encoder = new TextEncoder()

// may replace with hash() helper from shared/utils
export async function digestMessage(message) {
	const msgUint8 = encoder.encode(message) // encode as (utf-8) Uint8Array
	const hashBuffer = await crypto.subtle.digest('SHA-1', msgUint8) // hash the message
	const hashArray = Array.from(new Uint8Array(hashBuffer)) // convert buffer to byte array
	const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('') // convert bytes to hex string
	return hexToBase64(hashHex).replace('=', '-') // shorten from 40 to 28 chars
}

function hexToBase64(hexStr) {
	return btoa(
		[...hexStr].reduce(
			(acc, _, i) => (acc += !((i - 1) & 1) ? String.fromCharCode(parseInt(hexStr.substring(i - 1, i + 1), 16)) : ''),
			''
		)
	)
}

export function getPillNameDefault(self, d: any) {
	if (!self.opts.abbrCutoff) return d.name
	return d.name.length <= self.opts.abbrCutoff + 2
		? d.name
		: '<label title="' + d.name + '">' + d.name.substring(0, self.opts.abbrCutoff) + '...' + '</label>'
}

/* For some plots that can have multiple terms of the same ID,
but with different q{}, we can assign and use $id to
disambiguate which tw data to update and associate with
a rendered element such as a pill or a matrix row

tw: termWrapper = {id, term{}, q{}}
vocabApi
defaultQByTsHandler{}
	supply the optional default q{}
	value is { condition: {mode:'binary'}, ... }
	with term types as keys
*/

type DefaultQByTsHandler = {
	categorical?: CategoricalQ
	numeric?: NumericQ
	snplst?: SnpsQ
}

export async function fillTwLst(
	twlst: TwLst,
	vocabApi: VocabApi,
	defaultQByTsHandler?: DefaultQByTsHandler
): Promise<void> {
	await mayHydrateDictTwLst(twlst, vocabApi)
	const promises: Promise<TermWrapper>[] = []
	for (const tw of twlst) {
		promises.push(fillTermWrapper(tw, vocabApi, defaultQByTsHandler))
	}
	await Promise.all(promises)
}

// fill in tw.term{} from a dehydrated state
// a dictionary tw can be simply expressed as {id:str} and this function will fill in the term object.
// a non-dict term will always have a term object, so this function will not be applied to non-dict term
export async function mayHydrateDictTwLst(twlst: TwLst, vocabApi: VocabApi) {
	const ids: string[] = []
	for (const tw of twlst) {
		if (tw.term) continue
		if (tw.id === undefined || tw.id === '') throw '.id is required'
		ids.push(tw.id)
	}
	const terms = ids.length ? await vocabApi.getTerms(ids) : {}
	for (const id of ids) {
		if (!terms[id]) throw `missing dictionary term for id=${id}`
		for (const tw of twlst) {
			if (tw.id && tw.id in terms) tw.term = terms[tw.id]
		}
	}
}

// add migrated tw fillers here, by term.type

async function mayUseTwRouterFill(
	tw: TermWrapper,
	vocabApi: VocabApi,
	defaultQByTsHandler?: DefaultQByTsHandler
): Promise<TermWrapper | false> {
	if (!routedTermTypes.has(tw.term?.type)) return false
	// NOTE: while the tw refactor is not done for all term types and q.types/modes,
	// there will be some code duplication between TwRouter and the legacy code;
	// the latter will be deleted once the refactor/migration is done
	const fullTw = await TwRouter.fill(tw, { vocabApi, defaultQByTsHandler })
	Object.assign(tw, fullTw)
	mayValidateQmode(tw)
	// this should be moved to the term-type specific handler??
	if (!tw.$id) tw.$id = await get$id(vocabApi.getTwMinCopy(tw))
	if (tw.q) tw.q.isAtomic = true
	return tw
}

export async function fillTermWrapper(
	tw: TermWrapper,
	vocabApi: VocabApi,
	defaultQByTsHandler?: DefaultQByTsHandler
): Promise<TermWrapper> {
	tw.isAtomic = true
	if (!tw.term && tw.id) {
		// hydrate tw.term using tw.id
		await mayHydrateDictTwLst([tw], vocabApi)
	}

	if (await mayUseTwRouterFill(tw, vocabApi, defaultQByTsHandler)) return tw

	// tw.id is no longer needed
	delete tw.id
	if (!tw.q) (tw.q as any) = {}
	tw.q.isAtomic = true
	// check for legacy tw structure
	checkLegacyTw(tw)
	// call term-type specific logic to fill tw
	await call_fillTW(tw, vocabApi, defaultQByTsHandler)
	mayValidateQmode(tw)
	// compute $id after tw is filled
	if (!tw.$id) tw.$id = await get$id(vocabApi.getTwMinCopy(tw))
	return tw
}

// check for legacy tw structure that could be
// present in old saved sessions
function checkLegacyTw(tw) {
	// check for legacy q.groupsetting{}
	if (Object.keys(tw.q).includes('groupsetting')) {
		if (tw.q['groupsetting']['inuse']) {
			if (tw.q.type == 'predefined-groupset') {
				tw.q['predefined_groupset_idx'] = tw.q['groupsetting']['predefined_groupset_idx']
			} else if (tw.q.type == 'custom-groupset') {
				tw.q['customset'] = tw.q['groupsetting']['customset']
			} else {
				throw 'invalid q.type'
			}
		} else {
			tw.q.type = 'values'
		}
		delete tw.q['groupsetting']
	}
}

export async function call_fillTW(tw: TermWrapper, vocabApi: VocabApi, defaultQByTsHandler?: DefaultQByTsHandler) {
	// repeating this logic from fillTermWrapper(), since call_fillTW() may be called directly
	// TODO: may deprecate call_fillTW() once all term types have been migrated to xtw
	if (await mayUseTwRouterFill(tw, vocabApi, defaultQByTsHandler)) return

	if (!tw.$id) tw.$id = await get$id(vocabApi.getTwMinCopy(tw))
	const t = tw.term.type
	const type = t == 'float' || t == 'integer' || t == 'date' ? 'numeric' : (t as string)
	let _
	if (tw.term.type) {
		try {
			_ = await import(`./handlers/${type}.ts`)
		} catch (_e) {
			throw `Type ${type} does not exist`
		}
	} else throw `Type not defined for ${JSON.stringify(tw)}`
	await _.fillTW(tw, vocabApi, defaultQByTsHandler ? defaultQByTsHandler[type] : null)
}

function mayValidateQmode(tw: TermWrapper) {
	if (!('mode' in tw.q)) {
		// at this stage q.mode is allowed to be missing and will not validate
		return
	}
	// q.mode is set. here will validate
	if (typeof tw.q.mode != 'string') throw 'q.mode not string'
	// if (tw.q.mode == '') throw 'q.mode is empty string' //No longer required with typescript
	// handler code should implement term type-specific validations
	// e.g. to prevent cases such as mode=continuous for categorical term
}

// TODO: create and use a RawQ type that combines all raw q types
export function set_hiddenvalues(q: Q | RawValuesQ | RawGvQ, term: Term) {
	if (!q.hiddenValues) {
		q.hiddenValues = {}
		// by default, fill-in with uncomputable values
		if (term.values) {
			for (const k in term.values) {
				if (term.values[k].uncomputable) q.hiddenValues[k] = 1
			}
		}
	}
}
