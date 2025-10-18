FROM node:20-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build the application
RUN npm run build

# Expose port
EXPOSE 8080

# Start the application
CMD ["npm", "run", "web"]
