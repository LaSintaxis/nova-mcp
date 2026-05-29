FROM node:25.8.2

WORKDIR /app

RUN npm config set strict-ssl false

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["node", "src/index.js"]