/*
 This script reorders a 2D matrix by using hierarchial agglomerative clustering in both dimensions. It also generates a dendrogram for each of the two dimensions. The dissimilarity matrix is generated using euclidean distance.

INPUT PARAMETERS

The input is in the form of a JSON string.

JSON input fields:
  matrix: The 2D matrix to be sorted. Each row is separated by semicolon (";") and each column by comma (","). For e.g
      3 4 5 20
      3 5 6 1
      3 5 6 10

           is represented as [[3,4,5,20];[3,5,6,1];[3,5,6,10]]

  plot_image (optional): Plot the 2D sorted matrix.
  row_names (optional): Optionally input the names of the rows. This is used in the plot (if chosen).
  col_names (optional): Optionally input the names of the cols. This is used in the plot (if chosen).
  cluster_method (optional): Choose the clustering method. Options are Complete (default), Average, Weighted, Ward, Centroid and Median.

OUTPUT PARAMETERS

 1) sorted_matrix: Plain matrix is printed followed by number of rows and columns
 2) sorted_col_coordinates: Data for dendrogram in the x-axis. Contains JSON string containing list of traits for each node in the dendrogram.
       node_id: Node ID of the current node.
       node_coordinates: (X,Y) coordinates of the current node.
       child_nodes: ID's of the child node (if it exists). There will be no child node for the original (input) nodes in the dendrogram.
       child_node_coordinates: (X,Y) coordinates of each of the two child nodes (if they exist).
 3) sorted_row_coordinates: Data for dendrogram in the y-axis. Contains JSON string containing list of traits for each node in the dendrogram.
       node_id: Node ID of the current node.
       node_coordinates: (X,Y) coordinates of the current node.
       child_nodes: ID's of the child node (if it exists). There will be no child node for the original (input) nodes in the dendrogram.
       child_node_coordinates: (X,Y) coordinates of each of the two child nodes (if they exist).

EXAMPLES
 1) Syntax: cd .. && cargo build --release && json='{"matrix":"[[3,4,5,20];[3,5,6,1];[3,5,6,10]]","row_names":"[row1,row2,row3]","col_names":"[col1,col2,col3,col4]","plot_image":true,"cluster_method":"Average"}' && time echo "$json" | target/release/cluster

    Takes 2D matrix, row names and col names using cluster method "Average". In addition to stdout also plots the sorted 2D matrix to 1.png file

 2) Syntax: cd .. && cargo build --release && json='{"matrix":"[[3,4,5,20];[3,5,6,1];[3,5,6,10]]"}' && time echo "$json" | target/release/cluster

    Only prints sorted 2D matrix to stdout.

 3) Read from file
    Syntax: cd .. && cargo build --release && time cat test.txt | target/release/cluster
    Syntax: cd .. && cargo build --release && time cat iris_test.txt | target/release/cluster

*/
use colorgrad;
use json;
use json::JsonValue;
use kodama::{linkage, Method};
use nalgebra::base::dimension::Dyn;
use nalgebra::base::Matrix;
use nalgebra::base::VecStorage;
use nalgebra::DMatrix;
use serde::{Deserialize, Serialize};
use serde_json;
use std::env;
//use ndarray::Array1;
use ndarray::ArrayBase;
use ndarray::OwnedRepr;
use petgraph::algo::dijkstra;
//use petgraph::dot::Dot;
use petgraph::graph::NodeIndex;
use petgraph::prelude::Graph;
use plotters::prelude::*;
use rayon::prelude::*;
use std::any::type_name;
use std::io;
use std::time::Instant;

#[allow(dead_code)]
#[derive(Debug, Clone)]
struct NewNodeInfo {
    node_id: usize,
    child_nodes: Vec<usize>,
}

#[allow(dead_code)]
#[derive(Debug, Copy, Clone, Serialize, Deserialize)]
struct NodeCoordinate {
    x: Option<f64>, // The horizontal position of the node in the dendrogram.
    y: Option<f64>, // The y-position stores the relative distance from the last (top most) node in the dendrogram
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
struct NewNodeRelativeCoordinates {
    node_id: usize,                              // Node ID of the current node.
    node_coordinates: NodeCoordinate,            // (X,Y) coordinates of the current node.
    child_nodes: Vec<usize>, // ID's of the child node (if it exists). There will be no child node for the original (input) nodes in the dendrogram.
    child_node_coordinates: Vec<NodeCoordinate>, // (X,Y) coordinates of each of the two child nodes (if they exist).
}

#[allow(dead_code)]
fn type_of<T>(_: T) -> &'static str {
    type_name::<T>()
}

