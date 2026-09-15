// 从 extract.js 抽出的纯函数，改动 extract.js 后请同步此处（node test-renderRich.js）
const esc=(s)=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function renderRich(text, ent, richtextTags, inlineMedia, mediaMap) {
    const cps = Array.from(text || '');
    const N = cps.length;
    const B = new Uint8Array(N), I = new Uint8Array(N);

    for (const t of richtextTags || []) {
      const types = t.richtext_types || [];
      const b = types.indexOf('Bold') >= 0, i = types.indexOf('Italic') >= 0;
      for (let k = Math.max(0, t.from_index | 0); k < Math.min(N, t.to_index | 0); k++) {
        if (b) B[k] = 1;
        if (i) I[k] = 1;
      }
    }

    const spans = [];
    const add = (idx, html) => {
      if (!idx) return;
      const s = idx[0] | 0, e = idx[1] | 0;
      if (s >= 0 && e > s && e <= N) spans.push([s, e, html]);
    };
    const E = ent || {};
    for (const u of E.urls || []) add(u.indices, `<a href="${esc(u.expanded_url || u.url)}">${esc(u.display_url || u.expanded_url || u.url)}</a>`);
    for (const m of E.user_mentions || []) add(m.indices, `<a href="https://x.com/${esc(m.screen_name)}">@${esc(m.screen_name)}</a>`);
    for (const h of E.hashtags || []) add(h.indices, `<a href="https://x.com/hashtag/${encodeURIComponent(h.text)}">#${esc(h.text)}</a>`);
    for (const m of E.media || []) add(m.indices, '');
    spans.sort((a, b) => a[0] - b[0] || b[1] - a[1]);

    const ins = new Map();
    for (const m of inlineMedia || []) {
      const u = mediaMap[m.media_id];
      if (!u) continue;
      const at = m.index | 0;
      ins.set(at, (ins.get(at) || '') + `<figure><img src="${esc(u)}"></figure>`);
    }

    let out = '', i = 0, si = 0, cur = 0;
    const setStyle = (want) => {
      if (want === cur) return;
      if (cur & 2) out += '</em>';
      if (cur & 1) out += '</strong>';
      if (want & 1) out += '<strong>';
      if (want & 2) out += '<em>';
      cur = want;
    };

    while (i < N) {
      if (ins.has(i)) { setStyle(0); out += ins.get(i); }
      while (si < spans.length && spans[si][0] < i) si++;
      if (si < spans.length && spans[si][0] === i) {
        setStyle(0);
        out += spans[si][2];
        i = spans[si][1];
        si++;
        continue;
      }
      setStyle((B[i] ? 1 : 0) | (I[i] ? 2 : 0));
      const ch = cps[i];
      out += ch === '\n' ? '<br>' : esc(ch);
      i++;
    }
    setStyle(0);
    if (ins.has(N)) out += ins.get(N);
    return out;
  }

let pass = 0, fail = 0;
function t(name, got, want) {
  if (got === want) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + '\n    期望: ' + want + '\n    实际: ' + got); }
}

console.log('— 码点索引（中文）—');
// "我用了Codex这个工具" -> 码点 3..8 = "Codex"
t('中文串中加粗英文',
  renderRich('我用了Codex这个工具', null, [{from_index:3,to_index:8,richtext_types:['Bold']}], null, {}),
  '我用了<strong>Codex</strong>这个工具');

console.log('— 码点索引（emoji，UTF-16 是 2 个 code unit）—');
// "🚀发布了" 码点: 0=🚀 1=发 2=布 3=了 ；加粗码点 1..3 = "发布"
t('emoji 之后的加粗不错位',
  renderRich('🚀发布了', null, [{from_index:1,to_index:3,richtext_types:['Bold']}], null, {}),
  '🚀<strong>发布</strong>了');

console.log('— 加粗 + 斜体嵌套 —');
t('粗斜叠加正确闭合',
  renderRich('abcd', null, [
    {from_index:0,to_index:3,richtext_types:['Bold']},
    {from_index:1,to_index:4,richtext_types:['Italic']}],
    null, {}),
  '<strong>a</strong><strong><em>bc</em></strong><em>d</em>');

console.log('— 实体：链接 / @ / # —');
t('链接用 display_url 显示、指向 expanded_url',
  renderRich('看这个 https://t.co/abc 很好', {urls:[{indices:[4,20],url:'https://t.co/abc',expanded_url:'https://example.com/post',display_url:'example.com/post'}]}, null, null, {}),
  '看这个 <a href="https://example.com/post">example.com/post</a> 很好');

t('@ 提及',
  renderRich('谢谢 @ai_xiaomu', {user_mentions:[{indices:[3,13],screen_name:'ai_xiaomu'}]}, null, null, {}),
  '谢谢 <a href="https://x.com/ai_xiaomu">@ai_xiaomu</a>');

console.log('— 媒体 t.co 短链应被删除 —');
t('正文尾部媒体短链删掉',
  renderRich('配图如下 https://t.co/xyz', {media:[{indices:[5,21]}]}, null, null, {}),
  '配图如下 ');

console.log('— note_tweet 正文内嵌图 —');
t('inline_media 插到指定码点位置',
  renderRich('上图\n下文', null, null, [{index:2,media_id:'k1'}], {k1:'https://pbs.twimg.com/media/A.jpg?name=orig'}),
  '上图<figure><img src="https://pbs.twimg.com/media/A.jpg?name=orig"></figure><br>下文');

console.log('— 转义与换行 —');
t('尖括号转义 + 换行转 <br>',
  renderRich('a<b>\nc & d', null, null, null, {}),
  'a&lt;b&gt;<br>c &amp; d');

console.log('— 边界 —');
t('空文本', renderRich('', null, null, null, {}), '');
t('越界的 richtext 区间不崩',
  renderRich('abc', null, [{from_index:1,to_index:99,richtext_types:['Bold']}], null, {}),
  'a<strong>bc</strong>');
t('越界的实体区间被忽略',
  renderRich('abc', {urls:[{indices:[1,99],expanded_url:'https://e.com',display_url:'e.com'}]}, null, null, {}),
  'abc');

console.log('\n通过 ' + pass + ' / 失败 ' + fail);
process.exit(fail ? 1 : 0);
