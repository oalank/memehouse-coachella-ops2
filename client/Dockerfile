FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

ARG CACHE_BUST
ARG VITE_API_BASE_URL
ARG VITE_API_URL

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_API_URL=$VITE_API_URL

RUN echo "Cache bust: ${CACHE_BUST:-none}"
RUN echo "VITE_API_BASE_URL=${VITE_API_BASE_URL:-missing}"
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist

RUN npm install -g serve

EXPOSE 4173

CMD ["serve", "-s", "dist", "-l", "4173"]
