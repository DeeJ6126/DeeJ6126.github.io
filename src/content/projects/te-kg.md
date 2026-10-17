---
title: TE-Dee： 转座元件数据探索引擎
order: 1
year: 2026
status: 持续开发
summary: 面向人类转座元件的一体化数据探索平台，将分类、序列、基因组注释、文献关系、表达、共表达与 eQTL 证据组织为可浏览、可追溯的研究工作流。
cover: /img/projects/te-kg/logo.svg
background: 转座元件研究所需的信息分散在分类数据库、参考序列、基因组注释、表达数据和大量文献中，数据粒度与证据含义也不相同。TE-Dee 通过统一实体、保留来源与证据边界，把这些互补信息连接成适合检索、比较、图谱探索和问题驱动分析的数据平台。
process:
  - title: 多源数据整合
    description: 汇集 Repbase、RepeatMasker、表达数据、GTEx eQTL 与人工核验的文献关系，并保留各数据层的来源和语义。
  - title: 实体与证据建模
    description: 统一转座元件及相关生物医学实体，分别组织分类、知识关系、共表达和 eQTL 证据，避免把相关性误写为因果关系。
  - title: 交互式研究工作流
    description: 围绕 Browse、Graph、Path、Expression 和 Download 构建从目录检索到关系追踪、表达比较与结果导出的连续工作流。
  - title: 证据约束智能问答
    description: Agent 与 DeepThink 通过共享插件系统检索站内数据和文献证据，在可追溯结果基础上组织回答。
outcomes:
  - title: 知识图谱
    caption: 在 Knowledge Graph、TE-Gene Graph 与 Integrated Graph 之间切换，同时保留文献关系、共表达和 eQTL 的独立语义。此图为典型的知识图谱
    image: /img/projects/te-kg/graph.png
technologies:
  - PHP
  - JavaScript
  - Neo4j
  - MySQL
  - AntV G6
  - Python
  - DeepSeek API
links:
  - label: 在线访问
    url: https://bis.zju.edu.cn/tedee/
  - label: GitHub
    url: https://github.com/DeeJ6126/TE-Dee
accent: blue
---

TE-Dee（Transposable Element Data Exploration Engine）是一个面向人类转座元件研究的数据探索平台。它不是把多个数据源简单堆在同一页面，而是围绕“一个 TE 能查到什么、它与哪些实体相关、证据来自哪里、在不同生物环境中如何表达”组织连续的研究路径。

## 核心能力

- **Browse**：从 Repbase 与 RepeatMasker 整合目录检索 TE，查看分类、序列、基因组位置和相关注释。
- **Graph**：分别探索文献知识图谱、TE-Gene 共表达与 eQTL 图谱，并在整合模式中保留同一实体的多来源信息和平行关系。
- **Path**：寻找实体之间的关联路径，点击具体关系即可查看支持该关系的文献证据。
- **Expression**：比较 TE 在正常组织、正常细胞系和癌细胞系中的表达，查看共表达网络并对选定基因进行 GO 与 KEGG 富集。
- **Agent 与 DeepThink**：通过共享插件系统检索站内数据和文献，在证据约束下回答复杂问题。
- **Download**：提供可复用的数据文件、处理结果和必要的来源说明。

## 数据与证据边界

平台同时使用分类、序列、基因组位置、文献关系、表达、共表达和 eQTL 数据，但不会把这些证据混为一谈。文献关系保留 PMID 等来源；共表达表示统计相关而非调控或因果；eQTL 表示特定组织背景下的遗传关联。图谱整合的目标是让不同证据可以共同探索，同时仍能辨认其来源和含义。

## 项目意义

TE-Dee 希望减少研究者在多个数据库、表格和文献之间反复切换的成本。用户可以从一个转座元件出发，连续完成分类核对、序列与位置查看、关联实体探索、路径追踪、表达比较、功能富集和证据问答，并将结果导出用于后续分析。

项目目前已部署为可访问的网站，并持续完善数据覆盖、交互体验和科学文档。
