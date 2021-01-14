#!/usr/bin/env python

import sys
import os
import json
import subprocess
import ast

root_dir = '/var/www/eforge/forge2-tf/browser/src/client/assets/services'
data_dir = os.path.join(root_dir, 'data')
offsets_dir = '/net/seq/data/projects/eForge/www/forge2-tf/browser/src/client/assets/services/data/All/offsets'
offsets_fn = os.path.join(offsets_dir, 'offsets.txt')
pts_bin = os.path.join(root_dir, 'pts-line-bisect', 'pts_lbsearch')
bedops_dir = '/net/module/sw/bedops/2.4.35-typical/bin'
bedops_bin = os.path.join(bedops_dir, 'bedops')
htslib_dir = '/net/module/sw/htslib/1.7/bin'
tabix_bin = os.path.join('tabix')

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

form = json.load(sys.stdin)

def error(type, msg):
  if type == 400:
    sys.stdout.write('Status: 400 Bad Request\r\n')
  else:
    sys.stdout.write('Status: 400 Bad Request\r\n')
  sys.stdout.write('Content-Type: application/json\r\n\r\n')
  sys.stdout.write(json.dumps(
    { 'msg' : '%s' % (msg) }
  ))
  sys.exit(os.EX_USAGE)
  
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

#
# query
#

cmd = "%s -p %s %s | head -1 | cut -f2-" % (pts_bin, offsets_fn, tfModel)
try:
  overlap_result = subprocess.check_output(cmd, shell=True)
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

sys.stdout.write('Status: 200 OK\r\n')
sys.stdout.write('Content-Type: application/json; charset=utf-8\r\n\r\n')
sys.stdout.write(json.dumps(overlaps_json))
sys.exit(os.EX_OK)
