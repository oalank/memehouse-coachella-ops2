FROM node:20-alpine AS builder

# Build React client (Vite)
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm install
COPY client/ ./
RUN npm run build

# Build server
FROM node:20-alpine
WORKDIR /app
COPY server/package.json ./
RUN npm install --production
COPY server/ ./
COPY --from=builder /app/client/dist ./client/build

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "index.js"]
