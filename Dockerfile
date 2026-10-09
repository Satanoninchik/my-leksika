FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
RUN python3 -m venv /opt/voice && /opt/voice/bin/pip install --no-cache-dir piper-tts==1.8.0
RUN mkdir voices && curl -fL --retry 3 https://huggingface.co/rhasspy/piper-voices/resolve/main/ru/ru_RU/ruslan/medium/ru_RU-ruslan-medium.onnx -o voices/ru_RU-ruslan-medium.onnx && curl -fL --retry 3 https://huggingface.co/rhasspy/piper-voices/resolve/main/ru/ru_RU/ruslan/medium/ru_RU-ruslan-medium.onnx.json -o voices/ru_RU-ruslan-medium.onnx.json && curl -fL --retry 3 https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/high/en_US-lessac-high.onnx -o voices/en_US-lessac-high.onnx && curl -fL --retry 3 https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/high/en_US-lessac-high.onnx.json -o voices/en_US-lessac-high.onnx.json
COPY . .
ENV NODE_ENV=production LEXIKA_BIND=0.0.0.0 LEXIKA_PYTHON=/opt/voice/bin/python OMP_NUM_THREADS=1
EXPOSE 10000
CMD ["node","server-neural.cjs"]
