// Syntax: rustc indel.rs && ./indel chr11.119155745.T.TTGACCTGG.txt 119155745 75 T

use std::env;
use std::fs;
use std::cmp::Ordering;
use std::collections::HashSet;
//use std::path::Path;

pub struct read_diff_scores {
   groupID:usize,
   value:f64
}

struct kmer_input {
   kmer_sequence:String,
   kmer_weight:f64
}

struct read_category {
   category:String,
   groupID:usize
}


fn read_diff_scores_owned(item: &mut read_diff_scores) -> read_diff_scores {
    let val=item.value.to_owned();        
    let gID=item.groupID.to_owned();

    let read_val = read_diff_scores{
	    value:f64::from(val),
	    groupID:usize::from(gID)
    };	
    read_val	
}



fn main() {
    let args: Vec<String> = env::args().collect(); // Collecting arguments from commandline
    let filename = &args[1];
    let path: String = "../".to_string();
    println!("{:?}", filename);

    let contents = fs::read_to_string(path+filename)
        .expect("Something went wrong reading the file");

    let variant_pos = &args[2].parse::<i64>().unwrap();
    let segbplen = &args[3].parse::<i64>().unwrap();
    let refallele = &args[4];

    println!("variant_pos:{}", variant_pos);
    println!("segbplen:{}", segbplen);    
    
    let lines: Vec<&str> = contents.split("\n").collect();
    //let lines = lines.unwrap();    
    
    //println!("{:?}", lines);
    println!("{}", lines[0]);
    
    //----------------------------------------------------------------------------
    
    // IMPORTANT PARAMETERS
    const kmer_length: i64 = 6; // length of kmer
    const weight_no_indel:f64 = 0.1; // Weight when base not inside the indel
    const weight_indel:f64 = 10.0; // Weight when base is inside the indel
    const threshold_slope:f64 = 0.1; // Maximum curvature allowed to recognize perfectly aligned alt/ref sequences
    //----------------------------------------------------------------------------

    let left_most_pos = variant_pos - segbplen;
    let ref_length: i64 = refallele.len() as i64;
    
    let kmers = build_kmers(lines[0].to_string(), kmer_length);
    println!("kmers:{}",kmers[4]);


    let (ref_kmers_weight,all_ref_counts, all_ref_kmers_seq_values_nodups, all_ref_kmers_nodups, all_ref_kmers) = build_kmers_refalt(
    		lines[0].to_string(),
    		kmer_length,
    		left_most_pos,
    		*variant_pos,
    		*variant_pos + ref_length,
    		weight_indel,
    		weight_no_indel
    );

    let (alt_kmers_weight,all_alt_counts, all_alt_kmers_seq_values_nodups, all_alt_kmers_nodups, all_alt_kmers) = build_kmers_refalt(
    		lines[1].to_string(),
    		kmer_length,
    		left_most_pos,
    		*variant_pos,
    		*variant_pos + ref_length,
    		weight_indel,
    		weight_no_indel
    );

    let mut kmer_diff_scores = Vec::<f64>::new();
    let mut alt_comparisons = Vec::<f64>::new();    
    let mut ref_comparisons = Vec::<f64>::new();
    let mut ref_scores = Vec::<read_diff_scores>::new();
    let mut alt_scores = Vec::<read_diff_scores>::new();
    let mut i:i64 = 0;
    println!("Number of reads:{}", lines.len()-2);
    for read in lines{ // Will multithread this loop in the future
	if i >= 2 && read.len() > 0  { // The first two sequences are reference and alternate allele and therefore skipped. Also checking there are no blank lines in the input file
              let kmers = build_kmers(read.to_string(), kmer_length);
              //println!("kmers:{}",kmers.len());
              let ref_comparison=jaccard_similarity_weights(&kmers,&all_ref_kmers,&all_ref_kmers_nodups,&all_ref_kmers_seq_values_nodups,&ref_kmers_weight,&all_ref_counts);
	      let alt_comparison=jaccard_similarity_weights(&kmers,&all_alt_kmers,&all_alt_kmers_nodups,&all_alt_kmers_seq_values_nodups,&alt_kmers_weight,&all_alt_counts);
	      let diff_score: f64 = alt_comparison - ref_comparison; // Is the read more similar to reference sequence or alternate sequence
	      kmer_diff_scores.push(diff_score);
	      ref_comparisons.push(ref_comparison);
	      alt_comparisons.push(alt_comparison);
	      let item = read_diff_scores{
	         value:f64::from(diff_score),
	         groupID:usize::from(i as usize -2) // The -2 has been added since the first two sequences in the file are reference and alternate     
	      };
	      if diff_score > 0.0 {
		alt_scores.push(item)
	      } else if diff_score <= 0.0 {
		ref_scores.push(item)
	      }	    
	}    
        i+=1;
    }	

    println!("ref_scores length:{}",ref_scores.len());
    println!("alt_scores length:{}",alt_scores.len());

    println!("Parsing ref scores");
    if ref_scores.len() > 0 {
      let ref_indices = determine_maxima_alt(&mut ref_scores, &threshold_slope);
    }

    println!("Parsing alt scores");
    if alt_scores.len() > 0 {
      let alt_indices = determine_maxima_alt(&mut alt_scores, &threshold_slope);
    }    
}

