"""SQLite concurrency checks against the actual generated migration and API SQL.

Run: python3 tests/db_invariants.py
These validate storage invariants; they do not substitute for deployed D1 HTTP tests.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import re
import sqlite3
import tempfile
import threading
import unittest

ROOT = Path(__file__).resolve().parents[1]
API = (ROOT / 'app/api/demo/route.ts').read_text()


def query(prefix):
    statements = re.findall(r"\.prepare\('([^']+)'\)", API)
    matches = sorted(set(sql for sql in statements if sql.startswith(prefix)))
    if len(matches) != 1:
        raise AssertionError(f'Expected exactly one API SQL query: {prefix}')
    return matches[0]


INSERT_SESSION = query('INSERT OR IGNORE INTO demo_sessions')
INSERT_REDEMPTION = query('INSERT OR IGNORE INTO demo_redemptions')
BALANCE = query('SELECT COALESCE(')
READ_SESSION = query('SELECT * FROM demo_sessions WHERE guest_id=? AND id=?')
BENEFITS = dict((name, int(cost)) for name, cost in re.findall(r"'([a-z]+-[a-z]+)'\s*:\s*(\d+)", API))
ANCHOR_LOCK = next(sql for sql in re.findall(r'\.prepare\("([^\"]+)"\)', API) if sql.startswith("UPDATE demo_sessions SET chain_status='anchoring'"))


class StorageInvariants(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = str(Path(self.temp.name) / 'test.sqlite')
        with self.connect() as db:
            for migration in sorted((ROOT / 'drizzle').glob('*.sql')):
                db.executescript(migration.read_text())

    def tearDown(self):
        self.temp.cleanup()

    def connect(self):
        return sqlite3.connect(self.path, timeout=15, isolation_level=None)

    def credit(self, guest='guest-A', session='session-1', reward=20, digest='hash-A'):
        with self.connect() as db:
            return db.execute(INSERT_SESSION, (session, guest, '2026-10-12T09:00:00Z', '{}', digest, reward, '{"source":"simulator","events":[]}', guest)).rowcount

    def redeem(self, guest='guest-A', benefit='guest-pass'):
        cost = BENEFITS[benefit]
        with self.connect() as db:
            return db.execute(INSERT_REDEMPTION, (guest, benefit, cost, '2026-10-12T09:00:00Z', guest, guest, cost)).rowcount

    def balance(self, guest='guest-A'):
        with self.connect() as db:
            return db.execute(BALANCE, (guest, guest)).fetchone()[0]

    def race(self, jobs):
        barrier = threading.Barrier(len(jobs))
        def start(job):
            barrier.wait(timeout=10)
            return job()
        with ThreadPoolExecutor(max_workers=len(jobs)) as pool:
            return list(pool.map(start, jobs))

    def test_same_session_parallel_replay_credits_once(self):
        changes = self.race([lambda: self.credit() for _ in range(12)])
        self.assertEqual(sum(changes), 1)
        self.assertEqual(self.balance(), 20)

    def test_conflicting_replay_never_overwrites_original_credit(self):
        self.credit(reward=12)
        self.assertEqual(self.credit(reward=20, digest='tampered-hash'), 0)
        with self.connect() as db:
            reward, digest = db.execute('SELECT reward,hash FROM demo_sessions WHERE guest_id=? AND id=?', ('guest-A', 'session-1')).fetchone()
        self.assertEqual((reward, digest), (12, 'hash-A'))
        self.assertIn('if(existing.hash!==hash)', API)

    def test_session_input_survives_database_reload(self):
        self.credit()
        with self.connect() as db:
            stored = db.execute('SELECT input FROM demo_sessions WHERE guest_id=? AND id=?', ('guest-A', 'session-1')).fetchone()[0]
        self.assertEqual(stored, '{"source":"simulator","events":[]}')

    def test_duplicate_redemption_parallel_spends_once(self):
        cost = BENEFITS['guest-pass']
        self.credit(reward=cost * 2)
        changes = self.race([lambda: self.redeem() for _ in range(12)])
        self.assertEqual(sum(changes), 1)
        self.assertEqual(self.balance(), cost)

    def test_competing_redemptions_cannot_overdraw(self):
        # Either benefit can win; both cannot be afforded together.
        starting = max(BENEFITS.values())
        self.credit(reward=starting)
        changes = self.race([lambda benefit=benefit: self.redeem(benefit=benefit) for benefit in BENEFITS])
        self.assertEqual(sum(changes), 1)
        self.assertGreaterEqual(self.balance(), 0)

    def test_insufficient_funds_create_no_redemption(self):
        self.credit(reward=min(BENEFITS.values()) - 1)
        self.assertEqual(self.redeem(), 0)
        with self.connect() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM demo_redemptions').fetchone()[0], 0)

    def test_guest_namespace_isolation(self):
        self.credit(guest='guest-A', reward=20)
        self.credit(guest='guest-B', reward=7, digest='hash-B')
        self.assertEqual(self.balance('guest-A'), 20)
        self.assertEqual(self.balance('guest-B'), 7)
        self.assertEqual(self.balance('guest-C'), 0)
        self.assertEqual(self.redeem(guest='guest-C'), 0)
        with self.connect() as db:
            self.assertIsNone(db.execute(READ_SESSION, ('guest-C', 'session-1')).fetchone())
            self.assertEqual(len(db.execute(READ_SESSION, ('guest-A', 'session-1')).fetchall()), 1)
        for table in ['demo_sessions', 'demo_redemptions']:
            reads = re.findall(r"\.prepare\('([^']*SELECT[^']*)'\)", API)
            for sql in reads:
                if f'FROM {table}' in sql:
                    self.assertIn('guest_id=?', sql)

    def test_parallel_session_limit_is_atomic(self):
        for index in range(29):
            self.credit(session=f'prefill-{index}', reward=1)
        changes = self.race([lambda index=index: self.credit(session=f'race-{index}', reward=1) for index in range(10)])
        self.assertEqual(sum(changes), 1)
        self.assertEqual(self.balance(), 30)

    def test_anchor_compare_and_swap_allows_only_one_observed_state_owner(self):
        self.credit()
        def lock():
            with self.connect() as db:
                return db.execute(ANCHOR_LOCK, ('2026-10-12T09:01:00Z', 'guest-A', 'session-1', 'not_submitted', None, None)).rowcount
        self.assertEqual(sum(self.race([lock for _ in range(12)])), 1)
        with self.connect() as db:
            db.execute("UPDATE demo_sessions SET chain_status='confirmed',signature='confirmed-signature' WHERE guest_id='guest-A'")
        self.assertEqual(lock(), 0, 'stale snapshot must not reopen an already-confirmed session')

    def test_anchor_confirmed_state_and_changed_signature_cannot_be_relocked(self):
        self.credit()
        with self.connect() as db:
            db.execute("UPDATE demo_sessions SET chain_status='pending',signature='candidate-signature' WHERE guest_id='guest-A'")
            self.assertEqual(db.execute(ANCHOR_LOCK, ('later', 'guest-A', 'session-1', 'pending', None, None)).rowcount, 0)
            db.execute("UPDATE demo_sessions SET chain_status='confirmed' WHERE guest_id='guest-A'")
            self.assertEqual(db.execute(ANCHOR_LOCK, ('later', 'guest-A', 'session-1', 'confirmed', 'candidate-signature', None)).rowcount, 0)


if __name__ == '__main__':
    unittest.main(verbosity=2)
