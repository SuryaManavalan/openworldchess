// Tell Bing and the other IndexNow engines (which feed ChatGPT search, Copilot and DuckDuckGo) that
// the site's pages changed. Run after a deploy (.github/workflows/ci.yml). docs/specs/site.md.
//   node tools/site/indexnow.mjs
const KEY = '9d9b63dfa60f25d7d647d206d56c16e4'; // public by design: it's served at /9d9b63dfa60f25d7d647d206d56c16e4.txt to prove we own the site
const HOST = 'openworldchess.com';
const urls = ['/', '/about', '/guide', '/wilds', '/chronicle', '/cities'].map((p) => `https://${HOST}${p}`);
const r = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls }),
});
console.log('IndexNow:', r.status, r.statusText);
