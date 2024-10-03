// Need to set HDF5_DIR and LD_LIBRARY_PATH in ~/.bash_profile
// Syntax: cd .. && cargo build --release && json='{"gene":"TP53","data_type":"singlecell","hdf5_file":"matrix_with_na_comp_9.h5"}' && time echo $json | target/release/readHDF5
// cd .. && cargo build --release && json='{"genes":"TP53\tSQOR\tSSPN","limitSamples":"1\t3\t5\t6","data_type":"expression_count","hdf5_file":"/Users/rpaul1/pp_data/files/hg38/ALL-pharmacotyping/rnaseq/exprs.h5"}' && time echo $json | target/release/readHDF5
// cd .. && cargo build --release && json='{"data_type":"expression_samples","hdf5_file":"/Users/rpaul1/pp_data/files/hg38/ALL-pharmacotyping/rnaseq/exprs.h5"}' && time echo $json | target/release/readHDF5

use hdf5::types::FixedAscii;
use hdf5::types::VarLenAscii;
use hdf5::{File, Result};
use json;
use ndarray::Array1;
use ndarray::Array2;
use ndarray::Dim;
use std::io;
use std::time::Instant;

fn read_single_hdf5(hdf5_filename: String, gene_name: String) -> Result<()> {
    let file = File::open(&hdf5_filename)?; // open for reading
    let ds_dim = file.dataset("data/dim")?; // open the dataset

    // Check the data type and read the dataset accordingly
    let data_dim: Array1<_> = ds_dim.read::<usize, Dim<[usize; 1]>>()?;
    let num_samples = data_dim[0]; // Number of total columns in the dataset
    let num_genes = data_dim[1];
    println!("num_samples:{}", num_samples);
    println!("num_genes:{}", num_genes);

    //let now_partial_i = Instant::now();
    //let data_partial_i: Array1<usize> = ds_i.read_slice_1d(0..20)?;
    //println!("Data_partial_i: {:?}", data_partial_i);
    //println!("Time for partial_i dataset:{:?}", now_partial_i.elapsed());
    //
    //let now_x = Instant::now();
    //let ds_x = file.dataset("data/x")?; // open the dataset
    //let data_x: Array1<_> = ds_x.read::<f64, Dim<[usize; 1]>>()?;
    //println!("Data_x: {:?}", data_x);
    //println!("Time for x dataset:{:?}", now_x.elapsed());

    let now_genes = Instant::now();
    let ds_genes = file.dataset("gene_names")?;
    let genes = ds_genes.read_1d::<FixedAscii<104>>()?;
    //println!("\tgenes = {:?}", genes);
    //println!("\tgenes.shape() = {:?}", genes.shape());
    //println!("\tgenes.strides() = {:?}", genes.strides());
    //println!("\tgenes.ndim() = {:?}", genes.ndim());
    println!("Time for parsing genes:{:?}", now_genes.elapsed());

    let now_samples = Instant::now();
    let ds_samples = file.dataset("sample_names")?;
    let samples = ds_samples.read_1d::<FixedAscii<104>>()?;
    //println!("\tsamples = {:?}", samples);
    //println!("\tsamples.shape() = {:?}", samples.shape());
    //println!("\tsamples.strides() = {:?}", samples.strides());
    //println!("\tsamples.ndim() = {:?}", samples.ndim());
    println!("Time for parsing samples:{:?}", now_samples.elapsed());

    let gene_index;
    match genes.iter().position(|&x| x == gene_name) {
        Some(index) => {
            println!(
                "The index of '{}' is {} in 0-based format (add 1 to compare with R output)",
                gene_name, index
            );
            gene_index = index;
        }
        None => panic!(
            "Gene '{}' not found in the HDF5 file '{}'",
            gene_name, &hdf5_filename
        ),
    }

    // Find the number of columns that are populated for that gene
    let now_p = Instant::now();
    let ds_p = file.dataset("data/p")?; // open the dataset

    //let data_p: Array1<_> = ds_p.read::<usize, Dim<[usize; 1]>>()?;
    let data_partial_p: Array1<usize> = ds_p.read_slice_1d(gene_index..gene_index + 2)?;
    //println!("Data_p: {:?}", data_p);
    println!("Data_partial_p: {:?}", data_partial_p);
    println!("Time for p dataset:{:?}", now_p.elapsed());

    let array_start_point = data_partial_p[0];
    let array_stop_point = data_partial_p[1];
    let num_populated_cells = data_partial_p[1] - array_start_point;
    println!("Number of populated cells:{}", num_populated_cells);

    //Find all columns indices that are populated for the given gene
    let now_i = Instant::now();
    let ds_i = file.dataset("data/i")?; // open the dataset

    //let data_i: Array1<_> = ds_i.read::<f64, Dim<[usize; 1]>>()?;
    //println!("Data_i: {:?}", data_i);
    let populated_column_ids: Array1<usize> =
        ds_i.read_slice_1d(array_start_point..array_stop_point - 1)?;
    println!(
        "Length of populated_column_ids:{}",
        populated_column_ids.len()
    );

    // Do a sanity check (for testing)
    //let mut min = 0;
    //for i in 0..populated_column_ids.len() {
    //    if populated_column_ids[i] < min {
    //        println!("Value is decreasing {},{}", populated_column_ids[i], min);
    //    } else {
    //        min = populated_column_ids[i];
    //    }
    //}
    println!("Populated cells:{:?}", populated_column_ids);
    println!("Time for i dataset:{:?}", now_i.elapsed());

    //Find all columns values that are populated for the given gene
    let now_x = Instant::now();
    let ds_x = file.dataset("data/x")?; // open the dataset

    //let data_x: Array1<_> = ds_x.read::<f64, Dim<[usize; 1]>>()?;
    //println!("Data_x: {:?}", data_x);
    let populated_column_values: Array1<f64> =
        ds_x.read_slice_1d(array_start_point..array_stop_point - 1)?;
    println!(
        "Length of populated_column_ids:{}",
        populated_column_values.len()
    );
    println!("Time for x dataset:{:?}", now_x.elapsed());

    // Generate the complete array from the sparse array

    let mut gene_array: Array1<f64> = Array1::zeros(num_samples);
    let time_generating_full_array = Instant::now();
    //let mut gene_array: Vec<f64> = Vec::with_capacity(num_samples);
    for index in 0..num_samples {
        match populated_column_ids.iter().any(|&x| x == index) {
            true => match populated_column_ids.iter().position(|&x| x == index) {
                Some(y) => {
                    gene_array[index] = populated_column_values[y] //gene_array.push(populated_column_values[y]),
                }
                None => {} // should not happen because if the index is found, its position in the array should also be found
            },
            false => gene_array[index] = 0.0, //gene_array.push(0.0), // If index not found, it means the value is 0 for that sample
        }
    }

    let mut output_string = "{".to_string();
    for i in 0..gene_array.len() {
        //let item_json = "{\"".to_string()
        //    + &samples[i].to_string()
        //    + &"\","
        //    + &gene_array[i].to_string()
        //    + &"}";

        //let item_json = format!("{{\"{}\"}}", samples[i].to_string());

        output_string += &format!(
            "\"{}\":{}",
            samples[i].to_string(),
            gene_array[i].to_string()
        );
        //println!("item_json:{}", item_json);

        //let item_json = format!(
        //    r##"{{"{}",{}}}"##,
        //    samples[i].to_string().replace("\\", ""),
        //    gene_array[i].to_string()
        //);
        if i != gene_array.len() - 1 {
            output_string += &",";
        }
    }
    output_string += &"}".to_string();
    output_string = output_string.replace("\\", "");
    println!(
        "Time generating full array:{:?}",
        time_generating_full_array.elapsed()
    );
    println!("output_string:{}", output_string);

    // Print individual element in array

    //let arr = v.iter().collect::<Vec<_>>();
    //for (idx, val) in arr.iter().enumerate() {
    //    println!("\tarr[{:?}] = {:?} ({:?})", idx, val.to_string(), val.len());
    //}

    //for item in data_i {
    //    println!("i:{}", item);
    //}
    Ok(())
}

