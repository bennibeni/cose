export async function preparePhoto(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Usa foto JPG, PNG o WebP. Converti prima le foto HEIC.');
  if(file.size>25*1024*1024)throw new Error('La foto originale supera 25 MB.');
  const bitmap=await createImageBitmap(file);
  try{
    const scale=Math.min(1,2000/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    for(const quality of [.88,.75,.6,.4]){
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
      if(blob && blob.size<=3*1024*1024)return new File([blob],'foto.jpg',{type:'image/jpeg'});
    }throw new Error('Foto troppo grande: riduci la risoluzione prima di caricarla.');
  }finally{bitmap.close();}
}