#[allow(dead_code)]
fn euclidean_distance(item1: &Vec<f64>, item2: &Vec<f64>) -> f64 {
    // Assuming item1 and item2 have the same length, since they are part of a matrix
    let mut dist: f64 = 0.0;
    for i in 0..item1.len() {
        let diff = item1[i] - item2[i];
        dist += diff * diff;
    }
    dist.sqrt()
}

fn euclidean_distance4(coordinates: &Matrix<f64, Dyn, Dyn, VecStorage<f64, Dyn, Dyn>>) -> Vec<f64> {
    // Assuming item1 and item2 have the same length, since they are part of a matrix
    //println!("nrows:{}", coordinates.nrows());
    //println!("ncols:{}", coordinates.ncols());
    //let mut dist: f64 = 0.0;
    //for i in 0..item1.len() {
    //    let diff = item1[i] - item2[i];
    //    dist += diff * diff;
    //}
    //dist.sqrt();

    let mut condensed = vec![];
    for row in 0..coordinates.nrows() - 1 {
        for col in row + 1..coordinates.nrows() {
            let mut dist: f64 = 0.0;
            //condensed.push(euclidean_distance(&coordinates[row], &coordinates[col]));
            for i in 0..coordinates.ncols() {
                let diff = coordinates[(row, i)] - coordinates[(col, i)];
                dist += diff * diff;
            }
            condensed.push(dist.sqrt())
        }
    }
    //println!("condensed:{:?}", condensed);
    condensed
}

#[allow(dead_code)]
fn euclidean_distance6(coordinates: &Matrix<f64, Dyn, Dyn, VecStorage<f64, Dyn, Dyn>>) -> Vec<f64> {
    // Assuming item1 and item2 have the same length, since they are part of a matrix
    println!("nrows:{}", coordinates.nrows());
    println!("ncols:{}", coordinates.ncols());
    //let mut dist: f64 = 0.0;
    //for i in 0..item1.len() {
    //    let diff = item1[i] - item2[i];
    //    dist += diff * diff;
    //}
    //dist.sqrt();

    let mut condensed = vec![];
    for row in 0..coordinates.nrows() - 1 {
        for col in row + 1..coordinates.nrows() {
            //let mut dist: f64 = 0.0;
            ////condensed.push(euclidean_distance(&coordinates[row], &coordinates[col]));
            //for i in 0..coordinates.ncols() {
            //    let diff = coordinates[(row, i)] - coordinates[(col, i)];
            //    dist += diff * diff;
            //}

            let dist: f64 = (0..coordinates.ncols())
                .into_par_iter()
                .map(|i| {
                    (coordinates[(row, i)] - coordinates[(col, i)])
                        * (coordinates[(row, i)] - coordinates[(col, i)])
                })
                .sum();

            condensed.push(dist.sqrt())
        }
    }
    //println!("condensed:{:?}", condensed);
    condensed
}

#[allow(dead_code)]
fn euclidean_distance5(coordinates: &Matrix<f64, Dyn, Dyn, VecStorage<f64, Dyn, Dyn>>) -> Vec<f64> {
    // Assuming item1 and item2 have the same length, since they are part of a matrix
    println!("nrows:{}", coordinates.nrows());
    println!("ncols:{}", coordinates.ncols());
    //let mut dist: f64 = 0.0;
    //for i in 0..item1.len() {
    //    let diff = item1[i] - item2[i];
    //    dist += diff * diff;
    //}
    //dist.sqrt();

    let mut condensed = vec![];
    for row in 0..coordinates.nrows() - 1 {
        for col in row + 1..coordinates.nrows() {
            ////condensed.push(euclidean_distance(&coordinates[row], &coordinates[col]));
            //for i in 0..coordinates.ncols() {
            //    let diff = coordinates[(row, i)] - coordinates[(col, i)];
            //    dist += diff * diff;
            //}

            //println!("row:{}", row);
            //println!("col:{}", col);
            let row_matrix = coordinates.fixed_rows_with_step::<2>(row, col - row - 1);
            //println!("row_matrix:{:?}", row_matrix);
            let subtract_matrix = row_matrix.rows(1, 1) - row_matrix.rows(0, 1);
            //println!("subtract_matrix:{:?}", subtract_matrix);
            //let mul_matrix = Matrix::inner_product(&subtract_matrix.transpose(), subtract_matrix);
            let mul_matrix = subtract_matrix.dot(&subtract_matrix);
            //println!("mul_matrix:{:?}", mul_matrix.sqrt());
            condensed.push(mul_matrix.sqrt())
        }
    }
    //println!("condensed:{:?}", condensed);
    condensed
}

