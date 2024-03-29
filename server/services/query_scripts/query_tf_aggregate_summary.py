#!/usr/bin/env python3

import sys
import os
import json
import subprocess
from operator import add

form = json.load(sys.stdin)

def error(code, message):
  raise SystemExit(json.dumps({
    "code": code,
    "message": message
  }))

if not 'dataDir' in form:
  error(400, 'Data directory not specified')
data_dir = form['dataDir']
  
if not 'tf_aggregate_summary' in form:
  error(400, 'TF aggregate summary not specified')
tfAggregateSummary = form['tf_aggregate_summary']

if not 'array' in tfAggregateSummary:
  error(400, 'Array not specified')
array = tfAggregateSummary['array']

if not 'tfModel' in tfAggregateSummary:
  error(400, 'TF model name not specified')
tfModel = tfAggregateSummary['tfModel']

if not 'sample' in tfAggregateSummary:
  error(400, 'Sample not specified')
sample = tfAggregateSummary['sample']

if not 'padding' in tfAggregateSummary:
  error(400, 'Padding not specified')
padding = tfAggregateSummary['padding']

if not 'smoothing' in tfAggregateSummary:
  error(400, 'Smoothing not specified')
smoothing = tfAggregateSummary['smoothing']

if not 'signalType' in tfAggregateSummary:
  error(400, 'Signal type not specified')
signalType = tfAggregateSummary['signalType']

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
# for processing samples in aggregate, we:
#
# 1. read in sample metadata for the specified array
# 2. chop up the 'sample' variable to get the sample prefix
# 3. get all qualifying per-experiment samples for the specified prefix
# 4. use this for all per-experiment queries
# 5. aggregate over all queries
#

try:
  with open(sample_md_fns[array], "r") as smfh:
    sample_md = json.load(smfh)
except EnvironmentError as ee:
  error(404, 'could not find sample metadata fn [%s]' % (sample_md_fns[array]))

(sample_prefix, ds_suffix) = sample.split('-')
try:
  per_experiment_samples = sample_md['samples'][sample_prefix]
except KeyError as ke:
  error(404, 'could not find sample metadata for sample prefix [%s]' % (sample_prefix))

#
# write JSON payload
#
samplePrefix = sample.split('-')[0]
aggregate = { 
  'samplePrefix' : samplePrefix,
  'tfModel' : tfModel,
  'padding' : padding,
  'smoothing' : smoothing,
  'signalType' : signalType,
  'vectors' : {},
  'signal' : []
}

#
# clean motif model name
# 
tfModel = tfModel.replace('.', '_')
if tfModel.startswith('MA'):
  elems = tfModel.split('-')
  tfModel = elems[0]

#
# filter sample_md by samplePrefix (pattern: "all.fHeart-DS23853E.hg19.SPIC_ETS_1.cc.txt")
#
aggregate['samples'] = sample_md['samples'][samplePrefix]

#
# get signal vectors from vector data directory
# example filename pattern: "all.fHeart-DS23853E.hg19.SPIC_ETS_1.cc.txt"
# vector dir: "/net/seq/data/projects/eForge/www/eforge-tf/browser/src/client/assets/services/data/Illumina_850k_EPIC/aggregate/results/vectors/"
#
vectorDir = os.path.join(data_dir, array, 'aggregate', 'results', 'vectors')
vectorFns = []
vectorSignals = []
vectorAggregate = None
for sample in aggregate['samples']:
  vectorFn = os.path.join(vectorDir, 'all.%s.hg19.%s.cc.txt' % (sample, tfModel))
  if os.path.exists(vectorFn):
    vectorFns.append(vectorFn)
    with open(vectorFn, 'r') as vfh:
      signals = [float(x) for x in vfh.read().rstrip().split('\t')]
      vectorSignals.append(signals)
    if not vectorAggregate:
      vectorAggregate = signals
    else:
      vectorAggregate = map(add, vectorAggregate, signals)
  else:
    error(404, 'could not find vector fn [%s]' % (vectorFn))
psl = float(len(vectorSignals))
vectorAggregate = [x/psl for x in vectorAggregate]
aggregate['vectors']['perSampleFns'] = vectorFns
aggregate['vectors']['perSampleSignals'] = vectorSignals
aggregate['vectors']['aggregate'] = vectorAggregate
aggregate['signal'] = vectorAggregate

#
# build final state package
#
aggregate_json = {
  'aggregate' : aggregate
}

# sys.stdout.write('Status: 200 OK\r\n')
# sys.stdout.write('Content-Type: application/json; charset=utf-8\r\n\r\n')
# sys.stdout.write(json.dumps(aggregate_json))
# sys.exit(os.EX_OK)

print(json.dumps(aggregate_json))
sys.exit(0)
