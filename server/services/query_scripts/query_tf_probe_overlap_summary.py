#!/usr/bin/env python3

import sys
import os
import json
import subprocess
import ast

pts_bin = os.path.join('pts_lbsearch')

form = json.load(sys.stdin)

def error(code, message):
  raise SystemExit(json.dumps({
    "code": code,
    "message": message
  }))

if not 'dataDir' in form:
  error(400, 'Data directory not specified')
data_dir = form['dataDir']
  
if not 'tf_probe_overlap_summary' in form:
  error(400, 'Overlap summary not specified')
overlapSummary = form['tf_probe_overlap_summary']

if not 'array' in overlapSummary:
  error(400, 'Array not specified')
array = overlapSummary['array']

if not 'tfModel' in overlapSummary:
  error(400, 'TF model name not specified')
tfModel = overlapSummary['tfModel']

if not 'padding' in overlapSummary:
  error(400, 'Padding not specified')
padding = overlapSummary['padding']

offsets_fn = os.path.join(data_dir, 'All/offsets/offsets.txt')

probe_fns = {
  'All' : 'probes.bed.idsort.txt'
}

sample_md_fns = {
  'All' : os.path.join(data_dir, 'All/fp/filtered_sample_aggregates.json')
}

tf_databases = [
  'jaspar',
  'taipale',
  'uniprobe',
  'xfac'
]

#
# query
#

cmd = "%s -p %s %s | head -1 | cut -f2-" % (pts_bin, offsets_fn, tfModel)
try:
  overlap_result = subprocess.check_output(cmd, shell=True).decode('utf-8')
  if overlap_result:
    elems = overlap_result.rstrip('\n').split('\t')
    if len(elems) != 1:
      error(400, 'unexpected overlap result from pts_lbsearch on offsets [%d] [%s]' % (len(elems), cmd))
    try:
      overlaps = {}
      overlaps['tfModel'] = tfModel
      overlaps['array'] = array
      overlaps['padding'] = padding
      overlaps['probes'] = ast.literal_eval(elems[0])
    except TypeError as te:
      error(400, 'unexpected overlap type error from pts_lbsearch on probes [%s] [%s]' % (te, cmd))
  else:
    overlaps = {}
except subprocess.CalledProcessError as cpe:
  error(400, 'could not perform pts_lbsearch on probes [%s] [%s]' % (cmd, cpe))

#
# build final state package
#
overlaps_json = {
  'overlaps' : overlaps
}

# sys.stdout.write('Status: 200 OK\r\n')
# sys.stdout.write('Content-Type: application/json; charset=utf-8\r\n\r\n')
# sys.stdout.write(json.dumps(overlaps_json))
# sys.exit(os.EX_OK)

print(json.dumps(overlaps_json))
sys.exit(0)