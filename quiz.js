(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const config = window.QUIZ_CONFIG;
  const engine = window.QuizEngine;
  const themeButton = $('.theme-toggle');
  const pageName = window.SITE_CONTENT?.site?.name || '未名';
  document.querySelectorAll('[data-site-name]').forEach(node => { node.textContent = pageName; });
  $('#quiz-year').textContent = new Date().getFullYear();
  function themeLabel() {
    const dark = document.documentElement.dataset.theme === 'dark';
    themeButton.setAttribute('aria-label', dark ? '切换为浅色模式' : '切换为深色模式');
    themeButton.title = themeButton.getAttribute('aria-label');
    $('meta[name="theme-color"]').content = dark ? '#171717' : '#f7f7f7';
  }
  themeButton.hidden = false;
  themeLabel();
  themeButton.addEventListener('click', () => {
    document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('untitled-theme', document.documentElement.dataset.theme); } catch (_) {}
    themeLabel();
  });
  try { engine.validate(config); } catch (error) {
    $('#quiz-error').textContent = `问卷暂时无法加载：${error.message}`;
    $('#quiz-error').hidden = false;
    $('#quiz-description').textContent = '请检查问卷配置后重试。';
    return;
  }
  const questions = config.questions;
  const typeMap = new Map(config.types.map(type => [type.id, type]));
  const storageKey = `untitled-quiz:${config.id || 'default'}:v${config.version || 1}`;
  let storageAvailable = true;
  let state = { phase: 'intro', index: 0, answers: {}, editing: false };
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    if (saved && saved.schema === 1) {
      state.answers = engine.sanitizeAnswers(config, saved.answers);
      state.index = Number.isInteger(saved.index) ? Math.max(0, Math.min(questions.length - 1, saved.index)) : 0;
      state.phase = ['intro', 'question', 'result'].includes(saved.phase) ? saved.phase : 'intro';
      state.editing = saved.editing === true;
    }
  } catch (_) { /* 损坏的进度不影响新测试。 */ }
  try {
    sessionStorage.setItem(`${storageKey}:probe`, '1');
    sessionStorage.removeItem(`${storageKey}:probe`);
  } catch (_) { storageAvailable = false; }
  function storageNote() {
    $('#storage-note').textContent = storageAvailable ? '答案仅保存在当前标签页，不会上传。' : '答案不会上传；当前浏览器无法保存进度，刷新后需要重新作答。';
    $('#save-exit').firstChild.textContent = storageAvailable ? '暂存并退出 ' : '返回开始页 ';
  }
  function persist() {
    if (!storageAvailable) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify({ schema: 1, ...state })); }
    catch (_) { storageAvailable = false; storageNote(); }
  }
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function completedCount() { return Object.keys(state.answers).length; }
  function showScreen(name, focusTarget) {
    ['intro', 'question', 'result'].forEach(screen => { $(`#${screen}-screen`).hidden = screen !== name; });
    document.querySelectorAll('[data-step]').forEach(step => {
      if (step.dataset.step === name) step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
    });
    if (focusTarget) {
      $(focusTarget).focus({ preventScroll: true });
      $('#quiz-main').scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  }
  $('#quiz-label').textContent = config.label || '示例问卷';
  document.title = `${config.title || '偏好测试'} — ${pageName}`;
  if (Array.isArray(config.titleLines) && config.titleLines.length) {
    $('#intro-title').replaceChildren(...config.titleLines.map((line, index) => el('span', index ? 'muted-title' : '', line)));
  } else if (config.title) { $('#intro-title').textContent = config.title; }
  $('#quiz-description').textContent = config.description || '';
  $('#total-questions').textContent = String(questions.length).padStart(2, '0');
  $('#total-types').textContent = String(config.types.length).padStart(2, '0');
  $('#quiz-duration').textContent = config.duration || '按自己的节奏作答';
  $('#result-demo-note').textContent = config.demoNote || '';
  $('#start-quiz').disabled = false;
  storageNote();

  function showIntro(focus = false) {
    const count = completedCount();
    state.phase = 'intro';
    state.editing = false;
    $('#resume-note').hidden = !count;
    $('#resume-note').textContent = `本次已完成 ${count} / ${questions.length} 题，可以继续作答。`;
    $('#start-quiz').replaceChildren(document.createTextNode(count ? '继续测试 ' : '开始测试 '), el('span', '', '→'));
    $('#restart-intro').hidden = !count;
    persist();
    showScreen('intro', focus ? '#intro-title' : null);
  }
  function updateProgress() {
    const count = completedCount();
    const percent = Math.round(count / questions.length * 100);
    $('#answered-count').textContent = `已完成 ${count} / ${questions.length} 题`;
    $('#quiz-progress').setAttribute('aria-valuenow', String(percent));
    $('#quiz-progress').setAttribute('aria-valuetext', `${count} / ${questions.length} 题已完成`);
    $('#quiz-progress-fill').style.width = `${percent}%`;
    $('#question-map').replaceChildren();
    questions.forEach((question, index) => {
      const answered = Boolean(state.answers[question.id]);
      const button = el('button', `question-chip${answered ? ' is-answered' : ''}`, String(index + 1).padStart(2, '0'));
      button.type = 'button';
      button.setAttribute('aria-label', `第 ${index + 1} 题，${answered ? '已作答' : '未作答'}`);
      if (index === state.index) button.setAttribute('aria-current', 'step');
      button.addEventListener('click', () => { state.index = index; showQuestion(); });
      $('#question-map').append(button);
    });
    const answered = Boolean(state.answers[questions[state.index].id]);
    $('#next-question').disabled = !answered;
    $('#next-question').textContent = state.editing && count === questions.length ? '更新结果 →' : state.index === questions.length - 1 ? '查看结果 →' : '下一题 →';
    $('#selection-hint').textContent = answered ? '已选择，可继续' : '请选择一个选项';
  }
  function showQuestion(focus = true) {
    state.phase = 'question';
    const question = questions[state.index];
    $('#question-number').textContent = String(state.index + 1).padStart(2, '0');
    $('#question-total').textContent = `/ ${String(questions.length).padStart(2, '0')}`;
    $('#question-title').textContent = question.title;
    $('.question-sidebar > .eyebrow').textContent = question.section || '群聊现场';
    $('#question-hint').textContent = question.hint || '没有标准答案，选择最接近你的一个。';
    $('#answer-options').replaceChildren();
    question.options.forEach((option, optionIndex) => {
      const label = el('label', 'answer-option');
      const input = el('input');
      input.type = 'radio';
      input.name = 'answer';
      input.value = option.id;
      input.id = `answer-${state.index}-${optionIndex}`;
      input.required = true;
      input.checked = state.answers[question.id] === option.id;
      input.setAttribute('aria-label', option.text);
      input.setAttribute('aria-describedby', 'question-hint');
      const content = el('span', 'option-content');
      const letter = el('span', 'option-letter', optionIndex < 26 ? String.fromCharCode(65 + optionIndex) : String(optionIndex + 1));
      letter.setAttribute('aria-hidden', 'true');
      const check = el('span', 'option-check', '✓');
      check.setAttribute('aria-hidden', 'true');
      content.append(letter, el('span', 'option-text', option.text), check);
      input.addEventListener('change', () => {
        state.answers[question.id] = option.id;
        persist();
        updateProgress();
      });
      label.append(input, content);
      $('#answer-options').append(label);
    });
    $('#previous-question').disabled = state.index === 0;
    updateProgress();
    persist();
    showScreen('question', focus ? '#question-title' : null);
  }
  function showResult(focus = true) {
    let result;
    try { result = engine.score(config, state.answers); }
    catch (error) {
      const index = questions.findIndex(question => !state.answers[question.id]);
      state.index = index >= 0 ? index : 0;
      showQuestion(focus);
      $('#selection-hint').textContent = '请先完成这道题，再查看结果';
      return;
    }
    const primary = typeMap.get(result.winners[0]);
    const mixed = config.mixed || {};
    $('#result-kicker').textContent = result.isMixed ? `${result.winners.length} 位群友并列`  : primary.code || '你更接近';
    $('#result-title').textContent = result.isMixed ? mixed.title || '混合倾向' : primary.label;
    $('#result-description').textContent = result.isMixed ? mixed.description || '你的选择在几种类型间形成并列。' : primary.description || '';
    $('#result-advice').textContent = result.isMixed ? mixed.advice || '可以回看答案，了解不同选择的联系。' : primary.advice || '';
    $('#result-tags').replaceChildren();
    if (result.isMixed) result.winners.forEach(id => $('#result-tags').append(el('span', 'result-tag', typeMap.get(id).label)));
    const portraits = $('#result-portraits');
    const profiles = $('#friend-profiles');
    portraits.replaceChildren();
    profiles.replaceChildren();
    profiles.classList.toggle('is-mixed', result.isMixed);
    portraits.classList.toggle('is-mixed', result.isMixed);
    result.winners.slice(0, 3).forEach(id => {
      const type = typeMap.get(id);
      const image = el('img');
      image.src = type.avatar;
      image.alt = `${type.label}的头像`;
      portraits.append(image);
    });
    if (result.winners.length > 3) portraits.append(el('span', 'more-portraits', `+${result.winners.length - 3}`));
    result.winners.forEach(id => {
      const type = typeMap.get(id);
      const card = el('article', 'friend-result-card');
      const header = el('div', 'friend-card-header');
      const image = el('img', 'friend-profile-avatar');
      image.src = type.avatar;
      image.alt = `${type.label}的头像`;
      const identity = el('div', 'friend-card-identity');
      identity.append(el('p', 'friend-profile-kicker', '娱乐人设分析'), el('h2', 'friend-profile-name', type.label), el('p', 'friend-persona', type.persona));
      header.append(image, identity);
      const tags = el('div', 'friend-traits');
      (type.tags || []).forEach(tag => tags.append(el('span', '', tag)));
      const quote = el('div', 'friend-signature');
      quote.append(el('span', '', '人设台词 · 虚构'), el('p', '', `“${type.signature}”`));
      card.append(header, tags, el('p', 'friend-analysis', type.analysis || type.description), quote);
      profiles.append(card);
    });
    $('#result-completed').textContent = `${questions.length} / ${questions.length} 题已完成`;
    $('#distribution-note').textContent = '占比按答案权重计算并四舍五入，不是人格相似概率；并列按原始分值判定。';
    $('#result-distribution').replaceChildren();
    result.ranking.forEach(row => {
      const type = typeMap.get(row.id);
      const displayShare = Number((row.score / result.totalWeight * 100).toFixed(1));
      const wrapper = el('div', `distribution-row${result.winners.includes(row.id) ? ' is-winner' : ''}`);
      const label = el('div', 'distribution-label');
      label.append(el('span', '', type.label), el('span', '', `${displayShare}% · ${Number(row.score.toFixed(2))} 分`));
      const bar = el('div', 'distribution-bar');
      bar.setAttribute('aria-hidden', 'true');
      const fill = el('span');
      fill.style.width = `${displayShare}%`;
      bar.append(fill);
      wrapper.append(label, bar);
      $('#result-distribution').append(wrapper);
    });
    $('#answer-review-list').replaceChildren();
    questions.forEach((question, index) => {
      const option = question.options.find(item => item.id === state.answers[question.id]);
      const row = el('li', 'review-row');
      const copy = el('div', 'review-copy');
      const text = el('div');
      text.append(el('p', 'review-question', question.title), el('p', 'review-answer', `你的选择：${option.text}`));
      copy.append(text);
      const edit = el('button', 'text-link review-edit', '修改 ↗');
      edit.type = 'button';
      edit.setAttribute('aria-label', `修改第 ${index + 1} 题`);
      edit.addEventListener('click', () => { state.index = index; state.editing = true; showQuestion(); });
      row.append(copy, edit);
      $('#answer-review-list').append(row);
    });
    state.phase = 'result';
    state.editing = false;
    persist();
    showScreen('result', focus ? '#result-title' : null);
  }
  $('#start-quiz').addEventListener('click', () => {
    if (!completedCount()) state.index = 0;
    if (completedCount() === questions.length) showResult();
    else showQuestion();
  });
  $('#previous-question').addEventListener('click', () => {
    if (state.index > 0) { state.index -= 1; showQuestion(); }
  });
  $('#quiz-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!state.answers[questions[state.index].id]) return;
    const complete = completedCount() === questions.length;
    if ((state.editing || state.index === questions.length - 1) && complete) { showResult(); return; }
    if (state.index === questions.length - 1) {
      state.index = questions.findIndex(question => !state.answers[question.id]);
      showQuestion();
      $('#selection-hint').textContent = '还有未完成的题目，请补充这一题';
    } else { state.index += 1; showQuestion(); }
  });
  $('#save-exit').addEventListener('click', () => showIntro(true));
  $('#edit-answers').addEventListener('click', () => { state.index = 0; state.editing = true; showQuestion(); });
  const restartDialog = $('#restart-dialog');
  function requestRestart() { restartDialog.showModal(); document.body.classList.add('dialog-open'); }
  $('#retake-quiz').addEventListener('click', requestRestart);
  $('#restart-intro').addEventListener('click', requestRestart);
  $('#cancel-restart').addEventListener('click', () => restartDialog.close());
  restartDialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
  $('#confirm-restart').addEventListener('click', () => {
    restartDialog.close();
    state = { phase: 'question', index: 0, answers: {}, editing: false };
    persist();
    showQuestion();
  });
  if (state.phase === 'result') showResult(false);
  else if (state.phase === 'question') showQuestion(false);
  else showIntro();
})();