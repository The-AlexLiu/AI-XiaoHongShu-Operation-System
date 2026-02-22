# Netflix Meta-Scraper & Content Engine (全自动 Netflix 内容生成引擎)

<img width="3012" height="4075" alt="项目预览图" src="https://github.com/user-attachments/assets/8fafad4f-a7c5-41a7-871a-5874411b772c" />

## 🚀 项目简介

**Netflix Meta-Scraper** 是专为自媒体创作者（小红书/Instagram）打造的全栈内容自动化工具。它将数据采集、视觉设计、AI 文案创作无缝整合，能够在几秒钟内生成高质量的“Netflix 本周新片”图文素材，助你轻松打造爆款内容。

## ✨ 核心功能

- **🔍 智能采集引擎**: 自动抓取 Netflix 官网“最新上映”数据，支持精确的日期范围筛选（从第1页到第N页全量扫描）。
- **🎨 动态封面生成**: 自动生成 1242x1656px 高清竖版封面，内置“收视冠军”主题设计，实时渲染上映日期范围。
- **🤖 AI 文案创作**: 集成 GPT-4o-mini，自动撰写 emoji 丰富、语气热情的小红书风格文案（包含动态标题和标准化 Tag）。
- **📦 一键素材打包**: 告别繁琐操作，一键下载 `Title_Page.jpg`（封面）+ 所有高清电影海报，自动剔除无关文件。
- **⚡️ 极客交互界面**: 基于 React + Vite + Tailwind CSS 打造的电影级深色 UI，提供实时日志反馈和流畅的交互体验。

## 🛠️ 技术栈

- **后端**: Python 3.9+, FastAPI, Playwright (Async), OpenAI API
- **前端**: React 18, Vite, Tailwind CSS, Framer Motion
- **图像处理**: Pillow (PIL), Playwright Screenshot Strategy

## 📦 安装指南

### 前置要求

- Python 3.9+
- Node.js 16+
- Google Chrome 浏览器 (用于 Playwright 渲染)

### 1. 克隆仓库

```bash
git clone https://github.com/The-AlexLiu/netflix-meta-scraper.git
cd netflix-meta-scraper
```

### 2. 后端配置

```bash
# 安装 Python 依赖
pip install -r requirements.txt

# 安装 Playwright 浏览器内核
playwright install chromium
```

### 3. 前端配置

```bash
cd frontend
npm install
```

### 4. 环境变量 (.env)

在项目根目录创建 `.env` 文件，填入你的 OpenAI Key：

```ini
OPENAI_API_KEY=sk-your-api-key-here
```

## 🚀 使用说明

### 启动项目

1. **启动后端服务** (在根目录):
   ```bash
   python app.py
   ```
2. **启动前端界面** (在 frontend 目录):
   ```bash
   cd frontend
   npm run dev
   ```
3. 打开浏览器访问: `http://localhost:5173`

### 操作流程

1. **选择日期**: 设置你想抓取的时间段（例如：2月11日 - 2月15日）。
2. **点击 INITIATE**: 系统将自动开始爬取数据、下载海报、并生成封面。
3. **生成 AI 文案**: 抓取完成后，点击 `Generate Note` 获取 AI 撰写的小红书文案。
4. **一键下载**: 点击 `Download All Assets`，获得包含封面和所有海报的纯净压缩包。

## 📂 项目结构

```
.
├── app.py                 # FastAPI 后端核心 & API 接口
├── netflix_scraper.py     # Playwright 爬虫脚本
├── title_generator/       # 动态封面生成器模块
├── images/                # 图片素材缓存目录
├── frontend/              # React + Vite 前端源码
│   ├── src/
│   │   ├── App.jsx        # 主 UI 逻辑
│   │   └── index.css      # Tailwind & 全局样式
│   └── vite.config.js     # 前端配置 (含 API 代理)
└── requirements.txt       # Python 依赖列表
```

## 📝 开源协议

MIT License. 仅供学习与研究使用。

---

_Built with ❤️ for Creators._
