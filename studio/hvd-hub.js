/* PDF EDITOR navigation adapter for the ORIGINAL CIT-PDF v1.0.0 frontend.
 * AGPL-3.0-only. Does not alter or replace CIT's editor, CSS internals,
 * PdfEngine, render logic, rich-run handling, or export routines.
 */
(() => {
  'use strict';
  const home = new URL('../index.html', window.location.href).href;
  const goHome = () => {
    if(window.self!==window.top)window.parent.postMessage({type:'pdf-editor:navigate',route:'home'},window.location.origin);
    else window.location.assign(home);
  };
  if(window.self!==window.top){
    document.addEventListener('click',event=>{
      const a=event.target.closest?.('a[href]');
      if(!a||a.target==='_blank'||a.hasAttribute('download'))return;
      const dest=new URL(a.href,window.location.href);
      if(dest.origin===window.location.origin&&/\/index\.html$/.test(dest.pathname)){
        event.preventDefault();event.stopImmediatePropagation();goHome();
      }
    },true);
  }

  // Original CIT's Vite editor maps this action to import.meta.env.BASE_URL,
  // which points into cit-native/ and NOT to the parent HVD homepage. Install
  // a capture handler: prevent *only* this navigation; preserve all other
  // upstream events and controls unchanged.
  document.addEventListener('click', event => {
    const element = event.target;
    const back = element instanceof Element && element.closest('#back-to-tools');
    if (!back) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    goHome();
  }, true);

  function addAnchor(host, id, label, title) {
    if (!host || document.getElementById(id)) return;
    const link = document.createElement('a');
    link.id = id;
    link.className = 'hvd-cit-hub-link';
    link.href = home;
    link.title = title;
    link.setAttribute('aria-label', title);
    link.textContent = label;
    host.appendChild(link);
  }


  function setBrand(nodeId, value) {
    const node = document.getElementById(nodeId);
    if (!node) return;
    node.removeAttribute('data-i18n');
    node.textContent = value;
  }

  function brandImages() {
    for (const id of ['nav-logo', 'footer-logo']) {
      const node = document.getElementById(id);
      if (node && typeof HTMLImageElement !== 'undefined' && node instanceof HTMLImageElement) {
        node.src = new URL('hvd-mark.svg?v=20261016-editor1', window.location.href).href;
        node.alt = 'PDF EDITOR';
      }
    }
  }

  function legalAccess() {
    // Preserve upstream copyright notices and unmodified AGPL license files.
    // A low-contrast legal link is intentionally available in the tool UI.
    if (document.getElementById('hvd-legal-notice')) return;
    const footer = document.getElementById('footer-copyright');
    const location = footer?.parentElement;
    if (!location) return;
    const notice = document.createElement('a');
    notice.id = 'hvd-legal-notice';
    notice.href = new URL('../NOTICE.md', window.location.href).href;
    notice.textContent = 'Giấy phép & bản quyền thư viện';
    notice.target = '_blank';
    notice.rel = 'noopener noreferrer';
    notice.className = 'hvd-cit-legal-link';
    location.appendChild(notice);
  }

  function install() {
    if (document.body.dataset.hvdCitHub) return;
    document.body.dataset.hvdCitHub = 'original';
    setBrand('nav-brand', 'PDF EDITOR');
    setBrand('footer-brand', 'PDF EDITOR');
    brandImages();
    legalAccess();
    // Do not change upstream footer copyright: licensing details remain
    // accessible under NOTICE.md and LICENSE on the project website.
    const headerBrand = document.querySelector('#nav-brand a');
    if (headerBrand) headerBrand.href = home;
    const backLabel = document.querySelector('#back-to-tools span');
    if (backLabel) {
      backLabel.removeAttribute('data-i18n');
      backLabel.textContent = 'Trở về PDF EDITOR';
    }
    const toolbarGroup = document.querySelector('#toolbar .tgroup');
    addAnchor(toolbarGroup, 'hvd-cit-home', 'PDF EDITOR',
      'Quay về bộ công cụ PDF EDITOR');
    const landing = document.querySelector('#tool-uploader');
    addAnchor(landing, 'hvd-cit-uploader-home', '↖ PDF EDITOR',
      'Quay về trang chủ PDF EDITOR');

    // Document/SEO branding is applied during the site build, ahead of
    // first paint, to avoid a flash of the upstream name in browser tabs.
    const title='Chỉnh sửa văn bản PDF – PDF EDITOR';
    if (document.title !== title) document.title = title;
    window.dispatchEvent(new CustomEvent('hvd-cit-hub:ready',
      {detail:{product:'PDF EDITOR',home}}));
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
