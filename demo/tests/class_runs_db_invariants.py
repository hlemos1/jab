"""Exact run API SQL against migrated SQLite under concurrent writers."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import re
import sqlite3
import tempfile
import threading
import unittest

ROOT = Path(__file__).resolve().parents[1]
API = (ROOT / 'app/api/class-runs/route.ts').read_text()

def query(prefix):
    matches = set(sql for sql in re.findall(r"\.prepare\('([^']+)'\)", API) if sql.startswith(prefix))
    if len(matches) != 1:
        raise AssertionError(f'Expected one query starting with {prefix}')
    return matches.pop()

INSERT = query('INSERT OR IGNORE INTO demo_class_runs')
COMMAND = query('UPDATE demo_class_runs SET state=?,active=?')
COMPLETE = query('UPDATE demo_class_runs SET state=?,active=0')
DELETE = query('DELETE FROM demo_class_runs')
READ = query('SELECT id,plan_id,created_at,updated_at,revision,input,plan,timing,state,active,last_command_id,last_command_json FROM demo_class_runs WHERE scope_id=? AND id=?')

class RunStorage(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = str(Path(self.temp.name) / 'runs.sqlite')
        with self.connect() as db:
            for migration in sorted((ROOT / 'drizzle').glob('*.sql')):
                db.executescript(migration.read_text())

    def tearDown(self):
        self.temp.cleanup()

    def connect(self):
        return sqlite3.connect(self.path, timeout=15, isolation_level=None)

    def save(self, run_id='run-1', scope='guest-A'):
        with self.connect() as db:
            return db.execute(INSERT, (scope, run_id, 'plan-1', 'now', 'now', '{"name":"Snapshot"}', '{"rounds":[1,2]}', '{"workSeconds":5,"restSeconds":0}', '{"status":"ready","elapsedMs":0,"startedAt":null}', scope)).rowcount

    def command(self, command_id, revision=0, active=1, state='{"status":"running","elapsedMs":0,"startedAt":1000}', run_id='run-1', scope='guest-A'):
        with self.connect() as db:
            return db.execute(COMMAND, (state, active, 'later', command_id, json.dumps({'requestId': command_id}), scope, run_id, revision)).rowcount

    def race(self, jobs):
        barrier = threading.Barrier(len(jobs))
        def run(job):
            barrier.wait(timeout=10)
            return job()
        with ThreadPoolExecutor(max_workers=len(jobs)) as pool:
            return list(pool.map(run, jobs))

    def test_only_one_active_can_be_created_concurrently(self):
        results = self.race([lambda i=i: self.save(run_id=f'run-{i}') for i in range(10)])
        self.assertEqual(sum(results), 1)
        self.assertEqual(self.save(scope='guest-B'), 1)

    def test_cas_command_has_one_winner_and_its_matching_receipt(self):
        self.save()
        outcomes = self.race([lambda i=i: self.command(f'cmd-{i}') for i in range(10)])
        self.assertEqual(sum(outcomes), 1)
        with self.connect() as db:
            row = db.execute(READ, ('guest-A', 'run-1')).fetchone()
        winner = outcomes.index(1)
        self.assertEqual(row[4], 1)
        self.assertEqual(row[10], f'cmd-{winner}')
        self.assertEqual(json.loads(row[11])['requestId'], row[10])
        self.assertEqual(self.command('stale'), 0)

    def test_completion_cannot_overwrite_winning_pause(self):
        self.save()
        self.command('start')
        def complete():
            with self.connect() as db:
                return db.execute(COMPLETE, ('{"status":"completed"}', 'end', 'guest-A', 'run-1', 1)).rowcount
        pause = lambda: self.command('pause', revision=1, state='{"status":"paused","elapsedMs":59000,"startedAt":null}')
        self.assertEqual(sum(self.race([complete, pause])), 1)
        with self.connect() as db:
            row = db.execute(READ, ('guest-A', 'run-1')).fetchone()
        self.assertEqual(row[4], 2)
        self.assertIn(json.loads(row[8])['status'], ['completed', 'paused'])

    def test_only_scoped_terminal_revision_can_be_deleted(self):
        self.save()
        with self.connect() as db:
            self.assertEqual(db.execute(DELETE, ('guest-A','run-1',0)).rowcount,0)
        self.command('interrupt',active=0,state='{"status":"interrupted"}')
        with self.connect() as db:
            self.assertIsNone(db.execute(READ,('guest-B','run-1')).fetchone())
            for scope, revision in [('guest-B',1),('guest-A',0)]:
                self.assertEqual(db.execute(DELETE,(scope,'run-1',revision)).rowcount,0)
            self.assertEqual(db.execute(DELETE,('guest-A','run-1',1)).rowcount,1)

    def test_history_cap_does_not_overflow(self):
        for i in range(19):
            self.assertEqual(self.save(run_id=f'old-{i}'),1)
            self.command(f'end-{i}',run_id=f'old-{i}',active=0,state='{"status":"interrupted"}')
        outcomes=self.race([lambda i=i: self.save(run_id=f'new-{i}') for i in range(10)])
        self.assertEqual(sum(outcomes),1)
        winner=outcomes.index(1)
        self.command('end-new',run_id=f'new-{winner}',active=0,state='{"status":"interrupted"}')
        self.assertEqual(self.save(run_id='over-limit'),0)
        with self.connect() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM demo_class_runs WHERE scope_id=?',('guest-A',)).fetchone()[0],20)

if __name__ == '__main__':
    unittest.main(verbosity=2)
