"""
Shared config loader for vidpilot TTS scripts.

Config search order:
1. VIDPILOT_CONFIG env var (absolute path)
2. VIDPILOT_PROJECT env var + /vidpilot.json
3. CWD/vidpilot.json (project root)
"""

import json
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SKILL_DIR = os.path.dirname(SCRIPT_DIR)


def find_config_path():
    if os.environ.get("VIDPILOT_CONFIG"):
        return os.environ["VIDPILOT_CONFIG"]
    if os.environ.get("VIDPILOT_PROJECT"):
        p = os.path.join(os.environ["VIDPILOT_PROJECT"], "vidpilot.json")
        if os.path.exists(p):
            return p
    cwd = os.path.join(os.getcwd(), "vidpilot.json")
    if os.path.exists(cwd):
        return cwd
    print("[error] vidpilot.json not found in project directory.")
    print("  Set VIDPILOT_PROJECT env var or run from your project root.")
    sys.exit(1)


def get_project_dir():
    """Return the project directory (where vidpilot.json lives)."""
    config_path = find_config_path()
    return os.path.dirname(config_path)


def load_config():
    path = find_config_path()
    with open(path) as f:
        return json.load(f)


def get_account(account_id):
    """Load account config. Returns (account_dict, data_dir, engine_dir)."""
    config = load_config()
    accounts = config.get("accounts", {})
    if account_id not in accounts:
        print(f"[error] Unknown account: {account_id}")
        print(f"  Available: {', '.join(accounts.keys())}")
        sys.exit(1)
    acct = accounts[account_id]
    engine_dir = os.path.join(SKILL_DIR, "engine")
    data_dir = os.path.join(engine_dir, "src", "data", account_id)
    return acct, data_dir, engine_dir


def get_data_file_path(account_id, format_key, fallback_env=None, fallback_default=None):
    """Resolve the data file path for a given account and format."""
    account_id_env = os.environ.get("ACCOUNT", account_id)

    if account_id_env:
        try:
            acct, data_dir, engine_dir = get_account(account_id_env)
            filename = acct.get("files", {}).get(format_key)
            if filename:
                return os.path.join(data_dir, filename), acct.get("voiceSeeds", {})
        except SystemExit:
            pass

    # Fallback to env var or default
    if fallback_env and os.environ.get(fallback_env):
        filepath = os.path.join(SKILL_DIR, "engine", os.environ[fallback_env])
        return filepath, {"left": 42, "right": 2024, "narrator": 2024}

    if fallback_default:
        filepath = os.path.join(SKILL_DIR, "engine", fallback_default)
        return filepath, {"left": 42, "right": 2024, "narrator": 2024}

    print(f"[error] Cannot resolve data file for format '{format_key}'")
    sys.exit(1)
