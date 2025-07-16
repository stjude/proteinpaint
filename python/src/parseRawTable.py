#!/usr/bin/env python3
"""
Excel to Mutation and Annotation Files Converter

This script reads an Excel file (.xlsx or .xls) containing mutation data and creates two
specific output files:
1. mutation.txt - mutation data with standardized column names  
2. gata2Annotation.txt - annotation data in term-value format
"""

import pandas as pd
import sys
import os
from pathlib import Path
import argparse
from typing import List, Optional


def validate_required_columns(df: pd.DataFrame, required_columns: List[str]) -> bool:
    """
    Validate that all required columns are present in the DataFrame.
    
    Args:
        df (pd.DataFrame): The input DataFrame to validate
        required_columns (List[str]): List of column names that must be present
        
    Returns:
        bool: True if all required columns are present, False otherwise
    """
    missing_columns = [col for col in required_columns if col not in df.columns]
    
    if missing_columns:
        print(f"Error: Missing required columns: {missing_columns}")
        print(f"Available columns: {list(df.columns)}")
        return False
    
    return True


def read_excel_file(file_path: str) -> Optional[pd.DataFrame]:
    """
    Read an Excel file and return a pandas DataFrame using pd.ExcelFile.
    
    Args:
        file_path (str): Path to the Excel file
        
    Returns:
        Optional[pd.DataFrame]: DataFrame if successful, None if failed
    """
    try:
        # Use pd.ExcelFile to read the Excel file
        xls = pd.ExcelFile(file_path)
        
        # Read the first sheet
        df = pd.read_excel(xls, sheet_name=0)
        print(f"Successfully read {len(df)} rows from {file_path}")
        return df
    
    except ImportError as e:
        print(f"Error: Missing Excel reading dependency.")
        file_extension = Path(file_path).suffix.lower()
        
        if file_extension == '.xlsx':
            print(f"For .xlsx files, install openpyxl:")
            print(f"  pip install openpyxl")
        elif file_extension == '.xls':
            print(f"For .xls files, install xlrd:")
            print(f"  pip install xlrd")
        else:
            print(f"Install the appropriate Excel reading library:")
            print(f"  pip install openpyxl  # for .xlsx files")
            print(f"  pip install xlrd      # for .xls files")
        
        print(f"\nAlternatively, save your Excel file as CSV and modify this script to read CSV files.")
        return None
    
    except FileNotFoundError:
        print(f"Error: File '{file_path}' not found.")
        return None
    except pd.errors.EmptyDataError:
        print(f"Error: File '{file_path}' is empty.")
        return None
    except Exception as e:
        print(f"Error reading Excel file: {e}")
        return None


def filter_missing_data(df: pd.DataFrame, critical_columns: List[str]) -> pd.DataFrame:
    """
    Filter out rows that have missing data in critical columns.
    
    Missing data includes: NaN, None, empty strings, or whitespace-only strings.
    
    Args:
        df (pd.DataFrame): Input DataFrame
        critical_columns (List[str]): Columns that cannot have missing data
        
    Returns:
        pd.DataFrame: Filtered DataFrame with complete data in critical columns
    """
    rows_before = len(df)
    
    # Create a copy to avoid modifying the original
    filtered_df = df.copy()
    
    for col in critical_columns:
        if col not in filtered_df.columns:
            print(f"Warning: Critical column '{col}' not found in data")
            continue
            
        # Check for various types of missing data
        mask_not_null = filtered_df[col].notna()  # Not NaN/None
        mask_not_empty = filtered_df[col].astype(str).str.strip() != ""  # Not empty or whitespace-only
        
        # Keep only rows where both conditions are true
        filtered_df = filtered_df[mask_not_null & mask_not_empty]
    
    rows_after = len(filtered_df)
    rows_removed = rows_before - rows_after
    
    print(f"Filtered out {rows_removed} rows with missing critical data")
    print(f"Remaining rows: {rows_after}")
    
    return filtered_df


def create_mutation_file(df: pd.DataFrame) -> pd.DataFrame:
    """
    Create the mutation.txt format with standardized column names.
    
    Args:
        df (pd.DataFrame): Input DataFrame
        
    Returns:
        pd.DataFrame: DataFrame formatted for mutation.txt
    """
    mutation_df = pd.DataFrame()
    
    # Map your columns to the required mutation file format
    mutation_df['chr'] = df['chromosome']
    mutation_df['pos'] = df['start']
    mutation_df['ref'] = df['reference_allele']
    mutation_df['alt'] = df['alternate_allele']
    mutation_df['sample'] = df['patient']
    
    # Add additional info columns (keeping original names for these)
    additional_columns = ['gene', 'refseq', 'cDNAchange', 'aachange', 'class', 
                         'origin', 'PMID or DOI', 'disease', 
                         'GnomAD population frequency', 'pathogenicity']
    
    for col in additional_columns:
        if col in df.columns:
            mutation_df[col] = df[col]
    
    return mutation_df


