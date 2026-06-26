# AI 小红书内容运营系统

**AI-assisted Xiaohongshu Content Operation System**

这是一个面向小红书内容创作者 / 内容运营者的 AI 辅助内容运营系统，覆盖 **内容选题、素材整理、视觉资产生成、AI 文案创作、发布素材打包与运营流程自动化**。

当前项目以「影视资讯内容号」作为第一个 Demo 场景：系统可以整理公开内容源中的片名、日期和海报信息，生成小红书竖版封面，调用 AI 生成图文文案，并将发布前所需素材一键打包，辅助完成从选题到发布前准备的内容生产流程。

---

## 项目背景与边界

该项目并非单纯的技术 Demo，而是基于一个真实运营过的小红书内容账号沉淀而来。

在实际运营过程中，该账号实现：

- 小红书粉丝数突破 5,000；
- 内容持续获得自然流量
- 跑通从内容生产、发布到用户增长的完整流程
- 完成过商业化路径验证

这个案例也暴露了平台内容项目里最容易被忽视的问题：内容版权、素材来源、平台规则和账号风险必须在流程设计阶段就被纳入，而不能等账号做起来后再补。

因此，这个项目的核心价值不只是“自动生成内容”，而是沉淀一套可迁移的内容运营流程：

```text
内容源选择
↓
素材采集
↓
封面生成
↓
AI 文案创作
↓
发布素材整理
↓
账号增长
↓
商业化验证
↓
合规与风险复盘
```

![效果预览图](https://github.com/user-attachments/assets/acfa83b8-5e88-48c9-b375-3155026b6df9)

---

## 项目界面

<img width="3012" height="4075" alt="项目预览图" src="https://github.com/user-attachments/assets/8fafad4f-a7c5-41a7-871a-5874411b772c" />

---

## 为什么做这个项目

内容运营中有大量重复、繁琐但又必须完成的工作：

- 寻找稳定的内容选题
- 采集内容源和基础信息
- 整理图片、标题、发布时间等素材
- 设计封面和图文结构
- 撰写符合平台语境的内容文案
- 将素材整理成可直接发布的内容包
- 周期性重复以上流程

对内容账号来说，真正影响效率的往往不只是“想不到内容”，而是整个内容生产流程不够稳定、不够系统。

所以这个项目想解决的问题是：

> 如何用 AI 和自动化工具，把分散的内容运营动作，整理成一个可重复执行的内容生产系统。

---

## 项目简介

这个系统目前聚焦在影视资讯类内容场景。

传统流程中，运营者需要手动查看内容源、整理片名和上映日期、处理海报素材、设计封面、撰写小红书文案、打包图片素材。

该项目将这一整套流程自动化：

```text
内容源采集
↓
日期范围筛选
↓
标题 / 海报 / 上映信息提取
↓
小红书竖版封面生成
↓
AI 小红书文案生成
↓
发布素材一键打包
↓
发布前准备
```

这个项目的重点不是单纯做一个爬虫工具，而是尝试搭建一个 **AI 辅助内容运营工作流**。未来这套流程可以迁移到更多内容场景，例如热点榜单、产品推荐、品牌内容号、活动内容号等。

使用这类流程时，需要提前确认内容源授权、平台规则、素材版权和账号定位，不能把自动化能力当成绕过合规判断的工具。

---

## 核心功能

### 1. 内容源自动采集

系统自动整理影视资讯内容，并支持按日期范围进行筛选。

它会扫描多页内容，提取片名、上映日期、海报图片等信息，为后续封面生成和文案创作提供基础素材。

---

### 2. 小红书竖版封面生成

系统会自动生成适合小红书图文发布的竖版封面。

当前输出尺寸为：

```text
1242 × 1656 px
```

封面模板中包含动态日期范围、内容标题和「本周新片 / 收视冠军」等视觉结构，用于降低人工设计成本。

---

### 3. AI 小红书文案创作

系统集成 GPT-4o-mini，可自动生成更贴近小红书语境的图文文案。

文案内容包含：

- 小红书风格标题
- Emoji 表达
- 热情、口语化的推荐语气
- 标准化话题标签
- 适合图文发布的内容结构

---

### 4. 一键素材打包

系统可以将发布前需要的素材自动整理并打包下载。

素材包包括：

```text
Title_Page.jpg
影视海报图片
AI 生成文案
发布前所需素材
```

这一步可以减少内容发布前反复整理图片、命名文件、复制文案的时间成本。

---

### 5. 可视化操作界面

前端基于 React + Vite + Tailwind CSS + Framer Motion 构建。

界面支持：

- 日期范围选择
- 实时运行日志
- AI 文案生成
- 素材一键下载
- 深色模式视觉界面

---

## 技术栈

### 后端

- Python 3.9+
- FastAPI
- Playwright Async
- OpenAI API

### 前端

- React 18
- Vite
- Tailwind CSS
- Framer Motion

### 图像处理

- Pillow
- Playwright Screenshot Strategy

---

## 安装指南

### 前置要求

- Python 3.9+
- Node.js 16+
- Google Chrome / Chromium

### 1. 克隆仓库

```bash
git clone https://github.com/The-AlexLiu/AI-XiaoHongShu-Operation-System.git
cd AI-XiaoHongShu-Operation-System
```

### 2. 后端配置

```bash
pip install -r requirements.txt
playwright install chromium
```

### 3. 前端配置

```bash
cd frontend
npm install
```

### 4. 环境变量配置

在项目根目录创建 `.env` 文件，并填入 OpenAI API Key：

```ini
OPENAI_API_KEY=sk-your-api-key-here
```

---

## 使用说明

### 1. 启动后端服务

在项目根目录运行：

```bash
python app.py
```

### 2. 启动前端界面

在 `frontend` 目录下运行：

```bash
cd frontend
npm run dev
```

### 3. 打开项目

在浏览器访问：

```text
http://localhost:5173
```

### 4. 操作流程

```text
1. 选择日期范围
2. 点击 INITIATE
3. 等待系统完成内容采集与素材生成
4. 点击 Generate Note 生成小红书文案
5. 点击 Download All Assets 导出发布素材包
```

---

## 项目结构

```text
.
├── app.py                 # FastAPI 后端核心与 API 接口
├── netflix_scraper.py     # 当前 Demo 场景下的 Netflix 内容源采集模块
├── title_generator/       # 动态封面生成模块
├── images/                # 图片素材缓存目录
├── frontend/              # React + Vite 前端源码
│   ├── src/
│   │   ├── App.jsx        # 主 UI 逻辑
│   │   └── index.css      # Tailwind 与全局样式
│   └── vite.config.js     # 前端配置与 API 代理
└── requirements.txt       # Python 依赖列表
```

> 说明：当前版本以 Netflix 新片内容作为第一个 Demo 内容源，因此部分历史文件名中仍保留 `netflix` 命名。后续会逐步将相关模块重命名为更通用的内容源采集模块。

---

## 开源协议

MIT License.  
仅供学习、研究与作品集展示使用。

---

Built with ❤️ for creators, operators, and AI-assisted content workflows.
