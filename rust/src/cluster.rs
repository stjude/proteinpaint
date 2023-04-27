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

 1) sorted_matrix: Plain matrix is printed followed by number of rows and columns.
 2) sorted_col_elements: List of sorted column indexes in the sorted matrix.
 3) sorted_col_coordinates: Data for dendrogram in the x-axis. Contains JSON string containing list of traits for each node in the dendrogram.
       node_id: Node ID of the current node.
       node_coordinates: (X,Y) coordinates of the current node.
       child_nodes: ID's of the child node (if it exists). There will be no child node for the original (input) nodes in the dendrogram.
       child_node_coordinates: (X,Y) coordinates of each of the two child nodes (if they exist).
 4) sorted_row_elements: List of sorted row indexes in the sorted matrix.
 5) sorted_row_coordinates: Data for dendrogram in the y-axis. Contains JSON string containing list of traits for each node in the dendrogram.
       node_id: Node ID of the current node.
       node_coordinates: (X,Y) coordinates of the current node.
       child_nodes: ID's of the child node (if it exists). There will be no child node for the original (input) nodes in the dendrogram.
       child_node_coordinates: (X,Y) coordinates of each of the two child nodes (if they exist).
 6) all_original_nodes: This contains list of all descendent original nodes under the current node. This will be empty for the original nodes but will be populated with original node ID in derived nodes. This list will be shown in the UI on clicking a derived node.

EXAMPLES
 1) Syntax: cd .. && cargo build --release && json='{"matrix":[[9.5032,12.2685,8.2919,2.9634,9.2435],[10.5632,9.1719,22.7488,10.2698,31.7872],[0.1035,0.0525,0.0378,0.573,2.0522]],"row_names":["GeneA","GeneB","GeneC"],"col_names":["SampleA","SampleB","SampleC","SampleD","SampleE"],"plot_image":true,"cluster_method":"Average"}' && time echo "$json" | target/release/cluster

    Takes 2D matrix, row names and col names using cluster method "Average". In addition to stdout also plots the sorted 2D matrix to 1.png file

 2) Syntax: cd .. && cargo build --release && json='{"matrix":[[9.5032,12.2685,8.2919,2.9634,9.2435],[10.5632,9.1719,22.7488,10.2698,31.7872],[0.1035,0.0525,0.0378,0.573,2.0522]],"row_names":["GeneA","GeneB","GeneC"],"col_names":["SampleA","SampleB","SampleC","SampleD","SampleE"]}' && time echo "$json" | target/release/cluster

    Only prints sorted 2D matrix to stdout.

TO DO:

Implement parallelization of calculation of dissimilarity matrix using eculidean distance by using in-built parallelization in nalgebra crate using rayon. See this link below:

https://docs.rs/nalgebra/latest/nalgebra/base/par_iter/struct.ParColumnIterMut.html

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
use plotters::prelude::*;
use rayon::prelude::*;
use std::any::type_name;
use std::io;
use std::time::Instant;

#[derive(Debug, Copy, Clone, Serialize, Deserialize)]
struct Steps {
    cluster1: usize,
    cluster2: usize,
    dissimilarity: f64,
    size: usize,
}