// Used to get the sample names from HDF5 file at PP server startup
fn get_gene_expression_samples(hdf5_filename: String) -> Result<()> {
    let file = File::open(&hdf5_filename)?; // open for reading
    let now_samples = Instant::now();
    let ds_samples = file.dataset("samples")?;
    let samples = ds_samples.read::<VarLenAscii, Dim<[usize; 1]>>()?;
    println!("\tsamples = {:?}", samples);
    println!("\tsamples.shape() = {:?}", samples.shape());
    println!("\tsamples.strides() = {:?}", samples.strides());
    println!("\tsamples.ndim() = {:?}", samples.ndim());
    println!("Time for parsing samples:{:?}", now_samples.elapsed());

    let mut output_string = "".to_string();
    for i in 1..samples.len() {
        //let item_json = "{\"".to_string()
        //    + &samples[i].to_string()
        //    + &"\","
        //    + &gene_array[i].to_string()
        //    + &"}";

        //let item_json = format!("{{\"{}\"}}", samples[i].to_string());

        output_string += &format!("{}", samples[i].to_string());
        //println!("item_json:{}", item_json);

        //let item_json = format!(
        //    r##"{{"{}",{}}}"##,
        //    samples[i].to_string().replace("\\", ""),
        //    gene_array[i].to_string()
        //);
        if i != samples.len() - 1 {
            output_string += &",";
        }
    }
    println!("output_string:{}", output_string);
    Ok(())
}

