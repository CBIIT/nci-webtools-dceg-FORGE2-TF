#!/usr/bin/env python

import sys
import os
import json
import subprocess
import tempfile

root_dir = '/var/www/eforge/forge2-tf/browser/src/client/assets/services'
data_dir = os.path.join(root_dir, 'data')

array_probe_counts = {
  'All' : 37964763
}

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

array = tf_summary['array']
probes_obj = {'probes' : tf_summary['probes']}
fdr_threshold = float(tf_summary['fdrThreshold'])
count = int(array_probe_counts[array])
n_tests = int(tf_summary['nTests'])

tf_bin = os.path.join(data_dir, array, 'tf', 'query_probes.py')
tmp = tempfile.NamedTemporaryFile()
probes_fn = os.path.join(root_dir, 'tmp', os.path.basename(tmp.name))
with open(probes_fn, 'w') as f:
  json.dump(probes_obj, f)

cmd = "%s %s %d %f %d" % (tf_bin, probes_fn, count, fdr_threshold, n_tests)
try:
  pvals_result = subprocess.check_output(cmd, shell=True)
except subprocess.CalledProcessError as cpe:
  error(400, 'could not perform p-value/q-value query [%s] [%s] [%s]' % (cmd, probes_fn, cpe))
finally:
  os.remove(probes_fn)

summary_json = {
  'summary' : pvals_result
}

sys.stdout.write('Status: 200 OK\r\n')
sys.stdout.write('Content-Type: application/json; charset=utf-8\r\n\r\n')
sys.stdout.write(json.dumps(pvals_result))
sys.exit(os.EX_OK)
