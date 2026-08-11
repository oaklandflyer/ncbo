#!/usr/bin/env python3
"""
make-member.py — manage the sign-in accounts in data/members.json.

The browser (assets/js/auth.js) and this script write and read the exact same
format: PBKDF2-SHA256, 32-byte output, per-user 16-byte random salt, iteration
count stored per record so it can be raised later without breaking old accounts.

    python3 tools/make-member.py --user jdoe --name "J Doe" --role Curator --kind admin
    python3 tools/make-member.py --list
    python3 tools/make-member.py --remove jdoe

A plaintext password is never written, echoed or logged — it exists only in
memory long enough to derive the hash.

Read SECURITY-NOTES.md before deciding what to put behind this gate.
"""

import argparse
import hashlib
import json
import os
import secrets
import sys
from getpass import getpass

ITERATIONS = 210_000
DKLEN = 32
SALT_BYTES = 16
MIN_PASSWORD = 8

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DIRECTORY = os.path.join(ROOT, "data", "members.json")


def load():
    if not os.path.exists(DIRECTORY):
        return {"iterations": ITERATIONS, "users": []}
    with open(DIRECTORY, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    data.setdefault("iterations", ITERATIONS)
    data.setdefault("users", [])
    return data


def save(data):
    os.makedirs(os.path.dirname(DIRECTORY), exist_ok=True)
    with open(DIRECTORY, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2)
        fh.write("\n")


def derive(password, salt_hex, iterations):
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), iterations, dklen=DKLEN
    ).hex()


def ask_password():
    while True:
        first = getpass("Password: ")
        if len(first) < MIN_PASSWORD:
            print(f"Too short — use at least {MIN_PASSWORD} characters.", file=sys.stderr)
            continue
        if first != getpass("Password again: "):
            print("Those didn't match. Try again.", file=sys.stderr)
            continue
        return first


def cmd_list(data):
    users = data.get("users", [])
    if not users:
        print("No accounts yet. Add one with --user.")
        return 0
    width = max(len(u.get("u", "")) for u in users)
    print(f"{len(users)} account{'s' if len(users) != 1 else ''} in data/members.json:\n")
    for u in users:
        kind = "admin" if u.get("kind") == "admin" else "member"
        print(
            f"  {u.get('u', ''):<{width}}  {kind:<6}  "
            f"{u.get('name', '') or '(no name)'} — {u.get('role', '') or 'no role'}"
            f"  [{u.get('iter', ITERATIONS)} iterations]"
        )
    return 0


def cmd_remove(data, username):
    username = username.strip().lower()
    users = data.get("users", [])
    kept = [u for u in users if u.get("u", "").lower() != username]
    if len(kept) == len(users):
        print(f"No account named '{username}'.", file=sys.stderr)
        return 1
    data["users"] = kept
    save(data)
    print(f"Removed '{username}'. {len(kept)} account(s) left.")
    return 0


def cmd_add(data, args):
    username = args.user.strip().lower()
    if not username:
        print("--user cannot be empty.", file=sys.stderr)
        return 1

    password = args.password if args.password is not None else ask_password()
    if len(password) < MIN_PASSWORD:
        print(f"Password must be at least {MIN_PASSWORD} characters.", file=sys.stderr)
        return 1

    salt = secrets.token_hex(SALT_BYTES)
    iterations = args.iterations
    record = {
        "u": username,
        "name": args.name or username,
        "role": args.role or "",
        "kind": "admin" if args.kind == "admin" else "member",
        "salt": salt,
        "iter": iterations,
        "hash": derive(password, salt, iterations),
    }

    users = data.get("users", [])
    for i, existing in enumerate(users):
        if existing.get("u", "").lower() == username:
            users[i] = record
            data["users"] = users
            save(data)
            print(f"Replaced '{username}' ({record['kind']}).")
            return 0

    users.append(record)
    data["users"] = users
    save(data)
    print(f"Added '{username}' ({record['kind']}).")
    return 0


def main():
    ap = argparse.ArgumentParser(
        description="Manage data/members.json — the sign-in accounts for the NCBO member area.",
        epilog="Read SECURITY-NOTES.md for what this gate does and does not protect.",
    )
    ap.add_argument("--user", help="username to add or replace (lowercased)")
    ap.add_argument("--name", default="", help="display name")
    ap.add_argument("--role", default="", help="role label shown after sign-in, e.g. Curator")
    ap.add_argument(
        "--kind",
        default="member",
        choices=["member", "admin"],
        help="admin accounts can open the pages under admin/ (default: member)",
    )
    ap.add_argument(
        "--password",
        help="password (prompted for twice if omitted — preferred, it keeps it out of your shell history)",
    )
    ap.add_argument(
        "--iterations",
        type=int,
        default=ITERATIONS,
        help=f"PBKDF2 iterations for this record (default: {ITERATIONS})",
    )
    ap.add_argument("--list", action="store_true", help="list existing accounts")
    ap.add_argument("--remove", metavar="USER", help="remove an account")
    args = ap.parse_args()

    data = load()

    if args.list:
        return cmd_list(data)
    if args.remove:
        return cmd_remove(data, args.remove)
    if args.user:
        return cmd_add(data, args)

    ap.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
