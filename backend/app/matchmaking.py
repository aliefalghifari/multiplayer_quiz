
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.room_manager import RoomManager

router = APIRouter()
room_manager = RoomManager()


@router.websocket("/ws")
async def matchmaking(websocket: WebSocket):
    player_name = websocket.query_params.get(
        "player_name", "Player"
    )
    player_id = websocket.query_params.get("player_id")
    session_token = websocket.query_params.get("session_token")

    connected_player_id = None

    try:
        connected_player_id = await room_manager.connect(
            websocket=websocket,
            player_name=player_name,
            player_id=player_id,
            session_token=session_token,
        )

        if connected_player_id is None:
            return

        while True:
            message = await websocket.receive_text()
            print(
                f"Pesan dari {connected_player_id}: {message}"
            )

    except WebSocketDisconnect:
        print(f"Pemain terputus: {connected_player_id}")

    finally:
        if connected_player_id is not None:
            await room_manager.disconnect(
                connected_player_id,
                websocket,
            )
