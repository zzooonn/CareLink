const fs = require('fs');
const path = require('path');

function walk(dir, cb) {
  fs.readdirSync(dir).forEach(file => {
    const p = path.join(dir, file);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) walk(p, cb);
    else cb(p);
  });
}

const root = path.join(__dirname, '..');
const results = [];
walk(root, (file) => {
  if(!file.endsWith('.tsx')) return;
  const rel = path.relative(process.cwd(), file);
  const text = fs.readFileSync(file, 'utf8');
  // regex to find <Tag ...>some text</Tag>
  const re = /<([A-Za-z0-9_$.]+)[^>]*>\s*([^<\n][^<]*)\s*<\/\1>/g;
  let m;
  while((m = re.exec(text)) !== null){
    const tag = m[1];
    const inner = m[2];
    if(tag === 'Text' || tag.endsWith('.Text')) continue;
    // ignore if inner is only JSX expression like {something}
    if(/^\{.*\}$/.test(inner.trim())) continue;
    // ignore if inner is only numbers/punct
    if(/^\W+$/.test(inner.trim())) continue;
    // find line number
    const before = text.slice(0, m.index);
    const line = before.split(/\r?\n/).length;
    results.push({file: rel, line, tag, snippet: inner.trim().slice(0,120)});
  }
});

if(results.length===0){
  console.log('No bare-text inside non-Text tags detected.');
} else {
  console.log('Bare text inside non-Text tags:');
  results.forEach(r => console.log(`${r.file}:${r.line} <${r.tag}> -> ${r.snippet}`));
}
