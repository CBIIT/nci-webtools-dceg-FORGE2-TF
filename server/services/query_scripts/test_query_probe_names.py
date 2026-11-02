import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest


SCRIPT = os.path.join(os.path.dirname(__file__), 'query_probe_names.py')


class QueryProbeNamesTest(unittest.TestCase):
  def setUp(self):
    self.temp_dir = tempfile.TemporaryDirectory()
    probe_dir = os.path.join(self.temp_dir.name, 'All', 'probes')
    os.makedirs(probe_dir)
    self.probe_db = os.path.join(probe_dir, 'probes.db')
    with sqlite3.connect(self.probe_db) as conn:
      conn.execute('CREATE TABLE probes (array_id INTEGER, probe_name TEXT)')
      conn.executemany(
        'INSERT INTO probes VALUES (?, ?)',
        [(1, 'rs1'), (1, 'rs2'), (2, 'rs3')]
      )

  def tearDown(self):
    self.temp_dir.cleanup()

  def run_script(self, settings):
    return subprocess.run(
      [sys.executable, SCRIPT],
      input=json.dumps({'dataDir': self.temp_dir.name, 'settings': settings}),
      text=True,
      capture_output=True,
      check=False
    )

  def test_filter_database_is_optional_when_filter_is_disabled(self):
    result = self.run_script({
      'array': 'All',
      'probes': ['rs1', 'rs3'],
      'snpFilter': False
    })

    self.assertEqual(result.returncode, 0, result.stderr)
    self.assertEqual(json.loads(result.stdout), {'probes': ['rs1']})

  def test_filter_database_is_required_when_filter_is_enabled(self):
    result = self.run_script({
      'array': 'All',
      'probes': ['rs1'],
      'snpFilter': True
    })

    self.assertNotEqual(result.returncode, 0)
    error = json.loads(result.stderr)
    self.assertEqual(error['code'], 500)
    self.assertIn('rsids-filter.db', error['message'])

  def test_filter_database_limits_probe_query(self):
    filter_db = os.path.join(self.temp_dir.name, 'rsids-filter.db')
    with sqlite3.connect(filter_db) as conn:
      conn.execute('CREATE TABLE rsids (rsid TEXT)')
      conn.execute('INSERT INTO rsids VALUES (?)', ('rs2',))

    result = self.run_script({
      'array': 'All',
      'probes': ['rs1', 'rs2'],
      'snpFilter': True
    })

    self.assertEqual(result.returncode, 0, result.stderr)
    self.assertEqual(json.loads(result.stdout), {'probes': ['rs2']})

  def test_empty_probe_list_returns_empty_result(self):
    result = self.run_script({
      'array': 'All',
      'probes': [],
      'snpFilter': False
    })

    self.assertEqual(result.returncode, 0, result.stderr)
    self.assertEqual(json.loads(result.stdout), {'probes': []})

  def test_sql_error_is_actionable_json(self):
    os.remove(self.probe_db)
    with sqlite3.connect(self.probe_db):
      pass

    result = self.run_script({
      'array': 'All',
      'probes': ['rs1'],
      'snpFilter': False
    })

    self.assertNotEqual(result.returncode, 0)
    error = json.loads(result.stderr)
    self.assertEqual(error['code'], 500)
    self.assertIn('no such table: probes', error['message'])
    self.assertIn('probes.db', error['message'])


if __name__ == '__main__':
  unittest.main()
