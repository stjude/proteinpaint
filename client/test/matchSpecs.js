import process from 'process'
import { minimatch } from 'minimatch'

window.process = process

const params = getParams()
//const CURRSPECDIR = params.dir ? `./${params.dir}` : '.'
const NESTEDSPECDIR = !params.dir
	? '**'
	: params.dir.startsWith('../shared/utils/')
	? params.dir.replace('../shared/utils/', 'shared/utils/')
	: `**/${params.dir}`
const SPECNAME = params.name || '*'
const exclude = 'exclude' in params ? params.exclude : SPECNAME.includes('_x_.') ? '' : '_x_.'
const patterns = [
	//`${CURRSPECDIR}/test/${SPECNAME}.spec.*s`,
	`${NESTEDSPECDIR}/test/${SPECNAME}.spec.*s`
]
export const specsMatched = []

// console.log(19, SPECNAME, NESTEDSPECDIR, minimatch('mass/test/dataDownload.integration.spec.js', `${NESTEDSPECDIR}/test/${SPECNAME}.spec.*s`))

export function matchSpecs(filepath) {
	//if (window.testHost) return true
	if (!params.dir && !params.name) return false
	// !!! quick-fix for client:coverage failing on mds3.integration, menu, other 'flaky' tests !!!
	// if (window.location.pathname == '/puppet.html' && (filepath.includes('mds3.') || filepath.includes('menu.'))) {
	// 	console.log(`!!! skipping ${filepath} in matchSpecs() !!!`)
	// 	return false
	// }
	if (exclude && filepath.includes(exclude)) return false
	for (const pattern of patterns) {
		if (pattern && minimatch(filepath, pattern)) {
			specsMatched.push(filepath)
			return true
		}
	}
	return false
}

function getParams() {
	const params = {}
	if (!window.location.search.length) return params
	window.location.search
		.substr(1)
		.split('&')
		.forEach(kv => {
			const [key, value] = kv.split('=')
			params[key] = value
		})
	return params
}
