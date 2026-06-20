import os
import cv2
import requests

# 1. CONFIGURACIÓN DE RUTAS (Apuntando a tu carpeta de la v9)
CARPETA_ORIGEN = r"C:\Users\Magallanes\Desktop\licoreria\chucherias_img_pc"
CARPETA_HQ = r"C:\Users\Magallanes\Desktop\licoreria\chucherias_img_hd"
os.makedirs(CARPETA_HQ, exist_ok=True)

# URL del modelo de IA ligero (FSRCNN de escala x3)
MODELO_URL = "https://github.com/fannymonori/TF-ESPCN/raw/master/export/FSRCNN_x3.pb"
MODELO_PATH = "FSRCNN_x3.pb"

# 2. DESCARGAR EL MODELO DE IA SI NO EXISTE
if not os.path.exists(MODELO_PATH):
    print("📥 Descargando modelo de nitidez IA (FSRCNN)... Solo se hace una vez.")
    r = requests.get(MODELO_URL)
    with open(MODELO_PATH, 'wb') as f:
        f.write(r.content)
    print("✅ Modelo listo.")

# 3. INICIALIZAR EL MOTOR DE SUPER-RESOLUCIÓN
sr = cv2.dnn_superres.DnnSuperResImpl_create()
sr.readModel(MODELO_PATH)
sr.setModel("fsrcnn", 3) # Multiplica el tamaño x3 de forma inteligente

print("\n🚀 Iniciando procesamiento de alta definición...")
print("="*50)

imagenes = [f for f in os.listdir(CARPETA_ORIGEN) if f.endswith('.png')]
procesadas = 0

for nombre_archivo in imagenes:
    ruta_input = os.path.join(CARPETA_ORIGEN, nombre_archivo)
    ruta_output = os.path.join(CARPETA_HQ, nombre_archivo)
    
    # Si ya la procesamos en HD, saltar
    if os.path.exists(ruta_output):
        continue
        
    try:
        # Leer la imagen borrosa de la v9
        img = cv2.imread(ruta_input)
        if img is None: continue
        
        # La IA procesa y reconstruye los bordes pixelados
        img_hd = sr.upsample(img)
        
        # Guardar el resultado nítido en la nueva carpeta
        cv2.imwrite(ruta_output, img_hd)
        procesadas += 1
        print(f"✨ ¡Imagen optimizada en HD! -> {nombre_archivo}")
        
    except Exception as e:
        print(f"⚠️ No se pudo procesar {nombre_archivo}: {e}")

print(f"\n🎯 ¡Proceso terminado! Se mejoraron {procesadas} imágenes. Revisa la carpeta: {CARPETA_HQ}")