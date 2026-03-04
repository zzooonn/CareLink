# Python 3.11 slim 이미지 사용
FROM python:3.11-slim

WORKDIR /app

# 시스템 패키지 설치 (scipy 빌드에 필요)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# 의존성 먼저 설치 (레이어 캐싱)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 소스 코드 복사
COPY src/ src/

WORKDIR /app/src

EXPOSE 8000

CMD ["python", "server.py"]
