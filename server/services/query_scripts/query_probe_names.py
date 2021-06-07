#!/usr/bin/env python3

import sys
import os
import json
import sqlite3

array_ids = {
  'All' : 1
}

form = json.load(sys.stdin)

def error(code, message):
  raise SystemExit(json.dumps({
    "code": code,
    "message": message
  }))
if not 'dataDir' in form:
  error(400, 'Data directory not specified')
data_dir = form['dataDir']

if not 'settings' in form:
  error(400, 'Settings not specified [%s]' % (form))
settings = form['settings']

if not 'array' in settings:
  error(400, 'Array not specified [%s]' % (settings))
array = settings['array']

if not 'probes' in settings:
  error(400, 'Array not specified [%s]' % (settings))
probes = settings['probes']

# snp filter db
sqlite_filter_fn = os.path.join(data_dir, 'rsids-filter.db')
if not os.path.exists(sqlite_filter_fn):
  error(400, 'could not find snp filter SQL database file [%s]' % (sqlite_filter_fn))

# only filter snps if snpFilter flag = true
if settings['snpFilter']:
  conn = sqlite3.connect(sqlite_filter_fn)
  table_name = 'rsids'
  c = conn.cursor()
  query = "SELECT rsid FROM %s WHERE rsid IN (%s)" % (table_name, ','.join('?' * len(probes)))
  c.execute(query, probes)
  filtered_probes = [item for sublist in c.fetchall() for item in sublist]
  conn.close()
else:
  filtered_probes = probes

sqlite_fn = os.path.join(data_dir, array, 'probes', 'probes.db')
if not os.path.exists(sqlite_fn):
  error(400, 'could not find probes SQL database file [%s]' % (sqlite_fn))
  
conn = sqlite3.connect(sqlite_fn)
array_id = array_ids[array]
table_name = 'probes'
c = conn.cursor()
query = "SELECT probe_name FROM %s WHERE array_id = %d AND probe_name IN (%s)" % (table_name, array_id, ','.join('?' * len(filtered_probes)))
c.execute(query, filtered_probes)
query_result = c.fetchall()
conn.close()

result = {'probes' : [item for sublist in query_result for item in sublist]}

print(json.dumps(result))
sys.exit(0)

