FROM node:25.8.2
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar el resto del código
COPY . .

# Exponer puerto
EXPOSE 5000

# Comando para iniciar
CMD ["node", "src/index.js"]