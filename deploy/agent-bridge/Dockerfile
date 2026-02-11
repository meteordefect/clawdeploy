FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Remove devDependencies after build
RUN npm prune --production

# Create non-root user
RUN addgroup -g 1001 -S agentbridge && \
    adduser -S agentbridge -u 1001

USER agentbridge

CMD ["npm", "start"]
