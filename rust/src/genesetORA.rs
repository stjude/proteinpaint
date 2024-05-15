// The hypergeometric distribution is computed based on the implementation in https://rdrr.io/github/GuangchuangYu/DOSE/src/R/enricher_internal.R
// Syntax: cd .. && cargo build --release && cat ~/sjpp/test.txt | target/release/genesetORA
#![allow(non_snake_case)]
use json::JsonValue;
use r_mathlib;
use rusqlite::{Connection, Result};
use serde::{Deserialize, Serialize};
use serde_json;
use std::cmp::Ordering;
use std::io;
use std::time::Instant;

#[allow(non_camel_case_types)]
#[allow(non_snake_case)]
#[derive(Debug)]
struct GO_pathway {
    GO_id: String,
}

#[allow(non_camel_case_types)]
#[allow(non_snake_case)]
#[derive(Debug)]
struct pathway_genes {
    symbol: String,
    _ensg: String,
    _enstCanonical: String,
}

#[allow(non_camel_case_types)]
#[allow(non_snake_case)]
#[derive(Debug, Serialize, Deserialize)]
//#[allow(dead_code)]
struct pathway_p_value {
    pathway_name: String,
    p_value_original: f64,
    p_value_adjusted: Option<f64>,
}

fn calculate_hypergeometric_p_value(
    sample_genes: &Vec<&str>,
    background_genes: &Vec<&str>,
    genes_in_pathway: Vec<pathway_genes>,
) -> f64 {
    let matching_sample_genes_counts: f64 = sample_genes
        .iter()
        .zip(&genes_in_pathway)
        .filter(|&(a, b)| *a.to_string() == b.symbol)
        .count() as f64;
    //println!("k-1:{}", matching_sample_genes_counts - 1.0);
    //println!("M:{}", genes_in_pathway.len() as f64);
    //println!(
    //    "N-M:{}",
    //    background_genes.len() as f64 - genes_in_pathway.len() as f64
    //);
    //println!("n:{}", sample_genes.len() as f64);
    let p_value = r_mathlib::hypergeometric_cdf(
        matching_sample_genes_counts - 1.0,
        genes_in_pathway.len() as f64,
        background_genes.len() as f64 - genes_in_pathway.len() as f64,
        sample_genes.len() as f64,
        false,
        false,
    );
    //println!("p_value:{}", p_value);
    p_value
}

fn main() -> Result<()> {
    let mut input = String::new();
    match io::stdin().read_line(&mut input) {
        // Accepting the piped input from nodejs (or command line from testing)
        Ok(_n) => {
            let input_json = json::parse(&input);
            match input_json {
                Ok(json_string) => {
                    let run_time = Instant::now();
                    let db_input: &JsonValue = &json_string["db"];
                    let db;
                    match db_input.as_str() {
                        Some(db_string) => db = db_string.to_string(),
                        None => panic!("db file path is missing"),
                    }
                    let genesetgroup;
                    let genesetgroup_input: &JsonValue = &json_string["gene_set_group"];
                    match genesetgroup_input.as_str() {
                        Some(genesetgroup_string) => genesetgroup = genesetgroup_string.to_string(),
                        None => panic!("genesetgroup is missing"),
                    }
                    let sample_genes_input: &JsonValue = &json_string["sample_genes"];
                    let sample_genes: Vec<&str> =
                        sample_genes_input.as_str().unwrap().split(",").collect();
                    let mut pathway_p_values: Vec<pathway_p_value> = Vec::with_capacity(10000);
                    let background_genes_input: &JsonValue = &json_string["background_genes"];
                    let background_genes: Vec<&str> = background_genes_input
                        .as_str()
                        .unwrap()
                        .split(",")
                        .collect();
                    //println!("sample_genes:{:?}", sample_genes);
                    //println!("background_genes:{:?}", background_genes);

                    if sample_genes.len() == 0 {
                        panic!("No sample genes provided");
                    } else if background_genes.len() == 0 {
                        panic!("No background genes provided");
                    }
                    let num_items_output = 100; // Number of top pathways to be specified in the output

                    let conn = Connection::open(db)?;
                    let stmt_result = conn.prepare(
                        &("select id from terms where parent_id='".to_owned()
                            + &genesetgroup
                            + "'"),
                    );
                    let mut iter = 0;
                    match stmt_result {
                        Ok(mut stmt) => {
                            #[allow(non_snake_case)]
                            let GO_iter =
                                stmt.query_map([], |row| Ok(GO_pathway { GO_id: row.get(0)? }))?;
                            #[allow(non_snake_case)]
                            for GO_term in GO_iter {
                                iter += 1;
                                match GO_term {
                                    Ok(n) => {
                                        //println!("GO term {:?}", n);
                                        let sql_statement =
                                            "select genes from term2genes where id='".to_owned()
                                                + &n.GO_id
                                                + &"'";
                                        //println!("sql_statement:{}", sql_statement);
                                        let mut gene_stmt = conn.prepare(&(sql_statement))?;
                                        //println!("gene_stmt:{:?}", gene_stmt);

                                        let mut rows = gene_stmt.query([])?;
                                        let mut names = Vec::<pathway_genes>::new();
                                        while let Some(row) = rows.next()? {
                                            let a: String = row.get(0)?;
                                            let input_gene_json = json::parse(&a);
                                            match input_gene_json {
                                                Ok(json_genes) => {
                                                    for json_iter in 0..json_genes.len() {
                                                        let item = pathway_genes {
                                                            symbol: json_genes[json_iter]["symbol"]
                                                                .to_string(),
                                                            _ensg: json_genes[json_iter]["ensg"]
                                                                .to_string(),
                                                            _enstCanonical: json_genes[json_iter]
                                                                ["enstCanonical"]
                                                                .to_string(),
                                                        };
                                                        //println!("item:{:?}", item);
                                                        names.push(item);
                                                    }
                                                }
                                                Err(_) => {
                                                    panic!(
                                                "Symbol, ensg, enstCanonical structure is missing!"
                                            )
                                                }
                                            }
                                        }
                                        let p_value = calculate_hypergeometric_p_value(
                                            &sample_genes,
                                            &background_genes,
                                            names,
                                        );
                                        if p_value.is_nan() == false {
                                            pathway_p_values.push(pathway_p_value {
                                                pathway_name: n.GO_id,
                                                p_value_original: p_value,
                                                p_value_adjusted: None,
                                            })
                                        }
                                    }
                                    Err(_) => {
                                        println!("GO term not found!")
                                    }
                                }
                            }
                        }
                        Err(_) => panic!("sqlite database file not found"),
                    }
                    let output_string = "{\"num_pathways\":".to_string()
                        + &iter.to_string()
                        + &",\"pathways\":"
                        + &adjust_p_values(pathway_p_values, num_items_output)
                        + &"}";
                    println!("pathway_p_values:{}", output_string);
                    println!(
                        "Time for calculating gene overrepresentation:{:?}",
                        run_time.elapsed()
                    );
                }
                Err(error) => println!("Incorrect json:{}", error),
            }
        }
        Err(error) => println!("Piping error: {}", error),
    }
    Ok(())
}

