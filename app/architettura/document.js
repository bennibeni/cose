'use client';
import {useEffect,useId,useState} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';

function MermaidDiagram({source}){
  const id=useId().replace(/[^a-zA-Z0-9_-]/g,'');
  const [svg,setSvg]=useState('');
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    let active=true;
    async function draw(){
      try{
        const {default:mermaid}=await import('mermaid');
        mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'base',fontFamily:'system-ui, sans-serif',themeVariables:{primaryColor:'#edf2e7',primaryTextColor:'#233c35',primaryBorderColor:'#91a58a',lineColor:'#315d4e'},flowchart:{htmlLabels:false}});
        const result=await mermaid.render('cose-diagram-'+id,source);
        if(active)setSvg(result.svg);
      }catch{if(active)setFailed(true);}
    }
    draw();return()=>{active=false;};
  },[id,source]);
  if(failed)return <div className="architecture-diagram"><p>Diagramma in formato sorgente:</p><pre><code>{source}</code></pre></div>;
  if(!svg)return <p className="muted" role="status">Caricamento diagramma…</p>;
  // Mermaid strict mode sanitizes SVG; raw HTML in Markdown is never enabled.
  return <div className="architecture-diagram" role="img" aria-label="Diagramma dell’architettura" dangerouslySetInnerHTML={{__html:svg}}/>;
}

function documentationLink(href){
  if(!href || href.startsWith('#') || /^https?:\/\//i.test(href))return href;
  return new URL(href,'https://github.com/bennibeni/cose/blob/main/docs/').href;
}

export default function ArchitectureDocument({markdown}){
  return <article className="architecture-document">
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]} skipHtml components={{
      a({href,children}){
        const target=documentationLink(href);
        return <a href={target} {...(target?.startsWith('https://') || target?.startsWith('http://')?{target:'_blank',rel:'noopener noreferrer'}:{})}>{children}</a>;
      },
      pre({children}){
        const code=Array.isArray(children)?children[0]:children;
        if(code?.props?.className==='language-mermaid')return <MermaidDiagram source={String(code.props.children).trim()}/>;
        return <pre>{children}</pre>;
      },
      table({children}){return <div className="architecture-table"><table>{children}</table></div>;}
    }}>{markdown}</ReactMarkdown>
  </article>;
}
