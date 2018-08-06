

function isPositiveInteger(a) {
	if(!Number.isInteger(a)) return false
	if(a<=0) return false
	return true
}

exports.isPositiveInteger = isPositiveInteger


const tkt = {
	ruler: 'ruler',
}
exports.tkt = tkt
