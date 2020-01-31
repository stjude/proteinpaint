// shared in client, server, and tape test
exports.graphable = function(term) {
	if (!term) throw 'graphable: term is missing'
	// terms with a valid type supports graph
	return term.iscategorical || term.isinteger || term.isfloat || term.iscondition || term.isgenotype
}
