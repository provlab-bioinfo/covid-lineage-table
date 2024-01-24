# covid-lineage-table
 [![Lifecycle: WIP](https://img.shields.io/badge/lifecycle-WIP-yellow.svg)](https://lifecycle.r-lib.org/articles/stages.html#experimental) [![Contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/provlab-bioinfo/covid-lineage-table/issues) [![License: GPL3](https://img.shields.io/badge/license-GPL3-lightgrey.svg)](https://www.gnu.org/licenses/gpl-3.0.en.html) [![minimal Python version: 3.10](https://img.shields.io/badge/Python-3.10-6666ff.svg)](https://www.python.org/) [![Package Version = 0.0.1](https://img.shields.io/badge/Package%20version-0.0.1-orange.svg?style=flat-square)](https://github.com/provlab-bioinfo/covid-lineage-table/blob/main/NEWS) [![Last-changedate](https://img.shields.io/badge/last%20change-2023--11--03-yellowgreen.svg)](https://github.com/provlab-bioinfo/covid-lineage-table/blob/main/NEWS)

## Introduction

Based on [pango-watch](https://github.com/MDU-PHL/pango-watch), this tool visualizes SARS-CoV-2 lineages and creates a reference table for heirarchical grouping of SARS-CoV-2 lineages. As a single document, synchronizing lineage groupings between different groups/entities becomes much simpler, and can more easily be integrated into different platforms and programming languages.

## Table of Contents

- [Introduction](#introduction)
- [Quick-Start Guide](#quick-start%guide)
- [Usage](#usage)
- [Output](#output)
- [References](#references)

## Quick-Start Guide

Generate the up-to-date tree and host the webpage:
```bash
cd <path/to/covid-lineage-table/>
python generateTree.py
python -m http.server
```

In your browser:
```
http://localhost:8000/
```

![covid-lineage-table in browser](./lineage-tree.jpg)

## Usage

Each SARS-CoV-2 strain is represented as a node, with branches leading to its parent and child strains. The color of the node determines how it is going to be grouping in the reference table:

    - Green: A grouping strain    
    - Yellow: A strain to be grouped as 'Other' or 'Recombinant Other' (if derived from an X** variant)
    - Red: Ignored strains that will be grouped into the next nearest unignored parent strain.
    - Blue: New strains that have been added to pango since the the last reference table was generated. Only seen if a reference table is imported.

## Output

An exported table has the format of:
```
name             [SARS-CoV-2 strain identifier]
alias            [Pangolin alias]
clade            [NextClade designation]
grouping         [The parent strain grouping]
label            [Indicates 'Other' strains]
designationDate  [Date of strain designation]
```

## References

1. O’Toole, Áine, et al. "Assignment of epidemiological lineages in an emerging pandemic using the pangolin tool." Virus evolution 7.2 (2021): veab064.

2. Aksamentov, Ivan, et al. "Nextclade: clade assignment, mutation calling and quality control for viral genomes." Journal of open source software 6.67 (2021): 3773.
