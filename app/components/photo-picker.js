'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import Cropper from 'react-easy-crop';
import {preparePhoto} from '../../lib/prepare-photo';

export default function PhotoPicker({disabled,remaining,onSave,onPendingChange}){
  const [source,setSource]=useState(null),[queue,setQueue]=useState([]),[web,setWeb]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const [crop,setCrop]=useState({x:0,y:0}),[zoom,setZoom]=useState(1),[aspect,setAspect]=useState(3/2),[pixels,setPixels]=useState(null);
  const request=useRef(null);
  const mounted=useRef(true);
  const pickerRef=useRef(null),dialogRef=useRef(null);
  const active=!!source || !!queue.length || loading;
  useEffect(()=>{onPendingChange(active);return()=>onPendingChange(false);},[active,onPendingChange]);
  useEffect(()=>()=>{if(source)URL.revokeObjectURL(source.url);},[source]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;request.current?.abort();};},[]);
  useEffect(()=>{
    if(!source)return;
    const parent=pickerRef.current?.closest('.modal');
    const wasInert=parent?.hasAttribute('inert');
    const overflow=document.body.style.overflow;
    parent?.setAttribute('inert','');document.body.style.overflow='hidden';
    dialogRef.current?.querySelector('button')?.focus();
    return()=>{
      if(!wasInert)parent?.removeAttribute('inert');
      document.body.style.overflow=overflow;
      pickerRef.current?.focus();
    };
  },[source]);

  async function openFile(file){
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Usa JPG, PNG o WebP. Converti prima le foto HEIC.');
    if(file.size>25*1024*1024)throw new Error('La foto originale supera 25 MB.');
    let bitmap;try{bitmap=await createImageBitmap(file);}catch{throw new Error('Non è stato possibile aprire questa immagine.');}
    const ratio=bitmap.width/bitmap.height;bitmap.close();
    if(!mounted.current)return;
    setCrop({x:0,y:0});setZoom(1);setAspect(3/2);setPixels(null);
    setSource({file,url:URL.createObjectURL(file),ratio});
  }
  async function selectFiles(files){
    setError('');if(!files.length)return;
    if(files.length>remaining){setError(`Puoi aggiungere ancora ${remaining} foto.`);return;}
    setLoading(true);
    try{await openFile(files[0]);setQueue(files.slice(1));}catch(e){setError(e.message);}finally{setLoading(false);}
  }
  async function importWeb(){
    setLoading(true);setError('');request.current?.abort();request.current=new AbortController();
    try{
      const res=await fetch('/api/photos/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:web.trim()}),signal:request.current.signal});
      if(!res.ok){const body=await res.json().catch(()=>({}));throw new Error(res.status===401?'Sessione scaduta. Accedi nuovamente.':body.error || 'Impossibile importare questa immagine.');}
      const file=new File([await res.blob()],'immagine-web.jpg',{type:'image/jpeg'});
      await openFile(file);setWeb('');
    }catch(e){if(e.name!=='AbortError')setError(e.message);}finally{setLoading(false);}
  }
  async function advance(){
    setSource(null);setPixels(null);
    if(queue.length){const [next,...rest]=queue;setQueue([]);await openFile(next);setQueue(rest);}
  }
  async function usePhoto(){
    if(!source || !pixels)return;
    setError('');setLoading(true);
    try{await onSave(await preparePhoto(source.file,pixels));await advance();}catch(e){setError(e.message);}finally{setLoading(false);}
  }
  function cancel(){setQueue([]);setSource(null);setPixels(null);setError('');}
  function dialogKey(event){
    if(event.key==='Escape' && !locked){event.preventDefault();event.stopPropagation();cancel();return;}
    if(event.key!=='Tab')return;
    const targets=Array.from(dialogRef.current?.querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled),[tabindex="0"]') || []).filter(el=>el.getClientRects().length);
    const first=targets[0],last=targets[targets.length-1];
    if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
  }
  const locked=disabled || loading;
  return <section ref={pickerRef} tabIndex={-1} className="photo-picker" aria-label="Aggiungi e inquadra immagini">
    {!source && <>
      <label className="upload">＋ Dal dispositivo <small>Seleziona una o più foto, poi scegli l’inquadratura.</small><input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={locked || remaining<=0} onChange={e=>{const files=Array.from(e.target.files);e.target.value='';selectFiles(files);}}/></label>
      <div className="web-photo"><label>Oppure da un link web<input type="text" inputMode="url" autoComplete="off" placeholder="https://…/immagine.jpg" value={web} disabled={locked || remaining<=0} onChange={e=>setWeb(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(web.trim() && !locked)importWeb();}}}/></label><button type="button" disabled={locked || !web.trim() || remaining<=0} onClick={importWeb}>Apri immagine</button></div>
      <small>Sul sito di origine usa “Copia indirizzo immagine”.</small>
    </>}
    {source && createPortal(<div className="crop-overlay"><section ref={dialogRef} className="crop-dialog" role="dialog" aria-modal="true" aria-labelledby="crop-dialog-title" onKeyDown={dialogKey}>
      <div className="crop-dialog-header"><div><h2 id="crop-dialog-title">Centra l’immagine</h2><small>{queue.length?`Altre ${queue.length} da inquadrare`:'Trascina la foto e regola lo zoom.'}</small></div><button type="button" aria-label="Annulla inquadratura" disabled={locked} onClick={cancel}>✕</button></div>
      <div className="crop-dialog-body">
        <div className="crop-stage" style={locked?{pointerEvents:'none'}:undefined}><Cropper image={source.url} crop={crop} zoom={zoom} minZoom={1} maxZoom={4} aspect={aspect} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(area,areaPixels)=>setPixels(areaPixels)} zoomWithScroll={false} cropperProps={{tabIndex:0,'aria-label':'Inquadratura: trascina la foto o usa i tasti freccia'}}/></div>
        <div className="crop-settings"><label>Formato<select value={aspect} disabled={locked} onChange={e=>{setAspect(Number(e.target.value));setCrop({x:0,y:0});setZoom(1);}}><option value={3/2}>Card · 3:2</option><option value={1}>Quadrato · 1:1</option>{source.ratio!==1 && source.ratio!==3/2 && <option value={source.ratio}>Formato originale</option>}</select></label><label>Zoom<input type="range" min="1" max="4" step="0.01" value={zoom} disabled={locked} onChange={e=>setZoom(Number(e.target.value))}/></label></div>
      </div>
      <div className="crop-dialog-footer">
        {loading && <p className="muted" role="status">Preparazione e salvataggio…</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="crop-actions"><button type="button" disabled={locked} onClick={()=>{setCrop({x:0,y:0});setZoom(1);}}>Ricentra</button><button type="button" disabled={locked} onClick={cancel}>Annulla foto</button><button type="button" className="primary" disabled={locked || !pixels} onClick={usePhoto}>Usa questa immagine</button></div>
        <small>Conferma la foto, poi salva la scheda.</small>
      </div>
    </section></div>,document.body)}
    {loading && !source && <p className="muted" role="status">Caricamento immagine…</p>}
    {error && !source && <p className="error" role="alert">{error}</p>}
    {remaining<=0 && !source && <small>Hai raggiunto il limite di 30 foto per scheda.</small>}
  </section>;
}
