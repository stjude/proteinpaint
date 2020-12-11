let Block

/*
FIXME
blockinit should be merged here

only for launching browser view
but not gene view

gene view requires blockinit, which is async and do not return promise/block, thus breaking lazyload
*/

export default async function blocklazyload(arg) {
	return await import('./block').Block

	/*return new Promise( (resolve, reject) => {

		if(Block) {
			const block=new Block(arg)
			resolve(block)
			return
		}
		require.ensure([],()=>{
			Block=require('./block').Block
			const block=new Block(arg)
			resolve(block)
		})
	})*/
}
