import{bZ as j,d7 as n,dh as $,dt as l}from"./index-DUDY964y.js";import{i as g,m as a,o as d,c as h}from"./ethers-CCCiz19Z-xa7wrZYb.js";import{C as k}from"./getFormattedUsdFromLamports-B6EqSEho-C-HCdwKa.js";import{t as y}from"./transaction-CnfuREWo-nROljJQP.js";const O=({weiQuantities:e,tokenPrice:t,tokenSymbol:s})=>{let i=a(e),r=t?d(i,t):void 0,o=h(i,s);return n.jsx(c,{children:r||o})},P=({weiQuantities:e,tokenPrice:t,tokenSymbol:s})=>{let i=a(e),r=t?d(i,t):void 0,o=h(i,s);return n.jsx(c,{children:r?n.jsxs(n.Fragment,{children:[n.jsx(S,{children:"USD"}),r==="<$0.01"?n.jsxs(x,{children:[n.jsx(p,{children:"<"}),"$0.01"]}):r]}):o})},D=({quantities:e,tokenPrice:t,tokenSymbol:s="SOL",tokenDecimals:i=9})=>{let r=e.reduce(((u,f)=>u+f),0n),o=t&&s==="SOL"&&i===9?k(r,t):void 0,m=s==="SOL"&&i===9?y(r):`${j(r,i)} ${s}`;return n.jsx(c,{children:o?n.jsx(n.Fragment,{children:o==="<$0.01"?n.jsxs(x,{children:[n.jsx(p,{children:"<"}),"$0.01"]}):o}):m})};let c=l.span`
  font-size: 14px;
  line-height: 140%;
  display: flex;
  gap: 4px;
  align-items: center;
`,S=l.span`
  font-size: 12px;
  line-height: 12px;
  color: var(--privy-color-foreground-3);
`,p=l.span`
  font-size: 10px;
`,x=l.span`
  display: flex;
  align-items: center;
`;function v(e,t){return`https://explorer.solana.com/account/${e}?chain=${t}`}const F=e=>n.jsx(b,{href:e.chainType==="ethereum"?g(e.chainId,e.walletAddress):v(e.walletAddress,e.chainId),target:"_blank",children:$(e.walletAddress)});let b=l.a`
  &:hover {
    text-decoration: underline;
  }
`;export{F as S,D as f,P as h,O as p};
