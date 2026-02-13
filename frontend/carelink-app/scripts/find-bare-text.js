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

function isTsx(f){ return f.endsWith('.tsx'); }

const root = path.join(__dirname, '..');
const results = [];
walk(root, (file) => {
  if(!isTsx(file)) return;
  const rel = path.relative(process.cwd(), file);
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, idx) => {
    // skip lines that are obviously inside <Text> or are comments
    const trimmed = line.trim();
    if(!trimmed) return;
    if(trimmed.startsWith('//')) return;
    // heuristics: if line contains '>' then some non-tag chars then '<'
    const re = />\s*([^<\n][^<]*)\s*</;
    const m = re.exec(line);
    if(m){
      const inner = m[1];
      // ignore if inner starts with '{' or '<' or is just a JSX expression
      if(inner.trim().startsWith('{') || inner.trim().startsWith('<')) return;
      // ignore if this line contains <Text or </Text
      if(/<Text|<Text\s|<\/Text/.test(line)) return;
      // check previous few lines to see if inside <Text>
      const context = lines.slice(Math.max(0, idx-5), idx+6).join('\n');
      if(/<Text[\s>]/.test(context) && /<\/Text>/.test(context)) return; // probably inside Text
      // ignore lines with only JSX element close/open like /></
      if(/^[<>\/\s]+$/.test(inner)) return;
      // if inner contains only numbers/punctuation, skip
      if(/^\W+$/.test(inner.trim())) return;
      results.push({file: rel, line: idx+1, snippet: line.trim()});
    }
  });
});

if(results.length===0){
  console.log('No suspicious bare text nodes detected.');
} else {
  console.log('Suspicious bare text nodes found:');
  results.forEach(r => console.log(`${r.file}:${r.line} -> ${r.snippet}`));
}
