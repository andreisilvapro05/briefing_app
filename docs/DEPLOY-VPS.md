# Deploy do Fysi Briefing num VPS Ubuntu

Guia prático pra subir o app num servidor próprio, substituindo o Vercel.
Tempo estimado: ~30 min se o VPS já está pronto com SSH.

## Pré-requisitos

- VPS Ubuntu 22.04 LTS ou superior (1 GB RAM mínimo, 2 GB recomendado)
- Acesso SSH como usuário com `sudo`
- Domínio apontado pro IP do VPS (DNS tipo A: `app.fysilabdigital.com.br` → IP)
- Conta Supabase + Autentique funcionando (não precisa mexer nisso)

---

## 1. Setup do servidor (uma vez só)

SSH no servidor e roda:

```bash
# Atualiza pacotes
sudo apt update && sudo apt upgrade -y

# Node 20 (Next.js 16 exige Node ≥ 20)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential git

# PM2 (gerenciador de processo pra manter o app rodando)
sudo npm install -g pm2

# Nginx (reverse proxy + SSL)
sudo apt install -y nginx

# Certbot (SSL grátis via Let's Encrypt)
sudo apt install -y certbot python3-certbot-nginx

# Firewall — abre só HTTP/HTTPS/SSH
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Confere as versões:

```bash
node -v   # deve mostrar v20.x ou maior
npm -v
pm2 -v
nginx -v
```

---

## 2. Clonar o repo

```bash
cd /var/www
sudo mkdir briefing && sudo chown $USER:$USER briefing
cd briefing
git clone https://github.com/andreisilvapro05/briefing_app.git .
```

---

## 3. Variáveis de ambiente

Cria o `.env.local` com as mesmas variáveis que estavam no Vercel:

```bash
nano .env.local
```

Cola o conteúdo (substitui os valores reais — copia da Vercel se ainda tem
acesso lá, ou do gerenciador de senhas):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://hwsiukyxkhvmtkbqlerx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=briefing-uploads

# Resend (e-mail)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Fysi Lab <onboarding@fysilab.com>
TEAM_EMAIL=fysilabdigital@gmail.com

# ClickUp
CLICKUP_API_TOKEN=pk_...
CLICKUP_LIST_ID=...

# Captcha (pode deixar bypass)
BYPASS_CAPTCHA=true

# Admin
ADMIN_PASSWORD=fysi-2026
ADMIN_EMAILS=karine@fysilab.com,andrei@fysilab.com

# Acesso cliente
CLIENT_ACCESS_CODE=<o-código-que-você-escolheu>

# Autentique
AUTENTIQUE_API_TOKEN=<token-novo>
FYSI_SIGNER_NAME=Karine Sackt
FYSI_SIGNER_EMAIL=karine@fysilab.com

# App
NEXT_PUBLIC_APP_URL=https://app.fysilabdigital.com.br
NODE_ENV=production
```

Salva (`Ctrl+O`, `Enter`, `Ctrl+X`).

---

## 4. Build + rodar com PM2

```bash
# Dependências + build
npm install
npm run build

# Sobe com PM2 (porta 3000 por padrão)
pm2 start npm --name briefing -- start
pm2 save
pm2 startup    # cola o comando que ele imprimir, com sudo
```

Verifica:

```bash
pm2 status
curl http://localhost:3000     # deve devolver HTML
```

---

## 5. Nginx (reverse proxy + HTTPS)

Cria o site:

```bash
sudo nano /etc/nginx/sites-available/briefing
```

Cola (troca o `server_name` pelo seu domínio):

```nginx
server {
    listen 80;
    server_name app.fysilabdigital.com.br;

    client_max_body_size 30M;   # uploads do briefing (limite 25MB)

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Ativa:

```bash
sudo ln -s /etc/nginx/sites-available/briefing /etc/nginx/sites-enabled/
sudo nginx -t              # confere sintaxe
sudo systemctl reload nginx
```

Testa: `http://app.fysilabdigital.com.br` — deve abrir o site.

---

## 6. SSL (HTTPS)

```bash
sudo certbot --nginx -d app.fysilabdigital.com.br
```

Responde os prompts (e-mail pra renovação, aceita os termos, escolhe redirect
HTTP→HTTPS). O Certbot edita o Nginx sozinho.

Testa: `https://app.fysilabdigital.com.br` — cadeado verde.

Renovação automática já vem configurada (`sudo certbot renew --dry-run` testa).

---

## 7. Atualizações futuras (deploy de novas versões)

Sempre que merger algo na `main` no GitHub:

```bash
cd /var/www/briefing
git pull
npm install              # só se package.json mudou
npm run build
pm2 restart briefing
```

Pra automatizar (CI/CD via GitHub Actions ou similar), peça mais tarde.

---

## 8. Logs e debug

```bash
pm2 logs briefing              # logs em tempo real
pm2 monit                      # CPU/memória ao vivo
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

Reiniciar tudo:

```bash
pm2 restart briefing
sudo systemctl restart nginx
```

---

## Checklist final

- [ ] `https://app.fysilabdigital.com.br` carrega
- [ ] `/admin/login` → senha → cai em `/admin?key=...` (sem erro)
- [ ] `/painel/<slug>` redireciona pro `/dashboard` (testa com cliente existente)
- [ ] Upload de arquivo no briefing funciona (limite 25MB no Nginx OK)
- [ ] Gerar contrato no admin → Autentique recebe e envia e-mail
- [ ] DNS do domínio aponta pra esse VPS (não pro Vercel antigo)
- [ ] Vercel antigo pode ser desativado (pra não cobrar duplicado)

Se algo travar, me chama com a saída de `pm2 logs briefing` que eu identifico.
