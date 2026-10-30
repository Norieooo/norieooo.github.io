(() => {
  'use strict';
  document.documentElement.classList.add('js');
  const config = window.SITE_CONTENT || {};
  const site = config.site || {};
  const categories = Array.isArray(config.categories) ? config.categories : [];
  const items = Array.isArray(config.items) ? config.items : [];
  const categoryNames = new Map(categories.map(category => [category.id, category.label]));
  const coverNames = new Set(['orbit', 'fold', 'grid', 'rings', 'steps', 'window']);
  const grid = document.querySelector('#content-grid');
  const filters = document.querySelector('#filters');
  const resultCount = document.querySelector('#result-count');
  const dialog = document.querySelector('#content-dialog');
  const themeButton = document.querySelector('.theme-toggle');
  const menuButton = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#primary-nav');
  let activeCategory = 'all';
  document.querySelectorAll('[data-text]').forEach(element => {
    const value = site[element.dataset.text];
    if (typeof value === 'string') element.textContent = value;
  });
  if (site.pageTitle) document.title = site.pageTitle;
  if (site.description) document.querySelector('meta[name="description"]').content = site.description;
  document.querySelector('#year').textContent = new Date().getFullYear();

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function openItem(item, number) {
    document.querySelector('#dialog-category').textContent = categoryNames.get(item.category) || '内容';
    document.querySelector('#dialog-number').textContent = `NO. ${String(number).padStart(2, '0')}`;
    document.querySelector('#dialog-title').textContent = item.title || '未命名内容';
    document.querySelector('#dialog-summary').textContent = item.summary || '';
    const body = document.querySelector('#dialog-body');
    body.replaceChildren();
    if (item.avatar) {
      const avatar = makeElement('img', 'dialog-avatar');
      avatar.src = item.avatar;
      avatar.alt = `${item.title}的头像`;
      body.append(avatar);
    }
    const paragraphs = Array.isArray(item.body) ? item.body : [];
    if (!paragraphs.length) body.append(makeElement('p', '', '这项内容还没有正文。'));
    paragraphs.forEach(paragraph => body.append(makeElement('p', '', String(paragraph))));
    dialog.showModal();
    document.body.classList.add('dialog-open');
    dialog.scrollTop = 0;
  }
  function renderCards() {
    const selected = activeCategory === 'all' ? items : items.filter(item => item.category === activeCategory);
    const fragment = document.createDocumentFragment();
    selected.forEach(item => {
      const number = items.indexOf(item) + 1;
      const article = makeElement('article', 'content-card');
      const button = makeElement('button', 'card-button');
      button.type = 'button';
      button.setAttribute('aria-label', `查看详情：${item.title || '未命名内容'}`);
      button.setAttribute('aria-haspopup', 'dialog');
      const cover = makeElement('div', `card-cover cover-${coverNames.has(item.cover) ? item.cover : 'orbit'}`);
      cover.setAttribute('aria-hidden', 'true');
      cover.append(makeElement('span', 'card-number', String(number).padStart(2, '0')));
      const art = makeElement('div', 'card-art');
      ['a', 'b', 'c'].forEach(shape => art.append(makeElement('span', `shape-${shape}`)));
      if (item.avatar) {
        const image = makeElement('img', 'card-avatar');
        image.src = item.avatar;
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        cover.classList.add('avatar-cover');
        cover.append(image);
      } else { cover.append(art); }
      cover.append(makeElement('span', 'card-open', '↗'));
      const content = makeElement('div', 'card-content');
      content.append(makeElement('p', 'card-category', categoryNames.get(item.category) || '内容'));
      content.append(makeElement('h3', 'card-title', item.title || '未命名内容'));
      content.append(makeElement('p', 'card-summary', item.summary || ''));
      const bottom = makeElement('div', 'card-bottom');
      bottom.append(makeElement('span', '', item.note || '查看内容'));
      const arrow = makeElement('span', '', '→');
      arrow.setAttribute('aria-hidden', 'true');
      bottom.append(arrow);
      content.append(bottom);
      button.append(cover, content);
      button.addEventListener('click', () => openItem(item, number));
      article.append(button);
      fragment.append(article);
    });
    if (!selected.length) fragment.append(makeElement('p', 'empty-state', '这里还没有内容，留给下一次更新。'));
    grid.replaceChildren(fragment);
    resultCount.textContent = `${activeCategory === 'all' ? '全部内容' : categoryNames.get(activeCategory) || '内容'} · ${String(selected.length).padStart(2, '0')} 项`;
  }
  [{ id: 'all', label: '全部' }, ...categories].forEach(category => {
    const button = makeElement('button', 'filter-button', category.label);
    button.type = 'button';
    button.dataset.category = category.id;
    button.setAttribute('aria-pressed', String(category.id === activeCategory));
    button.addEventListener('click', () => {
      activeCategory = category.id;
      filters.querySelectorAll('button').forEach(filter => filter.setAttribute('aria-pressed', String(filter === button)));
      renderCards();
    });
    filters.append(button);
  });
  filters.hidden = false;
  renderCards();
  document.querySelectorAll('.dialog-close').forEach(button => button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  function syncThemeLabel() {
    const isDark = document.documentElement.dataset.theme === 'dark';
    const label = isDark ? '切换为浅色模式' : '切换为深色模式';
    themeButton.setAttribute('aria-label', label);
    themeButton.title = label;
    document.querySelector('meta[name="theme-color"]').content = isDark ? '#171717' : '#f7f7f7';
  }
  themeButton.hidden = false;
  syncThemeLabel();
  themeButton.addEventListener('click', () => {
    const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    try { localStorage.setItem('untitled-theme', nextTheme); } catch (_) {}
    syncThemeLabel();
  });
  function closeMenu() {
    nav.dataset.open = 'false';
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', '打开导航菜单');
  }
  menuButton.hidden = false;
  menuButton.addEventListener('click', () => {
    const open = nav.dataset.open !== 'true';
    nav.dataset.open = String(open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
  });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.dataset.open === 'true') { closeMenu(); menuButton.focus(); }
  });
  document.addEventListener('click', event => {
    if (!nav.contains(event.target) && !menuButton.contains(event.target)) closeMenu();
  });
  matchMedia('(max-width: 600px)').addEventListener('change', closeMenu);
  if ('IntersectionObserver' in window) {
    const navLinks = [...nav.querySelectorAll('a')];
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        navLinks.forEach(link => {
          const current = link.getAttribute('href') === `#${entry.target.id}`;
          link.classList.toggle('is-active', current);
          if (current) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-20% 0px -55% 0px', threshold: 0 });
    ['home', 'collection', 'about'].forEach(id => observer.observe(document.getElementById(id)));
  }
})();