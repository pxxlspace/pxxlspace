import os

from fastapi import FastAPI

app = FastAPI()


@app.get("/")
def read_root():
    return {"ok": True, "service": "FastAPI on Pxxl"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "3000")))
