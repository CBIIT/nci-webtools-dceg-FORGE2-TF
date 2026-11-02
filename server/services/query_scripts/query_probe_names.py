#!/usr/bin/env python3

import sys
import os
import json
import sqlite3

array_ids = {
  'All' : 1
}

def error(code, message):
  print(json.dumps({
    "code": code,
    "message": message
  }), file=sys.stderr)
  sys.exit(code if 1 <= code <= 255 else 1)

def query_values(database, column, table, where, values):
  if not values:
    return []

  try:
    with sqlite3.connect(database) as conn:
      query = "SELECT %s FROM %s WHERE %s IN (%s)" % (
        column,
        table,
        where,
        ','.join('?' * len(values))
      )
      return [row[0] for row in conn.execute(query, values).fetchall()]
  except sqlite3.Error as exc:
    error(500, 'failed to query SQL database file [%s]: %s' % (database, exc))

def main():
  try:
    form = json.load(sys.stdin)
  except (json.JSONDecodeError, UnicodeDecodeError) as exc:
    error(400, 'Invalid JSON request: %s' % (exc))

  if not isinstance(form, dict):
    error(400, 'JSON request must be an object')

  if 'dataDir' not in form:
    error(400, 'Data directory not specified')
  data_dir = form['dataDir']

  if 'settings' not in form or not isinstance(form['settings'], dict):
    error(400, 'Settings not specified')
  settings = form['settings']

  if 'array' not in settings:
    error(400, 'Array not specified')
  array_name = settings['array']
  if array_name not in array_ids:
    error(400, 'Unsupported array [%s]' % (array_name))

  if 'probes' not in settings or not isinstance(settings['probes'], list):
    error(400, 'Probes must be an array')
  probes = settings['probes']

  if 'snpFilter' not in settings or not isinstance(settings['snpFilter'], bool):
    error(400, 'snpFilter must be a boolean')

  filtered_probes = probes
  if settings['snpFilter']:
    sqlite_filter_fn = os.path.join(data_dir, 'rsids-filter.db')
    if not os.path.isfile(sqlite_filter_fn):
      error(500, 'could not find SNP filter SQL database file [%s]' % (sqlite_filter_fn))
    filtered_probes = query_values(
      sqlite_filter_fn,
      'rsid',
      'rsids',
      'rsid',
      probes
    )

  sqlite_fn = os.path.join(data_dir, array_name, 'probes', 'probes.db')
  if not os.path.isfile(sqlite_fn):
    error(500, 'could not find probes SQL database file [%s]' % (sqlite_fn))

  query_result = query_values(
    sqlite_fn,
    'probe_name',
    'probes',
    'array_id = %d AND probe_name' % (array_ids[array_name]),
    filtered_probes
  )
  print(json.dumps({'probes': query_result}))

if __name__ == '__main__':
  main()
