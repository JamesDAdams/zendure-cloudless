FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

RUN apk add --no-cache python3 make g++ \
    && npm install --workspace=backend --workspace=frontend

COPY frontend ./frontend
RUN npm run build --workspace=frontend

RUN npm prune --omit=dev --workspace=backend

FROM node:22-alpine AS production

WORKDIR /app
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
COPY --from=builder /app/node_modules ./node_modules
COPY backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist

ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/data

EXPOSE 3001
CMD ["node", "backend/src/index.js"]
