export default {
  outputFileTracingIncludes:{'/architettura':['./docs/ARCHITETTURA.md']},
  outputFileTracingExcludes:{'/*':['./data/**/*','./.env*','./scripts/**/*','./.google-oauth-client.json','./client_secret*.json']},
  async headers(){return [
    {source:'/:path*',headers:[
      {key:'X-Content-Type-Options',value:'nosniff'},
      {key:'X-Frame-Options',value:'DENY'},
      {key:'Referrer-Policy',value:'no-referrer'},
      {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
      {key:'Content-Security-Policy',value:"frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'"}
    ]},
    {source:'/api/:path*',headers:[{key:'Cache-Control',value:'private, no-store'}]},
    {source:'/architettura',headers:[{key:'Cache-Control',value:'private, no-store'},{key:'X-Robots-Tag',value:'noindex, nofollow'}]}
  ];}
};