fn read_gene_expression_hdf5(
    hdf5_filename: String,
    gene_name: String,
    limit_samples: Option<&str>,
) -> Result<()> {
    let file = File::open(&hdf5_filename)?; // open for reading
    let ds_dim = file.dataset("dims")?; // open the dataset

    // Check the data type and read the dataset accordingly
    let data_dim: Array1<_> = ds_dim.read::<usize, Dim<[usize; 1]>>()?;
    let num_samples = data_dim[0]; // Number of total columns in the dataset
    let num_genes = data_dim[1]; // Number of total rows in the dataset
    println!("num_samples bulk:{}", num_samples);
    println!("num_genes bulk:{}", num_genes);

    let now_genes = Instant::now();
    let ds_genes = file.dataset("gene_symbols")?;
    println!("ds_genes:{:?}", ds_genes);
    let genes = ds_genes.read::<VarLenAscii, Dim<[usize; 1]>>()?;
    println!("\tgenes = {:?}", genes);
    println!("\tgenes.shape() = {:?}", genes.shape());
    println!("\tgenes.strides() = {:?}", genes.strides());
    println!("\tgenes.ndim() = {:?}", genes.ndim());
    println!("Time for parsing genes:{:?}", now_genes.elapsed());

    let now_samples = Instant::now();
    let ds_samples = file.dataset("samples")?;
    let samples = ds_samples.read::<VarLenAscii, Dim<[usize; 1]>>()?;
    println!("\tsamples = {:?}", samples);
    println!("\tsamples.shape() = {:?}", samples.shape());
    println!("\tsamples.strides() = {:?}", samples.strides());
    println!("\tsamples.ndim() = {:?}", samples.ndim());
    println!("Time for parsing samples:{:?}", now_samples.elapsed());

    //Find all columns values that are populated for the given gene
    let now_counts = Instant::now();
    let ds_counts = file.dataset("counts")?; // open the dataset

    let gene_index;
    match genes.iter().position(|x| x.to_string() == gene_name) {
        Some(index) => {
            println!(
                "The index of '{}' is {} in 0-based format (add 1 to compare with R output)",
                gene_name, index
            );
            gene_index = index;
        }
        None => panic!(
            "Gene '{}' not found in the HDF5 file '{}'",
            gene_name, &hdf5_filename
        ),
    }

    //let data_counts: Array1<_> = ds_counts.read::<f64, Dim<[usize; 1]>>()?;
    //println!("Data_counts: {:?}", data_counts);
    let gene_array: Array2<f64> =
        ds_counts.read_slice_2d((gene_index..gene_index + 1, 0..num_samples))?;
    println!("Length of gene array:{:?}", gene_array.len()); // Check the result
    println!("Time for parsing gene data:{:?}", now_counts.elapsed());
    Ok(())
}

fn main() -> Result<()> {
    let mut input = String::new();
    match io::stdin().read_line(&mut input) {
        // Accepting the piped input from nodejs (or command line from testing)
        Ok(_bytes_read) => {
            //println!("{} bytes read", bytes_read);
            //println!("{}", input);
            let input_json = json::parse(&input);
            match input_json {
                Ok(json_string) => {
                    let now = Instant::now();
                    let hdf5_filename_result = &json_string["hdf5_file"].to_owned();
                    let hdf5_filename;
                    match hdf5_filename_result.as_str() {
                        Some(x) => {
                            hdf5_filename = x.to_string();
                        }
                        None => {
                            panic!("HDF5 filename not provided");
                        }
                    }

                    let data_type_result = &json_string["data_type"].to_owned();

                    let gene_result = &json_string["gene"].to_owned();
                    match gene_result.as_str() {
                        Some(_x) => {}
                        None => {
                            // This panic statement has been put inside an if statement because in case of a sample request, no gene names will be provided. Later need to organize the different queries into enums so as to type check each request.
                            if data_type_result.as_str().unwrap() != "expression_samples"
                                && data_type_result.as_str().unwrap() != "expression_count"
                            {
                                panic!("Gene name not provided");
                            }
                        }
                    }

                    let data_type;
                    match data_type_result.as_str() {
                        Some(x) => {
                            data_type = x.to_string();

                            let gene_result2 = &json_string["gene"].to_owned();
                            match gene_result2.as_str() {
                                Some(gene_name) => {
                                    if data_type == "singlecell" {
                                        read_single_hdf5(
                                            hdf5_filename.clone(),
                                            gene_name.to_string(),
                                        )?;
                                    }
                                }
                                None => {
                                    if data_type == "expression_samples" {
                                        get_gene_expression_samples(hdf5_filename.clone())?;
                                    }
                                }
                            }

                            let genes_result = &json_string["genes"].to_owned();
                            match genes_result.as_str() {
                                Some(genes) => {
                                    if data_type == "expression_count" {
                                        let limit_samples = &json_string["limitSamples"].to_owned();
                                        read_gene_expression_hdf5(
                                            hdf5_filename,
                                            genes.to_string(),
                                            limit_samples.as_str(),
                                        )?;
                                    } else {
                                        panic!("data_type needs to be singlecell, expression_count or expression_samples");
                                    }
                                }
                                None => {}
                            }
                        }
                        None => {
                            panic!("Data type not provided");
                        }
                    }

                    println!("Time for parsing genes from HDF5:{:?}", now.elapsed());
                }
                Err(error) => println!("Incorrect json: {}", error),
            }
        }
        Err(error) => println!("Piping error: {}", error),
    }
    Ok(())
}
