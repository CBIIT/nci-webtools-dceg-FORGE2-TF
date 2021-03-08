#!/usr/bin/env python3

import sys
import os
import json
import subprocess
import boto3
import botocore
from operator import add

tabix_bin = os.path.join('tabix')
pts_bin = os.path.join('pts_lbsearch')

probe_fns = {
  'All' : 'probes.bed.idsort.txt'
}

tf_databases = [
  'jaspar',
  'taipale',
  'uniprobe',
  'xfac'
]

form = json.load(sys.stdin)

if not 'dataDir' in form:
  error(400, 'Data directory not specified')
data_dir = form['dataDir']

if not 'awsInfo' in form:
  error(400, 'AWS info not specified')
aws_info = form['awsInfo']

if not 'settings' in form:
  error(400, 'Settings not specified')
settings = form['settings']

if not 'array' in settings:
  error(400, 'Array not specified')
array = settings['array']

if not 'sample' in settings:
  error(400, 'Sample not specified')
sample = settings['sample']

if not 'currentProbe' in settings:
  error(400, 'Probe selection not specified')
probe_name = settings['currentProbe']
  
if not 'padding' in settings:
  error(400, 'Padding not specified')
padding = settings['padding']

if not 'smoothing' in settings:
  error(400, 'Smoothing not specified')
smoothing = settings['smoothing']

if not 'signalType' in settings:
  error(400, 'Signal type not specified')
signal_type = settings['signalType']

if not 'annotationType' in settings:
  error(400, 'Annotation type not specified')
annotation_type = settings['annotationType']

sample_md_fns = {
  'All' : os.path.join(data_dir, 'All/fp/filtered_sample_aggregates.json')
}

def error(code, message):
  raise SystemExit(json.dumps({
    "code": code,
    "message": message
  }))

def checkS3File(bucket, filePath):
  if ('aws_access_key_id' in aws_info and len(aws_info['aws_access_key_id']) > 0 and 'aws_secret_access_key' in aws_info and len(aws_info['aws_secret_access_key']) > 0):
    session = boto3.Session(
      aws_access_key_id=aws_info['aws_access_key_id'],
      aws_secret_access_key=aws_info['aws_secret_access_key'],
    )
    s3 = session.resource('s3')
  else: 
    s3 = boto3.resource('s3')
  try:
    s3.Object(bucket, filePath).load()
  except botocore.exceptions.ClientError as e:
    if e.response['Error']['Code'] == "404":
      return False
    else:
      return False
  else: 
    return True

if ('aws_access_key_id' in aws_info and len(aws_info['aws_access_key_id']) > 0 and 'aws_secret_access_key' in aws_info and len(aws_info['aws_secret_access_key']) > 0):
  export_s3_keys = "export AWS_ACCESS_KEY_ID=%s AWS_SECRET_ACCESS_KEY=%s;" % (aws_info['aws_access_key_id'], aws_info['aws_secret_access_key'])
else:
  export_s3_keys = ""

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

probe = { 
  'name' : probe_name,
  'array' : array,
  'padding' : padding,
  'smoothing' : smoothing,
  'signal_type' : signal_type,
  'tf_overlaps' : {},
  'window' : {}
}
window = {}

#
# get genomic coordinates of probe
# eg. ./pts_lbsearch -p ../signal/GM12878-DS10671/reduced.probe.idsort.txt cg01914153
#
probes_fn = os.path.join(data_dir, array, 'probes', probe_fns[array])
if not os.path.exists(probes_fn):
  error(400, 'could not find id-sorted probes BED file [%s]' % (probes_fn))
# cmd = "%s -p %s %s | cut -f2-" % (pts_bin, probes_fn, probe_name)
cmd = "%s -p %s %s | cut -f2-" % (pts_bin, probes_fn, probe_name)
try:
  position_result = subprocess.check_output(cmd, shell=True).decode('utf-8')
  if position_result:
    elems = position_result.rstrip().split()
    if len(elems) < 3:
      error(400, 'unexpected position result from pts_lbsearch on probes [%s] | %s' % (cmd, str(elems)))
    try:
      position = {}
      position['chromosome'] = elems[0]
      position['start'] = int(elems[1])
      position['stop'] = int(elems[2])
      probe['position'] = position
    except TypeError as te:
      error(400, 'unexpected position result from pts_lbsearch on probes [%s]' % (cmd))
  else:
    error(400, 'empty result from pts_lbsearch on probes [%s]' % (cmd))
except subprocess.CalledProcessError as cpe:
  error(400, 'could not perform pts_lbsearch on probes [%s] [%s]' % (cmd, cpe))
  
#
# query sequence by coordinates
# eg. echo -e '<chr>\t<start>\t<stop>' | bedops -e 1 --chrom <chr> sequences.starch - 
#     tabix sequences.gz <chr>:<start>-<stop>
#
#sequences_fn = os.path.join(data_dir, array, 'sequence', 'sequences.probe.starch')

