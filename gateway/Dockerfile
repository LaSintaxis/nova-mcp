FROM node:25.8.2

WORKDIR /app

COPY package*.json ./
RUN npm config set strict-ssl false && npm install

COPY . .

CMD ["node", "src/index.js"]