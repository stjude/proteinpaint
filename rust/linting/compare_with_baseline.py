#!/usr/bin/env python3
"""
compare_with_baseline.py - Compare current Clippy output with baseline

This script takes Clippy JSON output and compares it against a baseline file,
identifying only new warnings that weren't present in the baseline. It can handle
compilation errors and still report on warnings found before the build failed.

Usage:
    python3 compare_with_baseline.py [clippy_output]
    
If clippy_output is not provided, it will read from stdin.
"""

import json
import sys
import os
from pathlib import Path
from typing import Dict, List, Set, Tuple, Any

# Path to the baseline file
# BASELINE_PATH = Path("linting/clippy_baseline.json")
BASELINE_PATH = Path(os.environ.get("BASELINE_PATH", "linting/clippy_baseline.json"))
DEBUG = os.environ.get("DEBUG", "0") == "1"

def debug_print(*args, **kwargs):
    """Print debug information if DEBUG is enabled."""
    if DEBUG:
        print("DEBUG:", *args, **kwargs, file=sys.stderr)

def parse_clippy_output(clippy_json: str) -> Tuple[List[Dict[str, Any]], bool]:
    """Parse Clippy JSON output and extract warning messages.
    
    Returns:
        Tuple of (warnings, had_errors)
    """
    warnings = []
    had_errors = False
    
    try:
        # Clippy outputs one JSON object per line
        for line in clippy_json.strip().split('\n'):
            if not line.strip():
                continue
                
            data = json.loads(line)
            
            # Check for errors
            if data.get('reason') == 'compiler-message' and data.get('message', {}).get('level') == 'error':
                had_errors = True
                debug_print("Found compilation error:", data.get('message', {}).get('message', ''))
            
            # Process diagnostic messages that are warnings
            if data.get('reason') == 'compiler-message' and data.get('message', {}).get('level') == 'warning':
                message = data['message']
                
                # Create a normalized warning representation
                warning = {
                    'code': message.get('code', {}).get('code', 'unknown'),
                    'message': message.get('message', ''),
                    'file': message.get('spans', [{}])[0].get('file_name', ''),
                    'line_start': message.get('spans', [{}])[0].get('line_start', 0),
                    'line_end': message.get('spans', [{}])[0].get('line_end', 0),
                    'column_start': message.get('spans', [{}])[0].get('column_start', 0),
                    'column_end': message.get('spans', [{}])[0].get('column_end', 0),
                }
                
                warnings.append(warning)
    except json.JSONDecodeError as e:
        print(f"Error parsing Clippy JSON output: {e}", file=sys.stderr)
        return [], True
    
    return warnings, had_errors

def load_baseline() -> List[Dict[str, Any]]:
    """Load the baseline warnings from the baseline file."""
    if not BASELINE_PATH.exists():
        print(f"Warning: Baseline file {BASELINE_PATH} not found. All warnings will be treated as new.", file=sys.stderr)
        return []
    
    try:
        with open(BASELINE_PATH, 'r') as f:
            content = f.read()
        warnings, _ = parse_clippy_output(content)
        return warnings
    except Exception as e:
        print(f"Error loading baseline file: {e}", file=sys.stderr)
        return []

def create_warning_fingerprint(warning: Dict[str, Any]) -> str:
    """Create a unique fingerprint for a warning to enable comparison."""
    return f"{warning['code']}|{warning['file']}|{warning['line_start']}|{warning['message']}"

def find_new_warnings(current_warnings: List[Dict[str, Any]], baseline_warnings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Identify warnings that are in current_warnings but not in baseline_warnings."""
    baseline_fingerprints = {create_warning_fingerprint(w) for w in baseline_warnings}
    
    new_warnings = []
    for warning in current_warnings:
        fingerprint = create_warning_fingerprint(warning)
        if fingerprint not in baseline_fingerprints:
            new_warnings.append(warning)
    
    return new_warnings

def format_warning(warning: Dict[str, Any]) -> str:
    """Format a warning for display."""
    return f"{warning['file']}:{warning['line_start']}:{warning['column_start']}: warning: {warning['message']} [{warning['code']}]"

def main():
    # Read Clippy output from stdin or command line argument
    if len(sys.argv) > 1:
        clippy_output = sys.argv[1]
    else:
        clippy_output = sys.stdin.read()
    
    # Parse current warnings and baseline
    current_warnings, had_errors = parse_clippy_output(clippy_output)
    baseline_warnings = load_baseline()
    
    debug_print(f"Found {len(current_warnings)} warnings in current output")
    debug_print(f"Found {len(baseline_warnings)} warnings in baseline")
    
    # Find new warnings
    new_warnings = find_new_warnings(current_warnings, baseline_warnings)
    
    # Report results
    if had_errors:
        print("⚠️ Compilation errors occurred. Some warnings may not have been detected.", file=sys.stderr)
        
    if new_warnings:
        print(f"Found {len(new_warnings)} new warning(s) that are not in the baseline:", file=sys.stderr)
        for warning in new_warnings:
            print(format_warning(warning), file=sys.stderr)
        sys.exit(1)
    else:
        if had_errors:
            print("No new warnings found in the parts that compiled successfully! 🎉", file=sys.stderr)
            print("Fix compilation errors to get a complete analysis.", file=sys.stderr)
            sys.exit(0)  # We'll still exit with 0 since no new warnings were found
        else:
            print("No new warnings found! 🎉", file=sys.stderr)
            sys.exit(0)

if __name__ == "__main__":
    main()