sequences_filePath = "/".join([aws_info['s3']['subFolder'], 'data', array, 'sequence', 'sequences.probe.gz'])
sequences_fn = "s3://%s/%s" % (aws_info['s3']['bucket'], sequences_filePath)
if not checkS3File(aws_info['s3']['bucket'], sequences_filePath):
  error(400, 'could not find sequences archive file [%s]' % (sequences_fn))
sequences_idx_filePath = os.path.join(data_dir, array, 'sequence') 

#cmd = "echo -e '%s\t%s\t%s' | %s -e 1 --chrom %s %s - | cut -f1,6-8" % (position['chromosome'], position['start'], position['stop'], bedops_bin, position['chromosome'], sequences_fn)
cmd = "(%s cd %s; %s %s %s:%d-%d %s | cut -f1,6-8)" % (export_s3_keys, sequences_idx_filePath, tabix_bin, sequences_fn, position['chromosome'], position['start'], position['stop'], '-D')
try:
  sequence_result = subprocess.check_output(cmd, shell=True).decode('utf-8')
  if sequence_result:
    elems = sequence_result.rstrip().split()
    window['range'] = {}
    window['range']['chromosome'] = elems[0]
    window['range']['start'] = int(elems[1])
    window['range']['stop'] = int(elems[2])
    sequence = list(elems[3])
    seq_length = len(sequence)
    seq_midpoint_index = int(seq_length/2)
    seq_l_index = seq_midpoint_index - padding
    seq_r_index = seq_midpoint_index + padding + 1
    window['sequence'] = sequence[seq_l_index:seq_r_index]
  else:
    error(400, 'empty result from sequences archive file query [%s]' % (cmd))
except subprocess.CalledProcessError as cpe:
  error(400, 'could not perform sequence archive query [%s] [%s]' % (cmd, cpe))

#
# query per-experiment signal by coordinates and per-experiment metadata
# eg. echo -e 'position_result' | bedops -e 1 --chrom <chr> <sample_name>/reduced.probe.starch -
#     tabix <sample_name>/reduced.probe.gz <chr>:<start>-<stop>
#
per_experiment_sample_signal_accumulator = []
for per_experiment_sample in per_experiment_samples:
  #signal_fn = os.path.join(data_dir, array, 'signal', sample, 'reduced.probe.starch')
  signal_filePath = "/".join([aws_info['s3']['subFolder'], 'data', array, 'signal', per_experiment_sample, 'reduced.probe.gz'])
  signal_fn = "s3://%s/%s" % (aws_info['s3']['bucket'], signal_filePath)
  if not checkS3File(aws_info['s3']['bucket'], signal_filePath):
    error(400, 'could not find signal archive file [%s]' % (signal_fn))
  signal_idx_filePath = os.path.join(data_dir, array, 'signal', per_experiment_sample) 

  cmd = "(%s cd %s; %s %s %s:%d-%d %s| cut -f1,6-8)" % (export_s3_keys, signal_idx_filePath, tabix_bin, signal_fn, position['chromosome'], position['start'], position['stop'], '-D')

  try:
    signal_result = subprocess.check_output(cmd, shell=True, stderr=subprocess.STDOUT).decode('utf-8')

    if signal_result:
      elems = signal_result.rstrip().split()
      try:
        signal = [float(x) for x in elems[3].split(",")]
        sig_length = len(signal)
        sig_midpoint_index = int(sig_length/2)
        sig_l_index = sig_midpoint_index - padding
        sig_r_index = sig_midpoint_index + padding + 1
        #window['signal'] = signal[sig_l_index:sig_r_index]
        if len(per_experiment_sample_signal_accumulator) == 0:
          per_experiment_sample_signal_accumulator = signal[sig_l_index:sig_r_index]
        else:
          per_experiment_sample_signal_accumulator = list(map(add, per_experiment_sample_signal_accumulator, signal[sig_l_index:sig_r_index]))
      except IndexError as ie:
        error(400, 'could not perform signal archive query [%s] [%s]' % (cmd, ie))
    else:
      error(400, 'empty result from signal archive file query [%s]' % (cmd))
  except subprocess.CalledProcessError as cpe:
    error(400, 'could not perform signal archive query [%s] [%s]' % (cmd, cpe))

pesl = float(len(per_experiment_samples))
per_experiment_sample_signal_accumulator = [x/pesl for x in per_experiment_sample_signal_accumulator]
window['signal'] = per_experiment_sample_signal_accumulator

#
# query TF binding sites by coordinates
# eg. echo -e 'position_result' | bedops -e 1 --chrom <chr> <db_name>/probe.db.starch -
#     tabix <db_name>/probe.db.gz <chr>:<start>-<stop>
#

