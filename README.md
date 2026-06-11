# 旋蒸回调

这是一个本地运行的静态 Web App，用来替代旋蒸后酒精度调整时的手算。

支持 3 种常用模式：

- `加水降度`：算要补多少水
- `升度补酒`：算要加多少高酒度酒液
- `守恒换算`：只按纯酒精守恒算理论目标总量

## 直接打开

直接打开 [index.html](</Users/heyi/Documents/New project/rotovap-abv-app/index.html>) 即可。

如果你想测试安装 App 和离线缓存，推荐在这个目录运行：

```bash
python3 -m http.server 4174
```

然后访问 [http://localhost:4174](http://localhost:4174)。

## 文件说明

- [index.html](</Users/heyi/Documents/New project/rotovap-abv-app/index.html>)：页面结构
- [styles.css](</Users/heyi/Documents/New project/rotovap-abv-app/styles.css>)：样式和响应式布局
- [app.js](</Users/heyi/Documents/New project/rotovap-abv-app/app.js>)：计算逻辑、本地保存、历史记录
- [manifest.webmanifest](</Users/heyi/Documents/New project/rotovap-abv-app/manifest.webmanifest>)：PWA 配置
- [sw.js](</Users/heyi/Documents/New project/rotovap-abv-app/sw.js>)：离线缓存

## 计算说明

这个 App 使用的是体积分数近似计算，默认按“纯酒精量守恒”处理：

- 纯酒精量 = 当前体积 × 当前酒精度
- 目标总体积 = 纯酒精量 ÷ 目标酒精度
- 升度补酒会额外考虑补入酒液带来的体积变化

日常批次回调足够快，但如果你对最终数值要求特别严，建议最后还是以密度计或实测为准。
