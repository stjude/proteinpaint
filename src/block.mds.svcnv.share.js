/*
things shared between svcnv track and other types of tracks
*/




export function rnabamtk_initparam ( c ) {
	/*
	for svcnv, c is tk.checkrnabam
	for ase, c is tk
	*/
	if( !c.hetsnp_minallelecount ) c.hetsnp_minallelecount = 2
	if( !c.rna_minallelecount ) c.rna_minallelecount = 3
	if( !c.hetsnp_minbaf ) c.hetsnp_minbaf = 0.3
	if( !c.hetsnp_maxbaf ) c.hetsnp_maxbaf = 0.7
	if( c.rnapileup_q==undefined ) c.rnapileup_q = 0
	if( !c.rnapileup_Q ) c.rnapileup_Q = 13
}
