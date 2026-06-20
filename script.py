import sqlite3

# Conectar a tu base de datos existente
conn = sqlite3.connect('data/catalogo.db')
cursor = conn.cursor()

# Verificar si la columna es_oferta existe, si no, crearla
try:
    cursor.execute("SELECT es_oferta FROM productos LIMIT 1")
except sqlite3.OperationalError:
    cursor.execute("ALTER TABLE productos ADD COLUMN es_oferta INTEGER DEFAULT 0")
    print("✅ Columna 'es_oferta' creada")

# Verificar productos actuales
cursor.execute("SELECT id, nombre FROM productos")
productos = cursor.fetchall()

print(f"📦 Productos encontrados: {len(productos)}")
print("-" * 50)

# Lista de productos que estarán en oferta (por nombre o ID)
# Puedes usar nombres exactos o IDs
ofertas_por_nombre = [
    'Whisky Johnnie Walker Black Label',
    'Whisky Buchanan\'s 12 Años',
    'Whisky + vaso',
    'Ron Barceló Imperial',
    'Ron Brugal Extra Viejo',
    'Ron + vaso',
    'Vodka Grey Goose',
    'Vodka + vaso',
    'Tequila Don Julio Blanco',
    'Tequila + vaso',
    'Ginebra Bombay Sapphire',
    'Ginebra + vaso',
    'Licor Amaretto Disaronno',
    'Licor + vaso',
    'Cerveza Corona Extra',
    'Cerveza + vaso',
    'Champagne Moët & Chandon',
    'Champagne Veuve Clicquot',
    'Champagne + vaso'
]

# O puedes usar IDs directamente (más seguro)
ofertas_por_id = [1, 4, 5, 6, 9, 10, 13, 14, 16, 17, 19, 20, 23, 24, 27, 28, 29, 30, 31]

# Actualizar productos por ID (método recomendado)
for id_oferta in ofertas_por_id:
    cursor.execute("UPDATE productos SET es_oferta = 1 WHERE id = ?", (id_oferta,))
    if cursor.rowcount > 0:
        print(f"✅ Producto ID {id_oferta} marcado como oferta")

# Mostrar productos en oferta después de la actualización
cursor.execute("SELECT id, nombre, precio, es_oferta FROM productos WHERE es_oferta = 1")
ofertas = cursor.fetchall()

print("-" * 50)
print(f"🔥 Productos en oferta: {len(ofertas)}")
print("-" * 50)
for id, nombre, precio, oferta in ofertas:
    print(f"  {id}. {nombre} - RD$ {precio:,} {'🔥' if oferta else ''}")

# Confirmar cambios
conn.commit()
conn.close()

print("-" * 50)
print("✅ ¡Base de datos actualizada con éxito!")
print("📌 Recuerda: Para que los cambios se vean en la página, recarga la página (Ctrl+F5)")