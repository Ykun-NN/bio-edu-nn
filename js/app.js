/* ============================================================
 * app.js — 高一生物教学平台 · 应用主文件（单一 Babel 脚本）
 * 合并：认证 / 路由 / 布局 / 首页 / 知识点 / 实验 / 自测 / 讨论 / 进度 / 管理
 * 依赖：window.BioData、window.BioStore（普通脚本先行加载，同步可用）
 * 单文件以保证 Babel 外部脚本执行顺序与作用域共享
 * ============================================================ */
const { useState, useEffect, useMemo, useCallback, useContext, createContext, createElement: h, Fragment } = React;

const {
  ConfigProvider, App: AntApp, message, Modal, Form, Input, Button, Tag, Avatar, Dropdown, Space,
  Menu, Card, Row, Col, Typography, Divider, Empty, Alert, Progress, Statistic, Steps, Result,
  Radio, Checkbox, Select, Tooltip, List, Timeline, Table, Popconfirm, Breadcrumb, Slider, Spin
} = antd;
const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

/* ==================== 认证模块 ==================== */
const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);
const ROLE_MAP = {
  student: { label: '学生', color: 'blue' },
  teacher: { label: '教师', color: 'green' },
  admin: { label: '管理员', color: 'red' }
};
function RoleTag({ role }) {
  const r = ROLE_MAP[role] || { label: role, color: 'default' };
  return h(Tag, { color: r.color }, r.label);
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => BioStore.getSession());
  const login = useCallback((username, password) => {
    const res = BioStore.login(username, password);
    if (res.ok) { setUser(res.user); message.success('登录成功，欢迎' + res.user.name); }
    else message.error(res.msg);
    return res;
  }, []);
  const logout = useCallback(() => { BioStore.logout(); setUser(null); message.success('已退出登录'); }, []);
  const register = useCallback((form) => {
    const res = BioStore.register(form);
    if (res.ok) { setUser(res.user); message.success('注册成功，已自动登录'); }
    else message.error(res.msg);
    return res;
  }, []);
  const can = useCallback((action) => BioStore.can(user, action), [user]);
  return h(AuthContext.Provider, { value: { user, login, logout, register, can } }, children);
}

function LoginModal({ open, onClose }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form] = Form.useForm();
  const onSubmit = () => {
    form.validateFields().then(values => {
      const res = mode === 'login' ? login(values.username, values.password) : register(values);
      if (res && res.ok) { form.resetFields(); onClose(); }
    });
  };
  const fillDemo = (u) => form.setFieldsValue({ username: u, password: '123456' });
  return h(Modal, {
    open, title: mode === 'login' ? '登录' : '注册', onCancel: onClose,
    footer: [
      h(Button, { key: 'switch', type: 'link', onClick: () => { setMode(mode === 'login' ? 'register' : 'login'); form.resetFields(); } },
        mode === 'login' ? '没有账号？去注册' : '已有账号？去登录'),
      h(Button, { key: 'cancel', onClick: onClose }, '取消'),
      h(Button, { key: 'ok', type: 'primary', onClick: onSubmit }, mode === 'login' ? '登录' : '注册')
    ]
  },
    h(Form, { form, layout: 'vertical' },
      h(Form.Item, { name: 'username', label: '用户名', rules: [{ required: true, message: '请输入用户名' }] }, h(Input, { placeholder: '请输入用户名' })),
      h(Form.Item, { name: 'password', label: '密码', rules: [{ required: true, message: '请输入密码' }] }, h(Input.Password, { placeholder: '请输入密码' })),
      mode === 'register' && h(Form.Item, { name: 'name', label: '姓名' }, h(Input, { placeholder: '请输入姓名' })),
      mode === 'login' && h('div', { style: { background: '#f6ffed', padding: 12, borderRadius: 8, fontSize: 13 } },
        h('div', { style: { fontWeight: 600, marginBottom: 6 } }, '演示账号（点击自动填充）'),
        h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
          h(Button, { size: 'small', onClick: () => fillDemo('student') }, '学生 student'),
          h(Button, { size: 'small', onClick: () => fillDemo('teacher') }, '教师 teacher'),
          h(Button, { size: 'small', onClick: () => fillDemo('admin') }, '管理员 admin')),
        h('div', { style: { marginTop: 6, color: '#888' } }, '密码均为 123456'))
    )
  );
}

