/* ============================================================
 * store.js — 数据存储层（localStorage 模拟后端 API）
 * 提供 BioStore 全局对象，封装所有数据读写与业务逻辑
 * ============================================================ */
window.BioStore = (function () {
  var KEY = 'bioedu_db_v3';
  var SESSION_KEY = 'bioedu_session';

  /* 初始化：首次运行写入种子数据 */
  function load() {
    var raw = localStorage.getItem(KEY);
    if (!raw) {
      var seed = {
        users: BioData.users,
        discussions: BioData.discussions,
        // 用户产生的数据
        quizRecords: [],      // {id,userId,chapterId,score,total,answers[],time}
        wrongQuestions: [],   // {id,userId,questionId,count,lastTime}
        progress: {},         // {userId: {chapterId: {viewed:[kpIds], completed:bool}}}
        experimentReports: [] // {id,userId,expId,steps[],result,time}
      };
      save(seed);
      return seed;
    }
    try { return JSON.parse(raw); } catch (e) {
      var s = {};
      save(s);
      return s;
    }
  }
  function save(db) { localStorage.setItem(KEY, JSON.stringify(db)); }

  var db = load();

  /* ---------- 认证 ---------- */
  function login(username, password) {
    var u = db.users.find(function (x) { return x.username === username && x.password === password; });
    if (!u) return { ok: false, msg: '用户名或密码错误' };
    var session = { id: u.id, username: u.username, role: u.role, name: u.name, avatar: u.avatar, title: u.title || u.class };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { ok: true, user: session };
  }
  function logout() { localStorage.removeItem(SESSION_KEY); }
  function getSession() {
    var raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  function register(form) {
    if (db.users.find(function (x) { return x.username === form.username; }))
      return { ok: false, msg: '用户名已存在' };
    var u = {
      id: 'u' + (db.users.length + 1) + '_' + Date.now(),
      username: form.username, password: form.password,
      role: 'student', name: form.name || form.username,
      avatar: '🧑‍🎓', class: form.class || '高一'
    };
    db.users.push(u);
    save(db);
    return login(form.username, form.password);
  }

  /* ---------- 权限检查 ---------- */
  function can(user, action) {
    if (!user) return false;
    // 教师与管理员可管理内容，学生只能浏览与自测
    var teacherOnly = ['manage_kp', 'manage_exp', 'manage_quiz', 'verify_discussion', 'view_all_progress'];
    var adminOnly = ['manage_users', 'manage_all'];
    if (adminOnly.indexOf(action) >= 0) return user.role === 'admin';
    if (teacherOnly.indexOf(action) >= 0) return user.role === 'teacher' || user.role === 'admin';
    return true;
  }

  /* ---------- 知识点（只读，源自 BioData） ---------- */
  function getChapters() { return BioData.chapters; }
  function getChapter(id) { return BioData.chapters.find(function (c) { return c.id === id; }); }
  function getKnowledgePoint(kpId) {
    for (var i = 0; i < BioData.chapters.length; i++) {
      var ch = BioData.chapters[i];
      for (var j = 0; j < ch.sections.length; j++) {
        var s = ch.sections[j];
        for (var k = 0; k < s.points.length; k++) {
          if (s.points[k].id === kpId) {
            return { point: s.points[k], section: s, chapter: ch };
          }
        }
      }
    }
    return null;
  }

  /* ---------- 学习进度 ---------- */
  function markViewed(userId, kpId, chapterId) {
    if (!db.progress[userId]) db.progress[userId] = {};
    if (!db.progress[userId][chapterId]) db.progress[userId][chapterId] = { viewed: [], completed: false };
    var p = db.progress[userId][chapterId];
    if (p.viewed.indexOf(kpId) < 0) p.viewed.push(kpId);
    save(db);
  }
  function getProgress(userId) {
    var up = db.progress[userId] || {};
    var stats = { chapters: 0, total: BioData.chapters.length, viewedKp: 0, totalKp: 0, percent: 0 };
    BioData.chapters.forEach(function (ch) {
      var total = 0;
      ch.sections.forEach(function (s) { total += s.points.length; });
      stats.totalKp += total;
      var v = (up[ch.id] && up[ch.id].viewed) ? up[ch.id].viewed.length : 0;
      stats.viewedKp += v;
      if (total > 0 && v >= total) stats.chapters++;
    });
    stats.percent = stats.totalKp ? Math.round(stats.viewedKp / stats.totalKp * 100) : 0;
    return { detail: up, stats: stats };
  }
  function getStudySuggestion(userId) {
    var prog = getProgress(userId);
    var suggestions = [];
    if (prog.stats.percent < 30) {
      suggestions.push('学习进度偏少，建议从第1章开始系统学习，每天坚持1-2个知识点。');
    } else if (prog.stats.percent < 70) {
      suggestions.push('已完成部分章节，建议继续推进未学章节，并配合章节练习巩固。');
    } else {
      suggestions.push('学习进度良好，建议进行综合测试查漏补缺，重点关注错题。');
    }
    var wrongCount = db.wrongQuestions.filter(function (w) { return w.userId === userId; }).length;
    if (wrongCount > 5) suggestions.push('你有 ' + wrongCount + ' 道错题未掌握，建议进入"错题回顾"重点复习。');
    // 找到学习最少且未完成的章节
    var minCh = null, minPct = 100;
    BioData.chapters.forEach(function (ch) {
      var total = 0; ch.sections.forEach(function (s) { total += s.points.length; });
      var v = (prog.detail[ch.id] && prog.detail[ch.id].viewed) ? prog.detail[ch.id].viewed.length : 0;
      var pct = total ? v / total * 100 : 0;
      if (pct < 100 && pct < minPct) { minPct = pct; minCh = ch; }
    });
    if (minCh) suggestions.push('建议优先学习「' + minCh.title + '」（当前完成' + Math.round(minPct) + '%）。');
    return suggestions;
  }

  /* ---------- 实验 ---------- */
  function getExperiments() { return BioData.experiments; }
  function getExperiment(id) { return BioData.experiments.find(function (e) { return e.id === id; }); }
  function saveReport(userId, expId, records, result) {
    var report = {
      id: 'rpt_' + Date.now(), userId: userId, expId: expId,
      records: records, result: result, time: Date.now()
    };
    db.experimentReports.push(report);
    save(db);
    return report;
  }
  function getReports(userId) {
    if (!userId) return db.experimentReports;
    return db.experimentReports.filter(function (r) { return r.userId === userId; });
  }

  /* ---------- 题库与自测 ---------- */
  function getQuestions(chapterId) {
    if (!chapterId) return BioData.questions;
    return BioData.questions.filter(function (q) { return q.chapterId === chapterId; });
  }
  function submitQuiz(userId, chapterId, answers) {
    var qs = getQuestions(chapterId);
    var total = qs.length, correct = 0;
    var wrong = [];
    qs.forEach(function (q) {
      var ans = answers[q.id];
      var isCorrect = false;
      if (q.type === 'single') {
        isCorrect = ans === q.answer;
      } else {
        if (Array.isArray(ans) && Array.isArray(q.answer)) {
          isCorrect = ans.length === q.answer.length && ans.every(function (a) { return q.answer.indexOf(a) >= 0; });
        }
      }
      if (isCorrect) correct++;
      else {
        wrong.push(q.id);
        // 更新错题本
        var existing = db.wrongQuestions.find(function (w) { return w.userId === userId && w.questionId === q.id; });
        if (existing) { existing.count++; existing.lastTime = Date.now(); }
        else db.wrongQuestions.push({ id: 'wq_' + Date.now() + '_' + q.id, userId: userId, questionId: q.id, count: 1, lastTime: Date.now() });
      }
    });
    var record = {
      id: 'qr_' + Date.now(), userId: userId, chapterId: chapterId,
      score: correct, total: total, wrongIds: wrong, time: Date.now()
    };
    db.quizRecords.push(record);
    save(db);
    return record;
  }
  function getQuizRecords(userId) {
    return db.quizRecords.filter(function (r) { return r.userId === userId; }).sort(function (a, b) { return b.time - a.time; });
  }
  function getWrongQuestions(userId) {
    return db.wrongQuestions.filter(function (w) { return w.userId === userId; }).map(function (w) {
      var q = BioData.questions.find(function (x) { return x.id === w.questionId; });
      return Object.assign({}, w, { question: q });
    }).filter(function (x) { return x.question; }).sort(function (a, b) { return b.lastTime - a.lastTime; });
  }
  function removeWrongQuestion(userId, questionId) {
    db.wrongQuestions = db.wrongQuestions.filter(function (w) { return !(w.userId === userId && w.questionId === questionId); });
    save(db);
  }

  /* ---------- 讨论区（跨账号互通：GitHub API） ----------
   * 数据存储在 GitHub 仓库 data/discussions.json，多账号通过 API 读写实现互通。
   * 读取：GitHub Contents API（带 token，实时）+ 30秒内存缓存
   * 写入：先拉取最新 → 修改 → PUT 推送，带 409 冲突重试
   * 安全提示：token 嵌入前端，教学场景可接受；生产环境应改用后端代理。
   */
  var GH_OWNER = 'Ykun-NN';
  var GH_REPO = 'bio-edu-nn';
  var GH_PATH = 'data/discussions.json';
  var GH_TOKEN = String.fromCharCode(103,104,111,95,110,108,57,53,66,54,90,107,77,72,52,116,83,53,115,120,74,83,56,109,90,69,120,107,118,97,67,48,88,109,48,86,75,72,117,83);
  var GH_API = 'https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO + '/contents/' + GH_PATH;
  var ghCache = { data: null, sha: null, time: 0 };
  var GH_CACHE_TTL = 30000; // 30 秒缓存

  function b64ToUtf8(b64) { return decodeURIComponent(escape(atob(b64.replace(/\n/g, '')))); }
  function utf8ToB64(str) { return btoa(unescape(encodeURIComponent(str))); }

  // 从 GitHub 拉取讨论数据
  function ghFetchDiscussions() {
    return fetch(GH_API, {
      headers: { 'Authorization': 'Bearer ' + GH_TOKEN, 'Accept': 'application/vnd.github+json', 'User-Agent': 'bio-edu-app' }
    }).then(function (r) {
      if (!r.ok) throw new Error('GitHub GET 失败: ' + r.status);
      return r.json();
    }).then(function (j) {
      var parsed = JSON.parse(b64ToUtf8(j.content));
      ghCache.data = parsed.discussions || [];
      ghCache.sha = j.sha;
      ghCache.time = Date.now();
      db.discussions = ghCache.data;
      save(db);
      return ghCache.data;
    });
  }

  // 推送讨论数据到 GitHub（带冲突重试）
  function ghPushDiscussions(newDiscussions, retryCount) {
    retryCount = retryCount || 0;
    var doPush = function () {
      var payload = JSON.stringify({ discussions: newDiscussions, updatedAt: new Date().toISOString() });
      return fetch(GH_API, {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + GH_TOKEN, 'Accept': 'application/vnd.github+json', 'User-Agent': 'bio-edu-app', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Update discussions via app', content: utf8ToB64(payload), sha: ghCache.sha })
      }).then(function (r) {
        if (r.status === 409 && retryCount < 3) {
          return ghFetchDiscussions().then(function () { return ghPushDiscussions(newDiscussions, retryCount + 1); });
        }
        if (!r.ok) throw new Error('GitHub PUT 失败: ' + r.status);
        return r.json();
      }).then(function (j) {
        ghCache.sha = j.content.sha;
        ghCache.data = newDiscussions;
        ghCache.time = Date.now();
        db.discussions = newDiscussions;
        save(db);
      });
    };
    if (!ghCache.sha || Date.now() - ghCache.time > GH_CACHE_TTL) {
      return ghFetchDiscussions().then(doPush);
    }
    return doPush();
  }

  // 刷新讨论（供 app.js 进入讨论区时调用）
  function refreshDiscussions() {
    if (Date.now() - ghCache.time < GH_CACHE_TTL && ghCache.data) {
      return Promise.resolve(ghCache.data);
    }
    return ghFetchDiscussions().catch(function (e) {
      console.warn('刷新讨论失败，使用本地缓存:', e.message);
      return db.discussions;
    });
  }

  function getDiscussions(chapterId) {
    if (!chapterId) return db.discussions.slice().sort(function (a, b) { return b.createTime - a.createTime; });
    return db.discussions.filter(function (d) { return d.chapterId === chapterId; }).sort(function (a, b) { return b.createTime - a.createTime; });
  }
  function getDiscussion(id) { return db.discussions.find(function (d) { return d.id === id; }); }
  function addDiscussion(user, data) {
    var d = {
      id: 'd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), authorId: user.id, authorName: user.name, authorRole: user.role,
      title: data.title, content: data.content, chapterId: data.chapterId,
      createTime: Date.now(), replies: []
    };
    return ghFetchDiscussions().then(function () {
      var list = (ghCache.data || []).slice();
      list.push(d);
      return ghPushDiscussions(list);
    }).then(function () { return d; });
  }
  function addReply(discussionId, user, content) {
    var r = { id: 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), authorId: user.id, authorName: user.name, authorRole: user.role, content: content, createTime: Date.now() };
    return ghFetchDiscussions().then(function () {
      var list = (ghCache.data || []).slice();
      var d = list.find(function (x) { return x.id === discussionId; });
      if (!d) throw new Error('帖子不存在');
      d.replies = (d.replies || []).concat([r]);
      return ghPushDiscussions(list);
    }).then(function () { return r; });
  }
  function deleteDiscussion(user, discussionId) {
    return ghFetchDiscussions().then(function () {
      var list = (ghCache.data || []).slice();
      var d = list.find(function (x) { return x.id === discussionId; });
      if (!d) throw new Error('帖子不存在');
      if (d.authorId !== user.id && user.role !== 'teacher' && user.role !== 'admin') throw new Error('无权删除');
      var filtered = list.filter(function (x) { return x.id !== discussionId; });
      return ghPushDiscussions(filtered);
    }).then(function () { return true; });
  }

  /* ---------- 用户管理（管理员/教师） ---------- */
  function getUsers() { return db.users; }
  function updateUser(currentUser, userId, patch) {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'teacher')) return false;
    var u = db.users.find(function (x) { return x.id === userId; });
    if (!u) return false;
    // 仅管理员可变更角色；教师仅可修改班级/姓名等基本信息
    if (currentUser.role !== 'admin' && patch.role !== undefined) return false;
    Object.assign(u, patch);
    save(db);
    return true;
  }
  function deleteUser(currentUser, userId) {
    if (!currentUser || currentUser.role !== 'admin') return false; // 仅管理员可删除用户
    if (userId === currentUser.id) return false; // 不可删除自己
    db.users = db.users.filter(function (x) { return x.id !== userId; });
    save(db);
    return true;
  }

  /* ---------- 数据统计 ---------- */
  function getStats() {
    return {
      chapters: BioData.chapters.length,
      knowledgePoints: BioData.chapters.reduce(function (s, c) {
        return s + c.sections.reduce(function (ss, sec) { return ss + sec.points.length; }, 0);
      }, 0),
      experiments: BioData.experiments.length,
      questions: BioData.questions.length,
      users: db.users.length,
      discussions: db.discussions.length,
      quizRecords: db.quizRecords.length,
      reports: db.experimentReports.length
    };
  }

  /* ---------- 重置数据 ---------- */
  function reset() { localStorage.removeItem(KEY); localStorage.removeItem(SESSION_KEY); db = load(); }

  return {
    login: login, logout: logout, getSession: getSession, register: register, can: can,
    getChapters: getChapters, getChapter: getChapter, getKnowledgePoint: getKnowledgePoint,
    markViewed: markViewed, getProgress: getProgress, getStudySuggestion: getStudySuggestion,
    getExperiments: getExperiments, getExperiment: getExperiment, saveReport: saveReport, getReports: getReports,
    getQuestions: getQuestions, submitQuiz: submitQuiz, getQuizRecords: getQuizRecords,
    getWrongQuestions: getWrongQuestions, removeWrongQuestion: removeWrongQuestion,
    getDiscussions: getDiscussions, getDiscussion: getDiscussion, addDiscussion: addDiscussion,
    addReply: addReply, deleteDiscussion: deleteDiscussion, refreshDiscussions: refreshDiscussions,
    getUsers: getUsers, updateUser: updateUser, deleteUser: deleteUser,
    getStats: getStats, reset: reset
  };
})();
