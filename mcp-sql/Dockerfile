FROM node:25.8.2

WORKDIR /app

COPY package*.json ./
#linea para evitar problemas de certificados SSL al instalar paquetes npm
#no recomendada para produccion
RUN npm config set strict-ssl false && npm install     

COPY . .

CMD ["node", "src/index.js"]