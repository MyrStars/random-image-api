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
COPY .env* ./
RUN npm ci --production
COPY --from=client-builder /app/client/dist ./client/dist

VOLUME /app/data
EXPOSE 3100
CMD ["node", "server/index.js"]