#[allow(dead_code)]
fn euclidean_distance3(
    item1: &ArrayBase<OwnedRepr<f64>, ndarray::Dim<[usize; 1]>>,
    item2: &ArrayBase<OwnedRepr<f64>, ndarray::Dim<[usize; 1]>>,
) -> f64 {
    // Assuming item1 and item2 have the same length, since they are part of a matrix
    let mut dist: f64 = 0.0;
    for i in 0..item1.len() {
        let diff = item1[i] - item2[i];
        dist += diff * diff;
    }
    dist.sqrt()
}

#[allow(dead_code)]
fn euclidean_distance2(item1: &Vec<f64>, item2: &Vec<f64>) -> f64 {
    // For now, this is performing worse than single-threaded version
    // Assuming item1 and item2 have the same length, since they are part of a matrix
    let dist: f64 = (0..item1.len())
        .into_iter()
        .map(|i| (item1[i] - item2[i]) * (item1[i] - item2[i]))
        .sum();
    dist.sqrt()
}

#[allow(dead_code)]
fn par_euclidean_distance(item1: &Vec<f64>, item2: &Vec<f64>) -> f64 {
    // For now, this is performing worse than single-threaded version
    // Assuming item1 and item2 have the same length, since they are part of a matrix
    let dist: f64 = (0..item1.len())
        .into_par_iter()
        .map(|i| (item1[i] - item2[i]) * (item1[i] - item2[i]))
        .sum();
    dist.sqrt()
}

