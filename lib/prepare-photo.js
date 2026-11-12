export async function preparePhoto(file,crop){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Usa foto JPG, PNG o WebP. Converti prima le foto HEIC.');
  if(file.size>25*1024*1024)throw new Error('La foto originale supera 25 MB.');
  const bitmap=await createImageBitmap(file);
  try{
    const area=crop || {x:0,y:0,width:bitmap.width,height:bitmap.height};
    if(![area.x,area.y,area.width,area.height].every(Number.isFinite) || area.x<0 || area.y<0 || area.width<=0 || area.height<=0 || area.x+area.width>bitmap.width+1 || area.y+area.height>bitmap.height+1)throw new Error('Inquadratura non valida. Riprova a centrare la foto.');
    const scale=Math.min(1,2000/Math.max(area.width,area.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(area.width*scale));canvas.height=Math.max(1,Math.round(area.height*scale));
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,area.x,area.y,area.width,area.height,0,0,canvas.width,canvas.height);
    for(const quality of [.88,.75,.6,.4]){
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
      if(blob && blob.size<=3*1024*1024)return new File([blob],'foto.jpg',{type:'image/jpeg'});
    }throw new Error('Foto troppo grande: riduci la risoluzione prima di caricarla.');
  }finally{bitmap.close();}
}
