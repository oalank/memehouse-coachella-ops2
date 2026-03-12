FROM node:20-alpine

WORKDIR /app

# Install server dependencies
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy server source
COPY . .

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "index.js"]