fn sort_elements(
    coordinates: &Matrix<f64, Dyn, Dyn, VecStorage<f64, Dyn, Dyn>>,
    cluster_method: &String,
) -> (Vec<usize>, Vec<NewNodeRelativeCoordinates>) {
    //fn sort_elements(coordinates: &Vec<Vec<f64>>) -> Vec<usize> {
    //fn sort_elements(coordinates: &Vec<Array1<f64>>) -> Vec<usize> {
    let new_now = Instant::now();
    let mut sorted_nodes = Vec::<usize>::new();
    let mut node_coordinates_final = Vec::<NewNodeRelativeCoordinates>::new();
    if coordinates.len() > 0 {
        //let mut condensed = vec![];
        //for row in 0..coordinates.len() - 1 {
        //    for col in row + 1..coordinates.len() {
        //        condensed.push(euclidean_distance(&coordinates[row], &coordinates[col]));
        //    }
        //}
        let mut node_coordinates_list = Vec::<NewNodeRelativeCoordinates>::new();
        let mut condensed = euclidean_distance4(coordinates);
        //println!("condensed:{:?}", condensed);
        let new_now2 = Instant::now();
        println!(
            "Time taken to generate dissimilarity matrix:{:?}",
            new_now2.duration_since(new_now)
        );
        //println!("coordinates.len():{:?}", coordinates.len());

        let dend;
        if cluster_method == &"Complete" {
            dend = linkage(&mut condensed, coordinates.nrows(), Method::Complete);
        } else if cluster_method == &"Average" {
            dend = linkage(&mut condensed, coordinates.nrows(), Method::Average);
        } else if cluster_method == &"Weighted" {
            dend = linkage(&mut condensed, coordinates.nrows(), Method::Weighted);
        } else if cluster_method == &"Ward" {
            dend = linkage(&mut condensed, coordinates.nrows(), Method::Ward);
        } else if cluster_method == &"Centroid" {
            dend = linkage(&mut condensed, coordinates.nrows(), Method::Centroid);
        } else if cluster_method == &"Median" {
            dend = linkage(&mut condensed, coordinates.nrows(), Method::Median);
        } else {
            panic!("Unknown clustering method:{}", cluster_method);
        }
        //println!("dend:{:?}", dend.steps());
        let new_now3 = Instant::now();
        println!(
            "Time taken to generate dendrogram:{:?}",
            new_now3.duration_since(new_now2)
        );

        let mut deps = Graph::new_undirected();

        // Adding nodes and edges to graph
        println!("Number of original nodes:{}", coordinates.nrows());
        for i in 0..coordinates.nrows() {
            // Add original nodes to graph
            deps.add_node(i);
        }

        //println!("dend.steps().len(){:?}", dend.steps().len());
        let mut new_nodes = Vec::<NewNodeInfo>::new();
        for i in 0..dend.steps().len() {
            let step = &dend.steps()[i];
            //println!("step:{:?}", step);
            let current_cluster_label = coordinates.nrows() + i;
            //println!("current_cluster_label:{}", current_cluster_label);
            // Adding nodes
            //let node1 = deps.add_node(step.cluster1);
            //let node2 = deps.add_node(step.cluster2);
            let node3 = deps.add_node(current_cluster_label);
            //println!("node1:{:?}", node1);

            let new_node = NewNodeInfo {
                node_id: current_cluster_label,
                child_nodes: vec![step.cluster1, step.cluster2],
            };
            new_nodes.push(new_node);
            // Adding edges
            deps.add_edge(
                NodeIndex::from(step.cluster1 as u32),
                node3,
                step.dissimilarity / 2.0,
            );
            deps.add_edge(
                NodeIndex::from(step.cluster2 as u32),
                node3,
                step.dissimilarity / 2.0,
            );
        }
        //println!("Graph:{}", Dot::new(&deps));
        let new_now4 = Instant::now();
        println!(
            "Time taken to generate graph:{:?}",
            new_now4.duration_since(new_now3)
        );

        let mut remaining_nodes: Vec<usize> = (0..coordinates.nrows()).collect();
        //println!("remaining_nodes:{:?}", remaining_nodes);

        // Initialize first node from cluster1 of first step, not sure if this is the best place from where to stop
        let mut current_node = dend.steps()[0].cluster1.clone();

        let mut num_iter = 0;
        let mut max_length_node_distance = 0; // max-length between all original node and the topmost node
        while remaining_nodes.len() > 0 {
            let mut smallest_distance = 1000000000; // Initialized to very high value

            //println!("current_node:{}", current_node);
            let distances = dijkstra(
                &deps,
                NodeIndex::from(current_node as u32),
                None,
                //Some(NodeIndex::from(node as u32)),
                |_| 1,
            );

            //println!("distances:{:?}", distances);
            let mut next_node = current_node;
            for item in distances {
                if item.0.le(&NodeIndex::from(coordinates.nrows() as u32 - 1)) == true
                    && item.0.ne(&NodeIndex::from(current_node as u32)) == true
                    && sorted_nodes.contains(&item.0.index()) == false
                {
                    //println!("item:{:?}", item);
                    if item.1 < smallest_distance {
                        smallest_distance = item.1;
                        next_node = item.0.index();
                    }
                }
                if item.0.eq(&NodeIndex::from(
                    new_nodes[new_nodes.len() - 1].node_id as u32,
                )) == true
                {
                    //node_y = item.1;
                    //println!("item:{:?}", item);
                    node_coordinates_list.push(NewNodeRelativeCoordinates {
                        node_id: current_node,
                        node_coordinates: NodeCoordinate {
                            x: Some(num_iter as f64),
                            y: Some(item.1 as f64),
                        },
                        child_nodes: vec![], // These are the original nodes, so they have no child nodes
                        child_node_coordinates: vec![
                            NodeCoordinate { x: None, y: None },
                            NodeCoordinate { x: None, y: None },
                        ],
                    });

                    if item.1 > max_length_node_distance {
                        max_length_node_distance = item.1
                    }
                }
            }
            //println!("next_node:{}", next_node);
            sorted_nodes.push(current_node);
            remaining_nodes.remove(
                remaining_nodes
                    .iter()
                    .position(|x| *x == current_node)
                    .expect(&(current_node.to_string() + " not found")),
            );
            current_node = next_node;
            num_iter += 1;
            //println!("remaining_nodes:{:?}", remaining_nodes);
        }
        //println!("sorted_nodes:{:?}", sorted_nodes);
        for i in 0..new_nodes.len() {
            let current_node = &new_nodes[i];
            //println!("current_node:{:?}", current_node);
            let distances = dijkstra(
                &deps,
                NodeIndex::from(current_node.node_id as u32),
                None,
                //Some(NodeIndex::from(node as u32)),
                |_| 1,
            );
            //println!("distances:{:?}", distances);

            // Computing relative y-coordinate of new node
            let mut node_y = 0.0;
            for item in distances {
                if item.0.eq(&NodeIndex::from(
                    new_nodes[new_nodes.len() - 1].node_id as u32,
                )) == true
                {
                    node_y = item.1 as f64;
                    //println!("item:{:?}", item);
                }

                //if item.1 > max_length_node_distance {
                //    max_length_node_distance = item.1
                //}
            }

            let (child_node1_x, child_node2_x): (Option<f64>, Option<f64>);
            let (child_node1_y, child_node2_y): (Option<f64>, Option<f64>);
            let child1_search_result = node_coordinates_list
                .iter()
                .find(|&i| i.node_id == current_node.child_nodes[0]);
            match child1_search_result {
                Some(item) => {
                    child_node1_x = item.node_coordinates.x;
                    child_node1_y = item.node_coordinates.y;
                }
                None => {
                    // Should not happen
                    panic!(
                        "X-coordinate of child node not found:{}",
                        current_node.child_nodes[0]
                    );
                }
            }

            let child2_search_result = node_coordinates_list
                .iter()
                .find(|&i| i.node_id == current_node.child_nodes[1]);
            match child2_search_result {
                Some(item) => {
                    child_node2_x = item.node_coordinates.x;
                    child_node2_y = item.node_coordinates.y;
                }
                None => {
                    // Should not happen
                    panic!(
                        "X-coordinate of child node not found:{}",
                        current_node.child_nodes[1]
                    );
                }
            }

            node_coordinates_list.push(NewNodeRelativeCoordinates {
                node_id: current_node.node_id,
                node_coordinates: NodeCoordinate {
                    x: Some((child_node1_x.unwrap() + child_node2_x.unwrap()) / 2.0),
                    y: Some(node_y),
                },
                child_nodes: current_node.child_nodes.clone(),
                child_node_coordinates: vec![
                    NodeCoordinate {
                        x: child_node1_x,
                        y: child_node1_y,
                    },
                    NodeCoordinate {
                        x: child_node2_x,
                        y: child_node2_y,
                    },
                ],
            })
        }

        // Update y-coordinates for original nodes
        for mut item in node_coordinates_list {
            if item.node_id < coordinates.nrows() {
                // Check if the current node is an original node. If yes, replace the y-coordinate with the max_length_node_distance
                item.node_coordinates.y = Some(max_length_node_distance as f64);
            } else {
                // If the current node is not an original node, check if any of the child nodes are original nodes. If yes, update the y-coordinate of that original node with max_length_node_distance
                for node_iter in 0..item.child_nodes.len() {
                    if item.child_nodes[node_iter] < coordinates.nrows() {
                        item.child_node_coordinates[node_iter].y =
                            Some(max_length_node_distance as f64);
                    }
                }
            }

            node_coordinates_final.push(item)
        }
        //println!("node_coordinates_final:{:?}", node_coordinates_final);
        let new_now5 = Instant::now();
        println!(
            "Time for sorting nodes:{:?}",
            new_now5.duration_since(new_now4)
        );
    } else {
        panic!("The dissimilarity matrix length cannot be zero");
    }
    (sorted_nodes, node_coordinates_final)
}

