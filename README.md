# Cose — archivio privato

App Next.js con interfaccia italiana, password, CRUD, ricerca, ordinamento manuale e per campo, foto principale e galleria. Le foto si possono scegliere dal dispositivo o da un link web diretto e centrare/ritagliare con drag e zoom prima dell'upload. Telefono e indirizzo sono obbligatori; gli altri campi sono facoltativi. Supporta filesystem locale oppure Google Drive privato con cifratura per il deploy su Vercel.

## Documentazione per lo sviluppatore

La [guida dettagliata dell'architettura](docs/ARCHITETTURA.md) descrive componenti, modello dati, API, sessioni, cifratura, storage, concorrenza, flusso foto, configurazione, deploy, test, backup e limiti del codice corrente.

La stessa guida è consultabile nell'app alla pagina `/architettura`, dopo l'accesso, tramite il collegamento **Guida sviluppatore** nel footer dell'archivio. Il contenuto deriva direttamente dal file Markdown; tabelle, indice e diagrammi vengono visualizzati nella pagina.

Per configurare gli account e le variabili cloud, consulta anche [Google Drive e Vercel](GOOGLE-DRIVE-VERCEL.md).

## Avvio

1. `npm install`
2. Copia `.env.example` in `.env.local`. Imposta una password privata e una chiave casuale SESSION_SECRET di almeno 32 caratteri. Non usare i valori di esempio.
3. `npm run dev`
4. Apri http://localhost:3000. Dal telefono sulla stessa rete usa http://INDIRIZZO-IP-DEL-PC:3000 (potrebbe servire consentire la porta nel firewall).

## Vercel + Google Drive

L'app è pubblicata su https://archivio-cose.vercel.app e collegata a Google Drive. L'autorizzazione Google usa OAuth con scope ristretto drive.file; JSON e foto vengono cifrati sul server. I segreti sono configurati soltanto nelle variabili server Production di Vercel e nei file locali ignorati. Vedi anche [la guida di configurazione](GOOGLE-DRIVE-VERCEL.md).

Su Vercel il backend rifiuta il filesystem locale: occorre STORAGE_BACKEND=drive con tutti i segreti indicati nella guida. La regola firewall per il limite distribuito dei tentativi password è in bozza: Vercel richiede un'approvazione esplicita per pubblicarla.

## Server con disco persistente

Esegui `npm run build` e `npm start` su un server Node con disco persistente. Imposta STORAGE_BACKEND=local, DATA_DIR con il percorso del volume permanente, ARCHIVE_PASSWORD, SESSION_SECRET, APP_ORIGIN con l'URL HTTPS del sito e COOKIE_SECURE=true. Usa un reverse proxy HTTPS che conservi Host e limiti gli upload a 4 MB.

Il backend locale richiede un singolo processo Node: la coda serializza le scritture, il numero di revisione rileva modifiche da altri dispositivi e la sostituzione del JSON è atomica. Non usare più repliche né filesystem temporanei con questa modalità. Il backend Drive usa invece scritture condizionali sull'ETag, compatibili con istanze serverless indipendenti.

## Dati e backup

In modalità locale il JSON è `DATA_DIR/items.json`; le immagini sono `DATA_DIR/photos/` e vengono servite solo dopo autenticazione. Esegui il backup dell'intera directory dati a processo fermo. In modalità Drive, salva anche una copia protetta della chiave di cifratura: senza quella i dati non sono recuperabili. Eliminare una scheda o rimuovere una foto dalla scheda non elimina il file immagine: evita la perdita di file ancora referenziati o caricati durante una modifica annullata.

La sessione dura 7 giorni. Cambiare password o SESSION_SECRET invalida tutte le sessioni. Il limite tentativi password è in memoria: in produzione applicare anche il rate limit Vercel descritto nella guida o un limite al reverse proxy. Le foto supportate sono JPG, PNG e WebP (convertire HEIC prima di caricare); vengono convertite in JPEG fino a 2000 pixel sul lato lungo e 3 MiB per upload. I metadati originali non sono conservati.

## Verifica

`npm test` verifica CRUD persistente, conflitti di scrittura tra istanze indipendenti con Drive simulato, cifratura e integrità, foto, validazione e sessioni. `npm run build` verifica la compilazione Next.js. Lo script di collegamento verifica le precondizioni delle scritture anche sull'account Drive reale prima di generare la configurazione.
