"""Run the exact class-plan API SQL against migrated SQLite, including races."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import re
import sqlite3
import tempfile
import threading
import unittest

ROOT = Path(__file__).resolve().parents[1]
API = (ROOT / 'app/api/classes/route.ts').read_text()


def query(prefix):
    matches = set(sql for sql in re.findall(r"\.prepare\('([^']+)'\)", API) if sql.startswith(prefix))
    if len(matches) != 1:
        raise AssertionError(f'Expected exactly one query starting with {prefix}')
    return matches.pop()


INSERT = query('INSERT OR IGNORE INTO demo_class_plans')
READ = query('SELECT id,created_at,input,plan FROM demo_class_plans WHERE scope_id=? AND id=?')
LIST = query('SELECT id,created_at,input,plan FROM demo_class_plans WHERE scope_id=? ORDER BY')
DELETE = query('DELETE FROM demo_class_plans')


class ClassPlanStorage(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = str(Path(self.temp.name) / 'classes.sqlite')
        with self.connect() as db:
            for migration in sorted((ROOT / 'drizzle').glob('*.sql')):
                db.executescript(migration.read_text())

    def tearDown(self):
        self.temp.cleanup()

    def connect(self):
        return sqlite3.connect(self.path, timeout=15, isolation_level=None)

    def save(self, scope='guest-A', plan_id='plan-1', raw_input='{"name":"Test"}', matrix='{"rulesVersion":"old","rounds":[1,2,3]}'):
        with self.connect() as db:
            return db.execute(INSERT, (scope, plan_id, '2026-10-12T12:00:00Z', raw_input, matrix, scope)).rowcount

    def race(self, jobs):
        barrier = threading.Barrier(len(jobs))
        def run(job):
            barrier.wait(timeout=10)
            return job()
        with ThreadPoolExecutor(max_workers=len(jobs)) as pool:
            return list(pool.map(run, jobs))

    def test_parallel_replays_insert_one_immutable_matrix(self):
        self.assertEqual(sum(self.race([self.save for _ in range(10)])), 1)
        self.assertEqual(self.save(raw_input='{"name":"Changed"}', matrix='{"rounds":[]}'), 0)
        with self.connect() as db:
            saved = db.execute(READ, ('guest-A', 'plan-1')).fetchone()
        self.assertEqual(saved[2], '{"name":"Test"}')
        self.assertEqual(saved[3], '{"rulesVersion":"old","rounds":[1,2,3]}')

    def test_parallel_limit_cannot_exceed_twenty(self):
        for index in range(19):
            self.save(plan_id=f'prefill-{index}')
        results = self.race([lambda index=index: self.save(plan_id=f'race-{index}') for index in range(10)])
        self.assertEqual(sum(results), 1)
        with self.connect() as db:
            self.assertEqual(len(db.execute(LIST, ('guest-A',)).fetchall()), 20)
        self.assertEqual(self.save(plan_id='overflow'), 0)
        self.assertEqual(self.save(scope='guest-B'), 1)

    def test_other_scope_cannot_read_or_delete_and_accounts_are_separate(self):
        for scope in ['guest-A', 'guest-B', 'account:A', 'account:B']:
            self.save(scope=scope)
        with self.connect() as db:
            self.assertIsNone(db.execute(READ, ('unknown', 'plan-1')).fetchone())
            self.assertEqual(db.execute(DELETE, ('unknown', 'plan-1')).rowcount, 0)
            self.assertEqual(db.execute(DELETE, ('account:A', 'plan-1')).rowcount, 1)
            for scope in ['guest-A', 'guest-B', 'account:B']:
                self.assertIsNotNone(db.execute(READ, (scope, 'plan-1')).fetchone())

    def test_deleted_plan_frees_one_slot(self):
        for index in range(20):
            self.save(plan_id=f'plan-{index}')
        with self.connect() as db:
            db.execute(DELETE, ('guest-A', 'plan-7'))
        self.assertEqual(self.save(plan_id='replacement'), 1)
        self.assertEqual(self.save(plan_id='overflow'), 0)


if __name__ == '__main__':
    unittest.main(verbosity=2)
