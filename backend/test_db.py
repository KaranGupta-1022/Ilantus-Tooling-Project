from db import get_connection


def test_connection_and_query():
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM use_cases;")
            count = cur.fetchone()[0]
            print(f"use_cases row count: {count}")

            cur.execute("SELECT code, name, category FROM use_cases ORDER BY code;")
            rows = cur.fetchall()
            for row in rows:
                print(f"Code: {row[0]}, Name: {row[1]}, Category: {row[2]}")


if __name__ == "__main__":
    test_connection_and_query()
