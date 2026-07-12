import{da as a,dB as _,d8 as T,d5 as E,d7 as e,ek as F,el as I,dV as U,dt as p,e2 as V}from"./index-DUDY964y.js";import{F as W}from"./ShieldCheckIcon-DN4h5Kfu.js";import{m as N}from"./ModalHeader-CPoYSZQh-BAsgeFOd.js";import{l as O}from"./Layouts-BlFm53ED-B8Xdst2z.js";import{g as H,h as z,u as B,b as M,k as D}from"./shared-054zR7p5-_OIPvEuN.js";import{w as s}from"./Screen-J_oQ5CmO-Cm_XKwzD.js";import"./index-Dq_xe9dz-BlOGoluW.js";const re={component:()=>{let[o,y]=a.useState(!0),{authenticated:m,user:b}=_(),{walletProxy:i,closePrivyModal:v,createAnalyticsEvent:x,client:j}=T(),{navigate:k,data:A,onUserCloseViaDialogOrKeybindRef:$}=E(),[n,C]=a.useState(void 0),[f,d]=a.useState(""),[c,g]=a.useState(!1),{entropyId:u,entropyIdVerifier:S,onCompleteNavigateTo:w,onSuccess:h,onFailure:P}=A.recoverWallet,l=(r="User exited before their wallet could be recovered")=>{v({shouldCallAuthOnSuccess:!1}),P(typeof r=="string"?new U(r):r)};return $.current=l,a.useEffect((()=>{if(!m)return l("User must be authenticated and have a Privy wallet before it can be recovered")}),[m]),e.jsxs(s,{children:[e.jsx(s.Header,{icon:W,title:"Enter your password",subtitle:"Please provision your account on this new device. To continue, enter your recovery password.",showClose:!0,onClose:l}),e.jsx(s.Body,{children:e.jsx(K,{children:e.jsxs("div",{children:[e.jsxs(H,{children:[e.jsx(z,{type:o?"password":"text",onChange:r=>(t=>{t&&C(t)})(r.target.value),disabled:c,style:{paddingRight:"2.3rem"}}),e.jsx(B,{style:{right:"0.75rem"},children:o?e.jsx(M,{onClick:()=>y(!1)}):e.jsx(D,{onClick:()=>y(!0)})})]}),!!f&&e.jsx(Y,{children:f})]})})}),e.jsxs(s.Footer,{children:[e.jsx(s.HelpText,{children:e.jsxs(O,{children:[e.jsx("h4",{children:"Why is this necessary?"}),e.jsx("p",{children:"You previously set a password for this wallet. This helps ensure only you can access it"})]})}),e.jsx(s.Actions,{children:e.jsx(G,{loading:c||!i,disabled:!n,onClick:async()=>{g(!0);let r=await j.getAccessToken(),t=F(b,u);if(!r||!t||n===null)return l("User must be authenticated and have a Privy wallet before it can be recovered");try{x({eventName:"embedded_wallet_recovery_started",payload:{walletAddress:t.address}}),await(i==null?void 0:i.recover({accessToken:r,entropyId:u,entropyIdVerifier:S,recoveryPassword:n})),d(""),w?k(w):v({shouldCallAuthOnSuccess:!1}),h==null||h(t),x({eventName:"embedded_wallet_recovery_completed",payload:{walletAddress:t.address}})}catch(R){I(R)?d("Invalid recovery password, please try again."):d("An error has occurred, please try again.")}finally{g(!1)}},$hideAnimations:!u&&c,children:"Recover your account"})}),e.jsx(s.Watermark,{})]})]})}};let K=p.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`,Y=p.div`
  line-height: 20px;
  height: 20px;
  font-size: 13px;
  color: var(--privy-color-error);
  text-align: left;
  margin-top: 0.5rem;
`,G=p(N)`
  ${({$hideAnimations:o})=>o&&V`
      && {
        // Remove animations because the recoverWallet task on the iframe partially
        // blocks the renderer, so the animation stutters and doesn't look good
        transition: none;
      }
    `}
`;export{re as PasswordRecoveryScreen,re as default};
