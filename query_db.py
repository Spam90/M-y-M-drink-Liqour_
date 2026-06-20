import sqlite3
import os

db_path = os.path.join(os.getcwd(), 'catalogo.db')
print("DB path:", db_path)
print("Exists:", os.path.exists(db_path))

conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print("Tables:", tables)

if tables:
    for t in tables:
        cursor.execute(f"PRAGMA table_info({t[0]})")
        print(f"Columns for {t[0]}:", cursor.fetchall())
        
        cursor.execute(f"SELECT * FROM {t[0]} WHERE es_oferta = 1 LIMIT 20")
        rows = cursor.fetchall()
        print(f"Ofertas ({t[0]}):")
        for r in rows:
            print(r)
        
        cursor.execute(f"SELECT id, nombre, imagen, es_oferta FROM {t[0]} LIMIT 5")
        print(f"Sample rows from {t[0]}:")
        for r in cursor.fetchall():
            print(r)

conn.close()