"""Exercise production SQL with concurrent SQLite connections and real transactions."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import re
import sqlite3
import tempfile
import threading
import unittest

ROOT = Path(__file__).resolve().parents[1]
SOURCE = (ROOT / 'app/api/units/route.ts').read_text()
SQL = [match[1] for match in re.findall(r"db\.prepare\((['`])(.*?)\1\)", SOURCE, re.S)]
def statement(prefix):
    return next(sql for sql in SQL if sql.startswith(prefix))
CREATE = statement('INSERT OR IGNORE INTO demo_units')
INVITE = statement('INSERT OR IGNORE INTO demo_unit_invites')
CLAIM = statement('UPDATE demo_unit_invites SET claimed_by=')
JOIN = statement('INSERT INTO demo_unit_members')
REVOKE = statement('UPDATE demo_unit_invites SET revoked_at=')
NOW = '2026-10-12T20:00:00.000Z'
LATER = '2026-10-19T20:00:00.000Z'

class UnitStorage(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = str(Path(self.temp.name) / 'units.sqlite')
        with self.connect() as db:
            for migration in sorted((ROOT / 'drizzle').glob('*.sql')):
                db.executescript(migration.read_text())
        self.create()

    def tearDown(self):
        self.temp.cleanup()

    def connect(self):
        return sqlite3.connect(self.path, timeout=15, isolation_level=None)

    def create(self, unit='unit', scope='owner'):
        with self.connect() as db:
            return db.execute(CREATE, (unit, scope, unit, scope, NOW)).rowcount

    def invite(self, identifier='invite', unit='unit', role='coach'):
        with self.connect() as db:
            return db.execute(INVITE, (identifier,unit,role,'hash-'+identifier,NOW,LATER,unit,unit,NOW)).rowcount

    def accept(self, scope='member', identifier='invite', now=NOW, fail=False):
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            try:
                nonce = 'nonce-'+scope+'-'+identifier
                changed = db.execute(CLAIM,(scope,now,nonce,'hash-'+identifier,now,scope,scope,scope)).rowcount
                if fail:
                    db.execute('INSERT INTO nonexistent VALUES(1)')
                db.execute(JOIN,(scope,'member-'+scope,scope,now,'hash-'+identifier,nonce,scope))
                db.execute('COMMIT')
                return changed
            except Exception:
                db.execute('ROLLBACK')
                raise

    def member(self, n, unit='unit', scope=None):
        scope = scope or f'member-{n}'
        with self.connect() as db:
            db.execute('INSERT INTO demo_unit_members(unit_id,scope_id,id,name,role,joined_at,active) VALUES(?,?,?,?,?,?,1)',(unit,scope,f'{unit}-{n}',scope,'athlete',NOW))

    def race(self, jobs):
        barrier=threading.Barrier(len(jobs))
        def run(job):
            barrier.wait(timeout=10)
            return job()
        with ThreadPoolExecutor(max_workers=len(jobs)) as pool:
            return list(pool.map(run,jobs))

    def test_one_owner_unit_under_concurrent_creation(self):
        outcomes=self.race([lambda i=i:self.create(f'unit-{i}','new-owner') for i in range(8)])
        self.assertEqual(sum(outcomes),1)

    def test_one_invite_one_claim_even_with_competing_accounts(self):
        self.invite()
        outcomes=self.race([lambda i=i:self.accept(f'person-{i}') for i in range(8)])
        self.assertEqual(sum(outcomes),1)
        with self.connect() as db:
            winner=db.execute('SELECT claimed_by FROM demo_unit_invites').fetchone()[0]
            self.assertEqual(db.execute('SELECT scope_id FROM demo_unit_members').fetchall(),[(winner,)])
        self.assertEqual(self.accept(winner),0)

    def test_failed_join_rolls_back_claim(self):
        self.invite()
        with self.assertRaises(sqlite3.OperationalError):
            self.accept(fail=True)
        with self.connect() as db:
            self.assertIsNone(db.execute('SELECT claimed_by FROM demo_unit_invites').fetchone()[0])
        self.assertEqual(self.accept(),1)

    def test_accept_and_revoke_have_only_one_winner(self):
        self.invite()
        def revoke():
            with self.connect() as db:
                return db.execute(REVOKE,(NOW,'unit','invite',NOW)).rowcount
        outcomes=self.race([self.accept,revoke])
        self.assertEqual(sum(outcomes),1)
        with self.connect() as db:
            claimed,revoked=db.execute('SELECT claimed_by,revoked_at FROM demo_unit_invites').fetchone()
            self.assertNotEqual(claimed is None,revoked is None)
            self.assertEqual(db.execute('SELECT count(*) FROM demo_unit_members').fetchone()[0],int(claimed is not None))

    def test_expiry_is_checked_at_claim_boundary(self):
        self.invite()
        self.assertEqual(self.accept(now=LATER),0)
        with self.connect() as db:
            self.assertIsNone(db.execute('SELECT claimed_by FROM demo_unit_invites').fetchone()[0])

    def test_member_capacity_includes_owner_and_is_atomic(self):
        for n in range(48):self.member(n)
        for n in range(8):self.invite(f'i-{n}')
        outcomes=self.race([lambda i=i:self.accept(f'new-{i}',f'i-{i}') for i in range(8)])
        self.assertEqual(sum(outcomes),1)
        with self.connect() as db:
            self.assertEqual(db.execute('SELECT count(*) FROM demo_unit_members WHERE active=1').fetchone()[0]+1,50)
            self.assertEqual(db.execute('SELECT count(*) FROM demo_unit_invites WHERE claimed_by IS NOT NULL').fetchone()[0],1)

    def test_joined_unit_limit_is_atomic(self):
        for n in range(9):
            self.create(f'joined-{n}',f'owner-{n}')
            self.member(n,f'joined-{n}','person')
        for n in range(8):
            self.create(f'new-{n}',f'new-owner-{n}')
            self.invite(f'i-{n}',f'new-{n}')
        outcomes=self.race([lambda i=i:self.accept('person',f'i-{i}') for i in range(8)])
        self.assertEqual(sum(outcomes),1)
        with self.connect() as db:
            self.assertEqual(db.execute('SELECT count(*) FROM demo_unit_members WHERE scope_id=? AND active=1',('person',)).fetchone()[0],10)

    def test_pending_invite_limit_is_atomic_and_revocation_releases_slot(self):
        for n in range(9):self.invite(f'old-{n}')
        outcomes=self.race([lambda i=i:self.invite(f'new-{i}') for i in range(8)])
        self.assertEqual(sum(outcomes),1)
        with self.connect() as db:
            db.execute(REVOKE,(NOW,'unit','old-0',NOW))
        self.assertEqual(self.invite('replacement'),1)

    def test_total_invite_limit_is_atomic_even_after_revocation(self):
        with self.connect() as db:
            for n in range(99):
                db.execute('INSERT INTO demo_unit_invites(id,unit_id,role,code_hash,created_at,expires_at,revoked_at) VALUES(?,?,?,?,?,?,?)',(f'old-{n}','unit','athlete',f'old-hash-{n}',NOW,LATER,NOW))
        outcomes=self.race([lambda i=i:self.invite(f'new-{i}') for i in range(8)])
        self.assertEqual(sum(outcomes),1)
        with self.connect() as db:
            self.assertEqual(db.execute('SELECT count(*) FROM demo_unit_invites').fetchone()[0],100)

if __name__=='__main__':
    unittest.main(verbosity=2)
