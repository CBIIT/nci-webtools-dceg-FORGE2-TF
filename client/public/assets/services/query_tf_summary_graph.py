#!/usr/bin/env python

import sys
import os
import json
import subprocess
import tempfile
import shutil

root_dir = '/var/www/eforge/forge2-tf/browser/src/client/assets/services'
data_dir = os.path.join(root_dir, 'data')

test_fn = os.path.join(root_dir, 'test.pdf')

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
  
if not 'tf_summary' in form:
  error(400, 'TF summary not specified')
tf_summary = form['tf_summary']

# write TF summary to table
tmp = tempfile.NamedTemporaryFile()
tf_summary_fn = os.path.join(root_dir, 'tmp', os.path.basename(tmp.name))
with open(tf_summary_fn, 'w') as f:
  for row in tf_summary['rows']:
    f.write('\t'.join(row) + '\n')
  
# convert TF summary table to PDF
tf_summary_output_fn = os.path.join(root_dir, 'tmp', tf_summary['output'])
tf_bin = os.path.join(root_dir, 'query_tf_summary_graph.Rscript')
strict = 0.01
marginal = 0.05
cmd = "%s --input=%s --output=%s --strict=%f --marginal=%f" % (tf_bin, tf_summary_fn, tf_summary_output_fn, strict, marginal)
try:
  tf_result = subprocess.check_output(cmd, shell=True)
except subprocess.CalledProcessError as cpe:
  error(400, 'could not perform PDF conversion')
finally:
  os.remove(tf_summary_fn)

with open(os.path.abspath(tf_summary_output_fn), 'r') as fh:
  sys.stdout.write('Status: 200 OK\r\n')
  sys.stdout.write('Content-Type: application/pdf\r\n\r\n')
  shutil.copyfileobj(fh, sys.stdout)

# delete TF summary table and PDF
os.remove(tf_summary_output_fn)
sys.exit(os.EX_OK)
