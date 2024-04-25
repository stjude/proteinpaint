// Syntax: cd .. && cargo build --release && cat ~/sjpp/test.txt | target/release/genesetORA
#![allow(non_snake_case)]
use json::JsonValue;
use r_mathlib;
use rusqlite::{Connection, Result};
use std::io;

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
#[derive(Debug)]
#[allow(dead_code)]
struct pathway_p_value {
    GO_id: String,
    p_value: f64,
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
                    let db_input: &JsonValue = &json_string["db"];
                    let db;
                    match db_input.as_str() {
                        Some(db_string) => db = db_string.to_string(),
                        None => panic!("db file path is missing"),
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
                    let conn = Connection::open(db)?;
                    let stmt_result =
                        conn.prepare("select id from terms where parent_id='BP: subset of GO'");
                    match stmt_result {
                        Ok(mut stmt) => {
                            #[allow(non_snake_case)]
                            let GO_iter =
                                stmt.query_map([], |row| Ok(GO_pathway { GO_id: row.get(0)? }))?;
                            let mut iter = 0;
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
                                                GO_id: n.GO_id,
                                                p_value: p_value,
                                            })
                                        }
                                    }
                                    Err(_) => {
                                        println!("GO term not found!")
                                    }
                                }
                            }
                            println!("Number of pathway entries:{}", iter);
                        }
                        Err(_) => panic!("sqlite database file not found"),
                    }
                    println!("pathway_p_values:{:?}", pathway_p_values);
                }
                Err(error) => println!("Incorrect json:{}", error),
            }
        }
        Err(error) => println!("Piping error: {}", error),
    }
    Ok(())
}
