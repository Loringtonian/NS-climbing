import{dB as U,d8 as I,d5 as P,da as u,d7 as e,e8 as v,ek as j,dx as W,dt as A}from"./index-C4ZNpdge.js";import{F as M}from"./ExclamationTriangleIcon-CX9WbOtR.js";import{F as V}from"./LockClosedIcon-Cn8D-wig.js";import{T as S,k,u as b}from"./ModalHeader-CPoYSZQh-DkLRrfpR.js";import{r as H}from"./Subtitle-CV-2yKE4-2RwwCTjw.js";import{e as $}from"./Title-BnzYV3Is-Btztt1d5.js";const B=A.div`
  && {
    border-width: 4px;
  }

  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
  aspect-ratio: 1;
  border-style: solid;
  border-color: ${l=>l.$color??"var(--privy-color-accent)"};
  border-radius: 50%;
`,z={component:()=>{var p;let{user:l}=U(),{client:T,walletProxy:m,refreshSessionAndUser:C,closePrivyModal:i}=I(),s=P(),{entropyId:f,entropyIdVerifier:E}=((p=s.data)==null?void 0:p.recoverWallet)??{},[n,h]=u.useState(!1),[c,F]=u.useState(null),[d,g]=u.useState(null);function y(){var r,o,t,a;if(!n){if(d)return(o=(r=s.data)==null?void 0:r.setWalletPassword)==null||o.onFailure(d),void i();if(!c)return(a=(t=s.data)==null?void 0:t.setWalletPassword)==null||a.onFailure(Error("User exited set recovery flow")),void i()}}s.onUserCloseViaDialogOrKeybindRef.current=y;let R=!(!n&&!c);return e.jsxs(e.Fragment,d?{children:[e.jsx(S,{onClose:y},"header"),e.jsx(B,{$color:"var(--privy-color-error)",style:{alignSelf:"center"},children:e.jsx(M,{height:38,width:38,stroke:"var(--privy-color-error)"})}),e.jsx($,{style:{marginTop:"0.5rem"},children:"Something went wrong"}),e.jsx(v,{style:{minHeight:"2rem"}}),e.jsx(k,{onClick:()=>g(null),children:"Try again"}),e.jsx(b,{})]}:{children:[e.jsx(S,{onClose:y},"header"),e.jsx(V,{style:{width:"3rem",height:"3rem",alignSelf:"center"}}),e.jsx($,{style:{marginTop:"0.5rem"},children:"Automatically secure your account"}),e.jsx(H,{style:{marginTop:"1rem"},children:"When you log into a new device, you’ll only need to authenticate to access your account. Never get logged out if you forget your password."}),e.jsx(v,{style:{minHeight:"2rem"}}),e.jsx(k,{loading:n,disabled:R,onClick:()=>(async function(){h(!0);try{let r=await T.getAccessToken(),o=j(l,f);if(!r||!m||!o)return;if(!(await m.setRecovery({accessToken:r,entropyId:f,entropyIdVerifier:E,existingRecoveryMethod:o.recoveryMethod,recoveryMethod:"privy"})).entropyId)throw Error("Unable to set recovery on wallet");let t=await C();if(!t)throw Error("Unable to set recovery on wallet");let a=j(t,o.address);if(!a)throw Error("Unabled to set recovery on wallet");F(!!t),setTimeout((()=>{var x,w;(w=(x=s.data)==null?void 0:x.setWalletPassword)==null||w.onSuccess(a),i()}),W)}catch(r){g(r)}finally{h(!1)}})(),children:c?"Success":"Confirm"}),e.jsx(b,{})]})}};export{z as SetAutomaticRecoveryScreen,z as default};
