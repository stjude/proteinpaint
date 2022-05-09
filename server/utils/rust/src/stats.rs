// Test syntax: echo chr17.7666870.T.C\t1678\t2828\t25242\t39296\nchr17.7667504.G.C\t179\t4327\t2884\t61648\nchr17.7667559.G.A\t3548\t958\t51468\t13062 | ../target/release/stats
use std::io;
mod stats_functions;

fn main() {
    let mut input = String::new();
    match io::stdin().read_line(&mut input) {
        // Accepting the piped input from nodejs (or command line from testing)
        #[allow(unused_variables)]
        Ok(n) => {
            //println!("{} bytes read", n);
            //println!("input:{}", input);
        }
        Err(error) => println!("Piping error: {}", error),
    }
    let variants: Vec<&str> = input.split("-").collect(); // Putting each variant in a separate element of vector

    let temp_vec: Vec<&str> = variants[0].split("\t").collect();
    //println!("temp_vec:{:?}", temp_vec);
    let fisher_limit = temp_vec[1].parse::<u32>().unwrap(); // Cutoff for sum of all four numbers to decide whether to use fisher or chisq test
    let individual_fisher_limit = temp_vec[2].parse::<u32>().unwrap(); // Cutoff for each individual number that must be passed to invoke chisq test

    //println!("fisher_limit:{}", fisher_limit);

    //println!("variants:{:?}", variants);

    for i in 1..variants.len() {
        let variant: Vec<&str> = variants[i].split("\t").collect();
        //println!("variant:{:?}", variant);
        if variant.len() > 1 {
            // Check if total greater than fisher limit, if yes then use chisq test
            let mut fisher_chisq_test: u64 = 1; // Initializing to fisher-test
            let n1 = variant[1].parse::<u32>().unwrap();
            let n2 = variant[2].parse::<u32>().unwrap();
            let n3 = variant[3].parse::<u32>().unwrap();
            let n4 = variant[4].replace("\n", "").parse::<u32>().unwrap();

            if n1 + n2 + n3 + n4 > fisher_limit
                && n1 > individual_fisher_limit
                && n2 > individual_fisher_limit
                && n3 > individual_fisher_limit
                && n4 > individual_fisher_limit
            {
                fisher_chisq_test = 2; // Setting test = chi-sq
            }
            let (p_value_original, _fisher_chisq_test) =
                stats_functions::strand_analysis_one_iteration(n1, n2, n3, n4, fisher_chisq_test);
            println!(
                "{}\t{}\t{}\t{}\t{}\t{}",
                variant[0],
                variant[1],
                variant[2],
                variant[3],
                variant[4].replace("\n", ""),
                p_value_original
            );
        }
    }
}
