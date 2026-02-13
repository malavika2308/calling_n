from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles

app = FastAPI()
active_connections = {}

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await websocket.accept()
    active_connections[client_id] = websocket
    try:
        while True:
            data = await websocket.receive_json()
            target_id = str(data.get("target_id"))
            # Relay all message types (offer, answer, candidate, call-request, end-call)
            if target_id in active_connections:
                await active_connections[target_id].send_json({
                    "from": client_id,
                    "type": data["type"],
                    "payload": data.get("payload")
                })
    except WebSocketDisconnect:
        if client_id in active_connections:
            del active_connections[client_id]

app.mount("/", StaticFiles(directory="static", html=True), name="static")