# Stato del progetto

- App: https://archivio-cose.vercel.app
- Progetto Vercel dedicato: archivio-cose.
- Google Drive autorizzato con scope drive.file; cartella privata e contenuti AES-256-GCM.
- Configurazione locale attiva in .env.local; copia della configurazione Drive in .env.drive.local. Entrambi esclusi da Git e deploy.
- Segreti configurati esclusivamente nell'ambiente Production di Vercel.
- Verificati compilazione, login e lettura dall'app locale, precondizioni Drive reali e protezione degli endpoint pubblicati.
- Firewall: bozza “Limita tentativi password archivio”, POST /api/auth, massimo 10 richieste ogni 60 secondi per IP, risposta 429. Attivazione bloccata dal controllo Vercel in attesa di approvazione umana esplicita.
- Conservare una copia protetta della chiave di cifratura. La sua perdita impedisce il recupero dei contenuti.
