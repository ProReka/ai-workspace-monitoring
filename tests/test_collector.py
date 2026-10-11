"""Backend unit tests (stdlib only): python -m unittest discover -s tests"""
import importlib
import json
import os
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def fresh(*names):
    mods = {}
    with mock.patch.dict(os.environ, {}, clear=False):
        for n in names:
            mods[n] = importlib.reload(importlib.import_module(n))
    return mods


class HelpersTest(unittest.TestCase):
    def test_jwt_exp(self):
        from collector import nine_router as nr
        import base64

        def tok(exp):
            p = base64.urlsafe_b64encode(json.dumps({"exp": exp}).encode()).decode().rstrip("=")
            return f"h.{p}.s"

        self.assertEqual(nr._jwt_exp(tok(1791714050)), 1791714050)
        self.assertIsNone(nr._jwt_exp("garbage"))
        self.assertIsNone(nr._jwt_exp(""))

    def test_friendly(self):
        from collector import nine_router as nr
        names = {"openai-compatible-chat-abc": "Lazio"}
        self.assertEqual(nr._friendly(names, "openai-compatible-chat-abc"), "Lazio")
        self.assertEqual(nr._friendly(names, "claude"), "Claude")
        self.assertEqual(nr._friendly(names, "opencode"), "OpenCode")
        self.assertEqual(nr._friendly(names, ""), "?")

    def test_kind_label(self):
        from collector import multica
        self.assertEqual(multica._kind_label("autopilot"), "Running autopilot")
        self.assertEqual(multica._kind_label("direct"), "Replying to DM")
        self.assertTrue(multica._kind_label("weird").startswith("Working"))

    def test_burn_color(self):
        from collector import nine_router as nr
        import time
        from datetime import datetime, timezone, timedelta
        soon = (datetime.now(timezone.utc) + timedelta(hours=3)).isoformat()
        self.assertEqual(nr._burn_color(0, soon, 5), "red")
        self.assertEqual(nr._burn_color(10, soon, 5), "red")
        # 5h window, 3h left (60% expected): 80% -> green, 40% -> orange
        self.assertEqual(nr._burn_color(80, soon, 5), "green")
        self.assertEqual(nr._burn_color(40, soon, 5), "orange")
        self.assertEqual(nr._burn_color(None, soon, 5), "gray")
        self.assertEqual(nr._burn_color(50, None, 5), "green")
        self.assertEqual(nr._burn_color(50, soon, None), "green")

    def test_window_hours(self):
        from collector import nine_router as nr
        self.assertEqual(nr._window_hours("session (5h)"), 5)
        self.assertEqual(nr._window_hours("weekly (7d)"), 7 * 24)
        self.assertEqual(nr._window_hours("gemini_weekly"), 7 * 24)
        self.assertEqual(nr._window_hours("Monthly"), 30 * 24)
        self.assertEqual(nr._window_hours("Rolling"), None)
        self.assertEqual(nr._window_hours("session"), None)


class ConfigTest(unittest.TestCase):
    def test_neutral_defaults(self):
        env = {k: v for k, v in os.environ.items()
               if not k.startswith(("MULTICA_", "NINEROUTER_", "AWS_", "ECS_", "KNOWN_", "REFRESH_", "MOCK_", "DATA_DIR", "PORT"))}
        with mock.patch.dict(os.environ, env, clear=True):
            import collector.config as c
            importlib.reload(c)
            self.assertEqual(c.MULTICA_WORKSPACE, "")
            self.assertEqual(c.KNOWN_DAEMONS, [])
            self.assertTrue(c.is_known_daemon("anything"))
            self.assertEqual(c.COMPANY_NAME, "Command Center")