fn adjust_p_values(
    mut original_p_values: Vec<pathway_p_value>,
    mut num_items_output: usize,
) -> String {
    // Sorting p-values in ascending order
    original_p_values.as_mut_slice().sort_by(|a, b| {
        (a.p_value_original)
            .partial_cmp(&b.p_value_original)
            .unwrap_or(Ordering::Equal)
    });

    let mut adjusted_p_values: Vec<pathway_p_value> = Vec::with_capacity(original_p_values.len());
    let mut old_p_value: f64 = 0.0;
    let mut rank: f64 = original_p_values.len() as f64;
    for j in 0..original_p_values.len() {
        let i = original_p_values.len() - j - 1;

        //println!("p_val:{}", p_val);
        let mut adjusted_p_val: f64 =
            original_p_values[i].p_value_original * (original_p_values.len() as f64 / rank); // adjusted p-value = original_p_value * (N/rank)
        if adjusted_p_val > 1.0 {
            // p_value should NEVER be greater than 1
            adjusted_p_val = 1.0;
        }
        //println!("Original p_value:{}", original_p_values[i].p_value);
        //println!("Raw adjusted p_value:{}", adjusted_p_value);
        if i != original_p_values.len() - 1 {
            if adjusted_p_val > old_p_value {
                adjusted_p_val = old_p_value;
            }
        }
        old_p_value = adjusted_p_val;
        //println!("adjusted_p_value:{}", adjusted_p_val);
        rank -= 1.0;

        adjusted_p_values.push(pathway_p_value {
            pathway_name: original_p_values[i].pathway_name.clone(),
            p_value_original: original_p_values[i].p_value_original,
            p_value_adjusted: Some(adjusted_p_val),
        });
    }
    adjusted_p_values.as_mut_slice().sort_by(|a, b| {
        (a.p_value_adjusted.unwrap())
            .partial_cmp(&b.p_value_adjusted.unwrap())
            .unwrap_or(Ordering::Equal)
    });

    if num_items_output > adjusted_p_values.len() {
        num_items_output = adjusted_p_values.len()
    }

    let mut output_string = "[".to_string();
    for i in 0..num_items_output {
        let j = adjusted_p_values.len() - i - 1;
        output_string += &serde_json::to_string(&adjusted_p_values[j]).unwrap();
        if i < num_items_output - 1 {
            output_string += &",".to_string();
        }
    }
    output_string += &"]".to_string();
    output_string
}
