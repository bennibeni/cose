import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {authorized} from '../../lib/auth.mjs';
import ArchitectureDocument from './document';
import './style.css';

export const dynamic='force-dynamic';
export const runtime='nodejs';
export const metadata={title:'Architettura — Cose',robots:{index:false,follow:false}};

export default async function ArchitecturePage(){
  if(!authorized({cookies:await cookies()}))redirect('/?next=architettura');
  const markdown=await readFile(path.join(process.cwd(),'docs','ARCHITETTURA.md'),'utf8');
  return <>
    <header className="architecture-header">
      <a className="brand" href="/" aria-label="Torna all’archivio">cose<span>●</span></a>
      <span className="private">Guida sviluppatore</span>
      <a className="back-to-archive" href="/">← Torna all’archivio</a>
    </header>
    <main className="architecture-workspace">
      <div className="architecture-intro"><p className="eyebrow">DOCUMENTAZIONE TECNICA</p><p className="muted">Componenti, dati e procedure di manutenzione di Cose.</p></div>
      <ArchitectureDocument markdown={markdown}/>
      <a className="back-to-archive architecture-bottom" href="/">← Torna all’archivio</a>
    </main>
  </>;
}
