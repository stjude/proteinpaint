import fs from 'fs'
import lines2R from '../src/lines2R'
import path from 'path'
import { write_file } from '../src/utils'
import serverconfig from '../src/serverconfig'

// TODO convert this to typescript!!

export async function doClustering(data, q, ds) {
	// get set of uniq sample names, to generate col_names dimension
	const sampleSet = new Set()
	for (const o of data.values()) {
		// {sampleId: value}
		for (const s in o) sampleSet.add(s)
		break
	}

	const inputData = {
		matrix: [],
		row_names: [], // genes
		col_names: [...sampleSet], // samples
		cluster_method: q.clusterMethod,
		plot_image: false // When true causes cluster.rs to plot the image into a png file (EXPERIMENTAL)
	}

	// compose "data{}" into a matrix
	for (const [gene, o] of data) {
		inputData.row_names.push(gene)
		const row = []
		for (const s of inputData.col_names) {
			row.push(o[s] || 0)
		}
		inputData.matrix.push(getZscore(row))
	}

	const Rinputfile = path.join(serverconfig.cachedir, Math.random().toString() + '.json')
	await write_file(Rinputfile, JSON.stringify(inputData))
	const Routput = JSON.parse(await lines2R(path.join(serverconfig.binpath, 'utils/hclust.R'), [], [Rinputfile]))
	fs.unlink(Rinputfile, () => {})

	const row_coordinates = Routput.RowMerge
	const col_coordinates = Routput.ColumnMerge
	const row_height = Routput.RowHeight
	const col_height = Routput.ColumnHeight
	const row_names_index = Routput.RowDendOrder.map(i => i.ind) // sorted rows. value is array index in input data
	const col_names_index = Routput.ColumnDendOrder.map(i => i.ind) // sorted columns, value is array index from input array

	const row_names = Routput.SortedRowNames.map(i => i.gene) // sorted row names
	const col_names = Routput.SortedColumnNames.map(i => i.sample) // sorted col names

	const row_output = parseclust(row_coordinates, row_height, row_names_index)
	const col_output = parseclust(col_coordinates, col_height, col_names_index)

	// generated sorted matrix based on row/col clustering order
	const output_matrix = []
	for (const rowI of row_names_index) {
		const newRow = []
		for (const colI of col_names_index) {
			newRow.push(inputData.matrix[rowI - 1][colI - 1])
		}
		output_matrix.push(newRow)
	}

	/* rust is no longer used

	const rust_output = await run_rust('cluster', JSON.stringify(inputData))
	//console.log('result:', result)

        sorted_sample_elements: List of indices of samples in sorted matrix
        sorted_gene_elements: List of indices of genes in sorted matrix
        sorted_gene_coordinates: Information for each node in the sample dendrogram (see details in rust/src/cluster.rs)
        sorted_sample_coordinates: Information for each node in the gene dendrogram (see details in rust/src/cluster.rs)
	let colSteps, rowSteps
	const rust_output_list = rust_output.split('\n')
	for (let item of rust_output_list) {
		if (item.includes('colSteps')) {
			colSteps = JSON.parse(JSON.parse(item.replace('colSteps:', '')))
		} else if (item.includes('rowSteps')) {
			rowSteps = JSON.parse(JSON.parse(item.replace('rowSteps:', '')))
		}
	}
	//console.log('colSteps:', colSteps)
	//console.log('rowSteps:', rowSteps)
	*/

	return {
		geneNameLst: row_names,
		sampleNameLst: col_names,
		matrix: output_matrix,
		row_dendro: row_output.dendrogram,
		row_children: row_output.children,
		col_dendro: col_output.dendrogram,
		col_children: col_output.children,
		col_names_index: col_names_index // to be deleted later
	}
}

function getZscore(l) {
	const mean = l.reduce((sum, v) => sum + v, 0) / l.length
	const sd = Math.sqrt(l.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / l.length)

	if (sd == 0) {
		return l
	}
	return l.map(v => (v - mean) / sd)
}

function parseclust(coordinates, height, names_index) {
	const branches = []
	const children = []
	let iter = 1
	let node_id = 0
	for (const item of coordinates) {
		let x_n1, y_n1, x_n2, y_n2, n1_id, n2_id
		const new_original_children = [] // This is used to store any new original nodes parsed
		let n1_children = []
		let n2_children = []
		if (item.n1 < 0) {
			// This is an original node
			x_n1 = names_index.indexOf(item.n1 * -1)
			y_n1 = 0
			children.push({ id: node_id, children: [] })
			new_original_children.push(item.n1 * -1)
		} else {
			// This is a derived node, need to find its coordinates from branches[] array
			const branch_entry = branches.find(ent => ent.id1 == 2 + 3 * (item.n1 - 1))
			//console.log('branch_entry:', branch_entry)
			x_n1 = branch_entry.x1
			y_n1 = branch_entry.y1
			const child_entry = children.find(ent => ent.id == branch_entry.id1)
			//console.log('child_entry:', child_entry)
			n1_children = child_entry.children
			children.push({ id: node_id, children: n1_children })
		}
		n1_id = node_id
		node_id += 1

		if (item.n2 < 0) {
			// This is an original node
			x_n2 = names_index.indexOf(item.n2 * -1)
			y_n2 = 0
			children.push({ id: node_id, children: [] })
			new_original_children.push(item.n2 * -1)
		} else {
			// This is a derived node, need to find its coordinates from branches[] array
			const branch_entry = branches.find(ent => ent.id1 == 2 + 3 * (item.n2 - 1))
			//console.log('branch_entry:', branch_entry)
			x_n2 = branch_entry.x1
			y_n2 = branch_entry.y1
			const child_entry = children.find(ent => ent.id == branch_entry.id1)
			//console.log('child_entry:', child_entry)
			n2_children = child_entry.children
			children.push({ id: node_id, children: n2_children })
		}
		n2_id = node_id
		node_id += 1

		const new_node_height = height[iter - 1].height
		// Adding the branches of the dendrogram
		branches.push({ id1: n1_id, x1: x_n1, y1: y_n1, id2: node_id, x2: (x_n1 + x_n2) / 2, y2: new_node_height })
		branches.push({ id1: node_id, x1: (x_n1 + x_n2) / 2, y1: new_node_height, id2: n2_id, x2: x_n2, y2: y_n2 })

		let new_parent_node_children = []
		// If any of the children of this new parent node is an original node those are added into the list of children of this new parent node
		if (item.n1 < 0 || item.n2 < 0) new_parent_node_children = [...new_original_children]

		// If n1 child is a derived node, all the children from n1 need to be copied into the parent node
		if (item.n1 > 0) {
			for (let i = 0; i < n1_children.length; i++) {
				new_parent_node_children.push(n1_children[i])
			}
		}
		// If n2 child is a derived node, all the children from n2 need to be copied into the parent node
		if (item.n2 > 0) {
			for (let i = 0; i < n2_children.length; i++) {
				new_parent_node_children.push(n2_children[i])
			}
		}
		children.push({ id: node_id, children: new_parent_node_children })

		node_id += 1
		iter += 1
	}
	//console.log('branches:', branches)
	//console.log('children:', children)
	return { dendrogram: branches, children: children }
}
