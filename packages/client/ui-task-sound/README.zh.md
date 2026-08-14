# @deepseek-ai/dsh-client-ui-task-sound

[English](README.md) | 中文

Web 端任务完成提示音插件：会话任务完成时播放提示音，并提供一个设置分区用于启用、自定义音频地址与调节音量。node 半区注册持久的 `ui-task-sound` 设置命名空间；浏览器半区观察会话列表，并通过注入的音频 sink 播放。

完成触发点是每个会话（无论是否选中）的 running→idle 边沿：`CompletionEdgeTracker` 折叠每份 `ctx.sessions.list` 快照，记录每个会话首次观察到的运行位，并恰好上报一次转换。加载时已空闲的会话永不触发；会话移除会丢弃其跟踪位；复用同一 id 的新会话从零开始。监听器随列表 store 的订阅挂载，并随 apply fiber 一起释放，因此 HMR 移除后不会留下边沿观察者。

播放默认使用 Web Audio 合成的双音提示音（E5 后接 C5，正弦振荡器加柔和包络），因此产品无需附带任何音频资源。配置了 URL 时改由 `new Audio(url)` 播放，并遵循同一音量。`enabled: false` 时两条路径都被抑制。设置行是 `settings.section` 条目：启用复选框写 `enabled`，URL 输入框在失焦时提交，音量滑块写入 0..1 的数字。所有写入都经由设置 scope 落盘到 Host 文档（默认 `$DSH_HOME/settings.yaml`），行组件从 scope 快照重新渲染。

## Model Experience

无——本包为人播放音频，不接触任何提示词、消息、schema、流或工具结果。

#### KV Cache effect

无——本包从不组装或发送 provider 请求。

## Known Limitations and Deferred Work

- **默认提示音是合成的，而非随附资源** —— Web Audio 音调仅在页面聚焦时播放；后台标签页可能延迟其上下文。自定义 URL 通过元素播放，受浏览器自动播放策略约束，因此新加载后的第一次完成可能被阻止，直到用户与页面交互。
- **提示音按完成边沿触发，而非按用户可见的回合** —— 一个完成多回合（多步任务）的会话在其 agent 停止运行时播放一次，与侧栏自身的完成信号一致，而非逐回合计数。
