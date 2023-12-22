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

	if (!Array.isArray(Routput.RowNodeJson)) throw 'invalid clustering output'

	const row_coordinates = Routput.RowNodeJson // ?
	const col_coordinates = Routput.ColNodeJson
	const row_names_index = Routput.RowDendOrder.map(i => i.ind) // sorted rows. value is array index in input data
	const col_names_index = Routput.ColumnDendOrder.map(i => i.ind) // sorted columns, value is array index from input array

	const row_names = Routput.SortedRowNames.map(i => i.gene) // sorted row names
	const col_names = Routput.SortedColumnNames.map(i => i.sample) // sorted col names

	const row_output = await parseclust(row_coordinates, row_names_index)
	const col_output = await parseclust(col_coordinates, col_names_index)

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

async function parseclust(coordinates, names_index) {
	// This function parses the output from fastclust.R output. The dendextend packages prints the x-y coordinates for each node in depth-first search format. So the order of x-y coordinates describes how each nodes is connected to ane another.

	/*

        |         (1.75, 69.749)  
        |     ____._____
        |     |        |(2.5,65.0797)           
        |     |     ___.___             
        |     |     |     |	       
        |     |     |     |	       
        |     |     |     |	       
        |     |     |     |	       
        |     |     |     |	       
        |     |     |     |	       
        |     |     |     |	       
        |     |     |     |	       
        |     |     |     |	       
        |_____._____._____.__
             (1,0)  (2,0) (3,0) 

        R dendextend output for the above dendrogram is as follows (depth-first search format)
             [,1]     [,2]
        [1,] 1.75 69.74910
        [2,] 1.00  0.00000
        [3,] 2.50 65.07977
        [4,] 2.00  0.00000
        [5,] 3.00  0.00000

        Output is in depth-first search format


        */

	let first = 1
	const xs = []
	const ys = []
	for (const item of coordinates) {
		//console.log(item)
		if (Number(item.x) % 1 != 0 && Number(item.y == 0)) {
			// In rare cases sometimes y=0 when x is decimal (not integer). This is happening most probably because the y-value is infinitesimally small so y is set to 0.0001 to approximate it.
			xs.push(Number(item.x))
			ys.push(0.0001)
		} else {
			xs.push(Number(item.x))
			ys.push(Number(item.y))
		}
	}
	//console.log(xs)
	//console.log(ys)

	let depth_start_position = 0 // Initializing position of depth start to position 0 in R output
	let i = 0
	const depth_first_branch = []
	const prev_ys = []
	const prev_xs = []
	let break_point = false
	let old_depth_start_position = 0
	let node_children = []
	let leaf_counter = 0
	for (let i = 0; i < ys.length; i++) {
		//console.log('i:', i)
		if (break_point == true) {
			// This clause is invoked when the a node's y-coordinate is found to be higher than the previous one (break_point = true). Then all previous nodes are searched for the closest node that is higher than the current node. This determines where the new branch should start from. In above example line 3 will be parsed (after break_point is set to true in previous iteration) since the y-coordinate of the node is higher than the node described in the previous line
			let hit = 0
			//console.log('prev_ys:', prev_ys)
			for (let j = 0; j < prev_ys.length; j++) {
				let k = prev_ys.length - j - 1
				//console.log('prev_ys[k]:', prev_ys[k])
				//console.log('ys[i]:', ys[i])
				if (prev_ys[k] > ys[i]) {
					depth_first_branch.push({ id1: i, x1: xs[i], y1: ys[i], id2: k, x2: prev_xs[k], y2: prev_ys[k] })
					hit = 1
					//console.log('Found')
					break
				}
			}
			if (hit == 0) {
				// Should not happen
				console.log('No suitable branch point found')
			}
			depth_first_branch.push({ id1: i, x1: xs[i], y1: ys[i], id2: i + 1, x2: xs[i + 1], y2: ys[i + 1] })
			if (ys[i] == 0) {
				// When y-axis of a node is found to be 0, then it is a leaf node. In that particular case this leaf node needs to be added to the "children" list of all nodes above it
				node_children = await update_leaf_node(depth_first_branch, i, node_children, names_index[leaf_counter])
				//node_children = await update_leaf_node(depth_first_branch, i, node_children, leaf_counter)
				leaf_counter += 1
			}
			prev_ys.push(ys[i])
			prev_xs.push(xs[i])
			//prev_ys = []
			//prev_xs = []
			//old_depth_start_position = depth_start_position
			break_point = false
		} else if (ys[i] > ys[i + 1] && i <= ys.length - 1) {
			// When y-coordinate of current node is greater than that of the next node, the current branch is extended to the next node. In case of line 2 and 4 in example output is parsed using this if clause statement.
			depth_first_branch.push({ id1: i, x1: xs[i], y1: ys[i], id2: i + 1, x2: xs[i + 1], y2: ys[i + 1] })
			if (ys[i] == 0) {
				// When y-axis of a node is found to be 0, then it is a leaf node. In that particular case this leaf node needs to be added to the "children" list of all nodes above it
				node_children = await update_leaf_node(depth_first_branch, i, node_children, names_index[leaf_counter])
				//node_children = await update_leaf_node(depth_first_branch, i, node_children, leaf_counter)
				leaf_counter += 1
			}
			prev_ys.push(ys[i])
			prev_xs.push(xs[i])
		} else if (ys[i] == ys[i + 1] && i <= ys.length - 1) {
			// When y-coordinate of current node is equal to that of the next node, it suggests both nodes are leaf nodes. IN that case the branch is extended from the previous node to the next node. Line 5 (in example output) will be parsed using this if clause.
			depth_first_branch.push({ id1: i - 1, x1: xs[i - 1], y1: ys[i - 1], id2: i + 1, x2: xs[i + 1], y2: ys[i + 1] })
			if (ys[i] == 0) {
				// When y-axis of a node is found to be 0, then it is a leaf node. In that particular case this leaf node needs to be added to the "children" list of all nodes above it
				node_children = await update_leaf_node(depth_first_branch, i, node_children, names_index[leaf_counter])
				//node_children = await update_leaf_node(depth_first_branch, i, node_children, leaf_counter)
				leaf_counter += 1
			}
			prev_ys.push(ys[i])
			prev_xs.push(xs[i])
		} else if (i == ys.length - 1) {
			// When the current node is the last element it is checked if it is a leaf node (it should be)
			if (ys[i] == 0) {
				// When y-axis of a node is found to be 0, then it is a leaf node. In that particular case this leaf node needs to be added to the "children" list of all nodes above it
				node_children = await update_leaf_node(depth_first_branch, i, node_children, names_index[leaf_counter])
				//node_children = await update_leaf_node(depth_first_branch, i, node_children, leaf_counter)
				leaf_counter += 1
			}
		} else {
			// When y-coordinate of next node is greater than that of the current node. The current branch ends and break_point is set to true. In the next iteration of the loop it is decided where the new branch should start from. Line 3 (in example) will be parsed using this clause.
			prev_ys.push(ys[i])
			prev_xs.push(xs[i])
			//old_depth_first_branch = depth_first_branch
			//depth_first_branch = []
			break_point = true
			if (ys[i] == 0) {
				// When y-axis of a node is found to be 0, then it is a leaf node. In that particular case this leaf node needs to be added to the "children" list of all nodes above it
				node_children = await update_leaf_node(depth_first_branch, i, node_children, names_index[leaf_counter])
				//node_children = await update_leaf_node(depth_first_branch, i, node_children, leaf_counter)
				leaf_counter += 1
			}

			//depth_start_position = i // Start of new branch
		}
	}
	//console.log('node_children:', node_children)
	return { dendrogram: depth_first_branch, children: node_children }
	//console.log(depth_first_branch)
}

