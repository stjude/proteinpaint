#!/bin/bash
# filter_rust_lint.sh - Extract warnings/errors for a specific file from clippy results

if [ $# -lt 2 ]; then
    echo "Usage: ./filter_rust_lint.sh RESULTS_FILE TARGET_FILE"
    echo "Example: ./filter_rust_lint.sh rust_lint_results.txt src/readHDF5.rs"
    exit 1
fi

RESULTS_FILE=$1
TARGET_FILE=$2
TEMP_FILE="temp_filtered.txt"

# Extract sections related to the target file with enough context
grep -B 1 -A 5 "$TARGET_FILE" "$RESULTS_FILE" > "$TEMP_FILE"

# Count actual warnings and errors
WARNING_COUNT=$(grep -c "warning:" "$TEMP_FILE")
ERROR_COUNT=$(grep -c "error:" "$TEMP_FILE")

echo "Analysis for $TARGET_FILE:"
echo "Found $WARNING_COUNT warnings and $ERROR_COUNT errors"
echo "-------------------------------------------------"

# Process each warning/issue one by one
issue_count=0
while IFS= read -r line; do
    if [[ "$line" == *"$TARGET_FILE"* ]]; then
        issue_count=$((issue_count + 1))
        
        # Determine if the previous line has warning or error
        if grep -B 1 "$line" "$TEMP_FILE" | head -1 | grep -q "warning:"; then
            echo -e "\033[1;33mWARNING #$issue_count:\033[0m"
        elif grep -B 1 "$line" "$TEMP_FILE" | head -1 | grep -q "error:"; then
            echo -e "\033[1;31mERROR #$issue_count:\033[0m"
        else
            echo -e "\033[1;36mISSUE #$issue_count:\033[0m"
        fi
        
        # Print the file location line
        echo "$line"
        
        # Print 5 lines after for context
        grep -A 5 "$line" "$TEMP_FILE" | tail -5
        
        echo "-------------------------------------------------"
    fi
done < "$TEMP_FILE"

echo "Total: $WARNING_COUNT warnings and $ERROR_COUNT errors identified in $TARGET_FILE"

# Clean up
rm "$TEMP_FILE"