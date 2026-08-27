import sqlite3
import os

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "suraksha_setu.db"))
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print("Tables in database:")
for t in tables:
    print(f"- {t[0]}")
    cursor.execute(f"PRAGMA table_info({t[0]})")
    cols = cursor.fetchall()
    print("  Columns:")
    for col in cols:
        print(f"    {col[1]} ({col[2]})")
conn.close()