for db_name in tf_databases:
  #db_fn = os.path.join(data_dir, array, 'tf', db_name, 'probe.db.starch')
  if annotation_type == 'Probe-only':
    probe_db_fn = 'probe.db.20.gz'
  elif annotation_type == 'All':
    probe_db_fn = 'probe.db.%d.gz' % (int(padding))

  db_filePath = "/".join([aws_info['s3']['subFolder'], 'data', array, 'tf', db_name, probe_db_fn])
  db_fn = "s3://%s/%s" % (aws_info['s3']['bucket'], db_filePath)
  if not checkS3File(aws_info['s3']['bucket'], db_filePath):
    error(400, 'could not find TF archive [%s]' % (db_fn))
  db_idx_filePath = os.path.join(data_dir, array, 'tf', db_name) 

  #cmd = "echo -e '%s\t%s\t%s' | %s -e 1 --chrom %s %s - " % (position['chromosome'], position['start'], position['stop'], bedops_bin, position['chromosome'], db_fn)
  cmd = "(%s cd %s; %s %s %s:%d-%d %s)" % (export_s3_keys, db_idx_filePath, tabix_bin, db_fn, position['chromosome'], position['start'], position['stop'], '-D')
  try:
    probe['tf_overlaps'][db_name] = []
    db_query_result = subprocess.check_output(cmd, shell=True).decode('utf-8')
    if db_query_result:
      elems = db_query_result.rstrip().split('|')
      hits = elems[1]
      perhits = []
      for hit in hits.split(';'):
        perhit_elems = hit.split('\t')
        perhit = {}
        perhit['chromosome'] = perhit_elems[0]
        perhit['start'] = int(perhit_elems[1])
        perhit['stop'] = int(perhit_elems[2])
        perhit['id'] = perhit_elems[3]
        perhit['score'] = float(perhit_elems[4])
        perhit['strand'] = perhit_elems[5]
#         perhit['sequence'] = perhit_elems[6]
        if annotation_type == 'Probe-only':
          if perhit['start'] <= position['start'] and perhit['stop'] > position['stop']:
            perhits.append(perhit)
        elif annotation_type == 'All':
          perhits.append(perhit)
      probe['tf_overlaps'][db_name] = perhits
    else:
      pass
  except subprocess.CalledProcessError as cpe:
    error(400, 'could not perform TF query [%s] [%s]' % (cmd, cpe))

#
# query per-experiment footprint sites by coordinates and per-experiment metadata
# eg. echo -e 'position_result' | bedops -e 1 --chrom <chr> <sample_name>/reduced.probe.starch -
#     tabix <sample_name>/reduced.probe.gz <chr>:<start>-<stop>
#
per_experiment_sample_fp_overlaps_accumulator = []
for per_experiment_sample in per_experiment_samples:
  # if annotation_type == 'Probe-only':
  #   probe_fp_fn = 'probe.fp.20.gz'
  # elif annotation_type == 'All':
  #   probe_fp_fn = 'probe.fp.%d.gz' % (int(padding))
  probe_fp_fn = 'probe.fp.%d.gz' % (int(padding))

  fp_filePath = "/".join([aws_info['s3']['subFolder'], 'data', array, 'fp', per_experiment_sample, probe_fp_fn])
  fp_fn = "s3://%s/%s" % (aws_info['s3']['bucket'], fp_filePath)
  if not checkS3File(aws_info['s3']['bucket'], fp_filePath):
    error(400, 'could not find footprint archive file [%s]' % (fp_fn))
  fp_idx_filePath = os.path.join(data_dir, array, 'fp', per_experiment_sample) 

  cmd = "(%s cd %s; %s %s %s:%d-%d %s)" % (export_s3_keys, fp_idx_filePath, tabix_bin, fp_fn, position['chromosome'], position['start'], position['stop'], '-D')
  try:
    probe['fp_overlaps'] = []
    fp_result = subprocess.check_output(cmd, shell=True).decode('utf-8')
    if fp_result:
      try:
        elems = fp_result.rstrip().split('|')
        hits = elems[1]
        perhits = []
        for hit in hits.split(';'):
          perhit_elems = hit.split('\t')
          perhit = {}
          perhit['chromosome'] = perhit_elems[0]
          perhit['start'] = int(perhit_elems[1])
          perhit['stop'] = int(perhit_elems[2])
          perhits.append(perhit)
  #         if annotation_type == 'Probe-only':
  #           if perhit['start'] <= position['start'] and perhit['stop'] > position['stop']:
  #             perhits.append(perhit)
  #         elif annotation_type == 'All':
  #           perhits.append(perhit)
        #probe['fp_overlaps'] = perhits
        per_experiment_sample_fp_overlaps_accumulator.extend(perhits)
      except IndexError as ie:
        pass
    else:
      #error(400, 'empty result from footprint archive file query [%s]' % (cmd))
      pass
  except subprocess.CalledProcessError as cpe:
    error(400, 'could not perform footprint archive query [%s] [%s]' % (cmd, cpe))

probe['fp_overlaps'] = per_experiment_sample_fp_overlaps_accumulator

#
# build final state package
#
probe['window'] = window
state_json = {
  'probe' : probe
}

print(json.dumps(state_json))
sys.exit(0)