fn build_kmers_refalt(sequence: String, kmer_length: i64,left_most_pos: i64, indel_start: i64,indel_stop: i64,weight_indel: f64, weight_no_indel: f64) -> (f64,Vec::<i64>,Vec::<String>,Vec<kmer_input>,Vec<kmer_input>)
{
    //println!("segbplen:{}", sequence);
    //println!("variant_pos in function:{}", indel_start);
    //println!("weight_indel in function:{}", weight_indel);

    let num_iterations = sequence.len() as i64 - kmer_length + 1;
    let sequence_vector: Vec<_> = sequence.chars().collect();    
    let mut kmers = Vec::<kmer_input>::new();
    let mut kmers_nodup = Vec::<String>::new();
    let mut kmers_nodup2 = Vec::<String>::new();    
    let mut kmer_start = left_most_pos;
    let mut kmer_stop = kmer_start + kmer_length;
    for i in 0..num_iterations {
	#[derive(Copy, Clone)]
	let mut subseq = String::new();
	let mut subseq2 = String::new();
	let mut subseq3 = String::new();
	let mut j=i as usize;	
	for _k in 0..kmer_length {
            subseq+=&sequence_vector[j].to_string();
	    subseq2+=&sequence_vector[j].to_string();
	    subseq3+=&sequence_vector[j].to_string();	    
	    j+=1;
	}
	let mut kmer_score:f64 = 0.0;
	for _k in kmer_start..kmer_stop {
	    if indel_start <= (j as i64) && (j as i64) < indel_stop {
		// Determining if nucleotide is within indel or not
		kmer_score += weight_indel;
	    }
	    else {
		kmer_score += weight_no_indel;
	    }           
	}
	kmers_nodup.push(subseq2);
	kmers_nodup2.push(subseq3);	
	let kmer_weight = kmer_input{
	    kmer_sequence:String::from(subseq),
	    kmer_weight:f64::from(kmer_score)
	};
	kmers.push(kmer_weight);	
	kmer_start+=1;
	kmer_stop+=1;
    }
    //println!("Number of kmers before:{}", kmers_nodup.len());
    // Getting unique kmers
    kmers_nodup.sort();
    kmers_nodup.dedup();

    kmers_nodup2.sort();
    kmers_nodup2.dedup();    
    //println!("Number of kmers after:{}", kmers_nodup.len());

    //println!("Total number of kmers:{}",kmers.len());
    
    let mut kmers2 = Vec::<kmer_input>::new();
    let mut kmer_counts = Vec::<i64>::new();
    let mut total_kmers_weight:f64 = 0.0;
    let mut i:usize = 0;    
    for kmer1 in kmers_nodup {
	let mut kmer_values = Vec::<f64>::new();
	let mut kmer_count = 0;
	for kmer2 in &kmers {
            if kmer1==kmer2.kmer_sequence {
		kmer_values.push(kmer2.kmer_weight);
		kmer_count+=1;
            } 		
	}
	kmer_counts.push(kmer_count);
	
	let sum: f64 = kmer_values.iter().sum();
	let kmer_weight = kmer_input{
	    kmer_sequence:String::from(kmer1),
	    kmer_weight:f64::from(sum as f64 / kmer_values.len() as f64) // Calculating mean
	};
        //println!("i:{}", i);
        //println!("kmer:{}", kmer_weight.kmer_sequence);	
        total_kmers_weight += (kmer_count as f64)*(sum as f64 / kmer_values.len() as f64);	
	kmers2.push(kmer_weight);
	i+=1;
    }
    
    let mut kmers3 = Vec::<kmer_input>::new();
    for kmer1 in kmers {
	for kmer2 in &kmers2 {
            if kmer1.kmer_sequence==kmer2.kmer_sequence {
	      let kmer_weight = kmer_input{
	         kmer_sequence:String::from(kmer1.kmer_sequence),
	         kmer_weight:f64::from(kmer2.kmer_weight)     
	      };
	
	      kmers3.push(kmer_weight);	
	      break;	
            }
	}	
    }
    (total_kmers_weight,kmer_counts,kmers_nodup2,kmers2,kmers3)
}    

// Multithread this function in the future
fn build_kmers(sequence: String, kmer_length: i64) -> Vec::<String>  {
    //println!("sequence:{}", sequence);
    let sequence_vector: Vec<_> = sequence.chars().collect();    
    let num_iterations = sequence.len() as i64 - kmer_length + 1;
    let mut kmers = Vec::<String>::new();
    for i in 0..num_iterations {
	//println!("{}", i);
	let mut subseq = String::new();
	let mut j=i as usize;
	for _k in 0..kmer_length {
            subseq+=&sequence_vector[j].to_string();
	    j+=1;
	}
	kmers.push(subseq);
	//println!("subseq:{}", subseq);
    }
    //println!("kmers:{}",kmers[10]);
    kmers
}

