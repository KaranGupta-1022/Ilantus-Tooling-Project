import os
import sys

from dotenv import load_dotenv

load_dotenv()


def check_env_vars():
    required = ["GROQ_API_KEY", "DATABASE_URL"]
    placeholder_markers = ["your_", "placeholder", "changeme"]
    ok = True

    for var in required:
        value = os.getenv(var)
        if not value:
            print(f"[FAIL] {var} is not set")
            ok = False
        elif any(marker in value.lower() for marker in placeholder_markers):
            print(f"[WARN] {var} looks like a placeholder value")
            ok = False
        else:
            print(f"[PASS] {var} is set")

    return ok


def check_imports():
    modules = ["flask", "flask_cors", "psycopg2", "openai", "requests", "bs4"]
    ok = True

    for module in modules:
        try:
            __import__(module)
            print(f"[PASS] import {module}")
        except ImportError as e:
            print(f"[FAIL] import {module} -> {e}")
            ok = False

    return ok


def check_db_connection():
    database_url = os.getenv("DATABASE_URL")
    if not database_url or "your_" in database_url.lower():
        print("[SKIP] DATABASE_URL not set, skipping connection test")
        return True

    try:
        import psycopg2

        conn = psycopg2.connect(database_url)
        conn.close()
        print("[PASS] Connected to database")
        return True
    except Exception as e:
        print(f"[FAIL] Could not connect to database -> {e}")
        return False


if __name__ == "__main__":
    print("Checking environment variables...")
    env_ok = check_env_vars()

    print("\nChecking package imports...")
    imports_ok = check_imports()

    print("\nChecking database connection...")
    db_ok = check_db_connection()

    print()
    if env_ok and imports_ok and db_ok:
        print("All checks passed.")
        sys.exit(0)
    else:
        print("Some checks failed. See above.")
        sys.exit(1)
