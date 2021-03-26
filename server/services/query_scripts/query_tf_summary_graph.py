#!/usr/bin/env python3

import sys
import os
import json
import subprocess
import tempfile
import shutil

form = json.load(sys.stdin)

def error(code, message):
  raise SystemExit(json.dumps({
    "code": code,
    "message": message
  }))

if not 'tmpDir' in form:
  error(400, 'Tmp directory not specified')
tmp_dir = form['tmpDir']
  
if not 'tf_summary' in form:
  error(400, 'TF summary not specified')
tf_summary = form['tf_summary']

# write TF summary to table
tmp = tempfile.NamedTemporaryFile()
tf_summary_fn = os.path.join(tmp_dir, os.path.basename(tmp.name))
with open(tf_summary_fn, 'w') as f:
  for row in tf_summary['rows']:
    f.write('\t'.join(row) + '\n')
  
# convert TF summary table to PDF
tf_summary_output_fn = os.path.join(tmp_dir, tf_summary['output'])
tf_bin = os.path.join(os.getcwd(), 'services', 'query_scripts', 'query_tf_summary_graph.Rscript')

strict = 0.01
marginal = 0.05
cmd = "%s --input=%s --output=%s --strict=%f --marginal=%f" % (tf_bin, tf_summary_fn, tf_summary_output_fn, strict, marginal)
try:
  tf_result = subprocess.check_output(cmd, shell=True)
except subprocess.CalledProcessError as cpe:
  error(400, 'could not perform PDF conversion')
finally:
  os.remove(tf_summary_fn)

result = {
  'output': os.path.abspath(tf_summary_output_fn)
}
# with open(os.path.abspath(tf_summary_output_fn), 'r') as fh:
#   # sys.stdout.write('Status: 200 OK\r\n')
#   # sys.stdout.write('Content-Type: application/pdf\r\n\r\n')
#   shutil.copyfileobj(fh, resultObj)

print(json.dumps(result))

# delete TF summary table and PDF
# os.remove(tf_summary_output_fn)
sys.exit(os.EX_OK)