fn jaccard_similarity_weights(kmers1: &Vec<String>, kmers2: &Vec<kmer_input>, kmers2_nodups: &Vec<kmer_input>, kmer2_seq_values_nodups: &Vec<String>, kmers2_weight: &f64, kmer2_counts: &Vec<i64>) -> f64 {
    // Getting unique read kmers
    let mut kmers1_nodup = kmers1.clone();
    kmers1_nodup.sort();
    kmers1_nodup.dedup();  

    // Finding common kmers between read and ref/alt
    let mut intersection = HashSet::new();
    //let mut intersection = kmers1_nodup.clone();

    //println!("Length of kmers1_nodup:{}",kmers1_nodup.len());
    //println!("Length of kmer2_seq_values_nodups:{}",kmer2_seq_values_nodups.len());
    
    for kmer in &kmers1_nodup{
       intersection.insert(kmer);
    }
    
    for kmer in kmer2_seq_values_nodups{
       intersection.insert(kmer);
    }	

    //println!("Length of intersection:{}",intersection.len());
 
    let mut kmer1_counts = Vec::<i64>::new();
    let mut kmers1_weight: f64 = 0.0;
    for kmer1 in &kmers1_nodup {
	let mut kmer_count: i64 = 0;
	let mut score: f64 = 0.0;
	for kmer2 in kmers1 {
            if kmer1==kmer2 {
		kmer_count+=1;
            } 		
	}	
	
	for kmer2 in kmers2_nodups {
            if kmer1==&kmer2.kmer_sequence {
		score=kmer2.kmer_weight;
		continue;
            }
	}
	kmers1_weight += (kmer_count as f64)*score;

	kmer1_counts.push(kmer_count);	
    }
    //println!("kmers1_weight:{}",kmers1_weight);
    
    let mut intersection_weight: f64 = 0.0;
    for kmer1 in intersection {
	let mut j: usize = 0;
	let mut score: f64 = 0.0;
	let mut kmer1_freq: i64 = 0;
	let mut kmer2_freq: i64 = 0;
	for kmer2 in kmers2_nodups {
            if kmer1==&kmer2.kmer_sequence {
		score=kmer2.kmer_weight;
		kmer2_freq=kmer2_counts[j];
		continue;
            }
	    j+=1;
	}

	j=0;
	for kmer2 in &kmers1_nodup {
            if kmer1==kmer2 {
		kmer1_freq=kmer1_counts[j];
		continue;
            }
	    j+=1;
	}
	if kmer1_freq <= kmer2_freq {
          intersection_weight += score*(kmer1_freq as f64);
	}
	if kmer1_freq > kmer2_freq {
          intersection_weight += score*(kmer2_freq as f64);
	}    
    }
    intersection_weight / (kmers1_weight + kmers2_weight - intersection_weight) // Jaccard similarity
}

fn determine_maxima_alt(kmer_diff_scores: &mut Vec<read_diff_scores>, threshold_slope: &f64) -> Vec<read_category> {

    // Sorting kmer_diff_scores
    kmer_diff_scores.sort_by(|b, a| a.value.partial_cmp(&b.value).unwrap_or(Ordering::Equal));

    let mut kmer_diff_scores_sorted = Vec::<read_diff_scores>::new();
    let mut kmer_diff_scores_sorted2 = Vec::<read_diff_scores>::new();    
    for item in kmer_diff_scores { // Making multiple copyies of kmer_diff_scores for further use
	//println!("Value:{}",item.value);
	//println!("groupID:{}",item.groupID);
	let item2:read_diff_scores = read_diff_scores_owned(item);
	kmer_diff_scores_sorted.push(item2);
	//let item2:read_diff_scores = read_diff_scores_owned(item);
        //kmer_diff_scores_sorted2.push(item2);	
    }
      
    let kmer_diff_scores_length: usize = kmer_diff_scores_sorted.len();
    let mut start_point: usize = kmer_diff_scores_length - 1;
    let mut slope:f64 = 0.0;
    let mut is_a_line = 1;
    let mut indices = Vec::<read_category>::new();
    let threshold_slope_clone: f64 = threshold_slope.to_owned();
    if kmer_diff_scores_length > 1 {
       for i in kmer_diff_scores_length..1 {
	   slope=(&kmer_diff_scores_sorted[i - 1].value - &kmer_diff_scores_sorted[i].value).abs();
	   if slope > threshold_slope_clone {
              start_point=i as usize;
	      println!("kmer_diff_scores_length>1,i:{}",i);  
              is_a_line = 0;
	      break; 
	   }    
       }	   
    }
    else {
      println!("Number of reads too low to determine curvature of slope");       
    }
    if (is_a_line == 1) {
	for i in 0..(kmer_diff_scores_length-1) {
           let read_cat = read_category{
	       category:String::from("refalt"),
	       groupID:usize::from(kmer_diff_scores_sorted[i].groupID)
           };
	   indices.push(read_cat); 
        }
    }
    indices
}    
