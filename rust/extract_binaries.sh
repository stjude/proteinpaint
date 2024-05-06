#!/bin/bash

# Assign command line arguments to variables
toml_path="./Cargo.toml"
source_dir="./target/release/"
dest_dir="./extracted_binaries"

# Ensure the destination directory exists
mkdir -p "$dest_dir"

# Read and process the Cargo.toml file to get binary names using awk
keep_files=($(awk '/\[\[bin\]\]/ { getline; if ($0 ~ /name[[:space:]]*=/) { gsub(/.*name[[:space:]]*=[[:space:]]*"|"/, ""); print } }' "$toml_path"))

# Convert array to a space-separated string for easier matching
keep_files=" ${keep_files[*]} "

# Change to the source directory where files are stored
cd "$source_dir" || exit

# Loop over all files and directories in the current directory, including hidden ones
for item in * .*; do
    # Skip special directories . and ..
    if [ "$item" = "." ] || [ "$item" = ".." ]; then
        continue
    fi

    # Check if the item (file or directory) is in the keep_files list
    if [[ $keep_files =~ " $item " ]]; then
        echo "Copying: $item to $dest_dir"
        # Copy the file or directory to the destination directory
        cp -r "$item" "./../../$dest_dir"
    fi
done
