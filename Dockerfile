# Multi-stage Dockerfile per STT24

# 1. Build stage: installazione dipendenze e build del bundle React/Vite
FROM node:22-alpine AS builder

WORKDIR /app

# Copia i file di dipendenze per sfruttare il layer cache di Docker
COPY package*.json ./
RUN npm install

# Copia il codice sorgente
COPY . .

# Compila l'applicazione per la produzione (genera la cartella /dist)
RUN npm run build

# 2. Production stage: server web Nginx leggero e ultra-ottimizzato
FROM nginx:alpine AS runner

# Rimuovi la configurazione predefinita di Nginx
RUN rm -rf /etc/nginx/conf.d/default.conf

# Copia la configurazione personalizzata Nginx per SPA
COPY nginx-docker.conf /etc/nginx/conf.d/default.conf

# Copia i file statici compilati dallo stage precedente
COPY --from=builder /app/dist /usr/share/nginx/html

# Espone la porta 80 del container
EXPOSE 80

# Avvia Nginx in primo piano
CMD ["nginx", "-g", "daemon off;"]
