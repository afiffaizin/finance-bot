FROM node:20-alpine

WORKDIR /app

# Copy package files dan install dependencies
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy source code dan migrations
COPY src/ ./src/
COPY migrations/ ./migrations/

EXPOSE 3002

CMD ["node", "src/index.js"]
