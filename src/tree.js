/*

given a list of leaf nodes, each with annotation for k1, k2,...
and levels of hierarchy in an ordered list of [ k1, k2, ... ]
derive the sort of output for d3-hierarchy.stratify

*/




const hardcode_root = 'root'
const hierarchy_spacer = '...'




exports.stratinput=function(lst,levels){

	const lp=new Map()
	// leaf to parent
	// k: HM...BALL...sub
	// v: HM...BALL


	const nodes=new Map() // key to node
	/*
	k: string id of node, e.g. HM...BALL
	v: node
		.full
		.lst[]
			items from input
	*/


	const size=new Map()
	// only increment size to leaf nodes, so that root.sum() will work
	// k: string id of a node, e.g. HM...BALL
	// v: number of items

	for(const m of lst) {
		for(const [i, lev] of levels.entries()) {
			const thisv=getkey(m,i,levels)
			const pav=getkey(m,i-1,levels)
			if(!m[lev.k]) {
				// stop at this level
				// add count to prev level
				if(i>0) {
					size.set(pav,size.get(pav)+1)
				}
				break
			}
			lp.set(thisv, pav)
			if(!size.has(thisv)) {
				size.set(thisv,0)
			}
			if(!nodes.has(thisv)) {
				const n={
					lst:[]
				}
				if(lev.full) {
					n.full=m[lev.full]
				}
				nodes.set(thisv,n)
			}
			nodes.get(thisv).lst.push(m)
			if(i==levels.length-1) {
				size.set(thisv, size.get(thisv)+1)
			}
		}
	}

	const nlst=[{ id:hardcode_root, name:hardcode_root }]

	for(const [chid,paid] of lp) {
		const n=nodes.get(chid)
		const fields=chid.split( hierarchy_spacer )
		nlst.push({
			id:chid,
			parentId:paid,
			lst:n.lst,
			value:size.get(chid),
			name:fields[fields.length-1], // show this instead of chid
			full:n.full
		})
	}
	return nlst
}



function getkey(m,i,levels) {
	// if i is 0, return 'root'
	const klst = [ hardcode_root ]
	for(let j=0; j<i; j++) {
		klst.push(m[levels[j].k])
	}
	if(i>=0) {
		klst.push(m[levels[i].k])
	}
	return klst.join(hierarchy_spacer)
}
