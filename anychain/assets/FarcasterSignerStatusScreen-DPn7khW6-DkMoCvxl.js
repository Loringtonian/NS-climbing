import{d5 as F,d6 as T,d8 as I,da as d,dx as k,d7 as t,dz as x,du as O,dt as n}from"./index-D8zVZxEl.js";import{h as q}from"./CopyToClipboard-DSTf_eKU-nQfbrKBS.js";import{n as B}from"./OpenLink-DZHy38vr-B6VVk4cP.js";import{C as E}from"./QrCode-GD4v2DKo-BwvycTb-.js";import{n as M}from"./ScreenLayout-CZ6F2ueW-B-z-REPT.js";import{l as h}from"./farcaster-DPlSjvF5-Mx7hKGJa.js";import"./dijkstra-COg3n3zL.js";import"./ModalHeader-CPoYSZQh-ClCx9Ch3.js";import"./Screen-J_oQ5CmO-CYzNcj07.js";import"./index-Dq_xe9dz-Ar6d4y7-.js";let S="#8a63d2";const _=({appName:u,loading:m,success:i,errorMessage:e,connectUri:r,onBack:s,onClose:c,onOpenFarcaster:o})=>t.jsx(M,x.isMobile||m?x.isIOS?{title:e?e.message:"Add a signer to Farcaster",subtitle:e?e.detail:`This will allow ${u} to add casts, likes, follows, and more on your behalf.`,icon:h,iconVariant:"loading",iconLoadingStatus:{success:i,fail:!!e},primaryCta:r&&o?{label:"Open Farcaster app",onClick:o}:void 0,onBack:s,onClose:c,watermark:!0}:{title:e?e.message:"Requesting signer from Farcaster",subtitle:e?e.detail:"This should only take a moment",icon:h,iconVariant:"loading",iconLoadingStatus:{success:i,fail:!!e},onBack:s,onClose:c,watermark:!0,children:r&&x.isMobile&&t.jsx(A,{children:t.jsx(B,{text:"Take me to Farcaster",url:r,color:S})})}:{title:"Add a signer to Farcaster",subtitle:`This will allow ${u} to add casts, likes, follows, and more on your behalf.`,onBack:s,onClose:c,watermark:!0,children:t.jsxs(P,{children:[t.jsx(R,{children:r?t.jsx(E,{url:r,size:275,squareLogoElement:h}):t.jsx(N,{children:t.jsx(O,{})})}),t.jsxs(z,{children:[t.jsx(L,{children:"Or copy this link and paste it into a phone browser to open the Farcaster app."}),r&&t.jsx(q,{text:r,itemName:"link",color:S})]})]})});let A=n.div`
  margin-top: 24px;
`,P=n.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
`,R=n.div`
  padding: 24px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 275px;
`,z=n.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
`,L=n.div`
  font-size: 0.875rem;
  text-align: center;
  color: var(--privy-color-foreground-2);
`,N=n.div`
  position: relative;
  width: 82px;
  height: 82px;
`;const Y={component:()=>{let{lastScreen:u,navigateBack:m,data:i}=F(),e=T(),{requestFarcasterSignerStatus:r,closePrivyModal:s}=I(),[c,o]=d.useState(void 0),[j,v]=d.useState(!1),[b,y]=d.useState(!1),g=d.useRef([]),a=i==null?void 0:i.farcasterSigner;d.useEffect((()=>{let w=Date.now(),l=setInterval((async()=>{if(!(a!=null&&a.public_key))return clearInterval(l),void o({retryable:!0,message:"Connect failed",detail:"Something went wrong. Please try again."});a.status==="approved"&&(clearInterval(l),v(!1),y(!0),g.current.push(setTimeout((()=>s({shouldCallAuthOnSuccess:!1,isSuccess:!0})),k)));let p=await r(a==null?void 0:a.public_key),C=Date.now()-w;p.status==="approved"?(clearInterval(l),v(!1),y(!0),g.current.push(setTimeout((()=>s({shouldCallAuthOnSuccess:!1,isSuccess:!0})),k))):C>3e5?(clearInterval(l),o({retryable:!0,message:"Connect failed",detail:"The request timed out. Try again."})):p.status==="revoked"&&(clearInterval(l),o({retryable:!0,message:"Request rejected",detail:"The request was rejected. Please try again."}))}),2e3);return()=>{clearInterval(l),g.current.forEach((p=>clearTimeout(p)))}}),[]);let f=(a==null?void 0:a.status)==="pending_approval"?a.signer_approval_url:void 0;return t.jsx(_,{appName:e.name,loading:j,success:b,errorMessage:c,connectUri:f,onBack:u?m:void 0,onClose:s,onOpenFarcaster:()=>{f&&(window.location.href=f)}})}};export{Y as FarcasterSignerStatusScreen,_ as FarcasterSignerStatusView,Y as default};
