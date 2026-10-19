const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const bridge = fs.readFileSync(path.join(root, 'pdf-local-tools.js'), 'utf8');

test('home compression uses the dedicated image-aware engine and never claims fake percentages', () => {
  assert.match(bridge, /compressPdfBytes/);
  assert.match(bridge, /pdf-compress-engine\.mjs\?v=/);
  assert.match(bridge, /input\[name="lv"\]:checked/);
  assert.match(bridge, /Nén mạnh/);
  assert.doesNotMatch(bridge, /const document = await window\.PDFLib\.PDFDocument\.load\(bytes\)/);
});

test('GitHub Pages homepage includes independent PDF tools and correct asset order', () => {
  assert.match(html, /<script src="pdf-lib\.min\.js"><\/script>/);
  assert.match(html, /<script src="pdf-local-tools\.js\?v=[^"]+"><\/script>/);
  assert.match(html, /<script src="organizer\.js\?v=[^"]+"><\/script>/);
  assert.ok(html.indexOf('pdf-lib.min.js') < html.indexOf('pdf-local-tools.js'));
  assert.match(html, /<script src="pdf-batch-text\.js\?v=[^"]+"><\/script>/);
  assert.ok(html.indexOf('organizer.js?v=') < html.indexOf('pdf-batch-text.js?v='), 'batch editor must load after organizer');
  for (const [, body] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (body.trim()) new vm.Script(body);
  }
  new vm.Script(bridge);
});

function mockPage(toolName, target) {
  const elements = {};
  const make = () => ({
    children: [], style: {}, disabled: false, textContent: '',
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    addEventListener() {},
  });
  elements.go = make();
  elements.out = make();
  elements['fmt-sel'] = { value: target };
  const document = {
    getElementById: id => elements[id] || null,
    createElement: () => make(),
  };
  let serverCalls = 0;
  const input = new Uint8Array(100);
  const windows = {
    PDFLib: { PDFDocument: {
      load: async () => ({ save: async () => new Uint8Array(80) }),
    } },
    pdfjsLib: { getDocument: () => ({promise: Promise.resolve({
      numPages: 1,
      getPage: async () => ({
        getTextContent: async () => ({items: [
          {str:'Hello PDF',transform:[1,0,0,1,0,50]},
          {str:'HVD',transform:[1,0,0,1,0,50]}
        ]}),
        cleanup() {}
      }),
      destroy: async () => {}
    })}) }
  };
  const context = {
    window: windows, document, console, FormData, Blob, AbortSignal,
    setTimeout, URL: {createObjectURL: () => 'blob:mock', revokeObjectURL(){} },
    fetch: () => {serverCalls++; throw new Error('Unexpected localhost call');},
    T: [], OPT: {}, home: ()=>{}, run: ()=>{},
    files: [{name:'civil3d.pdf',size:input.byteLength,arrayBuffer:async()=>input.buffer}],
    tool: [toolName], sz: n => String(n)+'B',
  };
  vm.createContext(context);
  vm.runInContext(bridge, context);
  return {context,elements,calls:()=>serverCalls};
}

for (const [name,target,output] of [
  ['PDF sang TXT',null,'civil3d.txt'],
  ['Chuyển đổi PDF','txt','civil3d.txt']
]) {
  test(name+' runs offline and makes a real browser download', async () => {
    const {context,elements,calls} = mockPage(name,target);
    await vm.runInContext('run()', context);
    assert.equal(calls(),0);
    assert.equal(elements.out.children[0].children[2].children[0].download,output);
    assert.equal(elements.go.disabled,false);
  });
}
