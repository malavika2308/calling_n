from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
import uuid

app = FastAPI()

# Store active connections: { "unique_id": websocket }
active_connections = {}

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await websocket.accept()
    active_connections[client_id] = websocket
    try:
        while True:
            # Receive data from one peer and forward it to the other
            data = await websocket.receive_json()
            target_id = data.get("target_id")
            if target_id in active_connections:
                await active_connections[target_id].send_json({
                    "from": client_id,
                    "type": data["type"],
                    "payload": data["payload"]
                })
    except WebSocketDisconnect:
        del active_connections[client_id]

app.mount("/", StaticFiles(directory="static", html=True), name="static")