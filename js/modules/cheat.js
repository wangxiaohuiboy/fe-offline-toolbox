/* 速查表：CSS 技巧 / Git / npm / HTTP 状态码 / keyCode（纯静态离线数据） */
DK.registerTool({
  id: 'cheat',
  name: '速查表',
  icon: '查',
  desc: 'CSS 技巧 · Git · npm · HTTP 状态码 · keyCode 离线速查',
  render(body) {
    const { h } = DK;

    const DATA = {
      'CSS 技巧': [
        ['display:flex;justify-content:center;align-items:center', '水平垂直居中'],
        ['overflow:hidden;text-overflow:ellipsis;white-space:nowrap', '单行省略'],
        ['display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden', '多行省略(2行)'],
        ['.clearfix::after{content:"";display:block;clear:both}', '清除浮动'],
        ['-webkit-line-clamp 配合 box-orient', '多行文本截断'],
        ['width:1px;transform:scaleY(.5)', 'Retina 1px 边框'],
        ['scrollbar-width:none; & ::-webkit-scrollbar{display:none}', '隐藏滚动条'],
        ['aspect-ratio:16/9', '宽高比'],
        ['object-fit:cover', '图片填充裁剪'],
        ['position:sticky;top:0', '吸顶'],
        ['gap:12px', 'flex/grid 间距(替代 margin)'],
        ['input::placeholder{color:#999}', '占位符样式'],
        ['user-select:none', '禁止选中'],
        ['touch-action:pan-y', '禁止横向手势'],
        ['@media (prefers-color-scheme:dark){...}', '跟随系统暗黑模式']
      ],
      'Git': [
        ['git checkout -b feature/xxx', '新建并切换分支'],
        ['git pull --rebase origin master', '变基拉取(减少 merge)'],
        ['git stash / git stash pop', '暂存/恢复工作区'],
        ['git cherry-pick <commit>', '摘取单个提交'],
        ['git log --oneline --graph -20', '简洁图形日志'],
        ['git reset --soft HEAD^', '撤销上次 commit(保留改动)'],
        ['git revert <commit>', '安全回滚某次提交'],
        ['git remote -v', '查看远程仓库'],
        ['git diff --staged', '查看已暂存差异'],
        ['git branch -d <name>', '删除本地分支'],
        ['git push origin --delete <name>', '删除远程分支'],
        ['git blame -L 10,20 file.js', '查看行级修改人']
      ],
      'npm / pnpm': [
        ['npm run dev', '启动开发服务'],
        ['npm ci', '按 lock 精确安装(CI 用)'],
        ['npm ls <pkg>', '查看依赖版本树'],
        ['npm outdated', '检查过时依赖'],
        ['npm view <pkg> versions', '查看包所有版本'],
        ['npm cache clean --force', '清缓存'],
        ['npx <pkg>', '临时执行包命令'],
        ['pnpm store path', 'pnpm 存储位置'],
        ['pnpm add -D <pkg>', '安装开发依赖'],
        ['npm config set registry <url>', '切换内网镜像源']
      ],
      'HTTP 状态码': [
        ['200 OK', '请求成功'],
        ['201 Created', '创建成功'],
        ['204 No Content', '成功但无返回体'],
        ['301 / 302', '永久/临时重定向'],
        ['304 Not Modified', '协商缓存命中'],
        ['400 Bad Request', '参数错误'],
        ['401 Unauthorized', '未登录/令牌失效'],
        ['403 Forbidden', '无权限'],
        ['404 Not Found', '资源不存在'],
        ['429 Too Many Requests', '请求过于频繁'],
        ['500 Internal Server Error', '服务端异常'],
        ['502 / 504', '网关错误/网关超时']
      ],
      'keyCode': [
        ['13 Enter', '回车'],
        ['27 Escape', 'Esc 关闭弹窗'],
        ['32 Space', '空格'],
        ['37/38/39/40', '← ↑ → ↓'],
        ['8 Backspace', '退格'],
        ['46 Delete', '删除'],
        ['65-90 A-Z', '字母键(65=A)'],
        ['48-57 0-9', '数字键(48=0)'],
        ['112-123 F1-F12', '功能键'],
        ['ctrlKey/metaKey', 'Ctrl / Command 判断']
      ]
    };

    let currentTab = 'CSS 技巧';
    const tabs = h('div', { class: 'row' });
    const listBox = h('div', { class: 'cheat-grid' });
    const searchIn = h('input', { class: 'ti', placeholder: '搜索…' });

    function renderList() {
      listBox.innerHTML = '';
      const f = (searchIn.value || '').trim().toLowerCase();
      DATA[currentTab].forEach(([code, desc]) => {
        if (f && !(code + desc).toLowerCase().includes(f)) return;
        listBox.appendChild(h('div', { class: 'cheat-item', title: '点击复制', onclick: () => DK.copy(code).then(() => DK.toast('已复制')) }, [
          h('code', { text: code }),
          h('span', { class: 'd', text: desc })
        ]));
      });
    }
    function renderTabs() {
      tabs.innerHTML = '';
      Object.keys(DATA).forEach(name => {
        tabs.appendChild(h('button', { class: 'btn' + (name === currentTab ? ' primary' : ''), text: name, onclick: () => { currentTab = name; renderTabs(); renderList(); } }));
      });
    }
    searchIn.addEventListener('input', DK.debounce(renderList, 120));

    body.appendChild(searchIn);
    body.appendChild(tabs);
    body.appendChild(h('div', { style: { height: '8px' } }));
    body.appendChild(listBox);
    renderTabs();
    renderList();
  }
});