class SnapshotMockTest(unittest.TestCase):
    def test_all_mock_without_creds(self):
        env = {k: v for k, v in os.environ.items()
               if not k.startswith(("MULTICA_", "NINEROUTER_", "AWS_", "ECS_", "KNOWN_", "REFRESH_", "MOCK_", "DATA_DIR", "PORT"))}
        with mock.patch.dict(os.environ, env, clear=True):
            import collector.config as config
            import collector.multica as multica
            import collector.nine_router as nine_router
            import collector.ecs as ecs
            import collector.snapshot as snap_mod
            for m in (config, multica, nine_router, ecs, snap_mod):
                importlib.reload(m)
            s = snap_mod.snapshot()
            self.assertEqual(s["modes"], {"multica": "mock", "router": "mock", "ecs": "mock"})
            for key in ("multica", "router", "ecs", "alerts", "notices", "meta", "thresholds"):
                self.assertIn(key, s)


class StoreTest(unittest.TestCase):
    def test_write_and_history(self):
        import time
        with tempfile.TemporaryDirectory() as tmp:
            with mock.patch.dict(os.environ, {"DATA_DIR": tmp}):
                import collector.store as store
                importlib.reload(store)
                now = int(time.time())
                store.write_snapshot({
                    "ts": now,
                    "multica": {"agents": [
                        {"agent_id": "a1", "agent_name": "Nova", "runtime_online": True,
                         "pending_total": 2, "running": 1}]},
                    "router": {"quotas": [
                        {"provider": "Claude", "account": "A1", "window": "5h",
                         "remaining_pct": 40.0}]},
                })
                h = store.history("week")
                self.assertIn("a1", {a["id"] for a in h["agents"]})
                self.assertTrue(any("Claude" in q["label"] for q in h["quotas"]))


class NoLoginRouterTest(unittest.TestCase):
    """9Router without dashboard password must still go live."""

    def _run(self, auth):
        from collector import nine_router as nr

        conns = [{"id": "c1", "provider": "claude", "name": "Account 1",
                  "email": None, "isActive": True, "testStatus": "active",
                  "lastError": None, "errorCode": None}]
        usage = {"plan": "X", "quotas": {
            "session (5h)": {"used": 10, "total": 100, "remainingPercentage": 90,
                             "resetAt": "2030-01-01T00:00:00Z"}}}

        locked = auth.get("requireLogin") and not auth.get("authenticated")

        def fake_conns(*a, **k):
            return [] if locked else conns

        def fake_usage(*a, **k):
            return {} if locked else {"c1": usage}

        def fake_get(client, base, path, token, statuses):
            statuses[path] = 200
            if path == "/api/auth/status":
                return 200, auth
            if path == "/api/version":
                return 200, {"currentVersion": "0.5.95"}
            if path == "/api/combos":
                return 200, {"combos": []}
            return 200, {}

        with mock.patch.dict(os.environ, {"NINEROUTER_URL": "http://x",
                                          "NINEROUTER_PASSWORD": "",
                                          "NINEROUTER_COOKIE": "",
                                          "NINEROUTER_KEY": ""}):
            import collector.config as config
            importlib.reload(config)
            importlib.reload(nr)
            try:
                with mock.patch.object(nr, "_get", side_effect=fake_get), \
                     mock.patch.object(nr, "_session_token", return_value=None), \
                     mock.patch.object(nr, "_connections", side_effect=fake_conns), \
                     mock.patch.object(nr, "_usages", side_effect=fake_usage), \
                     mock.patch.object(nr, "_models", return_value={"data": []}):
                    return nr.collect()
            finally:
                importlib.reload(config)
                importlib.reload(nr)

    def test_passwordless_goes_live(self):
        r = self._run({"authenticated": False, "requireLogin": False})
        self.assertEqual(r["mode"], "live")
        self.assertEqual(len(r["quotas"]), 1)

    def test_locked_out_stays_unconfigured(self):
        r = self._run({"authenticated": False, "requireLogin": True})
        self.assertEqual(r["mode"], "unconfigured")


if __name__ == "__main__":
    unittest.main()