def create_annotation_file(df: pd.DataFrame) -> pd.DataFrame:
    """
    Create the gata2Annotation.txt format with Sample, Term id, Value columns.
    Only includes PMID and disease information.
    
    Args:
        df (pd.DataFrame): Input DataFrame
        
    Returns:
        pd.DataFrame: DataFrame formatted for gata2Annotation.txt
    """
    # Only include PMID and disease in the annotation file
    annotation_columns = ["PMID or DOI", "disease"]
    
    annotation_rows = []
    
    # For each row in the original data
    for _, row in df.iterrows():
        sample_id = row['patient']
        
        # Create term-value pairs only for PMID and disease columns
        for col in annotation_columns:
            if col in df.columns and pd.notna(row[col]) and str(row[col]).strip() != "":
                annotation_rows.append({
                    'Sample': sample_id,
                    'Term id': col,
                    'Value': row[col]
                })
    
    return pd.DataFrame(annotation_rows)


def write_tsv_file(df: pd.DataFrame, output_path: str, description: str) -> bool:
    """
    Write a DataFrame to a tab-separated values file.
    
    Args:
        df (pd.DataFrame): DataFrame to write
        output_path (str): Path for the output file
        description (str): Description of the file for logging
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        df.to_csv(output_path, sep='\t', index=False, na_rep='')
        print(f"Successfully wrote {description} to {output_path} ({len(df)} rows)")
        return True
    except Exception as e:
        print(f"Error writing {description}: {e}")
        return False


def main() -> None:
    """
    Main function to orchestrate the Excel to mutation/annotation conversion process.
    """
    # Set up command line argument parsing
    parser = argparse.ArgumentParser(
        description="Convert Excel file to mutation.txt and gata2Annotation.txt files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python excel_converter.py mutations.xlsx
  python excel_converter.py data.xls --output-dir ./results
  python excel_converter.py mutations.xlsx --output-dir /path/to/output
        """
    )
    
    parser.add_argument('input_file', help='Path to input Excel file (.xlsx or .xls)')
    parser.add_argument('--output-dir', default='.',
                       help='Directory for output files (default: current directory)')
    
    args = parser.parse_args()
    
    # Validate input file exists and has correct extension
    input_path = Path(args.input_file)
    if not input_path.exists():
        print(f"Error: Input file '{args.input_file}' does not exist")
        sys.exit(1)
    
    # Check if file extension is supported
    supported_extensions = ['.xlsx', '.xls']
    if input_path.suffix.lower() not in supported_extensions:
        print(f"Error: Unsupported file format '{input_path.suffix}'")
        print(f"Supported formats: {', '.join(supported_extensions)}")
        sys.exit(1)
    
    # Define required columns and critical columns based on your Excel structure
    required_columns = [
        'gene', 'refseq', 'chromosome', 'start', 'reference_allele', 
        'alternate_allele', 'cDNAchange', 'aachange', 'class', 'origin', 
        'patient', 'PMID or DOI', 'disease', 'GnomAD population frequency', 
        'pathogenicity'
    ]
    critical_columns = ['start', 'reference_allele', 'alternate_allele']  # Cannot be missing
    
    # Step 1: Read the Excel file
    print("Step 1: Reading Excel file...")
    df = read_excel_file(args.input_file)
    if df is None:
        sys.exit(1)
    
    # Step 2: Validate required columns
    print("Step 2: Validating required columns...")
    if not validate_required_columns(df, required_columns):
        print("Please check your column names and try again.")
        sys.exit(1)
    
    # Step 3: Filter out rows with missing critical data
    print("Step 3: Filtering rows with missing position or alleles...")
    df = filter_missing_data(df, critical_columns)
    
    if len(df) == 0:
        print("Error: No valid rows remaining after filtering!")
        sys.exit(1)
    
    # Step 4: Create mutation.txt file
    print("Step 4: Creating mutation.txt file...")
    mutation_df = create_mutation_file(df)
    
    # Step 5: Create gata2Annotation.txt file
    print("Step 5: Creating gata2Annotation.txt file...")
    annotation_df = create_annotation_file(df)
    
    # Step 6: Write output files
    print("Step 6: Writing output files...")
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate output filenames
    mutation_file = output_dir / "mutation.txt"
    annotation_file = output_dir / "gata2Annotation.txt"
    
    # Write both files
    success1 = write_tsv_file(mutation_df, str(mutation_file), "mutation data")
    success2 = write_tsv_file(annotation_df, str(annotation_file), "annotation data")
    
    if success1 and success2:
        print(f"\nProcess completed successfully!")
        print(f"Output files:")
        print(f"  - mutation.txt: {mutation_file}")
        print(f"  - gata2Annotation.txt: {annotation_file}")
        print(f"\nSummary:")
        print(f"  - Mutation file: {len(mutation_df)} rows")
        print(f"  - Annotation file: {len(annotation_df)} rows")
    else:
        print("Process completed with errors.")
        sys.exit(1)


if __name__ == "__main__":
    main()