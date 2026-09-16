/* 设置：自定义词库 / 内网翻译接口 / 划词开关 / 数据导入导出 */
DK.registerTool({
  id: 'settings',
  name: '设置',
  icon: '⚙',
  desc: '自定义词库 · 内网翻译接口 · 划词翻译 · 数据导入导出',

  async preload() {
    const lines = await DK.store.get('dkCustomDict', '');
    DKTranslate.setCustomDict(lines);
  },

  render(body) {
    const { h } = DK;

    // ---- 划词翻译开关 ----
    const floatChk = h('input', { type: 'checkbox' });
    DK.store.get('dkFloatEnabled', true).then(v => { floatChk.checked = v !== false; });
    floatChk.addEventListener('change', () => DK.store.set('dkFloatEnabled', floatChk.checked));

    body.appendChild(h('div', { class: 'set-block' }, [
      h('h3', { text: '划词翻译' }),
      h('div', { class: 'desc', text: '在网页中选中文字后显示「译」按钮，点击查看离线词典翻译。关闭后仍可通过右键菜单使用。' }),
      h('div', { class: 'switch-row' }, [
        h('label', { class: 'switch' }, [floatChk, h('span', { class: 'track' }), h('span', { class: 'thumb' })]),
        h('span', { class: 'muted', text: '选中文字时显示翻译按钮' })
      ])
    ]));

    // ---- 自定义词库 ----
    const dictTa = h('textarea', { class: 'ta', style: { minHeight: '120px' }, placeholder: '每行一条：中文=英文1,英文2\n例如：\n结算中心=settlement center\n数据大盘=data dashboard' });
    DK.store.get('dkCustomDict', '').then(v => { dictTa.value = v || ''; });
    const saveDict = async () => {
      await DK.store.set('dkCustomDict', dictTa.value);
      DKTranslate.setCustomDict(dictTa.value);
      DK.toast('自定义词库已生效');
    };
    body.appendChild(h('div', { class: 'set-block' }, [
      h('h3', { text: '自定义词库' }),
      h('div', { class: 'desc', text: '团队专属术语放这里，翻译与「中文转变量名」都会优先使用。每行一条，格式：中文=英文1,英文2' }),
      dictTa,
      h('div', { class: 'row', style: { marginTop: '8px' } }, [
        h('button', { class: 'btn primary', text: '保存词库', onclick: saveDict }),
        h('button', { class: 'btn', text: '导出词库', onclick: () => DK.download('dk-dict.txt', dictTa.value) }),
        h('button', { class: 'btn', text: '导入词库', onclick: () => {
          const inp = document.createElement('input');
          inp.type = 'file'; inp.accept = '.txt,.json';
          inp.onchange = () => {
            const f = inp.files[0]; if (!f) return;
            const r = new FileReader();
            r.onload = () => { dictTa.value = (dictTa.value ? dictTa.value.trimEnd() + '\n' : '') + String(r.result).trim(); DK.toast('已载入，请点击保存'); };
            r.readAsText(f);
          };
          inp.click();
        } })
      ])
    ]));

    // ---- 内网翻译接口 ----
    const apiUrl = h('input', { class: 'ti', placeholder: '接口地址，如：http://translate.corp.internal/api/translate' });
    const apiMethod = h('select', { class: 'sel' }, [h('option', { value: 'GET', text: 'GET' }), h('option', { value: 'POST', text: 'POST' })]);
    const apiParam = h('input', { class: 'ti', style: { width: '120px' }, placeholder: '文本参数名', value: 'q' });
    const apiPath = h('input', { class: 'ti', style: { width: '150px' }, placeholder: '响应字段路径', value: 'data' });
    const apiHeaders = h('input', { class: 'ti', style: { fontFamily: 'var(--mono)' }, placeholder: '额外请求头 JSON，如：{"Authorization":"Bearer xxx"}' });

    DK.store.get('dkApi', null).then(cfg => {
      if (!cfg) return;
      apiUrl.value = cfg.url || '';
      apiMethod.value = cfg.method || 'GET';
      apiParam.value = cfg.qParam || 'q';
      apiPath.value = cfg.respPath || 'data';
      apiHeaders.value = cfg.headers ? JSON.stringify(cfg.headers) : '';
    });

    const saveApi = async () => {
      if (!apiUrl.value.trim()) { await DK.store.set('dkApi', null); DK.toast('已清除接口配置'); return; }
      let headers = {};
      if (apiHeaders.value.trim()) {
        try { headers = JSON.parse(apiHeaders.value); }
        catch (e) { DK.toast('请求头不是合法 JSON', 'err'); return; }
      }
      await DK.store.set('dkApi', {
        url: apiUrl.value.trim(), method: apiMethod.value,
        qParam: apiParam.value.trim() || 'q', respPath: apiPath.value.trim() || 'data', headers
      });
      DK.toast('接口配置已保存');
      // 内网接口按需申请主机权限（MV3 要求）
      try {
        const origin = new URL(apiUrl.value.trim()).origin + '/*';
        chrome.permissions.request({ origins: [origin] }, granted => {
          if (granted) DK.toast('已授权访问该内网地址');
          else DK.toast('未授权主机权限，请求可能被拦截', 'err');
        });
      } catch (e) { /* ignore */ }
    };

    body.appendChild(h('div', { class: 'set-block' }, [
      h('h3', { text: '内网翻译接口（可选）' }),
      h('div', { class: 'desc', text: '若公司内网有自建翻译服务，在此配置后，「翻译」页会出现「接口翻译」按钮。不配置则仅使用离线词典。' }),
      h('div', { class: 'row' }, [apiMethod, apiUrl]),
      h('div', { class: 'row' }, [
        h('label', { text: '参数名' }), apiParam,
        h('label', { text: '响应路径' }), apiPath
      ]),
      h('div', { class: 'row' }, [apiHeaders]),
      h('div', { class: 'row' }, [h('button', { class: 'btn primary', text: '保存接口配置', onclick: saveApi })])
    ]));

    // ---- 数据导入导出 ----
    body.appendChild(h('div', { class: 'set-block' }, [
      h('h3', { text: '配置备份' }),
      h('div', { class: 'desc', text: '将词库与接口配置导出为 JSON，方便团队内分发或换机恢复。' }),
      h('div', { class: 'row' }, [
        h('button', { class: 'btn', text: '导出全部配置', onclick: async () => {
          const data = { dict: await DK.store.get('dkCustomDict', ''), api: await DK.store.get('dkApi', null) };
          DK.download('devkit-config.json', JSON.stringify(data, null, 2), 'application/json');
        } }),
        h('button', { class: 'btn', text: '导入配置', onclick: () => {
          const inp = document.createElement('input');
          inp.type = 'file'; inp.accept = '.json';
          inp.onchange = () => {
            const f = inp.files[0]; if (!f) return;
            const r = new FileReader();
            r.onload = async () => {
              try {
                const data = JSON.parse(String(r.result));
                if (data.dict != null) { await DK.store.set('dkCustomDict', data.dict); dictTa.value = data.dict; DKTranslate.setCustomDict(data.dict); }
                if (data.api) await DK.store.set('dkApi', data.api);
                DK.toast('配置已恢复');
              } catch (e) { DK.toast('文件解析失败', 'err'); }
            };
            r.readAsText(f);
          };
          inp.click();
        } })
      ])
    ]));

    body.appendChild(h('div', { class: 'tip', html:
      '<b>隐私说明</b>：本工具所有词典与计算均在本地完成，除你主动配置的内网接口外，不会向任何外部地址发送数据。' }));
  }
});
