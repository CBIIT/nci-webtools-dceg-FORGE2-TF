#!/usr/bin/env python

import sys
import os
import json
import subprocess

root_dir = '/var/www/eforge/forge2-tf/browser/src/client/assets/services'
data_dir = os.path.join(root_dir, 'data')
pts_bin = os.path.join(root_dir, 'pts-line-bisect', 'pts_lbsearch')
bedops_dir = '/net/module/sw/bedops/2.4.34-typical/bin'
bedops_bin = os.path.join(bedops_dir, 'bedops')
htslib_dir = '/net/module/sw/htslib/1.7/bin'
tabix_bin = os.path.join('tabix')

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
cmd = "%s -p %s %s | cut -f2-" % (pts_bin, probes_fn, probe_name)
try:
  position_result = subprocess.check_output(cmd, shell=True)
  if position_result:
    elems = position_result.rstrip().split()
    if len(elems) != 3:
      error(400, 'unexpected position result from pts_lbsearch on probes [%s]' % (cmd))
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
sequences_fn = os.path.join(data_dir, array, 'sequence', 'sequences.probe.gz')
if not os.path.exists(sequences_fn):
  error(400, 'could not find sequences archive file [%s]' % (sequences_fn)) 
#cmd = "echo -e '%s\t%s\t%s' | %s -e 1 --chrom %s %s - | cut -f1,6-8" % (position['chromosome'], position['start'], position['stop'], bedops_bin, position['chromosome'], sequences_fn)
cmd = "%s %s %s:%d-%d | cut -f1,6-8" % (tabix_bin, sequences_fn, position['chromosome'], position['start'], position['stop'])
try:
  sequence_result = subprocess.check_output(cmd, shell=True)
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
# query signal by coordinates
# eg. echo -e 'position_result' | bedops -e 1 --chrom <chr> <sample_name>/reduced.probe.starch -
#     tabix <sample_name>/reduced.probe.gz <chr>:<start>-<stop>
#
#signal_fn = os.path.join(data_dir, array, 'signal', sample, 'reduced.probe.starch')
signal_fn = os.path.join(data_dir, array, 'signal', sample, 'reduced.probe.gz')
if not os.path.exists(signal_fn):
  error(400, 'could not find signal archive file [%s]' % (signal_fn))
#cmd = "echo -e '%s\t%s\t%s' | %s -e 1 --chrom %s %s - | cut -f1,6-8" % (position['chromosome'], position['start'], position['stop'], bedops_bin, position['chromosome'], signal_fn)
cmd = "%s %s %s:%d-%d | cut -f1,6-8" % (tabix_bin, signal_fn, position['chromosome'], position['start'], position['stop'])
try:
  signal_result = subprocess.check_output(cmd, shell=True)
  if signal_result:
    elems = signal_result.rstrip().split()
    try:
      signal = [int(x) for x in elems[3].split(",")]
      sig_length = len(signal)
      sig_midpoint_index = int(sig_length/2)
      sig_l_index = sig_midpoint_index - padding
      sig_r_index = sig_midpoint_index + padding + 1
      window['signal'] = signal[sig_l_index:sig_r_index]
    except IndexError as ie:
      error(400, 'could not perform signal archive query [%s] [%s]' % (cmd, ie))
  else:
    error(400, 'empty result from signal archive file query [%s]' % (cmd))
except subprocess.CalledProcessError as cpe:
  error(400, 'could not perform signal archive query [%s] [%s]' % (cmd, cpe))
  
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
  db_fn = os.path.join(data_dir, array, 'tf', db_name, probe_db_fn)
  if not os.path.exists(db_fn):
    error(400, 'could not find TF archive [%s]' % (db_fn))
  #cmd = "echo -e '%s\t%s\t%s' | %s -e 1 --chrom %s %s - " % (position['chromosome'], position['start'], position['stop'], bedops_bin, position['chromosome'], db_fn)
  cmd = "%s %s %s:%d-%d" % (tabix_bin, db_fn, position['chromosome'], position['start'], position['stop'])
  try:
    probe['tf_overlaps'][db_name] = []
    db_query_result = subprocess.check_output(cmd, shell=True)
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
# query footprint sites by coordinates
# eg. echo -e 'position_result' | bedops -e 1 --chrom <chr> <sample_name>/reduced.probe.starch -
#     tabix <sample_name>/reduced.probe.gz <chr>:<start>-<stop>
#
# if annotation_type == 'Probe-only':
#   probe_fp_fn = 'probe.fp.20.gz'
# elif annotation_type == 'All':
#   probe_fp_fn = 'probe.fp.%d.gz' % (int(padding))
probe_fp_fn = 'probe.fp.%d.gz' % (int(padding))
fp_fn = os.path.join(data_dir, array, 'fp', sample, probe_fp_fn)
if not os.path.exists(fp_fn):
  error(400, 'could not find footprint archive file [%s]' % (fp_fn))
cmd = "%s %s %s:%d-%d" % (tabix_bin, fp_fn, position['chromosome'], position['start'], position['stop'])
try:
  probe['fp_overlaps'] = []
  fp_result = subprocess.check_output(cmd, shell=True)
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
      probe['fp_overlaps'] = perhits
    except IndexError as ie:
      pass
  else:
    #error(400, 'empty result from footprint archive file query [%s]' % (cmd))
    pass
except subprocess.CalledProcessError as cpe:
  error(400, 'could not perform footprint archive query [%s] [%s]' % (cmd, cpe))

#
# build final state package
#
probe['window'] = window
state_json = {
  'probe' : probe
}

sys.stdout.write('Status: 200 OK\r\n')
sys.stdout.write('Content-Type: application/json; charset=utf-8\r\n\r\n')
sys.stdout.write(json.dumps(state_json))
sys.exit(os.EX_OK)
