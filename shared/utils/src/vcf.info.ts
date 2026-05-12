/*
to parse a variant line, not header

cannot simply slice by /[;=]/, but read char by char
case  CLNVI=Breast_Cancer_Information_Core__(BRCA2):745-4&base_change=C_to_G;
case  k1=v1;DB;k2=v2;
*/
export function dissect_INFO(str) {
	//let findequal=true
	let findsemicolon = false
	let findequalorsemicolon = true

	let i = 0
	let idx = 0

	const k2v = {}
	let lastkey

	while (i < str.length) {
		const c = str[i]
		if (findequalorsemicolon) {
			if (c == '=') {
				findsemicolon = true
				findequalorsemicolon = false
				lastkey = str.substring(idx, i)
				idx = i + 1
			} else if (c == ';') {
				// should be a flag
				k2v[str.substring(idx, i)] = 1
				idx = i + 1
			}
		} else if (findsemicolon && c == ';') {
			findequalorsemicolon = true
			findsemicolon = false
			k2v[lastkey] = str.substring(idx, i)
			lastkey = null
			idx = i + 1
		}
		i++
	}

	const remainstr = str.substr(idx, i)
	if (lastkey) {
		k2v[lastkey] = remainstr
	} else {
		k2v[remainstr] = 1
	}

	return k2v
}