#[allow(dead_code)]
#[derive(Debug, Copy, Clone, Deserialize)]
//#[serde(skip_serializing_if = "Struct::is_empty")]
struct NodeCoordinate {
    #[serde(skip_serializing_if = "Option::is_none")]
    x: Option<f64>, // The horizontal position of the node in the dendrogram.
    #[serde(skip_serializing_if = "Option::is_none")]
    y: Option<f64>, // The y-position stores the relative distance from the last (top most) node in the dendrogram
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
    let mut condensed = vec![];
    for row in 0..coordinates.nrows() - 1 {
        for col in row + 1..coordinates.nrows() {
            let mut dist: f64 = 0.0;
            //condensed.push(euclidean_distance(&coordinates[row], &coordinates[col]));
            for i in 0..coordinates.ncols() {
                dist += getsquare(coordinates[(row, i)] - coordinates[(col, i)]);
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
                .map(|i| getsquare(coordinates[(row, i)] - coordinates[(col, i)]))
                .sum();

            condensed.push(dist.sqrt())
        }
    }
    //println!("condensed:{:?}", condensed);
    condensed
}

fn getsquare(num: f64) -> f64 {
    return num * num;
}

#[allow(dead_code)]
fn euclidean_distance5(coordinates: &Matrix<f64, Dyn, Dyn, VecStorage<f64, Dyn, Dyn>>) -> Vec<f64> {
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

fn sort_elements(
    coordinates: &Matrix<f64, Dyn, Dyn, VecStorage<f64, Dyn, Dyn>>,
    cluster_method: &String,
) -> Vec<Steps> {
    //fn sort_elements(coordinates: &Vec<Vec<f64>>) -> Vec<usize> {
    //fn sort_elements(coordinates: &Vec<Array1<f64>>) -> Vec<usize> {
    let new_now = Instant::now();
    let mut steps_vec = Vec::<Steps>::new();
    if coordinates.len() > 0 {
        //let mut condensed = vec![];
        //for row in 0..coordinates.len() - 1 {
        //    for col in row + 1..coordinates.len() {
        //        condensed.push(euclidean_distance(&coordinates[row], &coordinates[col]));
        //    }
        //}
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

        //println!("dend.steps().len(){:?}", dend.steps().len());
        println!("Number of nodes:{}", coordinates.nrows());
        //println!("max_length_node_distance:{}", max_length_node_distance);
        for i in 0..dend.steps().len() {
            let step = &dend.steps()[i];
            steps_vec.push(Steps {
                cluster1: step.cluster1,
                cluster2: step.cluster2,
                dissimilarity: step.dissimilarity,
                size: step.size,
            })
        }
    } else {
        panic!("The dissimilarity matrix length cannot be zero");
    }
    steps_vec
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
                    //println!("json_string:{:?}", json_string["matrix"]);
                    let matrix = &json_string["matrix"]; // JSON key that stores the 2D matrix
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

                    let _plot_image;
                    let plot_image_option = &json_string["plot_image"].as_bool();
                    match plot_image_option {
                        Some(plot_image_op) => _plot_image = plot_image_op.to_owned(),
                        None => _plot_image = false,
                    }
                    //println!("plot_image:{}", plot_image);

                    let now = Instant::now();
                    // Generating dissimilarity matrix
                    let mut coordinates: Vec<Vec<f64>> = vec![];
                    let mut coordinates_plain = Vec::<f64>::new();
                    //let mut coordinates = Array2::<f64>::new();
                    //let mut coord_array: Vec<Array1<f64>> = vec![];
                    for i in 0..matrix.len() {
                        let mut matrix_line = Vec::<f64>::new(); // Will generate a single row/column of the matrix
                        for j in 0..matrix[i].len() {
                            matrix_line.push(matrix[i][j].as_f64().unwrap());
                            coordinates_plain.push(matrix[i][j].as_f64().unwrap());
                        }
                        //let matrix_array = Array1::from(matrix_line.clone());
                        //coord_array.push(matrix_array);
                        coordinates.push(matrix_line);
                    }
                    //println!("coord_array:{:?}", coord_array);
                    let input_matrix =
                        DMatrix::from_vec(matrix[0].len(), matrix.len(), coordinates_plain);

                    //println!("input_matrix:{:?}", input_matrix.nrows());
                    if input_matrix.ncols() != row_names.len() && row_names.len() > 0 {
                        // The row name is compared against col length intentonally. It does not really make much difference as the matrix is later transposed
                        panic!("Row names and row length in matrix are nor equal");
                    } else if input_matrix.nrows() != col_names.len() && col_names.len() > 0 {
                        // The col name is compared against row length intentonally. It does not really make much difference as the matrix is later transposed
                        panic!("Col names and col length in matrix are nor equal");
                    } else if input_matrix.ncols() <= 1 {
                        panic!("Please input a 2D matrix. The number of cols <= 1");
                    } else if input_matrix.nrows() <= 1 {
                        panic!("Please input a 2D matrix. The number of rows <= 1");
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
                    let col_steps = sort_elements(&input_matrix, &cluster_method);
                    let mut col_output_string = "[".to_string();
                    for i in 0..col_steps.len() {
                        col_output_string += &serde_json::to_string(&col_steps[i]).unwrap();
                        if i != col_steps.len() - 1 {
                            col_output_string += &",".to_string();
                        }
                    }
                    col_output_string += &"]".to_string();
                    println!("colSteps:{:?}", col_output_string);
                    let row_steps = sort_elements(&input_matrix.transpose(), &cluster_method);
                    let mut row_output_string = "[".to_string();
                    for i in 0..row_steps.len() {
                        row_output_string += &serde_json::to_string(&row_steps[i]).unwrap();
                        if i != row_steps.len() - 1 {
                            row_output_string += &",".to_string();
                        }
                    }
                    row_output_string += &"]".to_string();
                    println!("rowSteps:{:?}", row_output_string);
                    //let mut sorted_row_names = Vec::<String>::new();
                    //let mut sorted_col_names = Vec::<String>::new();
                    //
                    //match row_string_search.as_str() {
                    //    Some(_row_string_se) => {
                    //        sorted_row_names = sorted_row_elements
                    //            .clone()
                    //            .into_iter()
                    //            .map(|x| row_names[x].clone())
                    //            .collect::<Vec<String>>();
                    //    }
                    //    None => {}
                    //}
                    //
                    //match col_string_search.as_str() {
                    //    Some(_col_string_se) => {
                    //        sorted_col_names = sorted_col_elements
                    //            .clone()
                    //            .into_iter()
                    //            .map(|x| col_names[x].clone())
                    //            .collect::<Vec<String>>();
                    //    }
                    //    None => {}
                    //}
                    ////println!("sorted_row_names:{:?}", sorted_row_names);
                    ////println!("sorted_col_names:{:?}", sorted_col_names);
                    //
                    //let mut sorted_col_coordinates_string = "[".to_string();
                    //for i in 0..sorted_col_coordinates.len() {
                    //    sorted_col_coordinates_string +=
                    //        &serde_json::to_string(&sorted_col_coordinates[i]).unwrap();
                    //    if i != sorted_col_coordinates.len() - 1 {
                    //        sorted_col_coordinates_string += &",".to_string();
                    //    }
                    //}
                    //sorted_col_coordinates_string += &"]".to_string();
                    ////println!("sorted_col_coordinates:{:?}", sorted_col_coordinates_string);
                    //
                    //let mut sorted_row_coordinates_string = "[".to_string();
                    //for i in 0..sorted_row_coordinates.len() {
                    //    sorted_row_coordinates_string +=
                    //        &serde_json::to_string(&sorted_row_coordinates[i]).unwrap();
                    //    if i != sorted_row_coordinates.len() - 1 {
                    //        sorted_row_coordinates_string += &",".to_string();
                    //    }
                    //}
                    //sorted_row_coordinates_string += &"]".to_string();
                    ////println!("sorted_row_coordinates:{:?}", sorted_row_coordinates_string);
                    //if plot_image == true {
                    //    let sorted_matrix =
                    //        sort_matrix(sorted_col_elements, sorted_row_elements, &input_matrix);
                    //    let sorted_matrix_transpose = sorted_matrix.transpose();
                    //    //println!(
                    //    //    "sorted_matrix:{:?}",
                    //    //    &serde_json::to_string(&sorted_matrix_transpose).unwrap()
                    //    //);
                    //    let _plot_result = plot_matrix(
                    //        &sorted_matrix_transpose,
                    //        sorted_row_names,
                    //        sorted_col_names,
                    //    );
                    //}
                }
                Err(error) => println!("Incorrect json: {}", error),
            }
        }

        Err(error) => println!("Piping error: {}", error),
    }
}

#[allow(dead_code)]
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

#[allow(dead_code)]
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
