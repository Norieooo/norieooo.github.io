/* 纯计分逻辑；浏览器与 Node.js 共用，不依赖网页或网络。 */
(function (root) {
  'use strict';
  function validate(config) {
    if (!config || !Array.isArray(config.types) || config.types.length < 2) throw new Error('至少需要两种结果类型。');
    const types = new Set();
    config.types.forEach(type => {
      if (!type.id || types.has(type.id) || typeof type.label !== 'string' || !type.label.trim()) throw new Error('类型 id 必须唯一且名称不能为空。');
      types.add(type.id);
    });
    if (!Array.isArray(config.questions) || !config.questions.length) throw new Error('至少需要一道题。');
    const questions = new Set();
    config.questions.forEach(question => {
      if (!question.id || questions.has(question.id) || !question.title || !Array.isArray(question.options) || question.options.length < 2) throw new Error('题目 id 必须唯一，且至少包含两个选项。');
      questions.add(question.id);
      const options = new Set();
      question.options.forEach(option => {
        if (!option.id || options.has(option.id) || !option.text || !option.scores || typeof option.scores !== 'object' || Array.isArray(option.scores)) throw new Error('选项必须有唯一 id、文字和 scores。');
        options.add(option.id);
        let total = 0;
        Object.entries(option.scores).forEach(([id, weight]) => {
          if (!types.has(id) || !Number.isFinite(weight) || weight < 0) throw new Error('选项权重必须为已定义类型的非负数字。');
          total += weight;
        });
        if (!(total > 0) || !Number.isFinite(total)) throw new Error('每个选项的总权重必须大于零。');
      });
    });
    return true;
  }
  function sanitizeAnswers(config, answers) {
    const clean = {};
    if (!answers || typeof answers !== 'object') return clean;
    config.questions.forEach(question => {
      if (question.options.some(option => option.id === answers[question.id])) clean[question.id] = answers[question.id];
    });
    return clean;
  }
  function score(config, answers) {
    validate(config);
    const clean = sanitizeAnswers(config, answers);
    const missing = config.questions.filter(question => !Object.prototype.hasOwnProperty.call(clean, question.id));
    if (missing.length) {
      const error = new Error('请先完成全部题目。');
      error.missingQuestionIds = missing.map(question => question.id);
      throw error;
    }
    const totals = new Map(config.types.map(type => [type.id, 0]));
    config.questions.forEach(question => {
      const option = question.options.find(item => item.id === clean[question.id]);
      Object.entries(option.scores).forEach(([id, weight]) => totals.set(id, totals.get(id) + weight));
    });
    const totalWeight = [...totals.values()].reduce((sum, value) => sum + value, 0);
    if (!Number.isFinite(totalWeight) || totalWeight <= 0) throw new Error('总权重超出有效范围。');
    const ranking = config.types.map((type, index) => {
      const raw = totals.get(type.id) / totalWeight * 100;
      return { id: type.id, score: totals.get(type.id), percentage: Math.floor(raw), remainder: raw - Math.floor(raw), index };
    });
    let rest = 100 - ranking.reduce((sum, row) => sum + row.percentage, 0);
    [...ranking].sort((a, b) => b.remainder - a.remainder || a.index - b.index).forEach(row => {
      if (rest > 0) { row.percentage += 1; rest -= 1; }
    });
    ranking.sort((a, b) => b.score - a.score || a.index - b.index);
    const maxScore = ranking[0].score;
    const winners = ranking.filter(row => Math.abs(row.score - maxScore) <= Math.max(1, maxScore) * 1e-10).map(row => row.id);
    return { ranking: ranking.map(({ remainder, index, ...row }) => row), winners, isMixed: winners.length > 1, totalWeight };
  }
  const api = { validate, sanitizeAnswers, score };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.QuizEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);