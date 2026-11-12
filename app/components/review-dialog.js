'use client';
import {useEffect,useRef} from 'react';

export default function ReviewDialog({review,onClose}){
  const ref=useRef(null);
  useEffect(()=>{
    const dialog=ref.current,previous=document.activeElement;dialog.showModal();
    return()=>{dialog.close();if(previous instanceof HTMLElement && previous.isConnected)previous.focus();};
  },[]);
  function backdrop(event){
    if(event.target!==event.currentTarget)return;
    const r=ref.current.getBoundingClientRect();
    if(event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom)onClose();
  }
  return <dialog ref={ref} className="review-dialog" aria-labelledby="review-dialog-title" onCancel={onClose} onClick={backdrop}>
    <div className="review-dialog-header"><div><h2 id="review-dialog-title">Recensione</h2><p>{review.address}</p></div><button type="button" onClick={onClose} aria-label="Chiudi recensione" autoFocus>✕</button></div>
    <div className="review-text">{review.text}</div>
  </dialog>;
}
