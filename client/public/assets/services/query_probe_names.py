#!/usr/bin/env python

import sys
import os
import json
import sqlite3

root_dir = '/var/www/eforge/forge2-tf/browser/src/client/assets/services'
data_dir = os.path.join(root_dir, 'data')
pts_bin = os.path.join(root_dir, 'pts-line-bisect', 'pts_lbsearch')
bedops_dir = '/net/module/sw/bedops/2.4.34-typical/bin'
bedops_bin = os.path.join(bedops_dir, 'bedops')
htslib_dir = '/net/module/sw/htslib/1.7/bin'
tabix_bin = os.path.join('tabix')

array_ids = {
  'All' : 1
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

if not 'settings' in form:
  error(400, 'Settings not specified [%s]' % (form))
settings = form['settings']

if not 'array' in settings:
  error(400, 'Array not specified [%s]' % (settings))
array = settings['array']

if not 'probes' in settings:
  error(400, 'Array not specified [%s]' % (settings))
probes = settings['probes']

sqlite_fn = os.path.join(data_dir, array, 'probes', 'probes.db')
if not os.path.exists(sqlite_fn):
  error(400, 'could not find probes SQL database file [%s]' % (sqlite_fn))
  
conn = sqlite3.connect(sqlite_fn)
array_id = array_ids[array]
table_name = 'probes'
c = conn.cursor()
query = "SELECT probe_name FROM %s WHERE array_id = %d AND probe_name IN (%s)" % (table_name, array_id, ','.join('?' * len(probes)))
c.execute(query, probes)
query_result = c.fetchall()
conn.close()

result = {'probes' : [item for sublist in query_result for item in sublist]}

sys.stdout.write('Status: 200 OK\r\n')
sys.stdout.write('Content-Type: application/json; charset=utf-8\r\n\r\n')
sys.stdout.write(json.dumps(result))
sys.exit(os.EX_OK)