fn main() {
    env::set_var("RUST_BACKTRACE", "full");
    //rayon::ThreadPoolBuilder::new()
    //    .num_threads(4)
    //    .build_global()
    //    .unwrap();
    let mut input = String::new();
    //env::set_var("RUST_BACKTRACE", "1");
    match io::stdin().read_line(&mut input) {
        // Accepting the piped input from nodejs (or command line from testing)
        Ok(_bytes_read) => {
            let input_json = json::parse(&input);
            match input_json {
                Ok(json_string) => {
                    let matrix = &json_string["matrix"].as_str().unwrap(); // JSON key that stores the 2D matrix
                    let row_string_search: &JsonValue = &json_string["row_names"];
                    //println!("row_string_search:{}", row_string_search);
                    let mut row_names = Vec::<String>::new();
                    match row_string_search.as_str() {
                        Some(row_string_se) => {
                            let row_string = row_string_se
                                .replace("[", "")
                                .replace("]", "")
                                .replace("\n", "");
                            row_names = row_string
                                .split(",")
                                .into_iter()
                                .map(|x| x.to_string())
                                .collect::<Vec<String>>(); // Row names
                        }
                        None => {}
                    }
                    //println!("row_names:{:?}", row_names);

                    let col_string_search: &JsonValue = &json_string["col_names"];
                    //println!("col_string_search:{}", col_string_search);
                    let mut col_names = Vec::<String>::new();
                    match col_string_search.as_str() {
                        Some(col_string_se) => {
                            let col_string = col_string_se
                                .replace("[", "")
                                .replace("]", "")
                                .replace("\n", "");
                            col_names = col_string
                                .split(",")
                                .into_iter()
                                .map(|x| x.to_string())
                                .collect::<Vec<String>>(); // Col names
                        }
                        None => {}
                    }
                    //println!("col_names:{:?}", col_names);

                    let mut cluster_method: String = "Complete".to_string();
                    let cluster_method_search: &JsonValue = &json_string["cluster_method"];
                    match cluster_method_search.as_str() {
                        Some(cluster_method_se) => {
                            if cluster_method_se != "Single".to_string()
                                && cluster_method_se != "Complete".to_string()
                                && cluster_method_se != "Average".to_string()
                                && cluster_method_se != "Weighted".to_string()
                                && cluster_method_se != "Ward".to_string()
                                && cluster_method_se != "Centroid".to_string()
                                && cluster_method_se != "Median".to_string()
                            {
                                panic!("Unknown clustering method:{}", cluster_method_se);
                            } else {
                                cluster_method = cluster_method_se.to_string();
                            }
                        }
                        None => {}
                    }
                    //println!("cluster_method:{}", cluster_method);

                    let plot_image;
                    let plot_image_option = &json_string["plot_image"].as_bool();
                    match plot_image_option {
                        Some(plot_image_op) => plot_image = plot_image_op.to_owned(),
                        None => plot_image = false,
                    }
                    //println!("plot_image:{}", plot_image);

                    let input_list: Vec<&str> = matrix.split(";").collect(); // Vector containing list of sequences, the first two containing ref and alt.
                                                                             //println!("input_list:{:?}", input_list);

                    let now = Instant::now();
                    // Generating dissimilarity matrix
                    let mut coordinates: Vec<Vec<f64>> = vec![];
                    let mut coordinates_plain = Vec::<f64>::new();
                    //let mut coordinates = Array2::<f64>::new();
                    //let mut coord_array: Vec<Array1<f64>> = vec![];
                    for i in 0..input_list.len() {
                        let line = input_list[i]
                            .replace("[", "")
                            .replace("]", "")
                            .replace("\n", "");
                        //println!("line:{}", line);
                        let line2: Vec<&str> = line.split(",").collect();
                        //println!("line2:{:?}", line2);
                        let mut matrix_line = Vec::<f64>::new(); // Will generate a single row/column of the matrix
                        for j in 0..line2.len() {
                            matrix_line.push(line2[j].parse::<f64>().unwrap());
                            coordinates_plain.push(line2[j].parse::<f64>().unwrap());
                        }
                        //let matrix_array = Array1::from(matrix_line.clone());
                        //coord_array.push(matrix_array);
                        coordinates.push(matrix_line);
                    }
                    //println!("coord_array:{:?}", coord_array);
                    let input_matrix = DMatrix::from_vec(
                        coordinates[0].len(),
                        coordinates.len(),
                        coordinates_plain,
                    );

                    //println!("input_matrix:{:?}", input_matrix.nrows());
                    if input_matrix.ncols() != row_names.len() && row_names.len() > 0 {
                        // The row name is compared against col length intentonally. It does not really make much difference as the matrix is later transposed
                        panic!("Row names and row length in matrix are nor equal");
                    } else if input_matrix.nrows() != col_names.len() && col_names.len() > 0 {
                        // The col name is compared against row length intentonally. It does not really make much difference as the matrix is later transposed
                        panic!("Col names and col length in matrix are nor equal");
                    }

                    //println!("input_matrix:{:?}", input_matrix);

                    //println!("{}", type_of(coordinates));
                    let new_now = Instant::now();
                    println!(
                        "Time taken to build matrix:{:?}",
                        new_now.duration_since(now)
                    );
                    //println!("coordinates:{:?}", coordinates);

                    // Build our condensed matrix by computinghe dissimilarity between all
                    // possible coordinate pairs.
                    let (sorted_col_elements, sorted_col_coordinates) =
                        sort_elements(&input_matrix, &cluster_method);
                    //println!("sorted_elements:{:?}", sorted_elements);

                    let (sorted_row_elements, sorted_row_coordinates) =
                        sort_elements(&input_matrix.transpose(), &cluster_method);
                    //println!("sorted_elements2:{:?}", sorted_elements2);
                    let mut sorted_row_names = Vec::<String>::new();
                    let mut sorted_col_names = Vec::<String>::new();

                    match row_string_search.as_str() {
                        Some(_row_string_se) => {
                            sorted_row_names = sorted_row_elements
                                .clone()
                                .into_iter()
                                .map(|x| row_names[x].clone())
                                .collect::<Vec<String>>();
                        }
                        None => {}
                    }

                    match col_string_search.as_str() {
                        Some(_col_string_se) => {
                            sorted_col_names = sorted_col_elements
                                .clone()
                                .into_iter()
                                .map(|x| col_names[x].clone())
                                .collect::<Vec<String>>();
                        }
                        None => {}
                    }
                    //println!("sorted_row_names:{:?}", sorted_row_names);
                    //println!("sorted_col_names:{:?}", sorted_col_names);
                    let sorted_matrix =
                        sort_matrix(sorted_col_elements, sorted_row_elements, &input_matrix);
                    let sorted_matrix_transpose = sorted_matrix.transpose();
                    println!(
                        "sorted_matrix:{:?}",
                        &serde_json::to_string(&sorted_matrix_transpose).unwrap()
                    );
                    let mut sorted_col_coordinates_string = "[".to_string();
                    for i in 0..sorted_col_coordinates.len() {
                        sorted_col_coordinates_string +=
                            &serde_json::to_string(&sorted_col_coordinates[i]).unwrap();
                        if i != sorted_col_coordinates.len() - 1 {
                            sorted_col_coordinates_string += &",".to_string();
                        }
                    }
                    sorted_col_coordinates_string += &"]".to_string();
                    println!("sorted_col_coordinates:{:?}", sorted_col_coordinates_string);

                    let mut sorted_row_coordinates_string = "[".to_string();
                    for i in 0..sorted_row_coordinates.len() {
                        sorted_row_coordinates_string +=
                            &serde_json::to_string(&sorted_row_coordinates[i]).unwrap();
                        if i != sorted_row_coordinates.len() - 1 {
                            sorted_row_coordinates_string += &",".to_string();
                        }
                    }
                    sorted_row_coordinates_string += &"]".to_string();
                    println!("sorted_row_coordinates:{:?}", sorted_row_coordinates_string);
                    if plot_image == true {
                        let _plot_result = plot_matrix(
                            &sorted_matrix_transpose,
                            sorted_row_names,
                            sorted_col_names,
                        );
                    }
                }
                Err(error) => println!("Incorrect json: {}", error),
            }
        }

        Err(error) => println!("Piping error: {}", error),
    }
}

