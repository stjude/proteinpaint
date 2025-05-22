// Syntax: cd .. && cargo build --release && time cat ~/sjpp/test.txt | target/release/cerno
#![allow(non_snake_case)]
use json::JsonValue;
use r_mathlib::chi_squared_cdf;
use rusqlite::{Connection, Result};
use serde::{Deserialize, Serialize};
use serde_json;
use std::cmp::Ordering;
use std::collections::HashSet;
use std::io;

#[allow(non_camel_case_types)]
#[allow(non_snake_case)]
#[derive(Debug)]
struct GO_pathway {
    GO_id: String,
}

#[allow(non_camel_case_types)]
#[allow(non_snake_case)]
#[derive(Debug, Clone, PartialEq, PartialOrd)]
struct gene_order {
    gene_name: String,
    fold_change: f64,
    rank: Option<usize>,
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
    auc: f64,
    es: f64,
    gene_set_size: usize,
}

#[allow(non_camel_case_types)]
#[allow(non_snake_case)]
#[derive(Debug, Serialize, Deserialize)]
//#[allow(dead_code)]
struct output_struct {
    pval: f64,
    fdr: f64,
    leading_edge: String,
    auc: f64,
    es: f64,
    geneset_size: usize,
}

fn main() -> Result<()> {
    let mut input = String::new();
    match io::stdin().read_line(&mut input) {
        // Accepting the piped input from nodejs (or command line from testing)
        Ok(_n) => {
            let input_json = json::parse(&input);
            match input_json {
                Ok(json_string) => {
                    let msigdb_input: &JsonValue = &json_string["db"];
                    let msigdb;
                    match msigdb_input.as_str() {
                        Some(db_string) => msigdb = db_string.to_string(),
                        None => panic!("msigdb file path is missing"),
                    }
                    let genesetgroup;
                    let genesetgroup_input: &JsonValue = &json_string["geneset_group"];
                    match genesetgroup_input.as_str() {
                        Some(genesetgroup_string) => genesetgroup = genesetgroup_string.to_string(),
                        None => panic!("genesetgroup is missing"),
                    }
                    let sample_genes_input: &JsonValue = &json_string["genes"];
                    let mut sample_genes = Vec::<&str>::new();
                    for iter in 0..sample_genes_input.len() {
                        let item = sample_genes_input[iter].as_str().unwrap();
                        sample_genes.push(item);
                    }
                    //println!("sample_genes:{:?}", sample_genes);

                    let fold_change_input: &JsonValue = &json_string["fold_change"];
                    let mut fold_change_f64 = Vec::<f64>::new();
                    for iter in 0..fold_change_input.len() {
                        let item = fold_change_input[iter].as_f64().unwrap();
                        fold_change_f64.push(item);
                    }

                    if sample_genes.len() == 0 {
                        panic!("No sample genes provided");
                    }

                    if sample_genes.len() != fold_change_f64.len() {
                        panic!("Length of genes array and fold change array are not equal");
                    }

                    let mut genes_vector: Vec<gene_order> = Vec::with_capacity(sample_genes.len());
                    for i in 0..sample_genes.len() {
                        let item: gene_order = gene_order {
                            gene_name: sample_genes[i].to_string(),
                            fold_change: fold_change_f64[i],
                            rank: None, // Will be calculated later
                        };
                        genes_vector.push(item)
                    }
                    let mut pathway_p_values: Vec<pathway_p_value> = Vec::with_capacity(10000);

                    let genedb_input: &JsonValue = &json_string["genedb"];
                    let genedb;
                    match genedb_input.as_str() {
                        Some(gene_db_string) => genedb = gene_db_string.to_string(),
                        None => panic!("genedb file path is missing"),
                    }

                    let filter_non_coding_genes_input: &JsonValue = &json_string["filter_non_coding_genes"];
                    let filter_non_coding_genes: bool = filter_non_coding_genes_input.as_bool().unwrap();

                    let genedbconn = Connection::open(genedb)?;
                    let genedb_result = genedbconn.prepare(&("select * from codingGenes"));
                    let mut sample_coding_genes: Vec<gene_order> = Vec::with_capacity(24000);
                    match genedb_result {
                        Ok(mut x) => {
                            let mut genes = x.query([])?;
                            while let Some(coding_gene) = genes.next()? {
                                //println!("coding_gene:{:?}", coding_gene);
                                for sample_gene in &genes_vector {
                                    let code_gene: String = coding_gene.get(0).unwrap();
                                    if filter_non_coding_genes == true && code_gene == *sample_gene.gene_name {
                                        sample_coding_genes.push(sample_gene.clone());
                                    } else if filter_non_coding_genes == false {
                                        sample_coding_genes.push(sample_gene.clone());
                                    }
                                }
                            }
                        }
                        Err(_) => {}
                    }

                    if sample_coding_genes.len() == 0 {
                        panic!("All query genes are non-coding");
                    }

                    // Sort sample_coding_gene in descending order
                    sample_coding_genes
                        .as_mut_slice()
                        .sort_by(|a, b| (b.fold_change).partial_cmp(&a.fold_change).unwrap_or(Ordering::Equal));

                    // Assign ranks to each gene
                    for i in 0..sample_coding_genes.len() {
                        sample_coding_genes[i].rank = Some(i)
                    }

                    //println!("sample_genes:{:?}", sample_genes);
                    //println!("background_genes:{:?}", background_genes);

                    let msigdbconn = Connection::open(msigdb)?;
                    let stmt_result = msigdbconn
                        .prepare(&("select id from terms where parent_id='".to_owned() + &genesetgroup + "'"));
                    match stmt_result {
                        Ok(mut stmt) => {
                            #[allow(non_snake_case)]
                            let GO_iter = stmt.query_map([], |row| Ok(GO_pathway { GO_id: row.get(0)? }))?;
                            #[allow(non_snake_case)]
                            for GO_term in GO_iter {
                                match GO_term {
                                    Ok(n) => {
                                        //println!("GO term {:?}", n);
                                        let sql_statement =
                                            "select genes from term2genes where id='".to_owned() + &n.GO_id + &"'";
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
                                                        names.insert(json_genes[json_iter]["symbol"].to_string());
                                                    }
                                                }
                                                Err(_) => {
                                                    panic!("Symbol, ensg, enstCanonical structure is missing!")
                                                }
                                            }
                                        }
                                        let gene_set_size = names.len();
                                        let (p_value, auc, es, matches, gene_set_hits) =
                                            cerno(&sample_coding_genes, names);

                                        if matches >= 1.0
                                            && p_value.is_nan() == false
                                            && es.is_nan() == false
                                            && es != f64::INFINITY
                                            && auc != f64::INFINITY
                                            && auc.is_nan() == false
                                        {
                                            pathway_p_values.push(pathway_p_value {
                                                pathway_name: n.GO_id,
                                                p_value_original: p_value,
                                                p_value_adjusted: None,
                                                auc: auc,
                                                es: es,
                                                gene_set_hits: gene_set_hits,
                                                gene_set_size: gene_set_size,
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
                    let output_string = adjust_p_values(pathway_p_values);
                    println!("{}", output_string);
                }
                Err(error) => println!("Incorrect json:{}", error),
            }
        }
        Err(error) => println!("Piping error: {}", error),
    }
    Ok(())
}

fn cerno(sample_coding_genes: &Vec<gene_order>, genes_in_pathway: HashSet<String>) -> (f64, f64, f64, f64, String) {
    // Filter the sample_coding_genes vector to only include those whose gene_names are in the HashSet genes_in_pathway
    let gene_intersections: Vec<&gene_order> = sample_coding_genes
        .iter()
        .filter(|sample_coding_genes| genes_in_pathway.contains(&sample_coding_genes.gene_name)) // Check if name is in the HashSet genes_in_pathway
        .collect(); // Collect the results into a new vector

    let N1 = gene_intersections.len() as f64;
    let N = sample_coding_genes.len() as f64;
    let mut gene_set_hits: String = "".to_string();
    for gene in &gene_intersections {
        gene_set_hits += &(gene.gene_name.to_string() + &",");
    }
    if gene_intersections.len() > 0 {
        // Remove the last "," in string
        gene_set_hits.pop();
    }

    let ranks: Vec<usize> = gene_intersections // x <- l %in% mset$gs2gv[[m]] ; ranks <- c(1:N)[x]
        .iter()
        .map(|x| x.rank.unwrap())
        .collect::<Vec<usize>>();

    let cerno: f64 = ranks // -2 * sum( log(ranks/N) )
        .iter()
        .map(|x| ((*x as f64) / N).ln())
        .collect::<Vec<f64>>()
        .iter()
        .sum::<f64>()
        * (-2.0);

    let cES: f64 = cerno / (2.0 * (N1 as f64)); // cES <- cerno/(2*N1)
    let N2 = N - N1; // N2 = N - N1
    let R1 = ranks.iter().sum::<usize>() as f64; // R1 <- sum(ranks)
    let U = N1 * N2 + N1 * (N1 + 1.0) / 2.0 - R1; // U  <- N1*N2+N1*(N1+1)/2-R1
    let AUC = U / (N1 * N2); // AUC <- U/(N1*N2)
    let p_value = chi_squared_cdf(cerno, 2.0 * N1, false, false); // pchisq(ret$cerno, 2*N1, lower.tail=FALSE)
    (p_value, AUC, cES, N1, gene_set_hits)
}

fn adjust_p_values(mut original_p_values: Vec<pathway_p_value>) -> String {
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
        let mut adjusted_p_val: f64 = original_p_values[i].p_value_original * (original_p_values.len() as f64 / rank); // adjusted p-value = original_p_value * (N/rank)
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
            auc: original_p_values[i].auc,
            es: original_p_values[i].es,
            gene_set_hits: original_p_values[i].gene_set_hits.clone(),
            gene_set_size: original_p_values[i].gene_set_size,
        });
    }
    adjusted_p_values.as_mut_slice().sort_by(|a, b| {
        (a.p_value_adjusted.unwrap())
            .partial_cmp(&b.p_value_adjusted.unwrap())
            .unwrap_or(Ordering::Equal)
    });

    let mut output_string = "{".to_string();
    for i in 0..adjusted_p_values.len() {
        let item = output_struct {
            pval: adjusted_p_values[i].p_value_original,
            fdr: adjusted_p_values[i].p_value_adjusted.unwrap(),
            leading_edge: adjusted_p_values[i].gene_set_hits.clone(),
            geneset_size: adjusted_p_values[i].gene_set_size,
            es: adjusted_p_values[i].es,
            auc: adjusted_p_values[i].auc,
        };
        output_string += &format!(
            "\"{}\":{}",
            adjusted_p_values[i].pathway_name.clone(),
            serde_json::to_string(&item).unwrap()
        );
        if i < adjusted_p_values.len() - 1 {
            output_string += &",".to_string();
        }
    }
    output_string += &"}".to_string();
    output_string
}
