---
title: '让公式与流程图，成为解释的一部分'
description: '从一行公式到一张流程图，演示 KaTeX 与 Mermaid 在长文里的自然衔接。'
slug: 'math-and-diagrams'
pubDate: '2026-09-21'
category: 'technology'
tags: ['数学', 'Mermaid']
featured: false
lang: 'zh-CN'
---

这是一篇功能演示，包含行内公式、块级公式以及按需加载的 Mermaid 图表。

## 一行公式，有时胜过一段话

设输入为 $x$，线性模型可以写成 $y = wx + b$。行内公式应该与文字保持自然的基线，而不是打断阅读。

对于一组样本，可以用均方误差描述预测与真实值之间的距离：

$$
L(w,b) = \frac{1}{n}\sum_{i=1}^{n}\left(y_i - (wx_i+b)\right)^2
$$

公式在构建阶段排版，不需要等待客户端计算。

## 把发布流程画出来

下面的图表只在接近可视区域时加载渲染器。关闭 JavaScript 时，仍然保留可读的源码。

```mermaid
flowchart LR
  A[写作 Markdown] --> B[内容校验]
  B --> C[静态页面]
  C --> D[搜索索引]
  D --> E[Cloudflare Pages]
```

### 主题切换

图表与页面共用明暗模式。浅色环境采用柔和底色，深色环境保持文字与连接线的可辨识度。

## 图表也需要克制

当一段简单的文字已经足够，就不必再画图。当关系比顺序更重要时，图表才真正有帮助。
