import os

import psycopg2
from dotenv import load_dotenv

# load the environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

DATABASE_URL = os.getenv("DATABASE_URL")

# read the schema.sql file
with open(os.path.join(os.path.dirname(__file__), "schema.sql"), "r") as f:
    schema_sql = f.read()

# connect to the database
conn = psycopg2.connect(DATABASE_URL)
try:
    with conn.cursor() as cur:
        cur.execute(schema_sql)
    conn.commit()
    print("Schema applied successfully.")
finally:
    conn.close()