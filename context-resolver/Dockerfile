FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm config set strict-ssl false && npm install

COPY . .

CMD ["node", "src/index.js"]