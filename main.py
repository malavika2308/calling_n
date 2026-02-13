from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
import json

app = FastAPI()

# Store active connections: { "unique_id": websocket }
active_connections = {}

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await websocket.accept()
    active_connections[client_id] = websocket
    print(f"Client {client_id} connected")
    
    try:
        while True:
            # Receive signaling data
            data = await websocket.receive_json()
            target_id = str(data.get("target_id"))
            
            # Forward the message to the target user
            if target_id in active_connections:
                await active_connections[target_id].send_json({
                    "from": client_id,
                    "type": data["type"],
                    "payload": data.get("payload")
                })
    except WebSocketDisconnect:
        if client_id in active_connections:
            del active_connections[client_id]
        print(f"Client {client_id} disconnected")

# Mount static files last
app.mount("/", StaticFiles(directory="static", html=True), name="static")