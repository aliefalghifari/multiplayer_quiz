from fastapi import FastAPI
from app.matchmaking import router as matchmaking_router

app = FastAPI(title="Matchmaking Quiz")

app.include_router(matchmaking_router)


@app.get("/")
async def root():
    return {"message": "Matchmaking Quiz API is running"}