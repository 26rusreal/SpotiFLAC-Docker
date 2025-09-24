FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ffmpeg \
       flac \
       ca-certificates \
       tzdata \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /
COPY app/ /app
RUN pip install --no-cache-dir -r /app/requirements.txt

ENV DOWNLOAD_DIR=/downloads \
    CONFIG_DIR=/config

EXPOSE 8080

CMD ["uvicorn", "app.api.main:app", "--host", "0.0.0.0", "--port", "8080"]