async function update_leaf_node(depth_first_branch, given_node, node_children, node_id) {
	//console.log('given_node:', given_node)
	let current_node = given_node // Initialize the current node to the given_node
	let node_result = node_children.find(i => i.id == current_node) // Search if the node is already been entered in node_children
	if (node_result) {
		// If already present add current node to its children field
		let node_index = node_children.findIndex(i => i.id == current_node)
		node_children[node_index].children.push(node_id)
	} else {
		// If not present create an object with id = current_node and in children intitialize children array with node_id
		node_children.push({ id: current_node, children: [node_id] })
	}

	// Find branch of current node
	while (current_node != 0) {
		// Top node. This loop will continue until top node is reached
		let node_connector1 = depth_first_branch.find(i => i.id1 == current_node) // Find id1 with current_node
		let current_node1
		let current_node2
		if (node_connector1) {
			if (node_connector1.y1 <= node_connector1.y2) {
				// If y-coordinate of id1 is less than that of id2 then current_node1 = id2

				//console.log('depth_first_branch:', depth_first_branch)
				//console.log('current_node:', current_node)
				//console.log('node_connector1:', node_connector1)
				current_node1 = node_connector1.id2
			}
		}

		let node_connector2 = depth_first_branch.find(i => i.id2 == current_node) // Find id2 with current_node
		if (node_connector2) {
			if (node_connector2.y1 >= node_connector2.y2) {
				// If y-coordinate of id2 is less than that of id1 then current_node2 = id1

				//console.log('depth_first_branch:', depth_first_branch)
				//console.log('current_node:', current_node)
				//console.log('node_connector2:', node_connector2)
				current_node2 = node_connector2.id1
			}
		}

		if (!node_connector1 && node_connector2) {
			current_node = current_node2
		} else if (node_connector1 && !node_connector2) {
			current_node = current_node1
		} else if (node_connector1 && node_connector2) {
			if (node_connector1.y2 > node_connector2.y1) {
				current_node = current_node1
			} else {
				current_node = current_node2
			}
		} else {
			// Should not happen
			console.log('No connections found!')
		}

		// Adding node_id to current_node

		let node_result = node_children.find(i => i.id == current_node) // Search if the node is already been entered in node_children
		//console.log('node_result:', node_result)
		//console.log('given_node2:', given_node)
		if (node_result) {
			// If already present add current node to its children field
			let node_index = node_children.findIndex(i => i.id == current_node)
			node_children[node_index].children.push(node_id)
		} else {
			// If not present create an object with id = current_node and in children intitialize children array with node_id
			node_children.push({ id: current_node, children: [node_id] })
		}
		//console.log('node_children:', node_children)
	}
	return node_children
}
