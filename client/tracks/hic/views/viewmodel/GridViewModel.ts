import { Grid } from './Grid.ts'

export class GridViewModel {
	grid: Grid

	constructor(opts: any) {
		this.grid = new Grid(opts.hic.chrlst, opts.resolution || opts.hic.bpresolution[0], opts.hic.genome.chrlookup, 1)
	}
}
