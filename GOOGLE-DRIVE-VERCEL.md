# Configurazione privata: Vercel e Google Drive

Il collegamento Google è stato autorizzato e l'app è pubblicata su https://archivio-cose.vercel.app. I segreti Production sono configurati e i controlli sulle scritture simultanee sono stati verificati sull'account reale. La regola firewall è ancora in bozza, in attesa dell'approvazione esplicita richiesta da Vercel. Non inviare password, client secret, refresh token o chiavi in chat.

## Come viene limitato l'accesso

- Si usa un client OAuth dedicato e soltanto `https://www.googleapis.com/auth/drive.file`. Questo consente l'accesso ai file creati o esplicitamente aperti con l'app, non all'intero Drive. Non si usa lo scope completo `drive`, né delega di dominio.
- La configurazione crea una nuova cartella privata nel tuo My Drive. Non crea permessi pubblici, link condivisi o inviti. I controlli rifiutano un archivio o una foto che risultino condivisi.
- JSON e foto sono cifrati AES-256-GCM prima dell'upload. La chiave resta nelle variabili server di Vercel: Drive conserva il contenuto cifrato. Vercel può decifrarlo per mostrarlo dopo la password; non si tratta di cifratura end-to-end rispetto a Vercel.
- Token OAuth, client secret e chiave non passano al frontend. Il browser riceve soltanto dati e immagini dopo l'autenticazione. Il backend limita le richieste agli ID dell'archivio configurato e alle foto della sua cartella.
- La sessione usa cookie HttpOnly, SameSite=Strict e Secure su Vercel. Le modifiche richiedono l'origine esatta configurata in APP_ORIGIN. Cambiare password o SESSION_SECRET invalida le sessioni esistenti.

## 1. Crea il client OAuth Google

