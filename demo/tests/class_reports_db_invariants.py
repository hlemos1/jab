"""Report SQL invariants exercised against migrated SQLite with concurrent writers."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import re
import sqlite3
import tempfile
import threading
import unittest

ROOT = Path(__file__).resolve().parents[1]
API = (ROOT / 'app/api/class-reports/route.ts').read_text()
INSERT = next(sql for sql in re.findall(r"\.prepare\('([^']+)'\)", API) if sql.startswith('INSERT OR IGNORE INTO demo_class_reports'))

class ReportStorage(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = str(Path(self.temp.name) / 'reports.sqlite')
        with self.connect() as db:
            for migration in sorted((ROOT / 'drizzle').glob('*.sql')):
                db.executescript(migration.read_text())

    def tearDown(self):
        self.temp.cleanup()

    def connect(self):
        return sqlite3.connect(self.path, timeout=15, isolation_level=None)

    def seed(self, run='run', scope='owner', active=0, revision=2):
        with self.connect() as db:
            db.execute('INSERT INTO demo_class_runs(scope_id,id,plan_id,created_at,updated_at,revision,input,plan,timing,state,active) VALUES(?,?,?,?,?,?,?,?,?,?,?)', (scope,run,'plan','now','now',revision,'{}','{}','{}','{}',active))

    def save(self, run='run', request='request', scope='owner', revision=2):
        with self.connect() as db:
            return db.execute(INSERT,(scope,run,'now',request,'{"snapshot":true}','hash',scope,run,revision,scope)).rowcount

    def race(self, jobs):
        barrier=threading.Barrier(len(jobs))
        def run(job):
            barrier.wait(timeout=10)
            return job()
        with ThreadPoolExecutor(max_workers=len(jobs)) as pool:
            return list(pool.map(run,jobs))

    def test_concurrent_closeout_has_one_immutable_winner(self):
        self.seed()
        results=self.race([lambda i=i:self.save(request=f'request-{i}') for i in range(10)])
        self.assertEqual(sum(results),1)
        with self.connect() as db:
            self.assertEqual(db.execute('SELECT request_id FROM demo_class_reports').fetchone()[0],f'request-{results.index(1)}')
        self.assertEqual(self.save(),0)

    def test_request_id_is_unique_per_scope(self):
        self.seed('a');self.seed('b');self.seed('a',scope='other')
        self.assertEqual(sum(self.race([lambda:self.save('a'),lambda:self.save('b')])),1)
        self.assertEqual(self.save('a',scope='other'),1)

    def test_source_must_exist_and_match_scope_revision_and_terminal_state(self):
        self.seed(active=1)
        self.assertEqual(self.save(),0)
        with self.connect() as db:
            db.execute('UPDATE demo_class_runs SET active=0')
        self.assertEqual(self.save(revision=1),0)
        self.assertEqual(self.save(scope='stranger'),0)
        with self.connect() as db:
            db.execute('DELETE FROM demo_class_runs')
        self.assertEqual(self.save(),0)

    def test_report_survives_source_deletion(self):
        self.seed();self.assertEqual(self.save(),1)
        with self.connect() as db:
            db.execute('DELETE FROM demo_class_runs')
            self.assertEqual(db.execute('SELECT payload,hash FROM demo_class_reports').fetchone(),('{"snapshot":true}','hash'))

    def test_report_cap_is_atomic_under_concurrency(self):
        with self.connect() as db:
            for i in range(99):
                db.execute('INSERT INTO demo_class_reports(scope_id,id,created_at,request_id,payload,hash) VALUES(?,?,?,?,?,?)',('owner',f'old-{i}','now',f'old-request-{i}','{}','hash'))
        for i in range(10):self.seed(f'new-{i}')
        results=self.race([lambda i=i:self.save(f'new-{i}',request=f'new-request-{i}') for i in range(10)])
        self.assertEqual(sum(results),1)
        with self.connect() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM demo_class_reports WHERE scope_id=?',('owner',)).fetchone()[0],100)

if __name__=='__main__':
    unittest.main(verbosity=2)
