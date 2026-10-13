
import secrets
from uuid import uuid4

from fastapi import WebSocket


class RoomManager:
    def __init__(self):
        self.players: dict[str, dict] = {}
        self.rooms: dict[str, list[str]] = {}
        self.waiting_players: list[str] = []

    async def connect(
        self,
        websocket: WebSocket,
        player_name: str = "Player",
        player_id: str | None = None,
        session_token: str | None = None,
    ) -> str | None:
        await websocket.accept()

        # Reconnect: pemain harus memiliki ID dan token yang valid.
        if player_id is not None or session_token is not None:
            player = self.players.get(player_id or "")

            if (
                player is None
                or session_token is None
                or not secrets.compare_digest(
                    player["session_token"], session_token
                )
            ):
                await websocket.close(
                    code=1008,
                    reason="Identitas atau sesi tidak valid",
                )
                return None

            # Ganti koneksi lama dengan koneksi baru.
            player["websocket"] = websocket

            await websocket.send_json({
                "type": "reconnected",
                "player_id": player_id,
                "room_id": player["room_id"],
            })

            if player["room_id"] is None:
                await self._match_waiting_players()

                if player["room_id"] is None:
                    await websocket.send_json({
                        "type": "waiting",
                        "message": "Menunggu pemain kedua",
                    })
            else:
                await self._notify_room(
                    player["room_id"],
                    player_id,
                    {
                        "type": "player_reconnected",
                        "player_id": player_id,
                    },
                )

            return player_id

        # Koneksi baru: backend membuat identitas pemain.
        player_id = str(uuid4())
        session_token = secrets.token_urlsafe(32)

        self.players[player_id] = {
            "player_name": player_name,
            "session_token": session_token,
            "websocket": websocket,
            "room_id": None,
        }

        await websocket.send_json({
            "type": "player_created",
            "player_id": player_id,
            "session_token": session_token,
        })

        self.waiting_players.append(player_id)

        await self._match_waiting_players()

        if self.players[player_id]["room_id"] is None:
            await websocket.send_json({
                "type": "waiting",
                "message": "Menunggu pemain kedua",
            })

        return player_id

    async def _match_waiting_players(self):
        while True:
            available = [
                pid
                for pid in self.waiting_players
                if pid in self.players
                and self.players[pid]["websocket"] is not None
                and self.players[pid]["room_id"] is None
            ]

            if len(available) < 2:
                return

            player_1, player_2 = available[:2]

            self.waiting_players = [
                pid
                for pid in self.waiting_players
                if pid not in (player_1, player_2)
            ]

            room_id = f"room-{uuid4()}"

            self.rooms[room_id] = [player_1, player_2]
            self.players[player_1]["room_id"] = room_id
            self.players[player_2]["room_id"] = room_id

            for pid in (player_1, player_2):
                websocket = self.players[pid]["websocket"]

                await websocket.send_json({
                    "type": "matched",
                    "player_id": pid,
                    "room_id": room_id,
                    "message": "Lawan ditemukan",
                })

    async def _notify_room(
        self,
        room_id: str,
        excluded_player_id: str,
        message: dict,
    ):
        for pid in self.rooms.get(room_id, []):
            if pid == excluded_player_id:
                continue

            websocket = self.players[pid]["websocket"]

            if websocket is not None:
                await websocket.send_json(message)

    async def disconnect(
        self,
        player_id: str,
        websocket: WebSocket,
    ):
        player = self.players.get(player_id)

        # Jangan menghapus koneksi baru jika koneksi lama
        # terlambat melaporkan disconnect.
        if player is None or player["websocket"] is not websocket:
            return

        player["websocket"] = None

        room_id = player["room_id"]

        if room_id is not None:
            await self._notify_room(
                room_id,
                player_id,
                {
                    "type": "player_disconnected",
                    "player_id": player_id,
                },
            )
