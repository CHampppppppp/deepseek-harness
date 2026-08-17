# Agent Note: task-sound 设置分区从未暴露，写入被静默回退

Status: implemented

[English](2026-08-16-task-sound-not-exposed.md) | 中文

## 问题

Web 任务完成提示音的设置行里，音量滑块看上去是坏的：拖动之后，下一次渲染就弹回 50%，任何地方都没有报错。启用开关和自定义 URL 也同样无法持久化--只是音量最显眼，因为滑块是唯一一个每次拖动都从 scope 快照渲染取值的控件。

写入路径本身端到端是完好的。设置行经 settings scope 写入，`settings.mutate` 以展开合并应用单字段 `set` op，schemastery 默认值只填补缺失的键，沿途没有任何环节会丢弃一次只更新 `volume` 的写入。失败发生在更早一跳：`ui-task-sound` 已由插件的 node 半区注册为持久设置命名空间，却从未加入 `dsh-apiproxy` 的配置客户端 allowlist，于是 `settings.mutate` 回答 `settings-not-exposed`，`settings.describe` 也略去该命名空间。客户端 scope 把失败的写视为"重新读取并收敛"：重读找不到视图，快照转为 `unavailable`，设置行回落到硬编码默认值--静默回退而非拒绝。手写进 `settings.yaml` 的值同样到不了页面，原因相同。

这正是该 allowlist 的 `agent-presets` 记录已经点名的失败模式：向边界之外的命名空间写入的浏览器界面"先动、然后静默忘记，比拒绝这个控件更糟"。提示音功能带着这个缺陷上线，是因为暴露决策--apiproxy 注释写明它属于 allowlist 而非注册方插件--从未随功能一并做出。

## 决策

`ui-task-sound` 加入 `dsh-apiproxy` 的 `WEB_SETTINGS_NAMESPACES`，设置行的写入由此持久化到 Host 设置文档，读取也能解析。暴露本身即修复；插件、scope 和 settings seam 均无需改动。

与此同时，音量滑块增加了试听：每次变化按拖动到的音量播放一次提示音，用户由此听到该音量的实际效果，而不必从百分比推断。试听经由设置分区的 inject face（`preview(settings)`）传递，使用与完成信号相同的 sink 和同一个 `playChime`，并仅在试听调用时强制 `enabled: true`--用户问的是"30% 有多响"，不是在武装完成提示音；若试听受总开关抑制而保持静音，将无法区分 0% 与开关关闭这两种情况。持久化的 `enabled` 值不受影响。

## 备选方案

- **在 UI 中上报失败的写入。** 总体上值得做，但那只是包装症状：正确的状态是写入持久化，而不是产品自己渲染的控件得到一个可见的拒绝。
- **让 `settings.register()` 声明暴露。** apiproxy 注释已将此事押后：暴露是 proxy 持有的配置边界决策，按插件下放是比本次修复更大的改动。
- **通过 scope 订阅（类似 `volumechange`）触发试听。** 试听必须在拖动手势发生时以拖动值发声，而不是等 Host 往返落地--scope 快照可能晚若干帧到达，或者（如本 bug 所示）根本不到；订阅也无法区分用户的拖动与其他写方。inject face 回调把手势、取值和 sink 收在同一个位置。
- **试听遵守 `enabled: false`。** 如上拒绝：试听回答"这有多响"，静音在"轻"与"关"之间存在歧义。

## 后果

task-sound 设置行像其他 Web 偏好一样从 Host 文档持久化并重渲染；拖动音量时按该音量试听一次。为 Web 设置页新增设置分区的插件，仍需在同一改动中把命名空间加入 apiproxy allowlist--scope 恢复路径的设计使该失败模式保持静默，因此新分区的清单是：注册命名空间、暴露它、用一个测试覆盖往返。

试听的已知代价是连续拖过多档时重复播放（每个 `change` 触发一次）；每档 220ms 的合成音正是预期的"刮擦"手感，自定义 URL 路径则与完成提示音一样受浏览器自动播放策略约束。

## 测试

`api-proxy-config.spec.ts` 以 `ui-task-sound` 的 `settings.mutate` 往返钉住暴露，该测试在 allowlist 改动之前以 `settings-not-exposed` 失败。设置行 spec 钉住拖动时预览回调收到 `{ ...settings, volume }`；apply spec 钉住注入的 `preview` 在总开关关闭时仍经 sink 播放。其余包测试不变通过。
