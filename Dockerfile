FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
RUN npm install --workspace=backend --workspace=frontend

COPY frontend ./frontend
RUN npm run build --workspace=frontend

FROM node:20-alpine AS production

WORKDIR /app
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
RUN npm install --workspace=backend --omit=dev

COPY backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist

ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/data

EXPOSE 3001
CMD ["node", "backend/src/index.js"]