/* ==================== 路由模块 ==================== */
function parseHash() {
  let hash = window.location.hash.replace(/^#/, '') || '/';
  const [path, queryStr] = hash.split('?');
  const query = {};
  if (queryStr) queryStr.split('&').forEach(kv => { const [k, v] = kv.split('='); query[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
  return { path, query };
}
const RouterContext = createContext({ path: '/', query: {} });
const useRouter = () => useContext(RouterContext);
function navigate(path, query) {
  let hash = '#' + path;
  if (query && Object.keys(query).length) hash += '?' + Object.entries(query).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
  if (window.location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else window.location.hash = hash;
  window.scrollTo(0, 0);
}
function RouterProvider({ children }) {
  const [route, setRoute] = useState(parseHash());
  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onChange);
    if (!window.location.hash) window.location.hash = '/';
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return h(RouterContext.Provider, { value: route }, children);
}
function RouterLink({ to, query, children, className, style, onClick }) {
  return h('a', {
    href: '#' + to + (query ? '?' + Object.entries(query).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&') : ''),
    className, style, onClick: (e) => { if (onClick) onClick(e); }
  }, children);
}

/* ==================== 布局模块 ==================== */
const NAV_ITEMS = [
  { key: '/', label: '首页', icon: '🏠' },
  { key: '/knowledge', label: '知识点', icon: '📚' },
  { key: '/experiments', label: '实验模拟', icon: '🔬' },
  { key: '/quiz', label: '在线自测', icon: '📝' },
  { key: '/discussion', label: '讨论区', icon: '💬' },
  { key: '/progress', label: '学习进度', icon: '📊' }
];

function HeaderBar() {
  const { user, logout } = useAuth();
  const { path } = useRouter();
  const [loginOpen, setLoginOpen] = useState(false);
  const menuItems = [...NAV_ITEMS, ...(user && (user.role === 'teacher' || user.role === 'admin') ? [{ key: '/admin', label: '⚙️ 管理后台' }] : [])]
    .map(it => ({ key: it.key, label: h(RouterLink, { to: it.key }, h('span', null, it.icon + ' ' + it.label)) }));
  const userMenu = {
    items: user ? [
      { key: 'info', label: h('div', { style: { padding: '4px 0' } }, h('b', null, user.name), ' ', h(RoleTag, { role: user.role })), disabled: true },
      { key: 'progress', label: h(RouterLink, { to: '/progress' }, '📊 学习进度') },
      user.role !== 'student' && { key: 'admin', label: h(RouterLink, { to: '/admin' }, '⚙️ 管理后台') },
      { type: 'divider' },
      { key: 'logout', label: '退出登录' }
    ].filter(Boolean) : [],
    onClick: ({ key }) => { if (key === 'logout') logout(); }
  };
  return h('header', { className: 'bio-header' },
    h(RouterLink, { to: '/', className: 'bio-logo' }, h('span', { className: 'logo-icon' }, '🌿'), h('span', null, '高一生物教学平台')),
    h('div', { className: 'bio-header-right' },
      h(Menu, { mode: 'horizontal', selectedKeys: ['/' + (path.split('/')[1] || '')], items: menuItems, style: { borderBottom: 'none', minWidth: 0, flex: 1 } }),
      user ? h(Dropdown, { menu: userMenu, placement: 'bottomRight' },
        h(Space, { style: { cursor: 'pointer' } }, h(Avatar, { size: 32, style: { background: '#2e9e5b' } }, user.avatar || user.name[0]), h('span', { style: { fontSize: 14 } }, user.name)))
        : h(Button, { type: 'primary', onClick: () => setLoginOpen(true) }, '登录 / 注册')
    ),
    h(LoginModal, { open: loginOpen, onClose: () => setLoginOpen(false) })
  );
}

function SideMenu() {
  const { path } = useRouter();
  const { user } = useAuth();
  const items = [...NAV_ITEMS, ...(user && (user.role === 'teacher' || user.role === 'admin') ? [{ key: '/admin', label: '⚙️ 管理后台' }] : [])].map(it => ({ key: it.key, label: it.icon + ' ' + it.label }));
  const current = '/' + (path.split('/')[1] || '');
  return h('div', { className: 'bio-sider' },
    h('div', { className: 'bio-card', style: { padding: 0, overflow: 'hidden' } },
      h(Menu, { mode: 'inline', selectedKeys: [current], items: items.map(it => ({ key: it.key, label: h(RouterLink, { to: it.key }, it.label) })), style: { border: 'none' } }))
  );
}

function AppLayout({ children }) {
  return h('div', { className: 'bio-layout' },
    h(HeaderBar),
    h('div', { className: 'bio-body' }, h(SideMenu), h('main', { className: 'bio-content' }, children)),
    h('footer', { className: 'bio-footer' },
      h('div', null,
        h('span', null, '🌿 高一生物教学平台 BioEdu · 面向高中生物教学的专业网站'),
        h('br'),
        h('span', { style: { fontSize: 12 } }, '教学内容基于人教版必修一《分子与细胞》 | © 2026 BioEdu · 教学资源版权所有，仅供学习使用')))
  );
}

/* ==================== 首页 ==================== */
const FEATURES = [
  { key: '/knowledge', icon: '📚', title: '知识点体系', desc: '5本教材·23章 · 层级化知识框架', color: '#2e9e5b' },
  { key: '/experiments', icon: '🔬', title: '实验模拟', desc: '11个核心实验 · 虚拟操作', color: '#43a047' },
  { key: '/quiz', icon: '📝', title: '在线自测', desc: '15道精选题 · 错题回顾', color: '#66bb6a' },
  { key: '/discussion', icon: '💬', title: '互动讨论', desc: '师生问答 · 知识交流', color: '#7cb342' },
  { key: '/progress', icon: '📊', title: '学习进度', desc: '进度追踪 · 个性化建议', color: '#9ccc65' },
  { key: '/admin', icon: '⚙️', title: '管理后台', desc: '用户管理 · 数据统计', color: '#8d6e63' }
];

function HomePage() {
  const { user } = useAuth();
  const stats = BioStore.getStats();
  const prog = user ? BioStore.getProgress(user.id) : null;
  return h(Fragment, null,
    h('div', { className: 'hero' },
      h('h1', null, '欢迎来到高一生物教学平台 🌿'),
      h('p', null, '基于人教版必修一《分子与细胞》，提供知识点体系、虚拟实验、在线自测与互动讨论，助力师生高效开展生物教与学。'),
      h(Space, null,
        h(Button, { size: 'large', onClick: () => navigate('/knowledge'), style: { background: '#fff', color: '#2e9e5b', border: 'none', fontWeight: 600 } }, '📚 开始学习'),
        h(Button, { size: 'large', ghost: true, onClick: () => navigate('/experiments') }, '🔬 体验实验')),
      h('div', { className: 'hero-stats', style: { marginTop: 24 } },
        h('div', { className: 'hero-stat' }, h('div', { className: 'num' }, stats.knowledgePoints), h('div', { className: 'label' }, '知识点')),
        h('div', { className: 'hero-stat' }, h('div', { className: 'num' }, stats.experiments), h('div', { className: 'label' }, '虚拟实验')),
        h('div', { className: 'hero-stat' }, h('div', { className: 'num' }, stats.questions), h('div', { className: 'label' }, '自测题目')),
        h('div', { className: 'hero-stat' }, h('div', { className: 'num' }, stats.chapters), h('div', { className: 'label' }, '教学章节')))
    ),
    user && prog && h(Card, { className: 'bio-card', title: '我的学习概况', extra: h(RouterLink, { to: '/progress' }, '查看详情 →') },
      h(Row, { gutter: 24 },
        h(Col, { xs: 24, sm: 8 }, h(Statistic, { title: '总体进度', value: prog.stats.percent, suffix: '%', valueStyle: { color: '#2e9e5b' } })),
        h(Col, { xs: 24, sm: 8 }, h(Statistic, { title: '已学知识点', value: prog.stats.viewedKp, suffix: '/ ' + prog.stats.totalKp })),
        h(Col, { xs: 24, sm: 8 }, h(Progress, { percent: prog.stats.percent, strokeColor: '#2e9e5b' }))
      )
    ),
    h('div', { className: 'section-title' }, '核心功能'),
    h('div', { className: 'feature-grid' },
      FEATURES.map(f => h('div', { key: f.key, className: 'feature-item', onClick: () => navigate(f.key) },
        h('div', { className: 'icon', style: { background: f.color + '20' } }, f.icon),
        h('h3', null, f.title), h('p', null, f.desc)))
    ),
    h('div', { style: { marginTop: 24 } },
      h('div', { className: 'section-title' }, '教材章节概览'),
      h(Row, { gutter: [16, 16] },
        BioStore.getChapters().map(ch => {
          const total = ch.sections.reduce((s, sec) => s + sec.points.length, 0);
          return h(Col, { key: ch.id, xs: 24, sm: 12, md: 8 },
            h(Card, { hoverable: true, size: 'small', onClick: () => navigate('/knowledge', { chapter: ch.id }), title: h('span', { style: { color: '#2e9e5b' } }, ch.title) },
              h('div', { style: { minHeight: 60, color: '#5a6b62', fontSize: 13, lineHeight: 1.7 } }, ch.summary.slice(0, 60) + '...'),
              h('div', { style: { marginTop: 12 } }, h(Tag, { color: 'green' }, total + ' 个知识点')))
          );
        })
      )
    ),
    !user && h(Card, { className: 'bio-card', style: { marginTop: 24, background: '#f6ffed', border: '1px solid #b7eb8f' } },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' } },
        h('span', { style: { fontSize: 28 } }, '🔐'),
        h('div', null,
          h('div', { style: { fontWeight: 600 } }, '登录后体验完整功能'),
          h('div', { style: { fontSize: 13, color: '#666' } }, '点击右上角"登录/注册"，使用演示账号：student / teacher / admin，密码均为 123456')))
    )
  );
}

/* ==================== 知识点管理 ==================== */
const IMPORTANCE_MAP = {
  high: { label: '重点掌握', color: 'red', icon: '🔥' },
  medium: { label: '理解运用', color: 'orange', icon: '⭐' },
  low: { label: '了解认识', color: 'blue', icon: '📖' }
};
function highlightKeywords(text, keywords) {
  if (!text) return null;
  if (!keywords || !keywords.length) return text;
  const sorted = [...keywords].sort((a, b) => b.length - a.length);
  const escaped = sorted.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp('(' + escaped.join('|') + ')', 'g');
  return text.split(re).map((part, i) => sorted.includes(part) ? h('span', { key: i, className: 'highlight' }, part) : part);
}

function KpDetail({ kpId }) {
  const data = BioStore.getKnowledgePoint(kpId);
  const { user } = useAuth();
  const [viewMarked, setViewMarked] = useState(false);
  useEffect(() => {
    if (data && user && !viewMarked) { BioStore.markViewed(user.id, kpId, data.chapter.id); setViewMarked(true); }
  }, [kpId, data, user]);
  if (!data) return h(Empty, { description: '知识点不存在' });
  const { point, section, chapter } = data;
  const imp = IMPORTANCE_MAP[point.importance] || IMPORTANCE_MAP.medium;
  return h(Fragment, null,
    h(Breadcrumb, { style: { marginBottom: 16 } },
      h(Breadcrumb.Item, null, h(RouterLink, { to: '/knowledge' }, '知识点')),
      h(Breadcrumb.Item, null, h(RouterLink, { to: '/knowledge', query: { chapter: chapter.id } }, chapter.title)),
      h(Breadcrumb.Item, null, section.title),
      h(Breadcrumb.Item, null, point.title)),
    h(Card, { className: 'bio-card kp-detail' },
      h('div', { className: 'flex-between', style: { flexWrap: 'wrap', gap: 12 } },
        h(Title, { level: 2, style: { margin: 0, color: '#1f7a45' } }, point.title),
        h(Space, null, h(Tag, { color: imp.color }, imp.icon + ' ' + imp.label), h(Tag, { color: 'green' }, section.title))),
      h('div', { className: 'kp-meta', style: { marginTop: 16 } }, point.keywords.map((kw, i) => h(Tag, { key: i, className: 'keyword-tag' }, '# ' + kw))),
      h(Divider),
      h('div', { className: 'kp-content' },
        h(Title, { level: 4 }, '📖 核心内容'), h(Paragraph, null, highlightKeywords(point.content, point.keywords)),
        h(Title, { level: 4 }, '⚡ 重点难点'), h(Alert, { type: 'warning', message: highlightKeywords(point.difficulty, point.keywords), style: { marginBottom: 16 } }),
        h(Title, { level: 4 }, '💡 学习提示'), h(Alert, { type: 'success', message: highlightKeywords(point.tips, point.keywords) })),
      h(Divider),
      h(Space, { style: { flexWrap: 'wrap' } },
        h(Button, { type: 'primary', onClick: () => navigate('/quiz', { chapter: chapter.id }) }, '📝 章节自测'),
        h(Button, { onClick: () => navigate('/discussion', { chapter: chapter.id }) }, '💬 相关讨论'),
        h(Button, { onClick: () => navigate('/experiments') }, '🔬 关联实验'))
    )
  );
}

function ChapterSummary({ chapterId }) {
  const chapter = BioStore.getChapter(chapterId);
  const { user } = useAuth();
  if (!chapter) return h(Empty, { description: '章节不存在' });
  const prog = user ? BioStore.getProgress(user.id) : null;
  const chapterProg = prog && prog.detail[chapter.id];
  const totalKp = chapter.sections.reduce((s, sec) => s + sec.points.length, 0);
  const viewed = chapterProg ? chapterProg.viewed.length : 0;
  return h(Fragment, null,
    h(Breadcrumb, { style: { marginBottom: 16 } }, h(Breadcrumb.Item, null, h(RouterLink, { to: '/knowledge' }, '知识点')), h(Breadcrumb.Item, null, chapter.title)),
    h(Card, { className: 'bio-card' },
      h(Title, { level: 2, style: { color: '#1f7a45' } }, chapter.title),
      h(Paragraph, { style: { fontSize: 15, lineHeight: 1.9 } }, chapter.summary),
      user && h(Progress, { percent: totalKp ? Math.round(viewed / totalKp * 100) : 0, strokeColor: '#2e9e5b', format: p => '已学 ' + viewed + '/' + totalKp + ' (' + p + '%)' })),
    h(Card, { className: 'bio-card', title: '🎯 核心概念' },
      h(Space, { size: [8, 8], wrap: true }, chapter.keyPoints.map((kp, i) => h(Tag, { key: i, color: 'green', style: { padding: '4px 12px', fontSize: 14 } }, kp)))),
    h(Card, { className: 'bio-card', title: '🌳 知识框架图' },
      h('div', { className: 'kp-framework' }, h('pre', { style: { margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'Consolas, monospace', fontSize: 13, lineHeight: 1.8 } }, chapter.framework))),
    h(Card, { className: 'bio-card', title: '📋 知识点明细（点击查看详情）' },
      chapter.sections.map(section =>
        h('div', { key: section.id, style: { marginBottom: 20 } },
          h(Title, { level: 4, style: { color: '#2e9e5b' } }, section.title),
          section.points.map(point => {
            const imp = IMPORTANCE_MAP[point.importance] || IMPORTANCE_MAP.medium;
            const isViewed = chapterProg && chapterProg.viewed.includes(point.id);
            return h(Card, { key: point.id, size: 'small', hoverable: true, style: { marginBottom: 10, borderLeft: '3px solid ' + (imp.color === 'red' ? '#f5222d' : imp.color === 'orange' ? '#fa8c16' : '#1890ff') }, onClick: () => navigate('/knowledge', { kp: point.id }) },
              h('div', { className: 'flex-between', style: { flexWrap: 'wrap', gap: 8 } },
                h('div', null, h('span', { style: { fontWeight: 600 } }, point.title), h('br'), h(Text, { type: 'secondary', style: { fontSize: 12 } }, point.content.slice(0, 50) + '...')),
                h(Space, null, h(Tag, { color: imp.color }, imp.icon + ' ' + imp.label), isViewed && h(Tag, { color: 'green' }, '✓ 已学'), h(Button, { type: 'link', size: 'small' }, '查看 →'))));
          }))
      )
    )
  );
}

function KnowledgeOverview() {
  const allChapters = BioStore.getChapters();
  const { user } = useAuth();
  const prog = user ? BioStore.getProgress(user.id) : null;
  const [bookFilter, setBookFilter] = React.useState('all');
  const books = React.useMemo(() => {
    const map = new Map();
    allChapters.forEach(ch => { if (ch.book && !map.has(ch.book)) map.set(ch.book, { name: ch.book, grade: ch.grade }); });
    return Array.from(map.values());
  }, [allChapters]);
  const chapters = bookFilter === 'all' ? allChapters : allChapters.filter(ch => ch.book === bookFilter);
  const bookColor = { '必修1·分子与细胞': 'green', '必修2·遗传与进化': 'blue', '选必1·稳态与调节': 'orange', '选必2·生物与环境': 'cyan', '选必3·生物技术与工程': 'purple' };
  return h(Fragment, null,
    h('div', { className: 'section-title' }, '知识点体系'),
    h(Alert, { message: '高中全阶段·5本教材·23章', type: 'info', showIcon: true, style: { marginBottom: 16 }, description: '本平台依据人教版高中生物全套教材（必修1·分子与细胞、必修2·遗传与进化、选必1·稳态与调节、选必2·生物与环境、选必3·生物技术与工程）构建完整知识点体系，共23章。点击教材名称可筛选，点击章节进入总结页。' }),
    h('div', { style: { marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' } },
      h(Text, { type: 'secondary', style: { fontSize: 13 } }, '📚 按教材筛选：'),
      h(Button, { size: 'small', type: bookFilter === 'all' ? 'primary' : 'default', onClick: () => setBookFilter('all') }, '全部 (' + allChapters.length + ')'),
      books.map(b => h(Button, { key: b.name, size: 'small', type: bookFilter === b.name ? 'primary' : 'default', onClick: () => setBookFilter(b.name), style: bookFilter === b.name ? { background: '#2e9e5b', borderColor: '#2e9e5b' } : null },
        b.name.replace(/^[必修选必0-9]+·/, '') + ' (' + allChapters.filter(ch => ch.book === b.name).length + ')'))
    ),
    h(Row, { gutter: [16, 16] },
      chapters.map(ch => {
        const total = ch.sections.reduce((s, sec) => s + sec.points.length, 0);
        const viewed = prog && prog.detail[ch.id] ? prog.detail[ch.id].viewed.length : 0;
        const pct = total ? Math.round(viewed / total * 100) : 0;
        return h(Col, { key: ch.id, xs: 24, md: 12 },
          h(Card, { hoverable: true, onClick: () => navigate('/knowledge', { chapter: ch.id }) },
            h('div', { className: 'flex-between', style: { marginBottom: 12 } }, h(Title, { level: 4, style: { margin: 0, color: '#2e9e5b' } }, ch.title), h(Space, null, ch.book && h(Tag, { color: bookColor[ch.book] || 'default', style: { fontSize: 11 } }, ch.grade), h(Tag, { color: 'green' }, total + ' 知识点'))),
            ch.book && h('div', { style: { marginBottom: 8, fontSize: 12, color: '#888' } }, '📖 ' + ch.book),
            h(Paragraph, { type: 'secondary', style: { fontSize: 13, marginBottom: 12, minHeight: 44 } }, ch.summary.slice(0, 70) + '...'),
            h('div', { style: { marginBottom: 8 } }, h(Text, { type: 'secondary', style: { fontSize: 12 } }, '核心概念：'), ch.keyPoints.slice(0, 3).map((kp, i) => h(Tag, { key: i, style: { fontSize: 11, marginBottom: 4 } }, kp))),
            user && h(Progress, { percent: pct, size: 'small', strokeColor: '#2e9e5b' })));
      })
    )
  );
}

function KnowledgePage() {
  const { query } = useRouter();
  if (query.kp) return h(KpDetail, { kpId: query.kp });
  if (query.chapter) return h(ChapterSummary, { chapterId: query.chapter });
  return h(KnowledgeOverview);
}

/* ==================== 实验模拟 ==================== */
const EXP_DIFF = { 1: { label: '基础', color: 'green' }, 2: { label: '中等', color: 'blue' }, 3: { label: '较难', color: 'orange' }, 4: { label: '复杂', color: 'red' } };

function ExperimentSimulator({ exp }) {
  const { user } = useAuth();
  const [current, setCurrent] = useState(0);
  const [done, setDone] = useState(false);
  const [records, setRecords] = useState([]);
  const [reportSaved, setReportSaved] = useState(false);
  const [interactionDone, setInteractionDone] = useState(false);
  const [interactionState, setInteractionState] = useState({});
  useEffect(() => { setCurrent(0); setDone(false); setRecords([]); setReportSaved(false); setInteractionDone(false); setInteractionState({}); }, [exp.id]);
  useEffect(() => { setInteractionDone(false); setInteractionState({}); }, [current]);
  const total = exp.steps.length;
  const handleStep = () => {
    const step = exp.steps[current];
    setRecords(prev => [...prev, { step: current + 1, desc: step.desc, observed: step.expected, time: new Date().toLocaleTimeString() }]);
    if (current < total - 1) setCurrent(current + 1);
    else { setDone(true); message.success('实验完成！可生成实验报告'); }
  };
  const generateReport = () => {
    if (!user) { message.warning('请先登录后再保存报告'); return; }
    BioStore.saveReport(user.id, exp.id, records, exp.result);
    setReportSaved(true); message.success('实验报告已保存，可在"学习进度"查看');
  };
  const reset = () => { setCurrent(0); setDone(false); setRecords([]); setReportSaved(false); setInteractionDone(false); setInteractionState({}); };
  const step = exp.steps[current];
  const diff = EXP_DIFF[exp.difficulty] || EXP_DIFF[2];
  const progress = Math.round(((done ? total : current) / total) * 100);

  // 互动操作渲染器
  const renderInteraction = (interaction) => {
    if (!interaction) return h(Alert, { type: 'info', showIcon: true, message: '点击"执行操作"完成此步骤', style: { marginTop: 12 } });
    const t = interaction.type;
    const setVal = (key, val) => setInteractionState(prev => ({ ...prev, [key]: val }));
    const completeInteraction = () => { setInteractionDone(true); message.success('✓ 操作完成！'); };

    if (t === 'click') {
      return h('div', { style: { marginTop: 16, textAlign: 'center' } },
        h(Alert, { type: 'info', showIcon: true, message: interaction.hint, style: { marginBottom: 12 } }),
        h(Button, { type: interactionDone ? 'default' : 'primary', size: 'large', onClick: completeInteraction, disabled: interactionDone, icon: h('span', null, '👆') }, interactionDone ? '✓ 已完成操作' : '点击执行操作'));
    }
    if (t === 'drag') {
      const placed = interactionState.placed;
      return h('div', { style: { marginTop: 16 } },
        h(Alert, { type: 'info', showIcon: true, message: interaction.hint, style: { marginBottom: 12 } }),
        h('div', { style: { display: 'flex', gap: 24, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', padding: '20px', background: '#fafafa', borderRadius: 8 } },
          h('div', { draggable: !placed, onClick: () => { if (!placed) { setVal('placed', true); completeInteraction(); } }, style: { cursor: placed ? 'default' : 'grab', fontSize: 48, padding: '16px 24px', background: placed ? '#e6f7e6' : '#fff', border: '2px dashed ' + (placed ? '#52c41a' : '#999'), borderRadius: 8, transition: 'all 0.3s', opacity: placed ? 0.5 : 1 }, title: '点击或拖动' }, interaction.tool === 'microscope' ? '🔬' : interaction.tool === 'slide' ? '📋' : interaction.tool === 'glowing-splint' ? '🔥' : '📦'),
          h('span', { style: { fontSize: 24, color: '#999' }, className: 'exp-drag-arrow' }, placed ? '✓' : '→'),
          h('div', { style: { fontSize: 40, padding: '16px 32px', background: placed ? '#e6f7e6' : '#f5f5f5', border: '2px ' + (placed ? 'solid #52c41a' : 'dashed #ccc'), borderRadius: 8, minWidth: 120, textAlign: 'center' } }, interaction.tool === 'microscope' ? '🪵实验台' : interaction.tool === 'slide' ? '🔬载物台' : interaction.tool === 'glowing-splint' ? '🧪试管口' : '🎯目标')),
        placed && h(Alert, { type: 'success', showIcon: true, message: '操作完成！', style: { marginTop: 12 } }));
    }
    if (t === 'rotate') {
      const sel = interactionState.sel;
      return h('div', { style: { marginTop: 16 } },
        h(Alert, { type: 'info', showIcon: true, message: interaction.hint, style: { marginBottom: 12 } }),
        h(Space, { direction: 'vertical', style: { width: '100%' } },
          interaction.options.map((opt, i) => h(Button, { key: i, type: sel === i ? 'primary' : 'default', block: true, onClick: () => { setVal('sel', i); if (i === interaction.correct) completeInteraction(); else message.warning('选择不正确，请重试'); }, disabled: interactionDone }, (sel === i ? '✓ ' : '') + opt)),
          interactionDone && h(Alert, { type: 'success', showIcon: true, message: '✓ 已选择正确选项：' + interaction.options[interaction.correct] })));
    }
    if (t === 'slider') {
      const val = interactionState.val || 0;
      const isTarget = Math.abs(val - interaction.target) < 10;
      return h('div', { style: { marginTop: 16 } },
        h(Alert, { type: 'info', showIcon: true, message: interaction.hint, style: { marginBottom: 12 } }),
        h('div', { style: { padding: '0 20px' } },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 8 } }, h(Text, null, '近'), h(Text, { strong: true, style: { color: isTarget ? '#52c41a' : '#999' } }, '值：' + val), h(Text, null, '远')),
          h(Slider, { min: interaction.min, max: interaction.max, step: interaction.step, value: val, onChange: v => { setVal('val', v); if (Math.abs(v - interaction.target) < 10 && !interactionDone) completeInteraction(); }, disabled: interactionDone }),
          h('div', { style: { textAlign: 'center', marginTop: 12 } }, h('div', { style: { fontSize: 40 }, className: 'exp-focus-display' }, isTarget ? '🔬✨' : '🔬💨'), h(Text, { type: 'secondary', style: { fontSize: 12 } }, interaction.feedback || '')),
          interactionDone && h(Alert, { type: 'success', showIcon: true, message: '✓ 已调至合适位置，物像清晰', style: { marginTop: 12 } })));
    }
    if (t === 'pour') {
      const poured = interactionState.poured;
      return h('div', { style: { marginTop: 16 } },
        h(Alert, { type: 'info', showIcon: true, message: interaction.hint, style: { marginBottom: 12 } }),
        h('div', { style: { display: 'flex', gap: 24, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', padding: '20px', background: '#fafafa', borderRadius: 8 } },
          h('div', { onClick: () => { if (!poured) { setVal('poured', true); setVal('color', interaction.resultColor || interaction.color); completeInteraction(); } }, style: { cursor: poured ? 'default' : 'pointer', padding: '12px 16px', background: interaction.color || '#e3f2fd', border: '2px solid #2196F3', borderRadius: 8, color: '#1565c0', fontWeight: 'bold' } }, '🧪 ' + interaction.reagent),
          h('span', { style: { fontSize: 24, color: '#999' } }, poured ? '✓' : '→'),
          h('div', { style: { width: 60, height: 120, border: '2px solid #999', borderRadius: '0 0 8px 8px', position: 'relative', background: '#fff', overflow: 'hidden' } },
            h('div', { style: { position: 'absolute', bottom: 0, left: 0, right: 0, height: poured ? '70%' : '20%', background: poured ? (interaction.resultColor || interaction.color) : '#f5f5f5', transition: 'all 0.5s' } }),
            h('div', { style: { position: 'absolute', top: 4, left: 0, right: 0, textAlign: 'center', fontSize: 11, color: '#999' } }, '试管'))),
        poured && h(Alert, { type: 'success', showIcon: true, message: '✓ 已加入试剂', style: { marginTop: 12 } }));
    }
    if (t === 'heat') {
      const heated = interactionState.heated;
      const stage = interactionState.stage || 0;
      return h('div', { style: { marginTop: 16 } },
        h(Alert, { type: 'info', showIcon: true, message: interaction.hint, style: { marginBottom: 12 } }),
        h('div', { style: { display: 'flex', gap: 24, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', padding: '20px', background: '#fafafa', borderRadius: 8 } },
          h('div', { onClick: () => { if (!heated) { setVal('heated', true); setVal('stage', interaction.stages.length - 1); setVal('color', '#a52a2a'); completeInteraction(); } }, style: { cursor: heated ? 'default' : 'pointer', fontSize: 36, padding: '8px 16px', background: heated ? '#ffe0e0' : '#fff', border: '2px solid #f5222d', borderRadius: 8 } }, '🔥 酒精灯'),
          h('div', { style: { width: 60, height: 120, border: '2px solid #999', borderRadius: '0 0 8px 8px', position: 'relative', overflow: 'hidden' } },
            h('div', { style: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%', background: ['#2196F3', '#42a5f5', '#9ccc65', '#a52a2a'][stage] || '#2196F3', transition: 'all 0.5s' } }),
            h('div', { style: { position: 'absolute', top: 4, left: 0, right: 0, textAlign: 'center', fontSize: 11, color: '#333', fontWeight: 'bold' } }, interaction.stages[stage] || interaction.stages[0]))),
        h('div', { style: { textAlign: 'center', marginTop: 8 } }, interaction.stages.map((s, i) => h(Tag, { key: i, color: i <= stage ? 'green' : 'default', style: { margin: 2 } }, s))),
        heated && h(Alert, { type: 'success', showIcon: true, message: '✓ 加热完成，颜色变化：' + interaction.stages.join(' → '), style: { marginTop: 12 } }));
    }
    if (t === 'observe' || t === 'observe-timeline') {
      const observed = interactionState.observed;
      return h('div', { style: { marginTop: 16 } },
        h(Alert, { type: 'info', showIcon: true, message: interaction.hint, style: { marginBottom: 12 } }),
        t === 'observe-timeline' && interaction.stages && h('div', { style: { padding: '12px', background: '#f6ffed', borderRadius: 8, marginBottom: 12 } }, interaction.stages.map((s, i) => h('div', { key: i, style: { padding: '4px 0', display: 'flex', alignItems: 'center', gap: 8 } }, h('div', { style: { width: 24, height: 24, borderRadius: '50%', background: observed ? '#52c41a' : '#f0f0f0', color: '#fff', textAlign: 'center', lineHeight: '24px', fontSize: 12 } }, observed ? '✓' : i + 1), h(Text, null, s)))),
        h('div', { style: { textAlign: 'center', padding: '20px', background: '#fafafa', borderRadius: 8 } }, h('div', { style: { fontSize: 48, marginBottom: 8 } }, '👁️'), h(Text, { type: 'secondary' }, '观察实验现象')),
        h('div', { style: { textAlign: 'center', marginTop: 12 } }, h(Button, { type: observed ? 'default' : 'primary', onClick: () => { setVal('observed', true); completeInteraction(); }, disabled: observed }, observed ? '✓ 已记录观察结果' : '记录观察结果')),
        observed && h(Alert, { type: 'success', showIcon: true, message: '✓ 观察到：' + (interaction.correctObservation || step.expected), style: { marginTop: 12 } }));
    }
    if (t === 'sequence') {
      const seqIdx = interactionState.seqIdx || 0;
      const allDone = seqIdx >= interaction.steps.length;
      return h('div', { style: { marginTop: 16 } },
        h(Alert, { type: 'info', showIcon: true, message: interaction.hint, style: { marginBottom: 12 } }),
        interaction.steps.map((s, i) => {
          const isDone = i < seqIdx;
          const isCur = i === seqIdx;
          return h('div', { key: i, style: { padding: '12px', margin: '8px 0', background: isDone ? '#f6ffed' : isCur ? '#e6f7ff' : '#fafafa', border: '1px solid ' + (isDone ? '#b7eb8f' : isCur ? '#91d5ff' : '#e8e8e8'), borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 } },
            h('div', { style: { width: 28, height: 28, borderRadius: '50%', background: isDone ? '#52c41a' : isCur ? '#1890ff' : '#d9d9d9', color: '#fff', textAlign: 'center', lineHeight: '28px', fontSize: 12, flexShrink: 0 } }, isDone ? '✓' : i + 1),
            h('div', { style: { flex: 1 } }, h(Text, { strong: isCur }, s.reagent ? '🧪 ' + s.reagent : s.action || s.hint), h('div', null, h(Text, { type: 'secondary', style: { fontSize: 12 } }, s.hint))),
            isCur && h(Button, { type: 'primary', size: 'small', onClick: () => { const ni = seqIdx + 1; setVal('seqIdx', ni); if (ni >= interaction.steps.length) completeInteraction(); } }, '执行'));
        }),
        allDone && h(Alert, { type: 'success', showIcon: true, message: '✓ 全部操作步骤完成', style: { marginTop: 12 } }));
    }
    if (t === 'flow') {
      const flowed = interactionState.flowed;
      return h('div', { style: { marginTop: 16 } },
        h(Alert, { type: 'info', showIcon: true, message: interaction.hint, style: { marginBottom: 12 } }),
        h('div', { style: { display: 'flex', gap: 16, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', padding: '20px', background: '#fafafa', borderRadius: 8 } },
          h('div', { onClick: () => { if (!flowed) { setVal('flowed', true); completeInteraction(); } }, style: { cursor: flowed ? 'default' : 'pointer', padding: '8px 16px', background: interaction.color || '#e3f2fd', border: '2px solid #2196F3', borderRadius: 8, color: '#1565c0' } }, '💧 ' + interaction.reagent),
          h('span', null, flowed ? '✓' : '→'),
          h('div', { style: { padding: '12px 24px', background: '#fff', border: '2px dashed #999', borderRadius: 8 } }, '🔬 装片')),
        flowed && h(Alert, { type: 'success', showIcon: true, message: '✓ 引流完成，溶液已替换', style: { marginTop: 12 } }));
    }
    if (t === 'compare') {
      const compared = interactionState.compared;
      return h('div', { style: { marginTop: 16 } },
        h(Alert, { type: 'info', showIcon: true, message: interaction.hint, style: { marginBottom: 12 } }),
        h(Row, { gutter: 16 }, interaction.tubes.map((tube, i) => h(Col, { key: i, span: Math.floor(24 / interaction.tubes.length) },
          h('div', { style: { textAlign: 'center', padding: 16, background: '#fafafa', borderRadius: 8 } },
            h('div', { style: { width: 50, height: 100, border: '2px solid #999', borderRadius: '0 0 6px 6px', margin: '0 auto 8px', position: 'relative', overflow: 'hidden' } },
              h('div', { style: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%', background: tube === 'tube-1' ? '#e3f2fd' : '#fff9c4' } }),
              h('div', { style: { position: 'absolute', top: 30, left: 0, right: 0, textAlign: 'center', fontSize: 16 } }, tube === 'tube-1' ? '🫧' : '🫧🫧🫧')),
            h(Text, { strong: true }, tube === 'tube-1' ? '1号 FeCl3' : '2号 酶')),
          h(Text, { type: 'secondary', style: { fontSize: 12 } }, compared ? interaction.observations[tube] : '?')))),
        h('div', { style: { textAlign: 'center', marginTop: 12 } }, h(Button, { type: compared ? 'default' : 'primary', onClick: () => { setVal('compared', true); completeInteraction(); }, disabled: compared }, compared ? '✓ 已对比' : '对比观察')),
        compared && h(Alert, { type: 'success', showIcon: true, message: '✓ 对比完成：2号管（酶）气泡多且快，证明酶高效性', style: { marginTop: 12 } }));
    }
    if (t === 'data-record') {
      const recorded = interactionState.recorded;
      return h('div', { style: { marginTop: 16 } },
        h(Alert, { type: 'info', showIcon: true, message: interaction.hint, style: { marginBottom: 12 } }),
        h('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: 13 } },
          h('thead', null, h('tr', null, h('th', { style: { border: '1px solid #e8e8e8', padding: 8, background: '#fafafa' } }, '试管'), interaction.metrics.map(m => h('th', { key: m, style: { border: '1px solid #e8e8e8', padding: 8, background: '#fafafa' } }, m)))),
          h('tbody', null, Object.keys(interaction.data).map((k, i) => h('tr', { key: k },
            h('td', { style: { border: '1px solid #e8e8e8', padding: 8, textAlign: 'center', fontWeight: 'bold' } }, i + 1 + '号 ' + k),
            h('td', { style: { border: '1px solid #e8e8e8', padding: 8, textAlign: 'center', color: interaction.data[k] === '最多' ? '#52c41a' : '#666' } }, recorded ? interaction.data[k] : '？'))))),
        h('div', { style: { textAlign: 'center', marginTop: 12 } }, h(Button, { type: recorded ? 'default' : 'primary', onClick: () => { setVal('recorded', true); completeInteraction(); }, disabled: recorded }, recorded ? '✓ 数据已记录' : '记录数据')),
        recorded && h(Alert, { type: 'success', showIcon: true, message: '✓ 数据记录完成，pH7.0组气泡最多，酶活性最高', style: { marginTop: 12 } }));
    }
    if (t === 'chart') {
      const drawn = interactionState.drawn;
      const maxY = Math.max.apply(null, interaction.data.map(d => d.y));
      return h('div', { style: { marginTop: 16 } },
        h(Alert, { type: 'info', showIcon: true, message: interaction.hint, style: { marginBottom: 12 } }),
        h('div', { style: { padding: 16, background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8 } },
          h(Text, { strong: true }, interaction.yLabel + ' vs ' + interaction.xLabel),
          h('div', { style: { position: 'relative', height: 200, margin: '20px 0', borderLeft: '2px solid #999', borderBottom: '2px solid #999', paddingLeft: 10, paddingBottom: 10 } },
            h('div', { style: { position: 'absolute', left: -30, top: 80, transform: 'rotate(-90deg)', fontSize: 11, color: '#999' } }, interaction.yLabel),
            interaction.data.map((d, i) => h('div', { key: i, style: { position: 'absolute', left: (i * 18 + 10) + '%', bottom: 0, width: '8%', height: drawn ? (d.y / maxY * 100) + '%' : '0%', background: d.y === maxY ? '#52c41a' : '#1890ff', transition: 'height 0.5s ' + (i * 0.1) + 's', borderRadius: '4px 4px 0 0' } },
              h('div', { style: { position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', fontSize: 11, color: '#666', whiteSpace: 'nowrap' } }, drawn ? d.y : ''),
              h('div', { style: { position: 'absolute', bottom: -20, left: '50%', transform: 'translateX(-50%)', fontSize: 11, color: '#666' } }, d.x)))),
          h('div', { style: { textAlign: 'center', marginTop: 20 } }, h(Text, { type: 'secondary', style: { fontSize: 12 } }, interaction.xLabel + ' →'))),
        h('div', { style: { textAlign: 'center', marginTop: 12 } }, h(Button, { type: drawn ? 'default' : 'primary', onClick: () => { setVal('drawn', true); completeInteraction(); }, disabled: drawn }, drawn ? '✓ 曲线已绘制' : '绘制曲线')),
        drawn && h(Alert, { type: 'success', showIcon: true, message: '✓ 曲线呈钟形，最适pH约7.0，酶活性最高', style: { marginTop: 12 } }));
    }
    if (t === 'select') {
      const selected = interactionState.selected || [];
      const correctSet = interaction.correct || [];
      const allCorrect = selected.length === correctSet.length && correctSet.every(i => selected.indexOf(i) >= 0);
      return h('div', { style: { marginTop: 16 } },
        h(Alert, { type: 'info', showIcon: true, message: interaction.hint, style: { marginBottom: 12 } }),
        h(Space, { direction: 'vertical', style: { width: '100%' } },
          interaction.options.map((opt, i) => {
            const isSel = selected.indexOf(i) >= 0;
            return h(Button, { key: i, type: isSel ? 'primary' : 'default', block: true, onClick: () => { const ns = isSel ? selected.filter(x => x !== i) : [...selected, i]; setVal('selected', ns); }, disabled: interactionDone },
              (isSel ? '✓ ' : '') + opt);
          }),
          h(Button, { type: 'primary', block: true, disabled: interactionDone || selected.length === 0, onClick: () => { if (allCorrect) completeInteraction(); else message.warning('选择不完全正确，再检查一下'); } }, '确认选择'),
          interactionDone && h(Alert, { type: 'success', showIcon: true, message: '✓ 已选：' + correctSet.map(i => interaction.options[i]).join(' + ') }));
    }
    if (t === 'counter') {
      const counts = interactionState.counts || {};
      const targets = interaction.targets || [];
      const sampleSize = interaction.sampleSize || 100;
      const total = targets.reduce((s, t) => s + (counts[t] || 0), 0);
      const done = total >= sampleSize;
      return h('div', { style: { marginTop: 16 } },
        h(Alert, { type: 'info', showIcon: true, message: interaction.hint, style: { marginBottom: 12 } }),
        h('div', { style: { padding: 16, background: '#fafafa', borderRadius: 8 } },
          h(Row, { gutter: 16 }, targets.map(tg => h(Col, { key: tg, span: Math.floor(24 / targets.length) },
            h('div', { style: { textAlign: 'center', padding: 16, background: '#fff', borderRadius: 8, border: '1px solid #e8e8e8' } },
              h('div', { style: { fontSize: 36 } }, tg === '高茎' ? '🌿' : '🌱'),
              h(Text, { strong: true }, tg),
              h('div', { style: { fontSize: 28, color: '#2e9e5b', margin: '8px 0' } }, counts[tg] || 0),
              h(Button.Group, null,
                h(Button, { size: 'small', disabled: interactionDone, onClick: () => setVal('counts', { ...counts, [tg]: Math.max(0, (counts[tg] || 0) - 1) }) }, '-1'),
                h(Button, { size: 'small', type: 'primary', disabled: interactionDone, onClick: () => setVal('counts', { ...counts, [tg]: (counts[tg] || 0) + 1 }) }, '+1'),
                h(Button, { size: 'small', disabled: interactionDone, onClick: () => setVal('counts', { ...counts, [tg]: (counts[tg] || 0) + 10 }) }, '+10')))))),
          h('div', { style: { textAlign: 'center', marginTop: 12, color: done ? '#52c41a' : '#999' } }, '已统计：' + total + ' / ' + sampleSize + (total > 0 ? '  (' + targets.map(tg => tg + ':' + Math.round((counts[tg] || 0) / total * 100) + '%').join(' ') + ')' : ''))),
        h('div', { style: { textAlign: 'center', marginTop: 12 } }, h(Button, { type: interactionDone ? 'default' : 'primary', disabled: interactionDone || !done, onClick: () => completeInteraction() }, interactionDone ? '✓ 已统计完成' : '完成统计')),
        interactionDone && h(Alert, { type: 'success', showIcon: true, message: '✓ 统计完成！高茎:矮茎 ≈ 3:1，验证孟德尔分离定律', style: { marginTop: 12 } }));
    }
    if (t === 'punnett') {
      const cells = interactionState.cells || {};
      const gametes = interaction.gametes || ['D', 'd'];
      const expected = { 'D,D': 'DD', 'D,d': 'Dd', 'd,D': 'Dd', 'd,d': 'dd' };
      const allFilled = gametes.every(g1 => gametes.every(g2 => cells[g1 + ',' + g2]));
      const checkCell = (g1, g2) => {
        const key = g1 + ',' + g2;
        const expectedVal = expected[key];
        const inputVal = cells[key];
        if (inputVal) {
          if (inputVal.replace(/\s/g, '').toUpperCase() === expectedVal.toUpperCase()) return 'correct';
          return 'wrong';
        }
        return 'empty';
      };
      return h('div', { style: { marginTop: 16 } },
        h(Alert, { type: 'info', showIcon: true, message: interaction.hint, style: { marginBottom: 12 } }),
        h('div', { style: { padding: 16, background: '#fafafa', borderRadius: 8, overflowX: 'auto' } },
          h('table', { style: { borderCollapse: 'collapse', margin: '0 auto', minWidth: 240 } },
            h('thead', null, h('tr', null,
              h('th', { style: { border: '1px solid #999', padding: 12, background: '#e6f7e6', fontSize: 18 } }, '配子'),
              gametes.map(g => h('th', { key: g, style: { border: '1px solid #999', padding: 12, background: '#e6f7e6', fontSize: 18, color: '#2e9e5b', fontWeight: 'bold' } }, g))),
            h('tbody', null, gametes.map(g1 => h('tr', { key: g1 },
              h('td', { style: { border: '1px solid #999', padding: 12, background: '#e6f7e6', fontSize: 18, color: '#2e9e5b', fontWeight: 'bold', textAlign: 'center' } }, g1),
              gametes.map(g2 => {
                const key = g1 + ',' + g2;
                const status = checkCell(g1, g2);
                const bg = status === 'correct' ? '#f6ffed' : status === 'wrong' ? '#fff1f0' : '#fff';
                const border = status === 'correct' ? '#52c41a' : status === 'wrong' ? '#f5222d' : '#999';
                return h('td', { key: g2, style: { border: '1px solid ' + border, padding: 4, background: bg, textAlign: 'center' } },
                  h('input', { value: cells[key] || '', onChange: e => setVal('cells', { ...cells, [key]: e.target.value }), disabled: interactionDone, placeholder: '?', style: { width: 50, textAlign: 'center', fontSize: 16, border: 'none', background: 'transparent', fontWeight: 'bold', color: status === 'correct' ? '#2e9e5b' : status === 'wrong' ? '#f5222d' : '#333' } }));
              }))))),
          h('div', { style: { textAlign: 'center', marginTop: 12, fontSize: 13, color: '#888' } }, '提示：D×D=DD（高茎），D×d=Dd（高茎），d×d=dd（矮茎）')),
        h('div', { style: { textAlign: 'center', marginTop: 12 } }, h(Button, { type: interactionDone ? 'default' : 'primary', disabled: interactionDone || !allFilled, onClick: () => { const allCorrect = gametes.every(g1 => gametes.every(g2 => checkCell(g1, g2) === 'correct')); if (allCorrect) completeInteraction(); else message.warning('部分格子填写不正确，请检查'); } }, interactionDone ? '✓ 棋盘格已完成' : '检查棋盘格')),
        interactionDone && h(Alert, { type: 'success', showIcon: true, message: '✓ 棋盘格正确！F2 基因型 1DD:2Dd:1dd，表现型 3 高茎:1 矮茎', style: { marginTop: 12 } }));
    }
    return h(Alert, { type: 'info', showIcon: true, message: '点击"执行操作"完成此步骤', style: { marginTop: 12 } });
  };

  return h(Fragment, null,
    h('div', { className: 'flex-between', style: { marginBottom: 16, flexWrap: 'wrap', gap: 8 } },
      h(Space, null, h(Tag, { color: diff.color }, '难度：' + diff.label), h(Tag, { color: 'cyan' }, '⏱ ' + exp.duration), h(Tag, { color: 'purple' }, '📂 ' + exp.category), step && step.interaction && h(Tag, { color: 'magenta' }, '🎮 互动操作')),
      h(Button, { onClick: () => navigate('/experiments') }, '← 返回列表')),
    h(Card, { className: 'bio-card' },
      h(Title, { level: 3, style: { color: '#1f7a45' } }, '🧪 ' + exp.title),
      h(Paragraph, null, h(Text, { strong: true }, '实验目的：'), exp.objective),
      h('div', null, h(Text, { strong: true }, '实验材料：'), exp.materials.map((m, i) => h(Tag, { key: i, style: { marginBottom: 4 } }, m))),
      h(Divider, { style: { margin: '12px 0' } }),
      h(Progress, { percent: progress, strokeColor: '#2e9e5b', status: done ? 'success' : 'active' })),
    h(Card, { className: 'bio-card', title: '🔬 实验操作' },
      h(Steps, { current: current, size: 'small', direction: 'vertical', items: exp.steps.map((s, i) => ({ title: '步骤 ' + (i + 1), description: s.desc, status: i < current ? 'finish' : i === current ? (done ? 'finish' : 'process') : 'wait' })) })),
    !done ? h(Card, { className: 'bio-card' },
      h('div', { className: 'section-title', style: { fontSize: 16 } }, '🛠 虚拟操作（步骤 ' + (current + 1) + '/' + total + '）'),
      h('div', { className: 'exp-stage' },
        h('div', { className: 'exp-visual' }, step.visual),
        h(Paragraph, { style: { maxWidth: 600, margin: '0 auto 16px' } }, step.desc),
        h(Alert, { type: 'info', showIcon: true, message: '预期现象：' + step.expected, style: { maxWidth: 600, margin: '0 auto' } }),
        step.interaction && renderInteraction(step.interaction)),
      h('div', { style: { textAlign: 'center', marginTop: 16 } },
        h(Space, null, current > 0 && h(Button, { onClick: () => setCurrent(current - 1) }, '上一步'),
          h(Button, { type: 'primary', size: 'large', onClick: handleStep, disabled: step.interaction && !interactionDone }, current < total - 1 ? '执行操作 →' : '完成实验 🎉'), h(Button, { onClick: reset }, '重置'))),
      step.interaction && !interactionDone && h(Alert, { type: 'warning', showIcon: true, message: '请先完成上方互动操作，才能进入下一步', style: { marginTop: 12 } }))
    : h(Card, { className: 'bio-card' },
      h(Result, { status: 'success', title: '实验完成！', subTitle: '已完成「' + exp.title + '」全部 ' + total + ' 个步骤',
        extra: [h(Button, { type: 'primary', key: 'report', onClick: generateReport, disabled: reportSaved }, reportSaved ? '✓ 报告已保存' : '📄 生成实验报告'), h(Button, { key: 'reset', onClick: reset }, '重新实验')] })),
    h(Card, { className: 'bio-card', title: '📊 实验数据记录' },
      records.length === 0 ? h(Empty, { description: '尚未记录数据，请执行实验操作' }) :
        records.map((r, i) => h('div', { key: i, className: 'exp-data-row' },
          h('span', null, h(Tag, { color: 'green' }, '步骤' + r.step), h('span', { style: { color: '#888', fontSize: 12, marginLeft: 8 } }, r.time)),
          h('span', { style: { flex: 1, padding: '0 16px', fontSize: 13 } }, r.observed)))),
    (done || records.length > 0) && h(Card, { className: 'bio-card', title: '📝 实验结论与分析' },
      h(Alert, { type: 'success', showIcon: true, message: '实验结论', description: exp.result, style: { marginBottom: 16 } }),
      h(Alert, { type: 'warning', showIcon: true, message: '分析要点', description: '请结合实验现象理解其背后的生物学原理，思考实验设计的科学性与变量控制。可前往知识点系统复习相关理论。' }))
  );
}

function ExperimentList() {
  const exps = BioStore.getExperiments();
  const { user } = useAuth();
  const myReports = user ? BioStore.getReports(user.id) : [];
  return h(Fragment, null,
    h('div', { className: 'section-title' }, '教学实验模拟平台'),
    h(Alert, { message: '11个高中生物核心实验 · 交互式虚拟操作', type: 'success', showIcon: true, style: { marginBottom: 16 }, description: '提供实验步骤引导、虚拟操作界面和实验现象模拟，支持数据记录与实验报告生成。点击实验卡片开始模拟。' }),
    h(Row, { gutter: [16, 16] },
      exps.map(exp => {
        const diff = EXP_DIFF[exp.difficulty] || EXP_DIFF[2];
        const reportCount = myReports.filter(r => r.expId === exp.id).length;
        return h(Col, { key: exp.id, xs: 24, sm: 12, lg: 8 },
          h(Card, { hoverable: true, onClick: () => navigate('/experiments', { exp: exp.id }) },
            h('div', { className: 'flex-between', style: { marginBottom: 8 } }, h(Title, { level: 5, style: { margin: 0 } }, '🧪 ' + exp.title), h(Tag, { color: diff.color }, diff.label)),
            h(Paragraph, { type: 'secondary', style: { fontSize: 13, minHeight: 44, marginBottom: 8 } }, exp.objective.slice(0, 60) + '...'),
            h('div', { className: 'flex-between' }, h(Space, null, h(Tag, { color: 'cyan' }, '⏱ ' + exp.duration), h(Tag, { color: 'purple' }, exp.category), h(Tag, null, exp.steps.length + '步')), reportCount > 0 && h(Tag, { color: 'green' }, '✓ 已做' + reportCount + '次'))));
      })
    )
  );
}

function ExperimentsPage() {
  const { query } = useRouter();
  if (query.exp) { const exp = BioStore.getExperiment(query.exp); if (exp) return h(ExperimentSimulator, { exp }); }
  return h(ExperimentList);
}

/* ==================== 在线自测 ==================== */
const Q_DIFF = { 1: { label: '简单', color: 'green' }, 2: { label: '中等', color: 'blue' }, 3: { label: '较难', color: 'red' } };

function ResultCard({ result, questions, answers, onRetry }) {
  const percent = Math.round(result.score / result.total * 100);
  const wrongQs = questions.filter(q => {
    const ans = answers[q.id];
    if (q.type === 'single') return ans !== q.answer;
    if (Array.isArray(ans) && Array.isArray(q.answer)) return !(ans.length === q.answer.length && ans.every(a => q.answer.includes(a)));
    return true;
  });
  return h(Fragment, null,
    h(Card, { className: 'bio-card' },
      h(Result, { status: percent >= 60 ? 'success' : 'error', title: percent + ' 分', subTitle: '答对 ' + result.score + ' 题 / 共 ' + result.total + ' 题',
        extra: [h(Button, { type: 'primary', key: 'retry', onClick: onRetry }, '再做一次'), h(Button, { key: 'wrong', onClick: () => navigate('/quiz', { tab: 'wrong' }) }, '查看错题本'), h(Button, { key: 'back', onClick: () => navigate('/quiz') }, '返回题库')] }),
      h(Row, { gutter: 24, style: { textAlign: 'center', marginTop: 16 } },
        h(Col, { span: 8 }, h(Statistic, { title: '正确率', value: percent, suffix: '%', valueStyle: { color: percent >= 60 ? '#2e9e5b' : '#f5222d' } })),
        h(Col, { span: 8 }, h(Statistic, { title: '答对题数', value: result.score, valueStyle: { color: '#2e9e5b' } })),
        h(Col, { span: 8 }, h(Statistic, { title: '错题数', value: result.total - result.score, valueStyle: { color: '#f5222d' } })))),
    wrongQs.length > 0 && h(Card, { className: 'bio-card', title: '❌ 错题解析（' + wrongQs.length + '题）' },
      wrongQs.map((q, i) => {
        const userAns = answers[q.id];
        return h('div', { key: q.id, style: { marginBottom: 20, paddingBottom: 16, borderBottom: i < wrongQs.length - 1 ? '1px solid #f0f0f0' : 'none' } },
          h(Paragraph, { strong: true }, '第' + (i + 1) + '题：' + q.stem),
          q.options.map((opt, oi) => {
            const isCorrectAns = q.type === 'single' ? q.answer === oi : q.answer.includes(oi);
            const isUserAns = q.type === 'single' ? userAns === oi : (Array.isArray(userAns) && userAns.includes(oi));
            let cls = ''; if (isCorrectAns) cls = 'correct'; else if (isUserAns) cls = 'wrong';
            return h('div', { key: oi, className: 'quiz-option ' + cls }, String.fromCharCode(65 + oi) + '. ' + opt,
              isCorrectAns && h(Tag, { color: 'green', style: { marginLeft: 8 } }, '正确答案'),
              isUserAns && !isCorrectAns && h(Tag, { color: 'red', style: { marginLeft: 8 } }, '你的选择'));
          }),
          h(Alert, { type: 'info', showIcon: true, message: '解析：' + q.analysis, style: { marginTop: 8 } }));
      }))
  );
}

function QuizRunner({ chapterId, mode }) {
  const { user } = useAuth();
  const questions = useMemo(() => mode === 'all' ? BioStore.getQuestions() : BioStore.getQuestions(chapterId), [chapterId, mode]);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  if (!user) return h(Card, { className: 'bio-card' }, h(Result, { status: 'warning', title: '请先登录', subTitle: '自测功能需要登录后使用，以记录你的答题情况和学习进度', extra: h(Button, { type: 'primary', onClick: () => navigate('/') }, '去首页登录') }));
  if (questions.length === 0) return h(Empty, { description: '该章节暂无题目' });
  const setAnswer = (qid, val) => { if (submitted) return; setAnswers(prev => ({ ...prev, [qid]: val })); };
  const doSubmit = () => { const r = BioStore.submitQuiz(user.id, chapterId || 'all', answers); setResult(r); setSubmitted(true); message.success('已提交，得分 ' + r.score + '/' + r.total); };
  const submit = () => {
    const unanswered = questions.filter(q => answers[q.id] === undefined).length;
    if (unanswered > 0) Modal.confirm({ title: '还有 ' + unanswered + ' 题未作答', content: '确定要提交吗？未作答的题目将计为错误。', onOk: doSubmit });
    else doSubmit();
  };
  return h(Fragment, null,
    h('div', { className: 'flex-between', style: { marginBottom: 16, flexWrap: 'wrap', gap: 8 } },
      h(Title, { level: 3, style: { margin: 0, color: '#1f7a45' } }, mode === 'all' ? '📝 综合测试' : '📝 章节练习'),
      h(Space, null, h(Tag, { color: 'green' }, questions.length + ' 题'), h(Button, { onClick: () => navigate('/quiz') }, '← 返回'))),
    submitted && result ? h(ResultCard, { result, questions, answers, onRetry: () => { setAnswers({}); setSubmitted(false); setResult(null); } }) :
      h(Fragment, null,
        questions.map((q, idx) => {
          const diff = Q_DIFF[q.difficulty] || Q_DIFF[2];
          const ans = answers[q.id];
          return h(Card, { key: q.id, className: 'quiz-question', style: { marginBottom: 16 } },
            h('div', { className: 'flex-between', style: { marginBottom: 12, flexWrap: 'wrap', gap: 8 } },
              h('div', null, h(Tag, { color: 'green' }, '第' + (idx + 1) + '题'), h(Text, { strong: true, style: { marginLeft: 8 } }, q.stem)),
              h(Space, null, h(Tag, { color: diff.color }, diff.label), h(Tag, { color: q.type === 'multi' ? 'purple' : 'blue' }, q.type === 'multi' ? '多选题' : '单选题'))),
            q.type === 'single' ?
              h(Radio.Group, { value: ans, onChange: e => setAnswer(q.id, e.target.value), style: { width: '100%' } },
                q.options.map((opt, i) => h(Radio, { key: i, value: i, style: { display: 'block', margin: '8px 0', padding: '8px 12px', borderRadius: 8, border: '1px solid #e0ebe4' } }, String.fromCharCode(65 + i) + '. ' + opt)))
              : h(Checkbox.Group, { value: ans || [], onChange: v => setAnswer(q.id, v), style: { width: '100%' } },
                q.options.map((opt, i) => h('div', { key: i, style: { margin: '8px 0' } }, h(Checkbox, { value: i, style: { padding: '8px 12px', borderRadius: 8, border: '1px solid #e0ebe4', width: '100%' } }, String.fromCharCode(65 + i) + '. ' + opt))))
          );
        }),
        h(Card, { className: 'bio-card', style: { textAlign: 'center' } }, h(Space, null, h(Button, { type: 'primary', size: 'large', onClick: submit }, '提交答卷'), h(Button, { size: 'large', onClick: () => setAnswers({}) }, '清空重选')))
      )
  );
}

function WrongQuestions() {
  const { user } = useAuth();
  const [refresh, setRefresh] = useState(0);
  if (!user) return h(Empty, { description: '请先登录' });
  const wrongs = BioStore.getWrongQuestions(user.id);
  if (wrongs.length === 0) return h(Card, { className: 'bio-card' }, h(Result, { status: 'success', title: '暂无错题', subTitle: '你还没有错题记录，继续保持！' }));
  return h(Fragment, null,
    h('div', { className: 'section-title' }, '错题回顾（' + wrongs.length + '题）'),
    h(Alert, { type: 'warning', message: '错题已自动收录，复习掌握后可移除', showIcon: true, style: { marginBottom: 16 } }),
    wrongs.map((w, i) => {
      const q = w.question; const diff = Q_DIFF[q.difficulty] || Q_DIFF[2];
      return h(Card, { key: w.id, className: 'quiz-question' },
        h('div', { className: 'flex-between', style: { marginBottom: 12, flexWrap: 'wrap', gap: 8 } },
          h('div', null, h(Tag, { color: 'red' }, '错' + w.count + '次'), h(Text, { strong: true, style: { marginLeft: 8 } }, q.stem)),
          h(Space, null, h(Tag, { color: diff.color }, diff.label), h(Tag, { color: q.type === 'multi' ? 'purple' : 'blue' }, q.type === 'multi' ? '多选' : '单选'))),
        q.options.map((opt, oi) => { const isCorrectAns = q.type === 'single' ? q.answer === oi : q.answer.includes(oi); return h('div', { key: oi, className: 'quiz-option ' + (isCorrectAns ? 'correct' : '') }, String.fromCharCode(65 + oi) + '. ' + opt, isCorrectAns && h(Tag, { color: 'green', style: { marginLeft: 8 } }, '正确答案')); }),
        h(Alert, { type: 'info', showIcon: true, message: '解析：' + q.analysis, style: { marginTop: 8 } }),
        h('div', { style: { textAlign: 'right', marginTop: 8 } }, h(Button, { type: 'link', danger: true, onClick: () => { BioStore.removeWrongQuestion(user.id, q.id); setRefresh(refresh + 1); message.success('已移除，继续加油！'); } }, '已掌握，移除'))
      );
    })
  );
}

function QuizHome({ initialTab }) {
  const { user } = useAuth();
  const chapters = BioStore.getChapters();
  const records = user ? BioStore.getQuizRecords(user.id) : [];
  const [tab, setTab] = useState(initialTab || 'practice');
  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);
  return h(Fragment, null,
    h('div', { className: 'section-title' }, '在线自测题库'),
    h(Row, { gutter: 16, style: { marginBottom: 16 } },
      h(Col, { span: 8 }, h(Card, { size: 'small' }, h(Statistic, { title: '总题数', value: BioStore.getQuestions().length, suffix: '题' }))),
      h(Col, { span: 8 }, h(Card, { size: 'small' }, h(Statistic, { title: '我的练习次数', value: records.length, suffix: '次' }))),
      h(Col, { span: 8 }, h(Card, { size: 'small' }, h(Statistic, { title: '平均得分', value: records.length ? Math.round(records.reduce((s, r) => s + r.score / r.total * 100, 0) / records.length) : 0, suffix: '分' })))),
    h(Card, { className: 'bio-card' },
      h('div', { style: { display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid #f0f0f0' } },
        [{ k: 'practice', l: '📖 章节练习' }, { k: 'all', l: '🧪 综合测试' }, { k: 'wrong', l: '❌ 错题回顾' }].map(t => h(Button, { key: t.k, type: tab === t.k ? 'primary' : 'text', onClick: () => setTab(t.k) }, t.l))),
      tab === 'practice' && h(Fragment, null,
        h(Paragraph, { type: 'secondary' }, '选择章节进行专项练习：'),
        h(Row, { gutter: [12, 12] }, chapters.map(ch => { const count = BioStore.getQuestions(ch.id).length; return h(Col, { key: ch.id, xs: 24, sm: 12, md: 8 }, h(Card, { size: 'small', hoverable: true, onClick: () => navigate('/quiz', { run: ch.id, mode: 'chapter' }) }, h('div', { className: 'flex-between' }, h('div', null, h(Title, { level: 5, style: { margin: 0, color: '#2e9e5b' } }, ch.title), h(Text, { type: 'secondary', style: { fontSize: 12 } }, count + ' 题')), h(Button, { type: 'primary', size: 'small' }, '开始')))); }))),
      tab === 'all' && h(Card, { style: { textAlign: 'center', background: '#f6ffed' } },
        h(Title, { level: 4, style: { color: '#2e9e5b' } }, '🧪 综合测试'), h(Paragraph, null, '涵盖全部章节的 ' + BioStore.getQuestions().length + ' 道题目，检验综合掌握情况。'), h(Button, { type: 'primary', size: 'large', onClick: () => navigate('/quiz', { run: 'all', mode: 'all' }) }, '开始综合测试')),
      tab === 'wrong' && h(WrongQuestions),
      tab !== 'wrong' && records.length > 0 && h(Fragment, null,
        h(Divider, null, '最近练习记录'),
        records.slice(0, 5).map(r => { const ch = BioStore.getChapter(r.chapterId); return h('div', { key: r.id, className: 'exp-data-row' }, h('span', null, h(Tag, { color: 'green' }, ch ? ch.title : '综合'), h('span', { style: { color: '#888', fontSize: 12, marginLeft: 8 } }, new Date(r.time).toLocaleString())), h('span', null, h(Text, { strong: true, style: { color: r.score / r.total >= 0.6 ? '#2e9e5b' : '#f5222d' } }, r.score + '/' + r.total))); })
      )
    )
  );
}

function QuizPage() {
  const { query } = useRouter();
  if (query.run) return h(QuizRunner, { chapterId: query.run === 'all' ? null : query.run, mode: query.mode || 'chapter' });
  return h(QuizHome, { initialTab: query.tab });
}

/* ==================== 讨论区 ==================== */
function timeAgo(ts) {
  const diff = Date.now() - ts;
  const day = Math.floor(diff / 86400000); if (day > 0) return day + '天前';
  const hr = Math.floor(diff / 3600000); if (hr > 0) return hr + '小时前';
  const m = Math.floor(diff / 60000); if (m > 0) return m + '分钟前';
  return '刚刚';
}

function DiscussionDetail({ id }) {
  const { user } = useAuth();
  const [disc, setDisc] = useState(() => BioStore.getDiscussion(id));
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { BioStore.refreshDiscussions().then(function () { setDisc(BioStore.getDiscussion(id)); }); }, [id]);
  if (!disc) return h(Card, { className: 'bio-card' }, h(Empty, { description: '帖子不存在或已删除' }), h(Button, { onClick: () => navigate('/discussion') }, '返回讨论区'));
  const chapter = BioStore.getChapter(disc.chapterId);
  const submitReply = () => {
    if (!user) { message.warning('请先登录后再回复'); return; }
    if (!replyText.trim()) { message.warning('回复内容不能为空'); return; }
    setSubmitting(true);
    BioStore.addReply(id, user, replyText.trim()).then(function () { setDisc(BioStore.getDiscussion(id)); setReplyText(''); message.success('回复成功'); }).catch(function (e) { message.error('回复失败：' + e.message); }).finally(function () { setSubmitting(false); });
  };
  const handleDelete = () => Modal.confirm({ title: '确认删除该帖子？', onOk: function () { return BioStore.deleteDiscussion(user, id).then(function () { message.success('已删除'); navigate('/discussion'); }).catch(function (e) { message.error('删除失败：' + e.message); }); } });
  return h(Fragment, null,
    h(Breadcrumb, { style: { marginBottom: 16 } }, h(Breadcrumb.Item, null, h(RouterLink, { to: '/discussion' }, '讨论区')), h(Breadcrumb.Item, null, disc.title)),
    h(Card, { className: 'bio-card' },
      h('div', { className: 'flex-between', style: { flexWrap: 'wrap', gap: 8 } },
        h(Title, { level: 3, style: { margin: 0, color: '#1f7a45' } }, disc.title),
        h(Space, null, chapter && h(Tag, { color: 'green' }, chapter.title), user && (user.id === disc.authorId || user.role === 'teacher' || user.role === 'admin') && h(Button, { danger: true, size: 'small', onClick: handleDelete }, '删除'))),
      h('div', { style: { margin: '12px 0', display: 'flex', alignItems: 'center', gap: 8 } },
        h(Avatar, { size: 32, style: { background: '#2e9e5b' } }, disc.authorName[0]),
        h('span', null, h(Text, { strong: true }, disc.authorName), ' ', h(RoleTag, { role: disc.authorRole })), h(Text, { type: 'secondary', style: { fontSize: 12 } }, '· ' + timeAgo(disc.createTime))),
      h(Paragraph, { style: { fontSize: 15, lineHeight: 1.9, background: '#f4f9f6', padding: 16, borderRadius: 8 } }, disc.content)),
    h(Card, { className: 'bio-card', title: '💬 回复（' + disc.replies.length + '）' },
      disc.replies.length === 0 ? h(Empty, { description: '暂无回复，快来抢沙发~' }) :
        disc.replies.map(r => h('div', { key: r.id, className: 'discussion-reply' },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 } }, h(Avatar, { size: 24, style: { background: r.authorRole === 'teacher' ? '#fa8c16' : '#2e9e5b' } }, r.authorName[0]), h(Text, { strong: true }, r.authorName), ' ', h(RoleTag, { role: r.authorRole }), h(Text, { type: 'secondary', style: { fontSize: 12 } }, '· ' + timeAgo(r.createTime))),
          h(Paragraph, { style: { margin: 0, fontSize: 14, lineHeight: 1.8 } }, r.content)))),
    h(Card, { className: 'bio-card', title: '✍️ 我要回复' },
      user ? h(Fragment, null, h(TextArea, { value: replyText, onChange: e => setReplyText(e.target.value), rows: 4, placeholder: '请输入回复内容，参与知识交流...' }), h('div', { style: { textAlign: 'right', marginTop: 12 } }, h(Button, { type: 'primary', onClick: submitReply, disabled: !replyText.trim() || submitting, loading: submitting }, '发表回复')))
        : h(Alert, { type: 'info', message: '请先登录后参与讨论', showIcon: true, action: h(Button, { size: 'small', onClick: () => navigate('/') }, '去登录') }))
  );
}

function DiscussionList({ chapterFilter }) {
  const { user } = useAuth();
  const chapters = BioStore.getChapters();
  const [filter, setFilter] = useState(chapterFilter || '');
  const [refresh, setRefresh] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  useEffect(() => { if (chapterFilter) setFilter(chapterFilter); }, [chapterFilter]);
  useEffect(() => { setLoading(true); BioStore.refreshDiscussions().then(function () { setRefresh(refresh + 1); }).finally(function () { setLoading(false); }); }, []);
  const list = BioStore.getDiscussions(filter || null);
  const postDiscussion = () => {
    if (!user) { message.warning('请先登录'); return; }
    form.validateFields().then(v => {
      setLoading(true);
      BioStore.addDiscussion(user, { title: v.title, content: v.content, chapterId: v.chapterId }).then(function () { form.resetFields(); setModalOpen(false); setRefresh(refresh + 1); message.success('发帖成功'); }).catch(function (e) { message.error('发帖失败：' + e.message); }).finally(function () { setLoading(false); });
    });
  };
  return h(Fragment, null,
    h('div', { className: 'flex-between', style: { marginBottom: 16, flexWrap: 'wrap', gap: 8 } },
      h('div', { className: 'section-title', style: { margin: 0 } }, '互动讨论区'),
      h(Button, { type: 'primary', onClick: () => { if (!user) { message.warning('请先登录'); return; } setModalOpen(true); } }, '✍️ 发起讨论')),
    h(Card, { className: 'bio-card', size: 'small', style: { marginBottom: 16 } },
      h(Space, { wrap: true }, h(Button, { type: !filter ? 'primary' : 'default', size: 'small', onClick: () => { setFilter(''); navigate('/discussion'); } }, '全部'), chapters.map(ch => h(Button, { key: ch.id, type: filter === ch.id ? 'primary' : 'default', size: 'small', onClick: () => { setFilter(ch.id); } }, ch.title)))),
    list.length === 0 ? h(Card, { className: 'bio-card' }, loading ? h('div', { style: { textAlign: 'center', padding: 40 } }, h(Spin, { tip: '加载讨论...' })) : h(Empty, { description: '暂无讨论，快来发起第一个话题吧~' })) :
      h(List, { grid: { gutter: 16, xs: 1, sm: 1, md: 1 }, dataSource: list, renderItem: item => {
        const ch = BioStore.getChapter(item.chapterId);
        return h(List.Item, null, h(Card, { className: 'bio-card', hoverable: true, onClick: () => navigate('/discussion', { id: item.id }) },
          h('div', { className: 'flex-between', style: { flexWrap: 'wrap', gap: 8 } },
            h(Title, { level: 5, style: { margin: 0, color: '#1f7a45' } }, item.title),
            h(Space, null, ch && h(Tag, { color: 'green' }, ch.title), h(Tag, { color: 'blue' }, item.replies.length + ' 回复'))),
          h(Paragraph, { type: 'secondary', style: { fontSize: 13, marginBottom: 8 } }, item.content.slice(0, 80) + (item.content.length > 80 ? '...' : '')),
          h('div', { className: 'flex-between' },
            h(Space, null, h(Avatar, { size: 20, style: { background: '#2e9e5b' } }, item.authorName[0]), h(Text, { type: 'secondary', style: { fontSize: 12 } }, item.authorName), h(RoleTag, { role: item.authorRole })),
            h(Text, { type: 'secondary', style: { fontSize: 12 } }, timeAgo(item.createTime)))));
      } }),
    h(Modal, { open: modalOpen, title: '发起讨论', onCancel: () => setModalOpen(false), onOk: postDiscussion, okText: '发布' },
      h(Form, { form, layout: 'vertical' },
        h(Form.Item, { name: 'title', label: '标题', rules: [{ required: true, message: '请输入标题' }] }, h(Input, { placeholder: '请输入讨论标题' })),
        h(Form.Item, { name: 'chapterId', label: '所属章节' }, h(Select, { placeholder: '选择章节（可选）', allowClear: true, options: chapters.map(ch => ({ value: ch.id, label: ch.title })) })),
        h(Form.Item, { name: 'content', label: '内容', rules: [{ required: true, message: '请输入内容' }] }, h(TextArea, { rows: 4, placeholder: '请输入讨论内容...' }))))
  );
}

function DiscussionPage() {
  const { query } = useRouter();
  if (query.id) return h(DiscussionDetail, { id: query.id });
  return h(DiscussionList, { chapterFilter: query.chapter });
}

/* ==================== 学习进度 ==================== */
function ProgressPage() {
  const { user } = useAuth();
  if (!user) return h(Card, { className: 'bio-card' }, h(Result, { status: 'warning', title: '请先登录', subTitle: '登录后可查看你的学习进度', extra: h(Button, { type: 'primary', onClick: () => navigate('/') }, '去登录') }));
  const prog = BioStore.getProgress(user.id);
  const suggestions = BioStore.getStudySuggestion(user.id);
  const reports = BioStore.getReports(user.id);
  const quizRecords = BioStore.getQuizRecords(user.id);
  const chapters = BioStore.getChapters();
  return h(Fragment, null,
    h('div', { className: 'section-title' }, '学习进度追踪'),
    h(Row, { gutter: 16, style: { marginBottom: 16 } },
      h(Col, { xs: 12, md: 6 }, h(Card, { className: 'bio-card', size: 'small' }, h(Statistic, { title: '总体进度', value: prog.stats.percent, suffix: '%', valueStyle: { color: '#2e9e5b' } }))),
      h(Col, { xs: 12, md: 6 }, h(Card, { className: 'bio-card', size: 'small' }, h(Statistic, { title: '已学知识点', value: prog.stats.viewedKp, suffix: '/ ' + prog.stats.totalKp }))),
      h(Col, { xs: 12, md: 6 }, h(Card, { className: 'bio-card', size: 'small' }, h(Statistic, { title: '完成实验', value: reports.length, suffix: '个' }))),
      h(Col, { xs: 12, md: 6 }, h(Card, { className: 'bio-card', size: 'small' }, h(Statistic, { title: '练习次数', value: quizRecords.length, suffix: '次' }))),
    h(Card, { className: 'bio-card', title: '📊 各章节学习进度' },
      chapters.map(ch => {
        const cp = prog.detail[ch.id]; const total = ch.sections.reduce((s, sec) => s + sec.points.length, 0);
        const viewed = cp ? cp.viewed.length : 0; const pct = total ? Math.round(viewed / total * 100) : 0;
        return h('div', { key: ch.id, style: { marginBottom: 16 } },
          h('div', { className: 'flex-between', style: { marginBottom: 4 } }, h(Text, { strong: true }, ch.title), h(Text, { type: 'secondary', style: { fontSize: 12 } }, viewed + '/' + total + ' 知识点')),
          h(Progress, { percent: pct, strokeColor: '#2e9e5b' }));
      })),
    suggestions && suggestions.length > 0 && h(Card, { className: 'bio-card', title: '💡 个性化学习建议' },
      suggestions.map((s, i) => h(Alert, { key: i, type: 'info', showIcon: true, message: s, style: { marginBottom: 8 } }))),
    h(Row, { gutter: 16 },
      h(Col, { xs: 24, md: 12 }, h(Card, { className: 'bio-card', title: '📝 最近练习记录' },
        quizRecords.length === 0 ? h(Empty, { description: '暂无练习记录' }) :
          quizRecords.slice(0, 8).map(r => { const ch = BioStore.getChapter(r.chapterId); return h('div', { key: r.id, className: 'exp-data-row' }, h('span', null, h(Tag, { color: 'green' }, ch ? ch.title : '综合'), h('span', { style: { color: '#888', fontSize: 12, marginLeft: 8 } }, new Date(r.time).toLocaleString())), h('span', null, h(Text, { strong: true, style: { color: r.score / r.total >= 0.6 ? '#2e9e5b' : '#f5222d' } }, r.score + '/' + r.total))); }))),
      h(Col, { xs: 24, md: 12 }, h(Card, { className: 'bio-card', title: '🔬 实验报告' },
        reports.length === 0 ? h(Empty, { description: '暂无实验报告' }) :
          reports.map(r => { const exp = BioStore.getExperiment(r.expId); return h('div', { key: r.id, className: 'exp-data-row' }, h('span', null, h(Tag, { color: 'purple' }, '🧪 ' + (exp ? exp.title : '实验')), h('span', { style: { color: '#888', fontSize: 12, marginLeft: 8 } }, new Date(r.time).toLocaleString())), h('span', { style: { fontSize: 12 } }, r.records.length + ' 条数据')); }))))
    )
  );
}

/* ==================== 管理后台 ==================== */
function AdminPage() {
  const { user } = useAuth();
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return h(Card, { className: 'bio-card' },
      h(Result, { status: '403', title: '403', subTitle: '抱歉，您无权访问管理后台，该功能仅对教师和管理员开放。',
        extra: h(Button, { type: 'primary', onClick: () => navigate('/') }, '返回首页') }));
  }
  const stats = BioStore.getStats();
  const users = BioStore.getUsers();
  const [tab, setTab] = useState('overview');
  const [refresh, setRefresh] = useState(0);
  const editUser = (u) => {
    Modal.confirm({
      title: '编辑用户：' + u.name,
      content: h('div', { id: 'user-edit-hint', style: { padding: 12 } }, '将切换该用户角色（学生 ↔ 教师），确认操作？'),
      onOk: () => { const newRole = u.role === 'student' ? 'teacher' : 'student'; if (BioStore.updateUser(user, u.id, { role: newRole })) { message.success('已更新角色'); setRefresh(refresh + 1); } else message.error('无权操作'); }
    });
  };
  const delUser = (u) => {
    Modal.confirm({ title: '删除用户', content: '确认删除用户 ' + u.name + '？此操作不可恢复。', okType: 'danger', onOk: () => { if (BioStore.deleteUser(user, u.id)) { message.success('已删除'); setRefresh(refresh + 1); } else message.error('无权删除'); } });
  };
  const [pwdVisible, setPwdVisible] = useState({});
  const [resetTarget, setResetTarget] = useState(null);
  const [resetForm] = Form.useForm();
  const [resetOpen, setResetOpen] = useState(false);
  const openReset = (u) => { setResetTarget(u); resetForm.resetFields(); setResetOpen(true); };
  const submitReset = () => {
    resetForm.validateFields().then(v => {
      if (BioStore.updateUser(user, resetTarget.id, { password: v.newPassword })) {
        message.success('已重置 ' + resetTarget.name + ' 的密码');
        setResetOpen(false); setRefresh(refresh + 1);
      } else message.error('无权操作');
    });
  };
  return h(Fragment, null,
    h('div', { className: 'section-title' }, '⚙️ 管理后台'),
    h(Card, { className: 'bio-card' },
      h('div', { style: { display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid #f0f0f0' } },
        [{ k: 'overview', l: '📈 数据统计' }, { k: 'users', l: '👥 用户管理' }, { k: 'copyright', l: '© 版权保护' }].map(t => h(Button, { key: t.k, type: tab === t.k ? 'primary' : 'text', onClick: () => setTab(t.k) }, t.l))),
      tab === 'overview' && h(Fragment, null,
        h(Row, { gutter: 16 },
          h(Col, { xs: 12, md: 6 }, h(Card, { size: 'small' }, h(Statistic, { title: '注册用户', value: stats.users, valueStyle: { color: '#2e9e5b' } }))),
          h(Col, { xs: 12, md: 6 }, h(Card, { size: 'small' }, h(Statistic, { title: '知识点', value: stats.knowledgePoints }))),
          h(Col, { xs: 12, md: 6 }, h(Card, { size: 'small' }, h(Statistic, { title: '实验', value: stats.experiments }))),
          h(Col, { xs: 12, md: 6 }, h(Card, { size: 'small' }, h(Statistic, { title: '题目', value: stats.questions })))),
        h(Divider, null, '用户构成'),
        h(Space, { wrap: true },
          h(Tag, { color: 'blue', style: { fontSize: 14, padding: '4px 12px' } }, '学生：' + users.filter(u => u.role === 'student').length),
          h(Tag, { color: 'green', style: { fontSize: 14, padding: '4px 12px' } }, '教师：' + users.filter(u => u.role === 'teacher').length),
          h(Tag, { color: 'red', style: { fontSize: 14, padding: '4px 12px' } }, '管理员：' + users.filter(u => u.role === 'admin').length))),
      tab === 'users' && h(Table, {
        rowKey: 'id', dataSource: users, pagination: { pageSize: 8 }, size: 'small',
        columns: [
          { title: '用户名', dataIndex: 'username', key: 'username' },
          { title: '姓名', dataIndex: 'name', key: 'name' },
          { title: '角色', dataIndex: 'role', key: 'role', render: r => h(RoleTag, { role: r }) },
          { title: '密码', key: 'password', render: (_, u) => user.role === 'admin' ? h(Space, { size: 4 },
            h(Text, { type: 'secondary', style: { fontFamily: 'monospace' } }, pwdVisible[u.id] ? (u.password || '(空)') : '••••••'),
            h(Button, { size: 'small', type: 'link', style: { padding: '0 4px' }, onClick: () => setPwdVisible(Object.assign({}, pwdVisible, { [u.id]: !pwdVisible[u.id] })) }, pwdVisible[u.id] ? '隐藏' : '查看')
          ) : h(Text, { type: 'secondary' }, '—') },
          { title: '注册时间', dataIndex: 'createTime', key: 'time', render: t => new Date(t).toLocaleDateString() },
          { title: '操作', key: 'action', render: (_, u) => h(Space, null,
            u.id !== user.id && u.role !== 'admin' && h(Button, { size: 'small', onClick: () => editUser(u) }, '切换角色'),
            u.id !== user.id && u.role !== 'admin' && h(Button, { size: 'small', type: 'dashed', onClick: () => openReset(u) }, '重置密码'),
            u.id !== user.id && u.role !== 'admin' && h(Popconfirm, { title: '确认删除该用户？', onConfirm: () => delUser(u) }, h(Button, { size: 'small', danger: true }, '删除'))) }
        ]
      }),
      tab === 'copyright' && h(Fragment, null,
        h(Alert, { type: 'success', showIcon: true, message: '教学内容版权保护已启用', description: '本平台所有教学资源（知识点、实验、题库）均受版权保护，仅供注册用户学习使用。', style: { marginBottom: 16 } }),
        h(Card, { size: 'small', title: '版权保护措施' },
          h(List, { size: 'small', dataSource: [
            '所有教学内容标注版权声明，明确署名与使用范围',
            '基于角色权限控制资源访问，未登录用户仅可浏览概览',
            '教学资源禁止未授权转载与商业使用',
            '用户行为可追溯，保障内容安全与教学秩序'
          ], renderItem: (item, i) => h(List.Item, null, h(Text, null, (i + 1) + '. ' + item)) })),
        h(Card, { size: 'small', title: '内容安全策略', style: { marginTop: 12 } },
          h(List, { size: 'small', dataSource: [
            '讨论区发帖需登录，支持教师/管理员审核与删除违规内容',
            '管理后台仅对教师与管理员开放，分级权限管理',
            '敏感操作（删除用户/帖子）需二次确认，防止误操作',
            '用户数据存储于本地，演示环境隔离，保障数据安全'
          ], renderItem: (item, i) => h(List.Item, null, h(Text, null, (i + 1) + '. ' + item)) })))
    ),
    h(Modal, {
      open: resetOpen, title: resetTarget ? ('重置密码：' + resetTarget.name) : '', onOk: submitReset,
      onCancel: () => setResetOpen(false), okText: '确认重置', cancelText: '取消'
    },
      h(Form, { form: resetForm, layout: 'vertical' },
        h(Form.Item, { name: 'newPassword', label: '新密码', rules: [{ required: true, message: '请输入新密码' }, { min: 6, message: '密码至少 6 位' }] },
          h(Input, { placeholder: '请输入新密码（至少 6 位）' })),
        h(Form.Item, { name: 'confirm', label: '确认密码', dependencies: ['newPassword'], rules: [
          { required: true, message: '请再次输入密码' },
          ({ getFieldValue }) => ({ validator(_, v) { return v && v !== getFieldValue('newPassword') ? Promise.reject(new Error('两次输入不一致')) : Promise.resolve(); } })
        ] }, h(Input, { placeholder: '请再次输入新密码' }))))
  );
}

/* ==================== 路由分发 & 根渲染 ==================== */
function RouteView() {
  const { path } = useRouter();
  const seg = '/' + (path.split('/')[1] || '');
  switch (seg) {
    case '/': return h(HomePage);
    case '/knowledge': return h(KnowledgePage);
    case '/experiments': return h(ExperimentsPage);
    case '/quiz': return h(QuizPage);
    case '/discussion': return h(DiscussionPage);
    case '/progress': return h(ProgressPage);
    case '/admin': return h(AdminPage);
    default: return h(Card, { className: 'bio-card' }, h(Result, { status: '404', title: '404', subTitle: '页面不存在', extra: h(Button, { type: 'primary', onClick: () => navigate('/') }, '返回首页') }));
  }
}

const themeConfig = {
  token: {
    colorPrimary: '#2e9e5b',
    colorSuccess: '#52c41a',
    colorLink: '#2e9e5b',
    borderRadius: 8,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
  }
};

function Root() {
  const cfg = { theme: themeConfig };
  if (antd.locale && antd.locale.zh_CN) cfg.locale = antd.locale.zh_CN;
  return h(ConfigProvider, cfg,
    h(AntApp, null,
      h(AuthProvider, null,
        h(RouterProvider, null,
          h(AppLayout, null, h(RouteView, null))
        )
      )
    )
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(h(Root));