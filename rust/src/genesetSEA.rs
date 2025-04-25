// Syntax: cd .. && cargo build --release && cat ~/sjpp/test.txt | target/release/genesetORA
#![allow(non_snake_case)]
use json::JsonValue;
use r_mathlib;
use rusqlite::{Connection, Result};
use serde::{Deserialize, Serialize};
use serde_json;
use std::cmp::Ordering;
use std::collections::HashMap;
use std::collections::HashSet;
use std::env;
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
#[derive(Debug, Serialize, Deserialize)]
//#[allow(dead_code)]
struct pathway_p_value {
    pathway_name: String,
    p_value_original: f64,
    p_value_adjusted: Option<f64>,
    gene_set_hits: String,
    gene_set_size: usize,
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
                    let msigdb_input: &JsonValue = &json_string["msigdb"];
                    let msigdb;
                    match msigdb_input.as_str() {
                        Some(db_string) => msigdb = db_string.to_string(),
                        None => panic!("msigdb file path is missing"),
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

                    let genedb_input: &JsonValue = &json_string["genedb"];
                    let genedb;
                    match genedb_input.as_str() {
                        Some(gene_db_string) => genedb = gene_db_string.to_string(),
                        None => panic!("genedb file path is missing"),
                    }

                    let filter_non_coding_genes_input: &JsonValue =
                        &json_string["filter_non_coding_genes"];
                    let filter_non_coding_genes: bool =
                        filter_non_coding_genes_input.as_bool().unwrap();

                    let genedbconn = Connection::open(genedb)?;
                    let genedb_result = genedbconn.prepare(&("select * from codingGenes"));
                    let mut num_coding_genes: usize = 0;
                    let mut sample_coding_genes: HashSet<String> = HashSet::with_capacity(24000);
                    match genedb_result {
                        Ok(mut x) => {
                            let mut genes = x.query([])?;
                            while let Some(coding_gene) = genes.next()? {
                                num_coding_genes += 1;
                                //println!("coding_gene:{:?}", coding_gene);
                                for sample_gene in &sample_genes {
                                    let code_gene: String = coding_gene.get(0).unwrap();
                                    if filter_non_coding_genes == true && code_gene == *sample_gene
                                    {
                                        sample_coding_genes.insert(code_gene);
                                    } else if filter_non_coding_genes == false {
                                        sample_coding_genes.insert(code_gene);
                                    }
                                }
                            }
                        }
                        Err(_) => {}
                    }

                    if sample_coding_genes.len() == 0 {
                        panic!("All query genes are non-coding");
                    }

                    let background_genes_input: &JsonValue = &json_string["background_genes"];
                    let num_background_genes;
                    match background_genes_input.as_str() {
                        Some(x) => {
                            let background_genes_str: Vec<&str> = x.split(",").collect(); // Background genes is defined for e.g in case of DE analysis
                            num_background_genes = background_genes_str.len();
                        }
                        None => {
                            // Background genes not present for e.g. in hierarchial clustering
                            // Get background genes from the gene database
                            num_background_genes = num_coding_genes;
                        }
                    }
                    //println!("sample_genes:{:?}", sample_genes);
                    //println!("background_genes:{:?}", background_genes);

                    if sample_genes.len() == 0 {
                        panic!("No sample genes provided");
                    } else if num_background_genes == 0 {
                        panic!("No background genes provided");
                    }
                    let num_items_output = 100; // Number of top pathways to be specified in the output

                    let msigdbconn = Connection::open(msigdb)?;
                    let stmt_result = msigdbconn.prepare(
                        &("select id from terms where parent_id='".to_owned()
                            + &genesetgroup
                            + "'"),
                    );
                    match stmt_result {
                        Ok(mut stmt) => {
                            #[allow(non_snake_case)]
                            let GO_iter =
                                stmt.query_map([], |row| Ok(GO_pathway { GO_id: row.get(0)? }))?;
                            #[allow(non_snake_case)]
                            for GO_term in GO_iter {
                                match GO_term {
                                    Ok(n) => {
                                        //println!("GO term {:?}", n);
                                        let sql_statement =
                                            "select genes from term2genes where id='".to_owned()
                                                + &n.GO_id
                                                + &"'";
                                        //println!("sql_statement:{}", sql_statement);
                                        let mut gene_stmt = msigdbconn.prepare(&(sql_statement))?;
                                        //println!("gene_stmt:{:?}", gene_stmt);

                                        let mut rows = gene_stmt.query([])?;
                                        let mut names = HashSet::<String>::new();
                                        while let Some(row) = rows.next()? {
                                            let a: String = row.get(0)?;
                                            let input_gene_json = json::parse(&a);
                                            match input_gene_json {
                                                Ok(json_genes) => {
                                                    for json_iter in 0..json_genes.len() {
                                                        names.insert(
                                                            json_genes[json_iter]["symbol"]
                                                                .to_string(),
                                                        );
                                                    }
                                                }
                                                Err(_) => {
                                                    panic!(
                                                "Symbol, ensg, enstCanonical structure is missing!"
                                            )
                                                }
                                            }
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
                }
                Err(error) => println!("Incorrect json:{}", error),
            }
        }
        Err(error) => println!("Piping error: {}", error),
    }
    Ok(())
}