fn sort_matrix(
    // Rearranging matrix so as to plot it
    sorted_elements: Vec<usize>,
    sorted_elements2: Vec<usize>,
    original_array: &Matrix<f64, Dyn, Dyn, VecStorage<f64, Dyn, Dyn>>,
) -> Matrix<f64, Dyn, Dyn, VecStorage<f64, Dyn, Dyn>> {
    let new_now = Instant::now();
    let mut sorted_array = DMatrix::<f64>::zeros(original_array.nrows(), original_array.ncols());
    for col in 0..sorted_elements2.len() {
        let col_iter = sorted_elements2[col];
        //let mut row_iter;
        for row in 0..sorted_elements.len() {
            let row_iter = sorted_elements[row];
            //println!("row:{},col:{}", row_iter, col_iter);
            sorted_array[(row, col)] = original_array[(row_iter, col_iter)];
        }
    }
    let new_now2 = Instant::now();
    println!(
        "Time taken to sort matrix:{:?}",
        new_now2.duration_since(new_now)
    );
    //println!("sorted_array:{:?}", sorted_array);
    sorted_array
}

fn plot_matrix(
    original_array: &Matrix<f64, Dyn, Dyn, VecStorage<f64, Dyn, Dyn>>,
    sorted_row_names: Vec<String>,
    sorted_col_names: Vec<String>,
) -> Result<(), Box<dyn std::error::Error>> {
    let new_now = Instant::now();
    let cell_width: u32 = 200;
    let cell_height: u32 = 200;
    let row_text_font_size = 15; // Font size of row legend text
    let col_text_font_size = 15; // Font size of column legend text
    let multiplication_factor = 6; // This factor needs to be increased as row/column font size is increased.
    let offset_size = 2;

    let mut max_col_length = 0;
    let mut max_col_string: String = "".to_string();
    for i in 0..sorted_col_names.len() {
        if max_col_length < sorted_col_names[i].len() {
            max_col_length = sorted_col_names[i].len();
            max_col_string = sorted_col_names[i].clone();
        }
    }

    let mut max_row_length = 0;
    let mut max_row_string: String = "".to_string();
    for i in 0..sorted_row_names.len() {
        if max_row_length < sorted_row_names[i].len() {
            max_row_length = sorted_row_names[i].len();
            max_row_string = sorted_row_names[i].clone();
        }
    }

    let image_width = cell_width * (original_array.ncols() as u32)
        + ((max_row_string.len() * multiplication_factor + offset_size) as u32);
    let image_height = cell_height * (original_array.nrows() as u32)
        + ((max_col_string.len() * multiplication_factor + offset_size) as u32);
    let backend = BitMapBackend::new("1.png", (image_width, image_height)).into_drawing_area(); // Replace BitMapBackend with CanvasBackend in wasm
    println!("image_width:{},image_height:{}", image_width, image_height);

    let row_style =
        TextStyle::from(("arial", row_text_font_size as u32, "Normal").into_font()).color(&BLACK);
    let col_style = TextStyle::from(("arial", col_text_font_size as u32, "Normal").into_font())
        .color(&BLACK)
        .transform(FontTransform::Rotate270);
    let row_text_dim =
        DrawingArea::estimate_text_size(&backend, &max_row_string, &row_style).unwrap();
    let col_text_dim =
        DrawingArea::estimate_text_size(&backend, &max_col_string, &col_style).unwrap();
    println!("row text dimensions:{:?}", row_text_dim);
    println!("col text dimensions:{:?}", col_text_dim);

    backend.fill(&RGBColor(255, 255, 255))?;

    let max_value = original_array.max();
    let min_value = original_array.min();

    // Rendering row legends
    if sorted_row_names.len() > 0 {
        for row in 0..original_array.nrows() {
            backend.draw_text(
                &sorted_row_names[row].to_string(),
                &row_style,
                (
                    0,
                    (row as i32) * (cell_width as i32)
                        + ((col_text_dim.0 + offset_size as u32) as i32)
                        + (cell_height as i32) / 2,
                ),
            )?;
        }
    }

    // Rendering col legends
    if sorted_col_names.len() > 0 {
        for col in 0..original_array.ncols() {
            backend.draw_text(
                &sorted_col_names[col].to_string(),
                &col_style,
                (
                    (col as i32) * (cell_width as i32)
                        + ((col_text_dim.0 + offset_size as u32) as i32)
                        + (cell_width as i32) / 2,
                    (col_text_dim.0 as i32),
                ),
            )?;
        }
    }

    //println!("nrows:{}", original_array.nrows());
    //println!("ncols:{}", original_array.ncols());
    for col in 0..original_array.ncols() {
        for row in 0..original_array.nrows() {
            //println!("cell_value:{}", original_array[(row, col)]);
            let grad =
                create_color_gradient(original_array[(row, col)] as f64, max_value, min_value);
            //println!("grad:{:?}", grad);
            //println!(
            //    "total_cell_width:{}",
            //    cell_width * (original_array.nrows() as u32)
            //);
            //println!(
            //    "total_cell_height:{}",
            //    cell_height * (original_array.ncols() as u32)
            //);
            //println!(
            //    "top-left x,y:{},{}",
            //    (row as i32) * (cell_width as i32),
            //    (cell_height as i32) * (col as i32)
            //);
            //println!(
            //    "bottom-right x,y:{},{}",
            //    (row as i32 + 1) * (cell_width as i32),
            //    (cell_height as i32) * (col as i32 + 1)
            //);

            let start = (
                (cell_height as i32) * (col as i32) + (col_text_dim.0 as i32 + offset_size as i32),
                (row as i32) * (cell_width as i32) + (row_text_dim.0 as i32 + offset_size as i32),
            );
            let stop = (
                (cell_height as i32) * (col as i32 + 1)
                    + (col_text_dim.0 as i32 + offset_size as i32),
                (row as i32 + 1) * (cell_width as i32)
                    + (row_text_dim.0 as i32 + offset_size as i32),
            );
            backend.draw(&Rectangle::new(
                [start, stop],
                Into::<ShapeStyle>::into(&RGBColor(grad[0], grad[1], grad[2])).filled(),
            ))?;
            //println!("row:{},col:{}", row, col);
            //println!("start:{:?},stop:{:?}", start, stop);
        }
    }
    let new_now2 = Instant::now();
    println!(
        "Time taken to plot matrix:{:?}",
        new_now2.duration_since(new_now)
    );
    Ok(())
}

fn create_color_gradient(cell_mag: f64, max_value: f64, min_value: f64) -> [u8; 4] {
    let grad = colorgrad::CustomGradient::new()
        .html_colors(&["red", "blue"])
        .domain(&[min_value, max_value])
        .mode(colorgrad::BlendMode::Rgb)
        .build();
    grad.unwrap().at(cell_mag).to_rgba8()
}
