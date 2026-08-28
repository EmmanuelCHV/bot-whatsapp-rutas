from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
from typing import List
import requests
import time

app = FastAPI()

# Configura tus credenciales gratuitas de la API de WhatsApp (ej. Green-API o UltraMsg)
INST_ID = "TU_INSTANCE_ID"
TOKEN = "TU_API_TOKEN"

class Cliente(BaseModel):
    nombre: str
    telefono: str

class PayloadEnvio(BaseModel):
    mensaje: str
    clientes: List[Cliente]

def despachar_whatsapp(mensaje: str, clientes: List[Cliente]):
    for c in clientes:
        # Aseguramos formato internacional
        num = c.telefono.strip().replace("+", "").replace(" ", "")
        if not num.startswith("52"):
            num = f"52{num}"
            
        texto_personalizado = f"Hola {c.nombre}, {mensaje}"
        
        # Petición a la API de WhatsApp
        url = f"https://api.green-api.com/waInstance{INST_ID}/sendMessage/{TOKEN}"
        payload = {
            "chatId": f"{num}@c.us",
            "message": texto_personalizado
        }
        
        try:
            requests.post(url, json=payload, timeout=10)
        except Exception as e:
            print(f"Error enviando a {c.nombre}: {e}")
            
        # Pausa de 3 segundos entre envíos para no saturar
        time.sleep(3)

@app.post("/api/v1/enviar-ruta")
async def enviar_ruta(data: PayloadEnvio, background_tasks: BackgroundTasks):
    # Procesa en segundo plano para responderle al Atajo en 1 segundo
    background_tasks.add_task(despachar_whatsapp, data.mensaje, data.clientes)
    return {"status": "ok", "mensaje": f"Procesando {len(data.clientes)} envíos"}