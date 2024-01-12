from datetime import datetime
from typing import List, Optional
import typer, pango_aliasor
from watch import File, DB, toot
import requests

def insertNodeIntoTree(node, parentName, newNode):
  if node['name'] == parentName:
    node['children'].append(newNode)
  elif node['children']:
    for child in node['children']:
      insertNodeIntoTree(child, parentName, newNode)

def load_alias_key():
    import urllib.request, json

    with urllib.request.urlopen(
        "https://raw.githubusercontent.com/cov-lineages/pango-designation/master/pango_designation/alias_key.json"
    ) as data:
        file = json.load(data)
    return file 

def clean_parents(lineages, uncompressor):
    parents = []
    for lineage in lineages:
        lineage = lineage.replace('*', '')
        if '/' in lineage:
            # "BA.4/5"
            first, second = lineage.split('/')
            parents.append(first)
            parents.append(f"{first[:-1]}{second}")
        else:
            parents.append(lineage)
    return [uncompressor(p) for p in parents]
    
def tree():
    from pango_aliasor.aliasor import Aliasor
    import json 
    aliasor = Aliasor()
    db = DB(path="db.json")
    last_file = db.get_last()
    last_text = last_file.text
    lineages = []
    groups = []
    alias_key = load_alias_key()
    for i, line in enumerate(last_text.split('\n')):
        if not line or i == 0:
            # skip header and EOF
            continue
        compressed_lineage = line.split('\t')[0].split()[0]
        if compressed_lineage.startswith('*'): # remove withdrawn
            continue
        uncompressed_lineage = aliasor.uncompress(compressed_lineage)
        # process recombinants but only XBB not XBB.1
        if uncompressed_lineage.startswith('X') and len(compressed_lineage.split('.')) == 1: 
            # base lineage e.g. XBB
            unclean_parents = alias_key[compressed_lineage]
            parents = clean_parents(unclean_parents, uncompressor=aliasor.uncompress)
            # unique and order
            parents = sorted(list(set(parents)), reverse=True)
            lineages.append({"compressed_name":compressed_lineage,"name":uncompressed_lineage, "recombinant": True, "parents": parents})
        else:
            lineages.append({"compressed_name":compressed_lineage,"name":uncompressed_lineage, "recombinant": False})

    root = {'name':'root', 'children':[], 'compressed_name': 'SARS-CoV-2', 'group': None}
    # build tree
    for i, lineage in enumerate(lineages):
        if lineage['recombinant']:
            # recombinant
            parent = lineage['parents'][0].split(".")
            node = {
                    'name': lineage['name'], 
                    'children': [], 
                    'compressed_name':lineage['compressed_name'], 
                    'otherParents': lineage['parents'][1:],
                }
        else:
            parts = lineage['name'].split(".")
            *parent, end = parts
            node = {'name': lineage['name'], 'children': [], 'compressed_name':lineage['compressed_name']}
        group: str = node['compressed_name'].split('.')[0]
        if node['name'].startswith('X'):
            group = 'Recombinant'
        if group not in groups:
            groups.append(group)
        node['group'] = groups.index(group)
        if not parent:
            insertNodeIntoTree(root, 'root', node)
            continue
        insertNodeIntoTree(root, ".".join(parent), node)

    with open('data.json', 'w') as f:
        json.dump(root, f)