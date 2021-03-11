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

print(json.dumps(result))
sys.exit(0)

