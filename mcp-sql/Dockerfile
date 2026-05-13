FROM node:20.13.0-alpine3.19

WORKDIR /app

# Fix npm SSL issue
RUN npm config set strict-ssl false

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application
COPY . .

EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["node", "src/index.js"]