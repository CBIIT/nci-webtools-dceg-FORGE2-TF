#!/usr/bin/env python3

import sys
import os
import json
import subprocess
import tempfile

array_probe_counts = {
  'All' : 37964763
}

form = json.load(sys.stdin)

# def error(type, msg):
#   if type == 400:
#     sys.stdout.write('Status: 400 Bad Request\r\n')
#   else:
#     sys.stdout.write('Status: 400 Bad Request\r\n')
#   sys.stdout.write('Content-Type: application/json\r\n\r\n')
#   sys.stdout.write(json.dumps(
#     { 'msg' : '%s' % (msg) }
#   ))
#   sys.exit(os.EX_USAGE)

def error(code, message):
  raise SystemExit(json.dumps({
    "code": code,
    "message": message
  }))

if not 'dataDir' in form:
  error(400, 'Data directory not specified')
data_dir = form['dataDir']

if not 'tmpDir' in form:
  error(400, 'Tmp directory not specified')
tmp_dir = form['tmpDir']

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
probes_fn = os.path.join(tmp_dir, os.path.basename(tmp.name))
with open(probes_fn, 'w') as f:
  json.dump(probes_obj, f)

cmd = "python3 %s %s %d %f %d %s" % (tf_bin, probes_fn, count, fdr_threshold, n_tests, data_dir)
try:
  pvals_result = subprocess.check_output(cmd, shell=True).decode('utf-8')
except subprocess.CalledProcessError as cpe:
  error(400, 'could not perform p-value/q-value query [%s] [%s] [%s]' % (cmd, probes_fn, cpe))
finally:
  os.remove(probes_fn)

summary_json = {
  'summary' : pvals_result
}

# sys.stdout.write('Status: 200 OK\r\n')
# sys.stdout.write('Content-Type: application/json; charset=utf-8\r\n\r\n')
# sys.stdout.write(json.dumps(pvals_result))
# sys.exit(os.EX_OK)

print(json.dumps(pvals_result))
sys.exit(0)