Nel [Google Cloud Console](https://console.cloud.google.com/), crea un progetto dedicato oppure seleziona quello destinato all'app. Abilita **Google Drive API**.

In **Google Auth Platform**, configura nome e consenso dell'app per il tuo account. Crea un client OAuth di tipo **Applicazione web**. Aggiungi questo URI di reindirizzamento autorizzato esatto:

```
http://127.0.0.1:53682/oauth/callback
```

Il callback è locale e viene aperto soltanto dallo script di configurazione. Nessun callback di collegamento Drive è esposto dall'app pubblicata.

Per provare il collegamento puoi usare lo stato Testing e aggiungere il tuo account tra gli utenti di test. Per un collegamento duraturo passa allo stato In production secondo le richieste mostrate da Google: per app esterne in Testing i refresh token con scope Drive normalmente scadono dopo 7 giorni. Il consenso Google e le eventuali richieste di verifica devono essere completati dal proprietario.

Crea nella cartella del progetto il file locale **.env.oauth.local** con questi due valori, senza pubblicarlo:

```
GOOGLE_CLIENT_ID=il-client-id-google
GOOGLE_CLIENT_SECRET=il-client-secret-google
```

## 2. Autorizza personalmente il tuo account

Dal terminale nella cartella dell'app, con Node 22 o superiore:

```
node --env-file=.env.oauth.local scripts/connect-drive.mjs
```

In alternativa, lo script legge direttamente `.google-oauth-client.json` se le variabili del client non sono già impostate: in quel caso basta `node scripts/connect-drive.mjs`. Conservare il JSON solo localmente: è escluso da Git, tracing Next.js e upload Vercel.

Apri il link stampato nel tuo browser e completa l'accesso Google. Controlla il nome dell'app, l'account scelto e che il consenso riguardi solo i file usati con l'app. Non è richiesta la password Google nell'app Cose.

Lo script usa state casuale e PKCE, ascolta solo su 127.0.0.1, ha una scadenza di 10 minuti e non stampa i token. Crea una cartella e un archivio vuoto cifrato; verifica inoltre su Drive che una scrittura con una versione superata venga rifiutata. Alla fine salva i valori in **.env.drive.local**, escluso da Git e dal caricamento Vercel. Non rilanciarlo per aprire un archivio esistente: conserva il file di configurazione. Se fallisce dopo aver creato una cartella, può rimanere una cartella vuota da controllare manualmente in Drive.

## 3. Configura Vercel

Importa il progetto Next.js con **Root Directory = archivio-cose** se importi il repository contenitore, oppure la radice se pubblichi solo questa cartella. Il build command è `npm run build`.

Nelle variabili di ambiente **Production** inserisci i valori generati nel file .env.drive.local, usando i valori delle stringhe senza le virgolette esterne:

| Nome | Uso |
| --- | --- |
| STORAGE_BACKEND | `drive` |
| GOOGLE_CLIENT_ID | Client OAuth dedicato |
| GOOGLE_CLIENT_SECRET | Segreto del client |
| GOOGLE_REFRESH_TOKEN | Autorizzazione offline ottenuta da Google |
| GOOGLE_DRIVE_FOLDER_ID | Cartella creata dallo script |
| GOOGLE_DRIVE_ARCHIVE_ID | JSON cifrato creato dallo script |
| ARCHIVE_ENCRYPTION_KEY | Chiave base64 di 32 byte generata dallo script |
| ARCHIVE_PASSWORD | Password privata casuale di almeno 16 caratteri |
| SESSION_SECRET | Segreto casuale di almeno 32 caratteri |
| APP_ORIGIN | URL HTTPS finale esatto, per esempio `https://nome-app.vercel.app` |

Marca come Sensitive i segreti dove Vercel lo consente. Nessuna variabile deve avere prefisso NEXT_PUBLIC_. Non copiare i segreti Production negli ambienti Preview: usa un archivio di test separato se necessario. Prima di inserire contatti reali completa e verifica l'accesso HTTPS sul dominio definitivo. Dopo modifiche alle variabili ridistribuisci il progetto.

Configura anche una regola in **Firewall → Configure → New Rule**: Request Path uguale a `/api/auth`, Request Method `POST`, Rate Limit **10 richieste in 1 minuto per IP**, azione **429 / Too many requests**. Pubblica la regola e verificane il funzionamento. Il limite in memoria dell'app è una protezione aggiuntiva per istanza e non sostituisce il limite distribuito del firewall.

## Foto, dimensioni e concorrenza

Il browser ridimensiona le foto a un massimo di 2000 pixel sul lato lungo, le converte in JPEG e rimuove i metadati originali. L'upload al backend è limitato a 3 MiB per rispettare il limite del payload delle funzioni Vercel (4,5 MB, incluso multipart). Gli originali non vengono conservati. HEIC richiede conversione prima dell'upload.

L'archivio resta un JSON unico cifrato. Le modifiche usano revisione applicativa e If-Match sull'ETag Drive v2; in caso di conflitto l'app chiede di ricaricare, senza sovrascrivere silenziosamente. Lo script di configurazione verifica questa precondizione sull'account reale prima di salvare i segreti. I test automatici in repository usano un Drive simulato: senza credenziali non costituiscono una verifica live di Google.

È una soluzione per un piccolo archivio personale. Ogni caricamento dell'archivio richiede più chiamate Google e ogni foto viene inoltrata dal backend; non offre le prestazioni o le transazioni di un database.

## Recupero e revoca

Conserva una copia protetta di ARCHIVE_ENCRYPTION_KEY e degli ID dell'archivio, separatamente dal repository. **Perdere la chiave significa non poter decifrare i dati.** Non cambiare la chiave su un archivio esistente senza una procedura di migrazione.

Per revocare l'accesso rimuovi l'app nelle [connessioni del tuo Account Google](https://myaccount.google.com/connections) e rimuovi GOOGLE_REFRESH_TOKEN da Vercel. L'app smetterà di accedere a Drive; i file rimarranno sul tuo account.

Le eliminazioni dall'interfaccia rimuovono le schede dal JSON. I file foto non referenziati rimangono cifrati nella cartella per evitare cancellazioni accidentali; il backup deve includere cartella e chiave.

## Riferimenti ufficiali

- [Scope Drive](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [OAuth per applicazioni server](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Scadenza e revoca dei token](https://developers.google.com/identity/protocols/oauth2#expiration)
- [Limiti Vercel Functions](https://vercel.com/docs/functions/limitations)
- [Rate limiting Vercel](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)
