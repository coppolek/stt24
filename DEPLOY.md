# Deploy Automatico su VPS Hostinger tramite GitHub Actions

Questo repository è configurato con una pipeline **GitHub Actions** (`.github/workflows/deploy.yml`) che compila automaticamente l'applicazione ad ogni `git push` sul branch `main` e trasferisce i file compilati nella cartella `/var/www/stt24/dist` della tua VPS Hostinger.

---

## 1. Configurazione della VPS Hostinger (Una tantum)

Collegati alla tua VPS via SSH:
```bash
ssh root@IP_DELLA_TUA_VPS
```

### A. Crea la cartella di destinazione:
```bash
sudo mkdir -p /var/www/stt24/dist
sudo chown -R $USER:$USER /var/www/stt24
```

### B. Configura Nginx:
1. Copia la configurazione fornita in `nginx.conf.example`:
   ```bash
   sudo nano /etc/nginx/sites-available/stt24
   ```
2. Incolla il contenuto di `nginx.conf.example` modificando `server_name` con il tuo dominio (o con l'IP della VPS).
3. Attiva il sito e ricarica Nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/stt24 /etc/nginx/sites-enabled/
   sudo rm -f /etc/nginx/sites-enabled/default
   sudo nginx -t
   sudo systemctl restart nginx
   ```

---

## 2. Configura i Secret su GitHub

Nel tuo repository su GitHub, vai su:
👉 **Settings** > **Secrets and variables** > **Actions** > **New repository secret**

Aggiungi i seguenti 4 Secrets:

| Nome Secret | Valore | Note |
| :--- | :--- | :--- |
| `REMOTE_HOST` | `123.456.78.90` | L'indirizzo IP pubblico della tua VPS Hostinger |
| `REMOTE_USER` | `root` | L'utente SSH della VPS (es. `root`) |
| `TARGET_DIR` | `/var/www/stt24/dist` | Percorso della cartella root sul server |
| `SSH_PRIVATE_KEY` | *(chiave privata SSH)* | La chiave privata per accedere senza password |

### Come generare la chiave SSH per GitHub (se non ne hai già una):
Sulla tua VPS, esegui:
```bash
# 1. Genera la coppia di chiavi
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions -N ""

# 2. Aggiungi la chiave pubblica a quelle autorizzate
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# 3. Mostra la chiave privata da copiare in GitHub:
cat ~/.ssh/github_actions
```
Copia tutto l'output (comprese le righe `-----BEGIN OPENSSH PRIVATE KEY-----` e `-----END OPENSSH PRIVATE KEY-----`) e incollalo nel Secret `SSH_PRIVATE_KEY` su GitHub.

---

## 3. Deploy Automatico via GitHub Actions

Adesso ad ogni `git push` sul branch `main`:
1. GitHub Actions avvia il job.
2. Installa le dipendenze e compila il progetto (`npm run build`).
3. Sincronizza i file in `/var/www/stt24/dist/` tramite rsync sicuro.
4. L'aggiornamento è subito visibile online sul tuo sito!

---

## 4. Esecuzione con Docker e Docker Compose (Alternativa Container)

Se preferisci eseguire l'intera applicazione in un container Docker sulla VPS:

### A. Avvio con Docker Compose:
Sulla tua VPS, nella cartella del progetto:
```bash
# Avvia il container in background e compila l'immagine
docker compose up -d --build
```
L'applicazione sarà subito attiva e raggiungibile sulla porta `80` (HTTP) della tua VPS.

### B. Comandi utili Docker:
```bash
# Visualizza i container attivi
docker compose ps

# Visualizza i log in tempo reale
docker compose logs -f

# Ferma l'applicazione
docker compose down
```
