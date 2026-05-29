FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY server/ ./server/
COPY package*.json ./
# 注意：不将 .env 烘焙到镜像中，应通过 docker-compose 挂载或环境变量注入
RUN npm install --omit=dev
COPY --from=client-builder /app/client/dist ./client/dist

VOLUME /app/data
EXPOSE 3100
CMD ["node", "server/index.js"]
