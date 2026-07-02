FROM node:20-alpine

WORKDIR /app

# Copy package files dan install dependencies
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy source code
COPY src/ ./src/

# Volume untuk persistent auth session
VOLUME ["/app/auth_session"]

EXPOSE 3001

CMD ["node", "src/index.js"]
