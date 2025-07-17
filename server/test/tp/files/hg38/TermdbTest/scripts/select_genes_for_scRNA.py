import csv
import h5py
import os

# Specify the input and output file names
input_file = 'sample1.geneCounts.txt'
output_file = 'sample1.104.geneCounts.txt'
num_samples = 100
# Read gene IDs ans gene symbols from gene counts HDF5 file

# Open the HDF5 file
with h5py.File(os.path.join("/Users/rpaul1/sjpp/proteinpaint/server/test/tp/files/hg38/TermdbTest","TermdbTest.geneCounts.h5"), 'r') as hdf5_file:
    # Access the dataset
    gene_names = hdf5_file["gene_names"][:]
    gene_ids = hdf5_file["gene_ids"][:]

print (len(gene_names))
    
# Open the input TSV file and the output TSV file
i = 0
first = 1
with open(input_file, 'r', newline='') as infile, open(output_file, 'w', newline='') as outfile:
    reader = csv.reader(infile, delimiter='\t')  # Use tab as the delimiter
    writer = csv.writer(outfile, delimiter='\t')  # Use tab as the delimiter

    for row in reader:
        # Select the first 104 columns
        if first == 1:
            first = 0
            header = ["geneID", "geneSymbol", "bioType", "annotationLevel"]
            for j in range(num_samples):
                header.append("cell" + str(j+1)) 
            writer.writerow(header)
        else:   
            selected_columns = row[2: (4+num_samples)]
            selected_columns.insert(0, gene_names[i].decode('utf-8'))
            selected_columns.insert(0, gene_ids[i].decode('utf-8'))
            writer.writerow(selected_columns)  # Write the selected columns to the output file
            i += 1
print(f"First 10 columns have been written to {output_file}.")
